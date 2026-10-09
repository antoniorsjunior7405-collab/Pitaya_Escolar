import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { exigirPapel, membroDe, type AcessoRepository } from '../../shared/acesso/acesso.js';
import {
  evento,
  eventoBody,
  historicoItem,
  historicoQuery,
  rotaParams,
  viagemParams,
  posicaoBody,
  rotaDetalhe,
  rotaResumo,
  viagem,
} from './motorista.schemas.js';
import type { MotoristaService } from './motorista.service.js';

export function criarMotoristaRoutes(service: MotoristaService, acesso: AcessoRepository) {
  return async function motoristaRoutes(app: FastifyInstance) {
    // Todas as rotas deste módulo exigem login E papel MOTORISTA.
    app.addHook('onRequest', app.authenticate);
    app.addHook('preHandler', exigirPapel(acesso, 'MOTORISTA'));

    const r = app.withTypeProvider<ZodTypeProvider>();

    r.get('/rotas', { schema: { response: { 200: z.array(rotaResumo) } } }, async (req) =>
      service.listarRotas(membroDe(req)),
    );

    r.get(
      '/rotas/:rotaId',
      { schema: { params: rotaParams, response: { 200: rotaDetalhe } } },
      async (req) => service.detalharRota(membroDe(req), req.params.rotaId),
    );

    r.post(
      '/rotas/:rotaId/viagens',
      { schema: { params: rotaParams, response: { 200: viagem, 201: viagem } } },
      async (req, reply) => {
        const { viagem: v, criada } = await service.iniciarViagem(membroDe(req), req.params.rotaId);
        return reply.status(criada ? 201 : 200).send(v);
      },
    );

    r.post(
      '/viagens/:viagemId/eventos',
      {
        schema: {
          params: viagemParams,
          body: eventoBody,
          response: { 200: evento, 201: evento },
        },
      },
      async (req, reply) => {
        const { evento: e, criado } = await service.registrarEvento(
          membroDe(req),
          req.params.viagemId,
          req.body.alunoId,
          req.body.tipo,
        );
        return reply.status(criado ? 201 : 200).send(e);
      },
    );

    r.post(
      '/viagens/:viagemId/finalizar',
      { schema: { params: viagemParams, response: { 200: viagem } } },
      async (req) => service.finalizarViagem(membroDe(req), req.params.viagemId),
    );

    // Posição do veículo. Limite próprio: o app envia no máximo a cada ~10 s.
    r.put(
      '/viagens/:viagemId/posicao',
      {
        config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
        schema: { params: viagemParams, body: posicaoBody, response: { 204: z.null() } },
      },
      async (req, reply) => {
        await service.atualizarPosicao(membroDe(req), req.params.viagemId, req.body);
        return reply.status(204).send(null);
      },
    );

    r.get(
      '/viagens',
      { schema: { querystring: historicoQuery, response: { 200: z.array(historicoItem) } } },
      async (req) => service.historico(membroDe(req), req.query.limit, req.query.antesDe),
    );
  };
}
