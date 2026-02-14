import { config } from './index';

const knexConfig = {
  development: {
    client: 'pg',
    connection: {
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
    },
    pool: config.database.pool,
    migrations: {
      directory: '../database/migrations',
      extension: 'ts',
    },
    seeds: {
      directory: '../database/seeds',
      extension: 'ts',
    },
  },
  production: {
    client: 'pg',
    connection: {
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
      ssl: { rejectUnauthorized: false },
    },
    pool: config.database.pool,
    migrations: {
      directory: '../database/migrations',
      extension: 'ts',
    },
  },
};

export default knexConfig;
module.exports = knexConfig;
