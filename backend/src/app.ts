import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import { config } from './config/index.js';
import { healthRoutes } from './modules/health/index.js';
import { registerErrorHandler } from './shared/plugins/error-handler.js';

// Monta a aplicação sem chamar listen(), para os testes usarem app.inject().
export async function buildApp() {
  const app = Fastify({
    bodyLimit: 1_000_000,
    requestTimeout: 30_000,
    logger: {
      level: config.LOG_LEVEL,
      redact: ['req.headers.authorization', 'req.headers.cookie'],
      ...(config.NODE_ENV === 'development' && {
        transport: { target: 'pino-pretty' },
      }),
    },
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);

  await app.register(helmet);
  await app.register(cors, { origin: config.CORS_ORIGINS });
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });

  await app.register(healthRoutes);
  // Próximos módulos: app.register(authRoutes, { prefix: '/v1/auth' }) etc.

  return app;
}
