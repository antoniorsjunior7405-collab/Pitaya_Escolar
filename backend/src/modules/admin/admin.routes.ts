import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { exigirPapel, membroDe, type AcessoRepository } from '../../shared/acesso/acesso.js';
import {
  aluno,
  alunoBody,
  alunoDetalhe,
  alunoParams,
  membro,
  membrosQuery,
  organizacaoResponse,
  rota,
  rotaAlunoBody,
  rotaBody,
  rotaDetalhe,
  rotaParams,
  veiculo,
  veiculoBody,
  vinculoBody,
} from './admin.schemas.js';
import type { AdminService } from './admin.service.js';

export function criarAdminRoutes(service: AdminService, acesso: AcessoRepository) {
  return async function adminRoutes(app: FastifyInstance) {
    app.addHook('onRequest', app.authenticate);
    app.addHook('preHandler', exigirPapel(acesso, 'ADMIN'));

    const r = app.withTypeProvider<ZodTypeProvider>();
    const semCorpo = { 204: z.null() };

    r.get('/organizacao', { schema: { response: { 200: organizacaoResponse } } }, async (req) =>
      service.organizacao(membroDe(req)),
    );

    r.get(
      '/membros',
      { schema: { querystring: membrosQuery, response: { 200: z.array(membro) } } },
      async (req) => service.listarMembros(membroDe(req), req.query.papel),
    );

    r.get('/veiculos', { schema: { response: { 200: z.array(veiculo) } } }, async (req) =>
      service.listarVeiculos(membroDe(req)),
    );
    r.post(
      '/veiculos',
      { schema: { body: veiculoBody, response: { 201: veiculo } } },
      async (req, reply) =>
        reply.status(201).send(await service.criarVeiculo(membroDe(req), req.body)),
    );

    r.get('/alunos', { schema: { response: { 200: z.array(aluno) } } }, async (req) =>
      service.listarAlunos(membroDe(req)),
    );
    r.post(
      '/alunos',
      { schema: { body: alunoBody, response: { 201: aluno } } },
      async (req, reply) =>
        reply.status(201).send(await service.criarAluno(membroDe(req), req.body.nome)),
    );
    r.get(
      '/alunos/:alunoId',
      { schema: { params: alunoParams, response: { 200: alunoDetalhe } } },
      async (req) => service.detalharAluno(membroDe(req), req.params.alunoId),
    );
    r.post(
      '/alunos/:alunoId/responsaveis',
      { schema: { params: alunoParams, body: vinculoBody, response: semCorpo } },
      async (req, reply) => {
        await service.vincularResponsavel(membroDe(req), req.params.alunoId, req.body);
        return reply.status(204).send(null);
      },
    );

    r.get('/rotas', { schema: { response: { 200: z.array(rota) } } }, async (req) =>
      service.listarRotas(membroDe(req)),
    );
    r.post(
      '/rotas',
      { schema: { body: rotaBody, response: { 201: z.object({ id: z.uuid() }) } } },
      async (req, reply) =>
        reply.status(201).send(await service.criarRota(membroDe(req), req.body)),
    );
    r.get(
      '/rotas/:rotaId',
      { schema: { params: rotaParams, response: { 200: rotaDetalhe } } },
      async (req) => service.detalharRota(membroDe(req), req.params.rotaId),
    );
    r.post(
      '/rotas/:rotaId/alunos',
      { schema: { params: rotaParams, body: rotaAlunoBody, response: semCorpo } },
      async (req, reply) => {
        await service.adicionarAlunoNaRota(membroDe(req), req.params.rotaId, req.body);
        return reply.status(204).send(null);
      },
    );
  };
}
