import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { config } from './config/index.js';
import { criarAuthRoutes, criarAuthService, type AuthRepository } from './modules/auth/index.js';
import { healthRoutes } from './modules/health/index.js';
import { registerAuth } from './shared/plugins/authenticate.js';
import { registerErrorHandler } from './shared/plugins/error-handler.js';

export type AppDeps = { authRepository: AuthRepository };

// Monta a aplicação sem chamar listen(), para os testes usarem app.inject().
// As dependências (repositórios) entram por parâmetro: em produção são os do banco,
// nos testes podem ser versões em memória.
export async function buildApp(deps: AppDeps) {
  const app = Fastify({
    // Atrás do proxy do Render (1 salto) o IP real do cliente vem em X-Forwarded-For.
    // Sem isto, todos os usuários teriam o mesmo IP e dividiriam o mesmo rate limit.
    trustProxy:
      config.NODE_ENV === 'production' ? (_endereco: string, salto: number) => salto === 0 : false,
    bodyLimit: 1_000_000,
    requestTimeout: 30_000,
    connectionTimeout: 35_000,
    // Maior que o idle timeout do proxy, para o proxy nunca reutilizar uma conexão já fechada.
    keepAliveTimeout: 65_000,
    maxRequestsPerSocket: 1000,
    logger: {
      level: config.LOG_LEVEL,
      redact: ['req.headers.authorization', 'req.headers.cookie'],
      ...(config.NODE_ENV === 'development' && {
        transport: { target: 'pino-pretty' },
      }),
    },
  });

  // headersTimeout precisa ser maior que keepAliveTimeout (exigência do Node).
  app.server.headersTimeout = 66_000;

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);

  await app.register(helmet);
  await app.register(cors, { origin: config.CORS_ORIGINS });
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
  await registerAuth(app);

  const authService = criarAuthService(deps.authRepository, (sub) => app.jwt.sign({ sub }));

  await app.register(healthRoutes);
  await app.register(criarAuthRoutes(authService), { prefix: '/v1/auth' });
  // Próximos módulos: rotas, alunos, viagens...

  return app;
}
