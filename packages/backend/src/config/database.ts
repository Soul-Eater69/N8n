import knex, { Knex } from 'knex';
import { config } from './index';
import { logger } from '../utils/logger';

let db: Knex;

export function getDatabase(): Knex {
  if (!db) {
    db = knex({
      client: 'pg',
      connection: {
        host: config.database.host,
        port: config.database.port,
        database: config.database.name,
        user: config.database.user,
        password: config.database.password,
      },
      pool: config.database.pool,
      acquireConnectionTimeout: 10000,
    });
  }
  return db;
}

export async function testConnection(): Promise<void> {
  const database = getDatabase();
  try {
    await database.raw('SELECT 1');
    logger.info('Database connection established');
  } catch (error) {
    logger.error('Database connection failed', error);
    throw error;
  }
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.destroy();
    logger.info('Database connection closed');
  }
}
