import knex, { Knex } from 'knex';
import { config } from './index';

let db: Knex;

export function getDb(): Knex {
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
    });
  }
  return db;
}

export async function closeDb(): Promise<void> {
  if (db) await db.destroy();
}
