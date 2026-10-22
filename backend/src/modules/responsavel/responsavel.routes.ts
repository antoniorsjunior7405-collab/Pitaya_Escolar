import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { exigirPapel, membroDe } from '../../shared/acesso/acesso.js';
import { alunoParams, filho, filhoBody, filhoEdicaoBody } from './responsavel.schemas.js';
import type { ResponsavelService } from './responsavel.service.js';

// Cadastro de aluno: limite próprio, além do global, contra criação de alunos falsos em massa.
const limiteCadastro = { rateLimit: { max: 20, timeWindow: '1 hour' } };

const filhoResumo = z.object({
  id: z.uuid(),
  nome: z.string(),
  statusAluno: z.enum(['AGUARDANDO', 'EMBARCADO', 'ENTREGUE', 'AUSENTE']),
  // O responsável já confirmou que o filho chegou (só existe depois da entrega).
  chegadaConfirmada: z.boolean(),
  viagem: z
    .object({ id: z.uuid(), status: z.enum(['PLANEJADA', 'EM_ANDAMENTO', 'FINALIZADA']) })
    .nullable(),
  rotaNome: z.string().nullable(),
  motorista: z.object({ nome: z.string(), telefone: z.string().nullable() }).nullable(),
  veiculo: z.object({ placa: z.string(), modelo: z.string() }).nullable(),
});

const filhoDetalhe = filhoResumo.extend({
  posicao: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
      velocidade: z.number().nullable(),
      atualizadaEm: z.date(),
    })
    .nullable(),
});

export function criarResponsavelRoutes(service: ResponsavelService) {
  return async function responsavelRoutes(app: FastifyInstance) {
    app.addHook('onRequest', app.authenticate);
    app.addHook('preHandler', exigirPapel('RESPONSAVEL'));

    const r = app.withTypeProvider<ZodTypeProvider>();

    r.get('/filhos', { schema: { response: { 200: z.array(filhoResumo) } } }, async (req) =>
      service.listarFilhos(membroDe(req)),
    );

    r.get(
      '/filhos/:alunoId',
      { schema: { params: alunoParams, response: { 200: filhoDetalhe } } },
      async (req) => service.acompanharFilho(membroDe(req), req.params.alunoId),
    );

    r.post(
      '/filhos/:alunoId/chegada',
      { schema: { params: alunoParams, response: { 200: filhoResumo } } },
      async (req) => service.confirmarChegada(membroDe(req), req.params.alunoId),
    );

    // ── Filho cadastrado pela própria família ────────────────────────────────

    r.post(
      '/filhos',
      { config: limiteCadastro, schema: { body: filhoBody, response: { 201: filho } } },
      async (req, reply) =>
        reply.status(201).send(await service.cadastrarFilho(membroDe(req), req.body)),
    );

    r.put(
      '/filhos/:alunoId',
      { schema: { params: alunoParams, body: filhoEdicaoBody, response: { 200: filho } } },
      async (req) => service.editarFilho(membroDe(req), req.params.alunoId, req.body),
    );

    r.delete(
      '/filhos/:alunoId',
      { schema: { params: alunoParams, response: { 204: z.null() } } },
      async (req, reply) => {
        await service.excluirFilho(membroDe(req), req.params.alunoId);
        return reply.status(204).send(null);
      },
    );
  };
}
