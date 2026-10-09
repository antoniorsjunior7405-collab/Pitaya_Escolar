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
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),
  DATABASE_URL: z.string().min(1).optional(),
});

export const config = schema.parse(process.env);
export type Config = typeof config;
