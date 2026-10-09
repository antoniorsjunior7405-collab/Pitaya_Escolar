import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { config } from './config/index.js';
import {
  criarAdminRoutes,
  criarAdminService,
  type AdminRepository,
} from './modules/admin/index.js';
import { criarAuthRoutes, criarAuthService, type AuthRepository } from './modules/auth/index.js';
import { healthRoutes } from './modules/health/index.js';
import {
  criarMotoristaRoutes,
  criarMotoristaService,
  type MotoristaRepository,
} from './modules/motorista/index.js';
import {
  criarResponsavelRoutes,
  criarResponsavelService,
  type ResponsavelRepository,
} from './modules/responsavel/index.js';
import type { AcessoRepository } from './shared/acesso/acesso.js';
import { registerAuth } from './shared/plugins/authenticate.js';
import { registerErrorHandler } from './shared/plugins/error-handler.js';

export type AppDeps = {
  authRepository: AuthRepository;
  acessoRepository: AcessoRepository;
  motoristaRepository: MotoristaRepository;
  responsavelRepository: ResponsavelRepository;
  adminRepository: AdminRepository;
};

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
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    // Roda depois da autenticação: rotas logadas contam POR USUÁRIO. Contar por IP puniria
    // usuários de operadoras móveis com CGNAT (muitos celulares atrás do mesmo IP).
    // Rotas sem login (cadastro/login) continuam contando por IP, contra força bruta.
    hook: 'preHandler',
    keyGenerator: (req) => {
      const usuario = req.user as { sub?: string } | undefined;
      return usuario?.sub ? `u:${usuario.sub}` : `ip:${req.ip}`;
    },
  });
  await registerAuth(app);

  const authService = criarAuthService(deps.authRepository, (sub) => app.jwt.sign({ sub }));

  await app.register(healthRoutes);
  await app.register(criarAuthRoutes(authService), { prefix: '/v1/auth' });

  // Cada área exige o seu papel (hook no escopo do módulo).
  const acesso = deps.acessoRepository;
  await app.register(
    criarMotoristaRoutes(criarMotoristaService(deps.motoristaRepository), acesso),
    { prefix: '/v1/motorista' },
  );
  await app.register(
    criarResponsavelRoutes(criarResponsavelService(deps.responsavelRepository), acesso),
    { prefix: '/v1/responsavel' },
  );
  await app.register(criarAdminRoutes(criarAdminService(deps.adminRepository), acesso), {
    prefix: '/v1/admin',
  });

  return app;
}
