import { z } from 'zod';
import { placaSchema } from '../../shared/placa.js';

export const rotaParams = z.object({ rotaId: z.uuid() });
export const viagemParams = z.object({ viagemId: z.uuid() });
export const veiculoParams = z.object({ veiculoId: z.uuid() });

const texto = (max: number) => z.string().trim().min(1).max(max);
const veiculoResumo = z.object({ placa: z.string(), modelo: z.string() });
const statusViagem = z.enum(['PLANEJADA', 'EM_ANDAMENTO', 'FINALIZADA']);
const statusAluno = z.enum(['AGUARDANDO', 'EMBARCADO', 'ENTREGUE', 'AUSENTE']);
// O motorista registra embarque, entrega e falta. CHEGADA_CONFIRMADA só o responsável registra
// (rota própria); aqui ele aparece apenas na leitura dos eventos.
const tipoEventoDoMotorista = z.enum(['EMBARCADO', 'ENTREGUE', 'AUSENTE']);
const tipoEvento = z.enum([...tipoEventoDoMotorista.options, 'CHEGADA_CONFIRMADA']);

export const rotaResumo = z.object({
  id: z.uuid(),
  nome: z.string(),
  periodo: z.enum(['MANHA', 'TARDE', 'NOITE']).nullable(),
  veiculo: veiculoResumo,
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
      chegadaConfirmada: z.boolean(),
    }),
  ),
  viagemAtual: viagem.nullable(),
});

export const eventoBody = z.object({ alunoId: z.uuid(), tipo: tipoEventoDoMotorista });

export const posicaoBody = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  // m/s, como o GPS do aparelho informa. Leitura impossível (negativa, acima de 100 m/s ou
  // não numérica) vira "desconhecida": um ruído no GPS não pode descartar a posição inteira.
  velocidade: z.number().min(0).max(100).nullable().optional().catch(null),
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

// ── Cadastro do próprio motorista (gestão direta família–motorista) ─────────
// strictObject: campo desconhecido é recusado (400), conforme BOAS_PRATICAS §7.

// PUT substitui o veículo inteiro: capacidade omitida vira "não informada" (null).
export const veiculoBody = z.strictObject({
  placa: placaSchema,
  modelo: texto(80),
  capacidade: z.number().int().min(1).max(100).nullable().optional(),
});

export const veiculo = z.object({
  id: z.uuid(),
  placa: z.string(),
  modelo: z.string(),
  capacidade: z.number().int().nullable(),
});

// PUT substitui o perfil inteiro: todos os campos são obrigatórios; null limpa o valor.
// E-mail não muda aqui: ele é o login (fica com o módulo auth).
export const perfilBody = z.strictObject({
  nome: z.string().trim().min(2).max(120),
  telefone: z.string().trim().min(8).max(20).nullable(),
  apresentacao: texto(500).nullable(),
  regiaoAtendimento: texto(120).nullable(),
});

export const perfil = z.object({
  nome: z.string(),
  email: z.string(),
  telefone: z.string().nullable(),
  apresentacao: z.string().nullable(),
  regiaoAtendimento: z.string().nullable(),
  // null = aguardando aprovação: não aparece na busca das famílias.
  aprovadoEm: z.date().nullable(),
  veiculos: z.array(veiculo),
});

export type PosicaoInput = z.infer<typeof posicaoBody>;
export type TipoEventoInput = z.infer<typeof tipoEventoDoMotorista>;
export type VeiculoInput = z.infer<typeof veiculoBody>;
export type PerfilInput = z.infer<typeof perfilBody>;
