import { z } from 'zod';

// Única porta de entrada de variáveis de ambiente. Falha ao subir se algo estiver inválido.
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3333),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  DATABASE_URL: z.string().min(1).optional(),
  // Segredo que assina os tokens de acesso. Mínimo de 32 caracteres.
  JWT_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  // Fuso usado para "hoje" nas viagens (o servidor roda em UTC).
  TZ_NEGOCIO: z.string().default('America/Sao_Paulo'),
});

export const config = schema.parse(process.env);
export type Config = typeof config;
