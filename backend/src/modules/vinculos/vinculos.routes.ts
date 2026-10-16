import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { exigirPapel, membroDe } from '../../shared/acesso/acesso.js';
import {
  buscaMotoristasQuery,
  buscaMotoristasResponse,
  listaQuery,
  paginaPedidosRecebidos,
  paginaSolicitacoes,
  pedidoBody,
  pedidoRecebido,
  solicitacao,
  solicitacaoParams,
} from './vinculos.schemas.js';
import type { VinculosService } from './vinculos.service.js';

// Limites próprios, além do global: a busca não pode virar raspagem da lista de motoristas, e
// os pedidos não podem virar spam para os motoristas.
const limiteBusca = { rateLimit: { max: 20, timeWindow: '1 minute' } };
const limitePedido = { rateLimit: { max: 20, timeWindow: '1 hour' } };

/** Área do responsável: buscar motorista, pedir vínculo e acompanhar o pedido (tela de espera). */
export function criarVinculosResponsavelRoutes(service: VinculosService) {
  return async function vinculosResponsavelRoutes(app: FastifyInstance) {
    app.addHook('onRequest', app.authenticate);
    app.addHook('preHandler', exigirPapel('RESPONSAVEL'));

    const r = app.withTypeProvider<ZodTypeProvider>();

    r.get(
      '/motoristas',
      {
        config: limiteBusca,
        schema: { querystring: buscaMotoristasQuery, response: { 200: buscaMotoristasResponse } },
      },
      async (req) => service.buscarMotoristas(membroDe(req), req.query),
    );

    r.get(
      '/solicitacoes',
      { schema: { querystring: listaQuery, response: { 200: paginaSolicitacoes } } },
      async (req) => service.listarSolicitacoes(membroDe(req), req.query),
    );

    r.post(
      '/solicitacoes',
      {
        config: limitePedido,
        schema: { body: pedidoBody, response: { 200: solicitacao, 201: solicitacao } },
      },
      async (req, reply) => {
        const { solicitacao: s, criada } = await service.pedirVinculo(membroDe(req), req.body);
        return reply.status(criada ? 201 : 200).send(s);
      },
    );

    r.get(
      '/solicitacoes/:solicitacaoId',
      { schema: { params: solicitacaoParams, response: { 200: solicitacao } } },
      async (req) => service.detalharSolicitacao(membroDe(req), req.params.solicitacaoId),
    );

    r.post(
      '/solicitacoes/:solicitacaoId/cancelar',
      { schema: { params: solicitacaoParams, response: { 200: solicitacao } } },
      async (req) => service.cancelarSolicitacao(membroDe(req), req.params.solicitacaoId),
    );
  };
}

/** Área do motorista: ver os pedidos recebidos e responder. */
export function criarVinculosMotoristaRoutes(service: VinculosService) {
  return async function vinculosMotoristaRoutes(app: FastifyInstance) {
    app.addHook('onRequest', app.authenticate);
    app.addHook('preHandler', exigirPapel('MOTORISTA'));

    const r = app.withTypeProvider<ZodTypeProvider>();

    r.get(
      '/solicitacoes',
      { schema: { querystring: listaQuery, response: { 200: paginaPedidosRecebidos } } },
      async (req) => service.listarPedidosRecebidos(membroDe(req), req.query),
    );

    r.post(
      '/solicitacoes/:solicitacaoId/aceitar',
      { schema: { params: solicitacaoParams, response: { 200: pedidoRecebido } } },
      async (req) => service.responder(membroDe(req), req.params.solicitacaoId, 'ACEITA'),
    );

    r.post(
      '/solicitacoes/:solicitacaoId/recusar',
      { schema: { params: solicitacaoParams, response: { 200: pedidoRecebido } } },
      async (req) => service.responder(membroDe(req), req.params.solicitacaoId, 'RECUSADA'),
    );
  };
}
