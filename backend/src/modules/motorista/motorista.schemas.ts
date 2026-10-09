import { z } from 'zod';

export const rotaParams = z.object({ rotaId: z.uuid() });
export const viagemParams = z.object({ viagemId: z.uuid() });

const veiculo = z.object({ placa: z.string(), modelo: z.string() });
const statusViagem = z.enum(['PLANEJADA', 'EM_ANDAMENTO', 'FINALIZADA']);
const statusAluno = z.enum(['AGUARDANDO', 'EMBARCADO', 'ENTREGUE']);
const tipoEvento = z.enum(['EMBARCADO', 'ENTREGUE']);

export const rotaResumo = z.object({
  id: z.uuid(),
  nome: z.string(),
  periodo: z.enum(['MANHA', 'TARDE', 'NOITE']).nullable(),
  veiculo,
  totalAlunos: z.number().int(),
});

export const evento = z.object({ alunoId: z.uuid(), tipo: tipoEvento, registradoEm: z.date() });

export const viagem = z.object({
  id: z.uuid(),
  status: statusViagem,
  data: z.string(),
  iniciadaEm: z.date().nullable(),
  finalizadaEm: z.date().nullable(),
  eventos: z.array(evento),
});

export const rotaDetalhe = rotaResumo.omit({ totalAlunos: true }).extend({
  alunos: z.array(
    z.object({
      id: z.uuid(),
      nome: z.string(),
      ordem: z.number().int(),
      endereco: z.string().nullable(),
      status: statusAluno,
    }),
  ),
  viagemAtual: viagem.nullable(),
});

export const eventoBody = z.object({ alunoId: z.uuid(), tipo: tipoEvento });

export const posicaoBody = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  // m/s, como o GPS do aparelho informa. Negativo = desconhecida → descartamos.
  velocidade: z.number().min(0).max(100).nullable().optional(),
});

export const historicoQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  antesDe: z.coerce.date().optional(),
});

export const historicoItem = z.object({
  id: z.uuid(),
  rotaNome: z.string(),
  data: z.string(),
  iniciadaEm: z.date().nullable(),
  finalizadaEm: z.date().nullable(),
  alunosAtendidos: z.number().int(),
});

export type PosicaoInput = z.infer<typeof posicaoBody>;
export type TipoEventoInput = z.infer<typeof tipoEvento>;
