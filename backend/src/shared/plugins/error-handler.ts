import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import { AppError } from '../errors/app-error.js';

type CorpoErro = { code: string; message: string; requestId: string };

// Mensagens fixas para erros 4xx que vêm do Fastify/plugins. Nunca repassamos a
// mensagem original: ela pode conter detalhes internos.
type Padrao = { code: string; message: string };
const REQUISICAO_INVALIDA: Padrao = { code: 'BAD_REQUEST', message: 'Requisição inválida' };
const MENSAGENS_4XX = new Map<number, Padrao>([
  [400, REQUISICAO_INVALIDA],
  [401, { code: 'UNAUTHORIZED', message: 'Não autenticado' }],
  [403, { code: 'FORBIDDEN', message: 'Sem permissão' }],
  [404, { code: 'NOT_FOUND', message: 'Recurso não encontrado' }],
  [413, { code: 'PAYLOAD_TOO_LARGE', message: 'Corpo da requisição grande demais' }],
  [415, { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Tipo de conteúdo não suportado' }],
  [429, { code: 'TOO_MANY_REQUESTS', message: 'Muitas requisições. Tente novamente em instantes' }],
]);

function traduzir(error: FastifyError, requestId: string): { status: number; body: CorpoErro } {
  if (hasZodFastifySchemaValidationErrors(error)) {
    return {
      status: 400,
      body: { code: 'VALIDATION_ERROR', message: 'Dados inválidos', requestId },
    };
  }

  if (error instanceof AppError) {
    return {
      status: error.statusCode,
      body: { code: error.code, message: error.message, requestId },
    };
  }

  // Erros 4xx gerados pelo Fastify ou por plugins (rate limit, corpo grande, JSON malformado).
  const status = error.statusCode;
  if (status !== undefined && status >= 400 && status < 500) {
    const padrao = MENSAGENS_4XX.get(status) ?? REQUISICAO_INVALIDA;
    return { status, body: { ...padrao, requestId } };
  }

  return {
    status: 500,
    body: { code: 'INTERNAL_ERROR', message: 'Erro interno', requestId },
  };
}

// Handler central de erros. Nunca vaza stack trace nem detalhes internos ao cliente,
// e é à prova de falhas: se algo der errado ao montar a resposta, devolve um 500 fixo.
export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { status, body } = traduzir(error, request.id);
      // 5xx é problema nosso: vai para o log com o erro completo. 4xx é do cliente: só aviso.
      if (status >= 500) request.log.error({ err: error }, 'erro não tratado');
      else request.log.warn({ code: body.code, status }, 'requisição rejeitada');
      return reply.status(status).send(body);
    } catch (falha) {
      request.log.error({ err: falha, original: error }, 'falha no handler de erros');
      return reply
        .status(500)
        .send({ code: 'INTERNAL_ERROR', message: 'Erro interno', requestId: request.id });
    }
  });

  app.setNotFoundHandler((request, reply) =>
    reply.status(404).send({
      code: 'NOT_FOUND',
      message: 'Rota não encontrada',
      requestId: request.id,
    }),
  );
}
