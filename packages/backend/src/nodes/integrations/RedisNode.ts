import { INodeHandler, INodeExecutionContext } from '../../engine/NodeRegistry';
import { INodeTypeDescription, INodeExecutionResult, INodeExecutionData } from '@flowforge/shared';

const description: INodeTypeDescription = {
  type: 'integration.redis',
  displayName: 'Redis',
  description: 'Read and write data in Redis key-value store including strings, hashes, lists, sets, and pub/sub',
  icon: 'zap',
  category: 'integration',
  version: 1,
  inputs: [{ name: 'main', type: 'main' }],
  outputs: [{ name: 'main', type: 'main' }],
  properties: [
    {
      name: 'operation',
      displayName: 'Operation',
      type: 'options',
      default: 'get',
      required: true,
      options: [
        { name: 'Get', value: 'get', description: 'Get the value of a key' },
        { name: 'Set', value: 'set', description: 'Set a key-value pair' },
        { name: 'Delete', value: 'delete', description: 'Delete a key' },
        { name: 'Increment', value: 'incr', description: 'Increment a key by 1' },
        { name: 'Decrement', value: 'decr', description: 'Decrement a key by 1' },
        { name: 'Hash Get', value: 'hGet', description: 'Get a field from a hash' },
        { name: 'Hash Set', value: 'hSet', description: 'Set a field in a hash' },
        { name: 'Hash Get All', value: 'hGetAll', description: 'Get all fields from a hash' },
        { name: 'List Push', value: 'lPush', description: 'Push a value to a list' },
        { name: 'List Range', value: 'lRange', description: 'Get a range of values from a list' },
        { name: 'List Length', value: 'lLen', description: 'Get the length of a list' },
        { name: 'Set Add', value: 'sAdd', description: 'Add a member to a set' },
        { name: 'Set Members', value: 'sMembers', description: 'Get all members of a set' },
        { name: 'Publish', value: 'publish', description: 'Publish a message to a channel' },
        { name: 'Keys', value: 'keys', description: 'Find keys matching a pattern' },
        { name: 'Expire', value: 'expire', description: 'Set a TTL on a key' },
        { name: 'TTL', value: 'ttl', description: 'Get the remaining TTL of a key' },
        { name: 'Exists', value: 'exists', description: 'Check if a key exists' },
      ],
    },
    {
      name: 'key',
      displayName: 'Key',
      type: 'string',
      default: '',
      required: true,
      description: 'The Redis key to operate on',
    },
    {
      name: 'value',
      displayName: 'Value',
      type: 'string',
      default: '',
      description: 'The value to set',
      displayOptions: { show: { operation: ['set', 'lPush', 'sAdd', 'publish'] } },
    },
    {
      name: 'field',
      displayName: 'Hash Field',
      type: 'string',
      default: '',
      description: 'The hash field name',
      displayOptions: { show: { operation: ['hGet', 'hSet'] } },
    },
    {
      name: 'ttl',
      displayName: 'TTL (seconds)',
      type: 'number',
      default: 0,
      description: 'Time to live in seconds. 0 = no expiry',
      displayOptions: { show: { operation: ['set', 'expire'] } },
    },
    {
      name: 'rangeStart',
      displayName: 'Range Start',
      type: 'number',
      default: 0,
      displayOptions: { show: { operation: ['lRange'] } },
    },
    {
      name: 'rangeEnd',
      displayName: 'Range End',
      type: 'number',
      default: -1,
      description: '-1 means all elements',
      displayOptions: { show: { operation: ['lRange'] } },
    },
    {
      name: 'pattern',
      displayName: 'Key Pattern',
      type: 'string',
      default: '*',
      description: 'Pattern to match keys (e.g., user:*, session:*)',
      displayOptions: { show: { operation: ['keys'] } },
    },
  ],
  credentials: [{ name: 'redis', required: true }],
  color: '#DC382D',
};

