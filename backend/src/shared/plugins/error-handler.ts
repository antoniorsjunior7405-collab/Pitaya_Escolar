import type { FastifyInstance } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import { AppError } from '../errors/app-error.js';

// Handler central de erros. Nunca vaza stack trace nem detalhes internos ao cliente.
export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply.status(400).send({
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos',
        requestId: request.id,
      });
    }

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        code: error.code,
        message: error.message,
        requestId: request.id,
      });
    }

    request.log.error({ err: error }, 'erro não tratado');
    return reply.status(500).send({
      code: 'INTERNAL_ERROR',
      message: 'Erro interno',
      requestId: request.id,
    });
  });

  app.setNotFoundHandler((request, reply) =>
    reply.status(404).send({
      code: 'NOT_FOUND',
      message: 'Rota não encontrada',
      requestId: request.id,
    }),
  );
}
