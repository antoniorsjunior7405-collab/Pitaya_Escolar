import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { config } from '../config/index.js';
import * as schema from './schema.js';

// Pool único. O Neon suspende o compute após inatividade, então o primeiro acesso
// pode demorar; por isso o timeout de conexão é generoso.
export function criarPool(connectionString: string) {
  const pool = new pg.Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  });
  // Ao suspender o compute, o Neon fecha as conexões ociosas e o pool emite 'error'.
  // Sem listener, isso vira uncaughtException e derruba a API. O pool já descarta a
  // conexão morta e abre outra no próximo pedido; quem quiser registrar, escuta também.
  pool.on('error', () => {});
  return pool;
}

export function createDb() {
  if (!config.DATABASE_URL) throw new Error('DATABASE_URL não configurada');
  const pool = criarPool(config.DATABASE_URL);
  return { db: drizzle(pool, { schema }), pool };
}

export type Db = ReturnType<typeof createDb>['db'];
