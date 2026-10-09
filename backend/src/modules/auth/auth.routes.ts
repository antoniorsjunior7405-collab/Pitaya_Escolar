import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  cadastroBody,
  loginBody,
  meResponse,
  refreshBody,
  sessaoResponse,
  tokensResponse,
} from './auth.schemas.js';
import type { AuthService } from './auth.service.js';

// Limite mais rígido que o global: protege contra tentativa de adivinhar senhas.
const limiteRigido = { rateLimit: { max: 10, timeWindow: '1 minute' } };

export function criarAuthRoutes(service: AuthService) {
  return async function authRoutes(app: FastifyInstance) {
    const r = app.withTypeProvider<ZodTypeProvider>();

    r.post(
      '/cadastro',
      { config: limiteRigido, schema: { body: cadastroBody, response: { 201: sessaoResponse } } },
      async (req, reply) => reply.status(201).send(await service.cadastrar(req.body)),
    );

    r.post(
      '/login',
      { config: limiteRigido, schema: { body: loginBody, response: { 200: sessaoResponse } } },
      async (req) => service.login(req.body.email, req.body.senha),
    );

    r.post(
      '/refresh',
      { config: limiteRigido, schema: { body: refreshBody, response: { 200: tokensResponse } } },
      async (req) => service.renovar(req.body.refreshToken),
    );

    r.post(
      '/logout',
      { config: limiteRigido, schema: { body: refreshBody, response: { 204: z.null() } } },
      async (req, reply) => {
        await service.sair(req.body.refreshToken);
        return reply.status(204).send(null);
      },
    );

    r.get(
      '/me',
      { onRequest: [app.authenticate], schema: { response: { 200: meResponse } } },
      async (req) => service.me(req.user.sub),
    );
  };
}
