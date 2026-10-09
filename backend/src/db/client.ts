import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { config } from '../config/index.js';
import * as schema from './schema.js';

// Pool único. O Neon suspende o compute após inatividade, então o primeiro acesso
// pode demorar; por isso o timeout de conexão é generoso.
export function createDb() {
  if (!config.DATABASE_URL) throw new Error('DATABASE_URL não configurada');
  const pool = new pg.Pool({
    connectionString: config.DATABASE_URL,
    max: 10,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  });
  return { db: drizzle(pool, { schema }), pool };
}

export type Db = ReturnType<typeof createDb>['db'];
