import { QueueService } from './services/queue.service';
import { ReservationService } from './services/reservation.service';
import { EventService } from './services/event.service';
import { emitToQueue, emitToUser } from './services/websocket.service';
import { config } from './config';
import { logger } from './utils/logger';

const queueService = new QueueService();
const reservationService = new ReservationService();
const eventService = new EventService();

/**
 * Queue Drain Worker
 *
 * Runs every second. Pops users from the front of each active event queue
 * at a controlled rate and issues booking tokens via WebSocket.
 */
let drainIntervalId: NodeJS.Timeout;
const activeEventQueues = new Set<string>();

export function startDrainWorker(): void {
  drainIntervalId = setInterval(async () => {
    for (const eventId of activeEventQueues) {
      try {
        const batchSize = Math.ceil(config.queue.drainRate / 1); // per second
        const admitted = await queueService.drainQueue(eventId, batchSize);

        for (const userId of admitted) {
          // Notify the user they've been admitted
          emitToUser(userId, 'queue:admitted', { eventId });
        }

        // Broadcast updated queue stats
        const stats = await queueService.getStats(eventId);
        emitToQueue(eventId, 'queue:stats', stats);
      } catch (err: any) {
        logger.error({ eventId, err: err.message }, 'Queue drain error');
      }
    }
  }, 1000);

  logger.info('Queue drain worker started');
}

/**
 * Reservation Expiry Worker
 *
 * Runs every 30 seconds. Finds reservations past their lock timeout
 * and releases their seats back to available.
 */
let expiryIntervalId: NodeJS.Timeout;

export function startExpiryWorker(): void {
  expiryIntervalId = setInterval(async () => {
    try {
      const expired = await reservationService.expireStaleReservations();
      if (expired > 0) {
        logger.info({ expired }, 'Reservation expiry sweep completed');
      }
    } catch (err: any) {
      logger.error({ err: err.message }, 'Reservation expiry error');
    }
  }, 30_000);

  logger.info('Reservation expiry worker started');
}

/**
 * Register an event queue for drain processing.
 * Called when an event goes on sale.
 */
export function registerEventQueue(eventId: string): void {
  activeEventQueues.add(eventId);
  logger.info({ eventId }, 'Event queue registered for draining');
}

export function unregisterEventQueue(eventId: string): void {
  activeEventQueues.delete(eventId);
}

export function stopWorkers(): void {
  if (drainIntervalId) clearInterval(drainIntervalId);
  if (expiryIntervalId) clearInterval(expiryIntervalId);
}
