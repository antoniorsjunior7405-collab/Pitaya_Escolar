import type { EventoRow } from '../db/consultas.js';

export type StatusAluno = 'AGUARDANDO' | 'EMBARCADO' | 'ENTREGUE';

/**
 * Situação de um aluno numa viagem, derivada dos eventos registrados.
 * No banco só existem EMBARCADO e ENTREGUE; "AGUARDANDO" significa "nenhum evento ainda".
 */
export function statusDoAluno(eventos: EventoRow[], alunoId: string): StatusAluno {
  let status: StatusAluno = 'AGUARDANDO';
  for (const e of eventos) {
    if (e.alunoId !== alunoId) continue;
    if (e.tipo === 'ENTREGUE') return 'ENTREGUE';
    status = 'EMBARCADO';
  }
  return status;
}
