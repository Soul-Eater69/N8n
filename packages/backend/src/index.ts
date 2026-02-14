import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimiter';
import { initializeWebSocket } from './services/websocket.service';
import { registerAllNodes } from './nodes/register';
import { startWorker } from './worker';
import { closeDatabase } from './config/database';
import { closeRedis } from './config/redis';
import { closeQueues } from './services/queue.service';

// Routes
import authRoutes from './routes/auth.routes';
import workflowRoutes from './routes/workflow.routes';
import executionRoutes from './routes/execution.routes';
import credentialRoutes from './routes/credential.routes';
import webhookRoutes from './routes/webhook.routes';
import nodeRoutes from './routes/node.routes';
import auditRoutes from './routes/audit.routes';

const app = express();
const server = http.createServer(app);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Handled by Next.js
}));
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
}));
app.use(compression());

// Body parsing
app.use(express.json({ limit: '16mb' }));
app.use(express.urlencoded({ extended: true, limit: '16mb' }));

// Logging
if (config.env !== 'test') {
  app.use(morgan('combined'));
}

// Rate limiting
app.use('/api/', apiLimiter);

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/workflows', workflowRoutes);
app.use('/api/v1/executions', executionRoutes);
app.use('/api/v1/credentials', credentialRoutes);
app.use('/api/v1/nodes', nodeRoutes);
app.use('/api/v1/audit', auditRoutes);

// Webhook handler (public endpoint)
app.use('/webhooks', webhookRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize services
async function bootstrap(): Promise<void> {
  try {
    // Register all node types
    registerAllNodes();
    logger.info('Node types registered');

    // Initialize WebSocket
    initializeWebSocket(server);

    // Start execution worker
    startWorker();

    // Start server
    server.listen(config.port, config.host, () => {
      logger.info(`FlowForge API server running on ${config.host}:${config.port}`);
      logger.info(`Environment: ${config.env}`);
    });
  } catch (error) {
    logger.error(error, 'Failed to bootstrap server');
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  server.close(async () => {
    logger.info('HTTP server closed');
    await closeQueues();
    await closeRedis();
    await closeDatabase();
    logger.info('Graceful shutdown complete');
    process.exit(0);
  });

  // Force shutdown after 30s
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled rejection');
});

bootstrap();

export { app, server };
