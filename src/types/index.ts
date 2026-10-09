// Tipos do domínio do Pitaya Escolar (versão frontend/mock).
// Os nomes dos status seguem docs/DATABASE.md e docs/BUSINESS_RULES.md.
// Quando existir backend, estes tipos serão gerados a partir do schema (Dia 3).

/** Estados de uma viagem (RN-08: PLANEJADA → EM_ANDAMENTO → FINALIZADA, sem volta). */
export type StatusViagem = 'PLANEJADA' | 'EM_ANDAMENTO' | 'FINALIZADA';

/**
 * Situação de um aluno em uma viagem.
 * AGUARDANDO é só um estado de tela ("ainda não há evento registrado").
 * No banco só existirão eventos EMBARCADO e ENTREGUE.
 */
export type StatusAluno = 'AGUARDANDO' | 'EMBARCADO' | 'ENTREGUE';

export type Veiculo = {
  placa: string;
  modelo: string;
};

export type Aluno = {
  id: string;
  nome: string;
};

export type Rota = {
  id: string;
  nome: string;
  veiculo: Veiculo;
  alunos: Aluno[];
};

export type ViagemHistorico = {
  id: string;
  rotaNome: string;
  data: string;
  totalAlunos: number;
};

/** O que o responsável enxerga sobre um filho. */
export type Filho = {
  id: string;
  nome: string;
  statusViagem: StatusViagem;
  statusAluno: StatusAluno;
  motoristaNome: string;
  veiculo: Veiculo;
};
