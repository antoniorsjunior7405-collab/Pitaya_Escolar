import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { exigirPapel, membroDe, type AcessoRepository } from '../../shared/acesso/acesso.js';
import type { ResponsavelService } from './responsavel.service.js';

const filhoResumo = z.object({
  id: z.uuid(),
  nome: z.string(),
  statusAluno: z.enum(['AGUARDANDO', 'EMBARCADO', 'ENTREGUE']),
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

export function criarResponsavelRoutes(service: ResponsavelService, acesso: AcessoRepository) {
  return async function responsavelRoutes(app: FastifyInstance) {
    app.addHook('onRequest', app.authenticate);
    app.addHook('preHandler', exigirPapel(acesso, 'RESPONSAVEL'));

    const r = app.withTypeProvider<ZodTypeProvider>();

    r.get('/filhos', { schema: { response: { 200: z.array(filhoResumo) } } }, async (req) =>
      service.listarFilhos(membroDe(req)),
    );

    r.get(
      '/filhos/:alunoId',
      { schema: { params: z.object({ alunoId: z.uuid() }), response: { 200: filhoDetalhe } } },
      async (req) => service.acompanharFilho(membroDe(req), req.params.alunoId),
    );
  };
}
