import jwt from '@fastify/jwt';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../../config/index.js';
import { UnauthorizedError } from '../errors/app-error.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string };
    user: { sub: string };
  }
}

// Autenticação: valida o token de acesso (Bearer) em toda rota que usar app.authenticate.
// Autorização (papel/posse do recurso) é checada no service de cada módulo.
export async function registerAuth(app: FastifyInstance) {
  await app.register(jwt, {
    secret: config.JWT_SECRET,
    sign: { algorithm: 'HS256', expiresIn: config.ACCESS_TOKEN_TTL },
    verify: { algorithms: ['HS256'] },
  });

  app.decorate('authenticate', async (req: FastifyRequest) => {
    try {
      await req.jwtVerify();
    } catch {
      throw new UnauthorizedError('Token ausente ou inválido');
    }
  });
}
