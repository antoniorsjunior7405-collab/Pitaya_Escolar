import { z } from 'zod';

// ── Vínculo família–motorista: busca, pedido e resposta ─────────────────────
// strictObject: campo desconhecido é recusado (400), conforme BOAS_PRATICAS §7. Responsável e
// motorista NUNCA vêm do corpo nem da URL: saem do token.

export const ESTADOS_SOLICITACAO = [
  'PENDENTE',
  'ACEITA',
  'RECUSADA',
  'CANCELADA',
  'EXPIRADA',
] as const;
const estado = z.enum(ESTADOS_SOLICITACAO);

export const solicitacaoParams = z.object({ solicitacaoId: z.uuid() });

const limit = (max: number) => z.coerce.number().int().min(1).max(max).default(max);

// Toda listagem é paginada por cursor (BOAS_PRATICAS §6): o cursor é o id do último item da
// página anterior, e proximoCursor null indica a última página.
const pagina = <T extends z.ZodType>(item: T) =>
  z.object({ itens: z.array(item), proximoCursor: z.uuid().nullable() });

// Busca: filtro obrigatório (nome ou região com 3+ letras). Não existe "listar todos": a
// família procura alguém com quem já combinou, e a busca não vira lista de contatos.
export const buscaMotoristasQuery = z
  .strictObject({
    termo: z.string().trim().min(3).max(80).optional(),
    regiao: z.string().trim().min(3).max(80).optional(),
    limit: limit(20),
    cursor: z.uuid().optional(),
  })
  .refine((q) => q.termo !== undefined || q.regiao !== undefined, {
    message: 'Informe o nome ou a região do motorista',
  });

// Só dados públicos: sem telefone, e-mail ou placa. O telefone aparece depois do aceite.
export const motoristaPublico = z.object({
  id: z.uuid(),
  nome: z.string(),
  regiaoAtendimento: z.string().nullable(),
  apresentacao: z.string().nullable(),
  veiculoModelo: z.string().nullable(),
});

export const buscaMotoristasResponse = pagina(motoristaPublico);

export const listaQuery = z.strictObject({ limit: limit(20), cursor: z.uuid().optional() });

export const pedidoBody = z.strictObject({ motoristaId: z.uuid(), alunoId: z.uuid() });

// O que o responsável vê do próprio pedido (tela de espera).
export const solicitacao = z.object({
  id: z.uuid(),
  estado,
  criadoEm: z.date(),
  expiraEm: z.date(),
  respondidaEm: z.date().nullable(),
  aluno: z.object({ id: z.uuid(), nome: z.string() }),
  motorista: z.object({
    id: z.uuid(),
    nome: z.string(),
    regiaoAtendimento: z.string().nullable(),
    // null enquanto o pedido não foi aceito.
    telefone: z.string().nullable(),
  }),
});

// O que o motorista vê de um pedido recebido: só primeiros nomes (minimização, LGPD). Endereço,
// escola e o resto do aluno só depois do aceite.
export const pedidoRecebido = z.object({
  id: z.uuid(),
  estado,
  criadoEm: z.date(),
  expiraEm: z.date(),
  alunoPrimeiroNome: z.string(),
  responsavelPrimeiroNome: z.string(),
});

export const paginaSolicitacoes = pagina(solicitacao);
export const paginaPedidosRecebidos = pagina(pedidoRecebido);

export type BuscaMotoristasInput = z.infer<typeof buscaMotoristasQuery>;
export type ListaInput = z.infer<typeof listaQuery>;
export type PedidoInput = z.infer<typeof pedidoBody>;
export type EstadoSolicitacao = z.infer<typeof estado>;
