import Redis from 'ioredis';
import { config } from './index';
import { logger } from '../utils/logger';

let redisClient: Redis;
let subscriberClient: Redis;

function createRedisClient(name: string): Redis {
  const client = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    db: config.redis.db,
    maxRetriesPerRequest: null,
    retryStrategy(times: number) {
      const delay = Math.min(times * 200, 5000);
      return delay;
    },
  });

  client.on('connect', () => logger.info(`Redis ${name} connected`));
  client.on('error', (err) => logger.error(`Redis ${name} error`, err));

  return client;
}

export function getRedis(): Redis {
  if (!redisClient) {
    redisClient = createRedisClient('main');
  }
  return redisClient;
}

export function getSubscriber(): Redis {
  if (!subscriberClient) {
    subscriberClient = createRedisClient('subscriber');
  }
  return subscriberClient;
}

export async function closeRedis(): Promise<void> {
  if (redisClient) await redisClient.quit();
  if (subscriberClient) await subscriberClient.quit();
  logger.info('Redis connections closed');
}