export const RedisNode: INodeHandler = {
  description,

  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    const credentials = ctx.credentials.redis as Record<string, string> | undefined;
    if (!credentials?.url && !credentials?.host) {
      throw new Error('Redis credentials not configured. Provide a URL or host.');
    }

    // Dynamic import to avoid requiring ioredis at module load
    const Redis = (await import('ioredis')).default;
    const connectionUrl = credentials.url || `redis://${credentials.host}:${credentials.port || 6379}`;
    const client = new Redis(connectionUrl, {
      password: credentials.password || undefined,
      connectTimeout: 10000,
      maxRetriesPerRequest: 3,
    });

    const operation = (ctx.parameters.operation as string) || 'get';
    const results: INodeExecutionData[] = [];

    try {
      for (const item of ctx.inputData) {
        try {
          const key = (ctx.parameters.key as string) || (item.json.key as string) || '';
          let result: unknown;

          switch (operation) {
            case 'get': {
              const value = await client.get(key);
              result = { key, value, exists: value !== null };
              break;
            }

            case 'set': {
              const value = (ctx.parameters.value as string) || (item.json.value as string) || '';
              const ttl = (ctx.parameters.ttl as number) || 0;
              if (ttl > 0) {
                await client.set(key, value, 'EX', ttl);
              } else {
                await client.set(key, value);
              }
              result = { key, value, ttl, success: true };
              break;
            }

            case 'delete': {
              const deleted = await client.del(key);
              result = { key, deleted: deleted > 0, count: deleted };
              break;
            }

            case 'incr': {
              const newValue = await client.incr(key);
              result = { key, value: newValue };
              break;
            }

            case 'decr': {
              const newValue = await client.decr(key);
              result = { key, value: newValue };
              break;
            }

            case 'hGet': {
              const field = (ctx.parameters.field as string) || '';
              const value = await client.hget(key, field);
              result = { key, field, value, exists: value !== null };
              break;
            }

            case 'hSet': {
              const field = (ctx.parameters.field as string) || '';
              const value = (ctx.parameters.value as string) || (item.json.value as string) || '';
              await client.hset(key, field, value);
              result = { key, field, value, success: true };
              break;
            }

            case 'hGetAll': {
              const hash = await client.hgetall(key);
              result = { key, data: hash, fieldCount: Object.keys(hash).length };
              break;
            }

            case 'lPush': {
              const value = (ctx.parameters.value as string) || (item.json.value as string) || '';
              const length = await client.lpush(key, value);
              result = { key, value, listLength: length };
              break;
            }

            case 'lRange': {
              const start = (ctx.parameters.rangeStart as number) || 0;
              const end = (ctx.parameters.rangeEnd as number) ?? -1;
              const values = await client.lrange(key, start, end);
              result = { key, values, count: values.length };
              break;
            }

            case 'lLen': {
              const length = await client.llen(key);
              result = { key, length };
              break;
            }

            case 'sAdd': {
              const value = (ctx.parameters.value as string) || (item.json.value as string) || '';
              const added = await client.sadd(key, value);
              result = { key, value, added: added > 0 };
              break;
            }

            case 'sMembers': {
              const members = await client.smembers(key);
              result = { key, members, count: members.length };
              break;
            }

            case 'publish': {
              const value = (ctx.parameters.value as string) || (item.json.value as string) || '';
              const receivers = await client.publish(key, value);
              result = { channel: key, message: value, receivers };
              break;
            }

            case 'keys': {
              const pattern = (ctx.parameters.pattern as string) || '*';
              const keys = await client.keys(pattern);
              result = { pattern, keys, count: keys.length };
              break;
            }

            case 'expire': {
              const ttl = (ctx.parameters.ttl as number) || 60;
              const success = await client.expire(key, ttl);
              result = { key, ttl, success: success === 1 };
              break;
            }

            case 'ttl': {
              const remaining = await client.ttl(key);
              result = { key, ttl: remaining, hasExpiry: remaining > 0 };
              break;
            }

            case 'exists': {
              const exists = await client.exists(key);
              result = { key, exists: exists > 0 };
              break;
            }

            default:
              throw new Error(`Unsupported Redis operation: ${operation}`);
          }

          results.push({
            json: { success: true, operation, ...(result as Record<string, unknown>) },
            pairedItem: { item: results.length },
          });
        } catch (error: any) {
          results.push({
            json: { success: false, operation, error: error.message },
            pairedItem: { item: results.length },
          });
        }
      }
    } finally {
      await client.quit();
    }

    return { data: [results] };
  },
};
