import type { EventoRow } from '../db/consultas.js';

export type StatusAluno = 'AGUARDANDO' | 'EMBARCADO' | 'ENTREGUE' | 'AUSENTE';

// Da menos para a mais avançada. EMBARCADO vence AUSENTE: se o motorista marcou falta e a
// criança apareceu depois, o embarque corrige a falta.
const ORDEM: readonly StatusAluno[] = ['AGUARDANDO', 'AUSENTE', 'EMBARCADO', 'ENTREGUE'];

/**
 * Situação de um aluno numa viagem, derivada dos eventos do motorista. "AGUARDANDO" significa
 * "nenhum evento ainda". CHEGADA_CONFIRMADA (do responsável) não muda a situação: ver
 * chegadaConfirmada.
 */
export function statusDoAluno(eventos: EventoRow[], alunoId: string): StatusAluno {
  let status: StatusAluno = 'AGUARDANDO';
  for (const e of eventos) {
    if (e.alunoId !== alunoId || e.tipo === 'CHEGADA_CONFIRMADA') continue;
    if (ORDEM.indexOf(e.tipo) > ORDEM.indexOf(status)) status = e.tipo;
  }
  return status;
}

/** O responsável já confirmou que a criança chegou? */
export function chegadaConfirmada(eventos: EventoRow[], alunoId: string) {
  return eventos.some((e) => e.alunoId === alunoId && e.tipo === 'CHEGADA_CONFIRMADA');
}
