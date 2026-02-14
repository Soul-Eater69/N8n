import Redis from 'ioredis';
import { config } from './index';

let client: Redis;
let subscriber: Redis;

function create(name: string): Redis {
  const c = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    maxRetriesPerRequest: null,
    retryStrategy: (times) => Math.min(times * 200, 5000),
  });
  c.on('error', (err) => console.error(`Redis ${name} error:`, err.message));
  return c;
}

export function getRedis(): Redis {
  if (!client) client = create('main');
  return client;
}

export function getSubscriber(): Redis {
  if (!subscriber) subscriber = create('subscriber');
  return subscriber;
}

export async function closeRedis(): Promise<void> {
  if (client) await client.quit();
  if (subscriber) await subscriber.quit();
}
