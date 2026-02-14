import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimiter';
import { initWebSocket } from './services/websocket.service';
import { startDrainWorker, startExpiryWorker, stopWorkers } from './worker';
import { closeDb } from './config/database';
import { closeRedis } from './config/redis';

// Routes
import authRoutes from './routes/auth.routes';
import eventRoutes from './routes/event.routes';
import queueRoutes from './routes/queue.routes';
import reservationRoutes from './routes/reservation.routes';
import paymentRoutes from './routes/payment.routes';
import ticketRoutes from './routes/ticket.routes';
import adminRoutes from './routes/admin.routes';

const app = express();
const server = http.createServer(app);

// Security
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: config.cors.origin, credentials: true }));
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use('/api/', apiLimiter);

// Health
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'stagerush-api', uptime: process.uptime() });
});

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/events', eventRoutes);
app.use('/api/v1/queue', queueRoutes);
app.use('/api/v1/reservations', reservationRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/tickets', ticketRoutes);
app.use('/api/v1/admin', adminRoutes);

// 404
app.use((_req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } });
});

// Error handler
app.use(errorHandler);

// Bootstrap
async function bootstrap(): Promise<void> {
  try {
    initWebSocket(server);
    startDrainWorker();
    startExpiryWorker();

    server.listen(config.port, config.host, () => {
      logger.info(`StageRush API running on ${config.host}:${config.port}`);
    });
  } catch (err) {
    logger.error(err, 'Bootstrap failed');
    process.exit(1);
  }
}

async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received, shutting down...`);
  stopWorkers();
  server.close(async () => {
    await closeRedis();
    await closeDb();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 15_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

bootstrap();

export { app, server };
