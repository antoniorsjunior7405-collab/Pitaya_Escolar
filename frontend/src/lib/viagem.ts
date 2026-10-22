import type { AlunoDaRota, StatusAluno, TipoEventoDoMotorista } from '@/types';

// Regras de tela da viagem do motorista. Quem decide é o backend (regras-viagem.ts); aqui a
// interface só mostra os botões que fazem sentido e explica por que finalizar está bloqueado.

export type AcaoDoAluno = { tipo: TipoEventoDoMotorista; variante: 'primario' | 'secundario' };

/** Botões de cada aluno, conforme a situação dele na viagem em andamento. */
export function acoesDoAluno(status: StatusAluno): AcaoDoAluno[] {
  switch (status) {
    case 'AGUARDANDO':
      return [
        { tipo: 'EMBARCADO', variante: 'primario' },
        { tipo: 'AUSENTE', variante: 'secundario' },
      ];
    // A criança que faltou pode aparecer depois: embarcar corrige a falta.
    case 'AUSENTE':
      return [{ tipo: 'EMBARCADO', variante: 'secundario' }];
    case 'EMBARCADO':
      return [{ tipo: 'ENTREGUE', variante: 'primario' }];
    case 'ENTREGUE':
      return [];
  }
}

const ROTULO: Record<TipoEventoDoMotorista, string> = {
  EMBARCADO: 'Embarcou',
  ENTREGUE: 'Entregue',
  AUSENTE: 'Faltou',
};

export const rotuloDaAcao = (tipo: TipoEventoDoMotorista, nome: string) =>
  `${ROTULO[tipo]}: ${nome}`;

/** Alunos sem desfecho (nem entregues, nem ausentes): enquanto houver, não dá para finalizar. */
export const alunosPendentes = (alunos: AlunoDaRota[]) =>
  alunos.filter((a) => a.status !== 'ENTREGUE' && a.status !== 'AUSENTE').length;

export function motivoParaNaoFinalizar(pendentes: number) {
  if (pendentes === 0) return null;
  return pendentes === 1
    ? 'Para finalizar, registre a entrega ou a falta do aluno que falta.'
    : `Para finalizar, registre a entrega ou a falta dos ${pendentes} alunos que faltam.`;
}
