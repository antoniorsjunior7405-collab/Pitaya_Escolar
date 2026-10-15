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
  // E-mail transacional (recuperação de senha) via Resend. Sem a chave, em desenvolvimento o
  // link aparece no log; em produção o envio fica desligado (e o servidor avisa ao subir).
  EMAIL_RESEND_API_KEY: z.string().min(1).optional(),
  // O domínio do remetente precisa estar verificado no Resend. O padrão é o remetente de
  // teste do Resend, que só entrega para o e-mail da própria conta Resend.
  EMAIL_REMETENTE: z.string().min(3).default('Pitaya Escolar <onboarding@resend.dev>'),
  // Endereço que o link do e-mail abre (deep link do app, ou uma página https que o redireciona).
  EMAIL_URL_REDEFINIR_SENHA: z.url().default('pitayaescolar://redefinir-senha'),
});

export const config = schema.parse(process.env);
export type Config = typeof config;
