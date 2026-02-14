export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  host: process.env.HOST || '0.0.0.0',

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'flowforge',
    user: process.env.DB_USER || 'flowforge',
    password: process.env.DB_PASSWORD || 'flowforge',
    pool: {
      min: parseInt(process.env.DB_POOL_MIN || '2', 10),
      max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    },
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'change-me-in-production',
    accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },

  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },

  queue: {
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '10', 10),
    maxRetries: parseInt(process.env.QUEUE_MAX_RETRIES || '3', 10),
  },

  execution: {
    timeout: parseInt(process.env.EXECUTION_TIMEOUT || '300000', 10),
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT_EXECUTIONS || '50', 10),
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },

  encryption: {
    key: process.env.ENCRYPTION_KEY || 'default-32-char-encryption-key!!',
  },
};
