import jwt from 'jsonwebtoken';
import { getRedis } from '../config/redis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { generateId } from '../utils/helpers';
import {
  REDIS_KEYS,
  SEAT_LOCK_DURATION_SEC,
  QUEUE_DRAIN_RATE_DEFAULT,
  QUEUE_HEARTBEAT_TIMEOUT_MS,
  MAX_TICKETS_PER_ORDER,
} from '@stagerush/shared';
import { IQueueEntry, IQueueStats, IBookingToken } from '@stagerush/shared';

/**
 * Virtual Waiting Room - Redis-backed FIFO queue.
 *
 * Uses a Redis Sorted Set with timestamp scores for O(log N) insert
 * and O(1) rank lookup. Supports millions of concurrent queue entries.
 *
 * Flow:
 * 1. User joins queue → ZADD with timestamp score
 * 2. Drain loop pops from front → issues booking tokens
 * 3. WebSocket broadcasts position updates
 */
export class QueueService {
  private redis = getRedis();

  /**
   * Add user to the virtual waiting room.
   * Returns queue position and estimated wait time.
   */
  async joinQueue(eventId: string, userId: string): Promise<IQueueEntry> {
    const key = REDIS_KEYS.QUEUE(eventId);
    const score = Date.now();

    // ZADD NX - only add if not already in queue
    const added = await this.redis.zadd(key, 'NX', score, userId);

    // Get position (0-indexed, so add 1)
    const rank = await this.redis.zrank(key, userId);
    const position = (rank ?? 0) + 1;
    const totalInQueue = await this.redis.zcard(key);

    const drainRate = config.queue.drainRate || QUEUE_DRAIN_RATE_DEFAULT;
    const estimatedWaitSeconds = Math.ceil(position / drainRate);

    const queueToken = jwt.sign(
      { userId, eventId, type: 'queue' },
      config.jwt.secret,
      { expiresIn: '2h' }
    );

    logger.info({ eventId, userId, position, totalInQueue }, 'User joined queue');

    return {
      userId,
      eventId,
      position,
      totalInQueue,
      estimatedWaitSeconds,
      joinedAt: score,
      status: 'waiting',
      queueToken,
    };
  }

  /**
   * Get current queue position for a user.
   */
  async getPosition(eventId: string, userId: string): Promise<IQueueEntry | null> {
    const key = REDIS_KEYS.QUEUE(eventId);
    const rank = await this.redis.zrank(key, userId);

    if (rank === null) {
      // Check if already admitted
      const admitted = await this.redis.sismember(REDIS_KEYS.QUEUE_ADMITTED(eventId), userId);
      if (admitted) {
        return {
          userId, eventId, position: 0, totalInQueue: 0,
          estimatedWaitSeconds: 0, joinedAt: 0, status: 'admitted', queueToken: '',
        };
      }
      return null;
    }

    const totalInQueue = await this.redis.zcard(key);
    const position = rank + 1;
    const drainRate = config.queue.drainRate || QUEUE_DRAIN_RATE_DEFAULT;

    return {
      userId, eventId, position, totalInQueue,
      estimatedWaitSeconds: Math.ceil(position / drainRate),
      joinedAt: 0, status: 'waiting', queueToken: '',
    };
  }

  /**
   * Drain users from the front of the queue and issue booking tokens.
   * Called by the drain worker at a controlled rate.
   * Returns the list of admitted user IDs.
   */
  async drainQueue(eventId: string, count: number): Promise<string[]> {
    const key = REDIS_KEYS.QUEUE(eventId);
    const admittedKey = REDIS_KEYS.QUEUE_ADMITTED(eventId);

    // Pop 'count' users from the front (lowest scores = earliest joiners)
    const users = await this.redis.zpopmin(key, count);

    const admittedUserIds: string[] = [];
    for (let i = 0; i < users.length; i += 2) {
      const userId = users[i];
      admittedUserIds.push(userId);

      // Mark as admitted
      await this.redis.sadd(admittedKey, userId);

      // Issue a time-limited booking token
      const bookingToken = jwt.sign(
        {
          userId,
          eventId,
          type: 'booking',
          maxSeats: MAX_TICKETS_PER_ORDER,
        },
        config.jwt.secret,
        { expiresIn: `${SEAT_LOCK_DURATION_SEC}s` }
      );

      // Store token in Redis for validation
      await this.redis.setex(
        REDIS_KEYS.BOOKING_TOKEN(bookingToken),
        SEAT_LOCK_DURATION_SEC,
        JSON.stringify({ userId, eventId, maxSeats: MAX_TICKETS_PER_ORDER })
      );
    }

    if (admittedUserIds.length > 0) {
      logger.info({ eventId, admitted: admittedUserIds.length }, 'Queue drained');
    }

    return admittedUserIds;
  }

  /**
   * Validate a booking token. Returns the token payload or null.
   */
  async validateBookingToken(token: string): Promise<IBookingToken | null> {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as any;
      if (decoded.type !== 'booking') return null;

      // Verify token still exists in Redis (not expired/revoked)
      const stored = await this.redis.get(REDIS_KEYS.BOOKING_TOKEN(token));
      if (!stored) return null;

      return {
        token,
        eventId: decoded.eventId,
        userId: decoded.userId,
        expiresAt: decoded.exp * 1000,
        maxSeats: decoded.maxSeats,
      };
    } catch {
      return null;
    }
  }

  /**
   * Revoke a booking token (used after successful reservation or expiry).
   */
  async revokeBookingToken(token: string): Promise<void> {
    await this.redis.del(REDIS_KEYS.BOOKING_TOKEN(token));
  }

  /**
   * Get queue statistics for an event.
   */
  async getStats(eventId: string): Promise<IQueueStats> {
    const queueKey = REDIS_KEYS.QUEUE(eventId);
    const admittedKey = REDIS_KEYS.QUEUE_ADMITTED(eventId);

    const [totalInQueue, admittedCount] = await Promise.all([
      this.redis.zcard(queueKey),
      this.redis.scard(admittedKey),
    ]);

    const drainRate = config.queue.drainRate || QUEUE_DRAIN_RATE_DEFAULT;

    return {
      eventId,
      totalInQueue,
      drainRatePerSecond: drainRate,
      estimatedWaitSeconds: Math.ceil(totalInQueue / drainRate),
      admittedCount,
      activeBookings: 0, // Updated by reservation service
    };
  }

  /**
   * Remove user from queue (they left voluntarily).
   */
  async leaveQueue(eventId: string, userId: string): Promise<void> {
    await this.redis.zrem(REDIS_KEYS.QUEUE(eventId), userId);
    logger.info({ eventId, userId }, 'User left queue');
  }
}
