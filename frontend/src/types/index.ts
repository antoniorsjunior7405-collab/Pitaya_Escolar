// Tipos do domínio, espelhando as respostas da API (backend/src/modules/*/…schemas.ts).
// Datas chegam como string ISO no JSON.

/** Estados de uma viagem (RN-08: PLANEJADA → EM_ANDAMENTO → FINALIZADA, sem volta). */
export type StatusViagem = 'PLANEJADA' | 'EM_ANDAMENTO' | 'FINALIZADA';

/**
 * Situação de um aluno numa viagem. AGUARDANDO = nenhum evento registrado ainda;
 * no banco só existem eventos EMBARCADO e ENTREGUE.
 */
export type StatusAluno = 'AGUARDANDO' | 'EMBARCADO' | 'ENTREGUE';
export type TipoEvento = 'EMBARCADO' | 'ENTREGUE';
export type Periodo = 'MANHA' | 'TARDE' | 'NOITE';

export type Veiculo = { placa: string; modelo: string };

export type Evento = { alunoId: string; tipo: TipoEvento; registradoEm: string };

export type Viagem = {
  id: string;
  status: StatusViagem;
  data: string;
  iniciadaEm: string | null;
  finalizadaEm: string | null;
  eventos: Evento[];
};

export type RotaResumo = {
  id: string;
  nome: string;
  periodo: Periodo | null;
  veiculo: Veiculo;
  totalAlunos: number;
};

export type AlunoDaRota = {
  id: string;
  nome: string;
  ordem: number;
  endereco: string | null;
  status: StatusAluno;
};

export type RotaDetalhe = Omit<RotaResumo, 'totalAlunos'> & {
  alunos: AlunoDaRota[];
  viagemAtual: Viagem | null;
};

export type ViagemHistorico = {
  id: string;
  rotaNome: string;
  data: string;
  iniciadaEm: string | null;
  finalizadaEm: string | null;
  alunosAtendidos: number;
};

export type Posicao = {
  latitude: number;
  longitude: number;
  velocidade: number | null;
  atualizadaEm: string;
};

export type FilhoResumo = {
  id: string;
  nome: string;
  statusAluno: StatusAluno;
  viagem: { id: string; status: StatusViagem } | null;
  rotaNome: string | null;
  motorista: { nome: string; telefone: string | null } | null;
  veiculo: Veiculo | null;
};

export type FilhoDetalhe = FilhoResumo & { posicao: Posicao | null };
