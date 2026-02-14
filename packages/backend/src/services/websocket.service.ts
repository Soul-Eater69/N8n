import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../utils/logger';
import { WebSocketEventType } from '@flowforge/shared';

let io: Server;

interface AuthenticatedSocket extends Socket {
  userId?: string;
  tenantId?: string;
}

export function initializeWebSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: config.cors.origin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Authentication middleware
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token as string, config.jwt.secret) as {
        id: string;
        tenantId: string;
      };

      socket.userId = decoded.id;
      socket.tenantId = decoded.tenantId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    const { userId, tenantId } = socket;

    // Join tenant room for scoped broadcasts
    if (tenantId) {
      socket.join(`tenant:${tenantId}`);
    }

    logger.info({ userId, tenantId }, 'WebSocket client connected');

    // Subscribe to specific workflow execution updates
    socket.on('subscribe:execution', (executionId: string) => {
      socket.join(`execution:${executionId}`);
    });

    socket.on('unsubscribe:execution', (executionId: string) => {
      socket.leave(`execution:${executionId}`);
    });

    // Subscribe to workflow updates (collaborative editing)
    socket.on('subscribe:workflow', (workflowId: string) => {
      socket.join(`workflow:${workflowId}`);
    });

    socket.on('unsubscribe:workflow', (workflowId: string) => {
      socket.leave(`workflow:${workflowId}`);
    });

    // Workflow editor cursor sync
    socket.on('cursor:move', (data: { workflowId: string; position: { x: number; y: number } }) => {
      socket.to(`workflow:${data.workflowId}`).emit('cursor:update', {
        userId,
        position: data.position,
      });
    });

    socket.on('disconnect', () => {
      logger.info({ userId }, 'WebSocket client disconnected');
    });
  });

  logger.info('WebSocket server initialized');
  return io;
}

export function emitToTenant(tenantId: string, event: WebSocketEventType, data: unknown): void {
  if (io) {
    io.to(`tenant:${tenantId}`).emit(event, {
      type: event,
      payload: data,
      timestamp: Date.now(),
    });
  }
}

export function emitToExecution(executionId: string, event: WebSocketEventType, data: unknown): void {
  if (io) {
    io.to(`execution:${executionId}`).emit(event, {
      type: event,
      payload: data,
      timestamp: Date.now(),
    });
  }
}

export function emitToWorkflow(workflowId: string, event: WebSocketEventType, data: unknown): void {
  if (io) {
    io.to(`workflow:${workflowId}`).emit(event, {
      type: event,
      payload: data,
      timestamp: Date.now(),
    });
  }
}

export function getIO(): Server {
  return io;
}
