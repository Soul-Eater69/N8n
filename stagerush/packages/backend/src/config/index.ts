export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4100', 10),
  host: process.env.HOST || '0.0.0.0',

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'stagerush',
    user: process.env.DB_USER || 'stagerush',
    password: process.env.DB_PASSWORD || 'stagerush',
    pool: { min: 2, max: 30 },
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'stagerush-dev-secret-change-in-prod',
    accessExpiry: '15m',
    refreshExpiry: '7d',
  },

  cors: { origin: process.env.CORS_ORIGIN || 'http://localhost:3100' },

  queue: {
    drainRate: parseInt(process.env.QUEUE_DRAIN_RATE || '100', 10),
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '20', 10),
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || 'sk_test_mock',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_mock',
  },
};
