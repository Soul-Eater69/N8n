import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { getSubscriber } from '../config/redis';
import { logger } from '../utils/logger';
import { WSEventType } from '@stagerush/shared';

let io: Server;

export function initWebSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: config.cors.origin, credentials: true },
    pingTimeout: 60_000,
    pingInterval: 25_000,
    transports: ['websocket', 'polling'],
  });

  // Auth middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token) return next(new Error('Auth required'));

    try {
      const decoded = jwt.verify(token as string, config.jwt.secret) as any;
      (socket as any).userId = decoded.id;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = (socket as any).userId;
    logger.info({ userId }, 'WS connected');

    // Join user-specific room
    socket.join(`user:${userId}`);

    // Subscribe to event updates
    socket.on('subscribe:event', (eventId: string) => {
      socket.join(`event:${eventId}`);
    });

    socket.on('subscribe:queue', (eventId: string) => {
      socket.join(`queue:${eventId}`);
    });

    socket.on('subscribe:reservation', (reservationId: string) => {
      socket.join(`reservation:${reservationId}`);
    });

    socket.on('unsubscribe:event', (eventId: string) => socket.leave(`event:${eventId}`));
    socket.on('unsubscribe:queue', (eventId: string) => socket.leave(`queue:${eventId}`));

    socket.on('disconnect', () => {
      logger.debug({ userId }, 'WS disconnected');
    });
  });

  // ── Subscribe to Redis pub/sub for cross-instance broadcasting ──
  const sub = getSubscriber();

  sub.psubscribe('event:*:seats');
  sub.on('pmessage', (_pattern, channel, message) => {
    const match = channel.match(/^event:(.+):seats$/);
    if (match) {
      const eventId = match[1];
      io.to(`event:${eventId}`).emit('seat:batch_update', {
        type: 'seat:batch_update',
        payload: JSON.parse(message),
        timestamp: Date.now(),
      });
    }
  });

  logger.info('WebSocket server initialized');
  return io;
}

export function emitToQueue(eventId: string, event: WSEventType, data: unknown): void {
  io?.to(`queue:${eventId}`).emit(event, { type: event, payload: data, timestamp: Date.now() });
}

export function emitToUser(userId: string, event: WSEventType, data: unknown): void {
  io?.to(`user:${userId}`).emit(event, { type: event, payload: data, timestamp: Date.now() });
}

export function emitToEvent(eventId: string, event: WSEventType, data: unknown): void {
  io?.to(`event:${eventId}`).emit(event, { type: event, payload: data, timestamp: Date.now() });
}

export function emitToReservation(reservationId: string, event: WSEventType, data: unknown): void {
  io?.to(`reservation:${reservationId}`).emit(event, { type: event, payload: data, timestamp: Date.now() });
}
