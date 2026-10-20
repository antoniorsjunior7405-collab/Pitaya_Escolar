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

export type Coordenada = { latitude: number; longitude: number };

export type Posicao = Coordenada & {
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

// ── Vínculo família–motorista (backend/src/modules/vinculos/vinculos.schemas.ts) ──

/** EXPIRADA = o motorista não respondeu dentro do prazo. */
export type EstadoPedido = 'PENDENTE' | 'ACEITA' | 'RECUSADA' | 'CANCELADA' | 'EXPIRADA';

/** O que a busca mostra de um motorista: só dados públicos (sem telefone, e-mail ou placa). */
export type MotoristaPublico = {
  id: string;
  nome: string;
  regiaoAtendimento: string | null;
  apresentacao: string | null;
  veiculoModelo: string | null;
};

/** Página de uma listagem. proximoCursor null = última página. */
export type Pagina<T> = { itens: T[]; proximoCursor: string | null };

/** Pedido de transporte visto pelo responsável (tela de espera). */
export type Pedido = {
  id: string;
  estado: EstadoPedido;
  criadoEm: string;
  expiraEm: string;
  respondidaEm: string | null;
  aluno: { id: string; nome: string };
  motorista: {
    id: string;
    nome: string;
    regiaoAtendimento: string | null;
    /** Só vem depois que o motorista aceita. */
    telefone: string | null;
  };
};

/** Pedido visto pelo motorista: só primeiros nomes até ele aceitar. */
export type PedidoRecebido = {
  id: string;
  estado: EstadoPedido;
  criadoEm: string;
  expiraEm: string;
  alunoPrimeiroNome: string;
  responsavelPrimeiroNome: string;
};

// ── Perfil do motorista (backend/src/modules/motorista/motorista.schemas.ts) ──

/** Situação da conta do motorista na plataforma, derivada de `aprovadoEm`. */
export type SituacaoConta = 'EM_ANALISE' | 'APROVADO';

export type VeiculoDoMotorista = Veiculo & { id: string; capacidade: number | null };

export type PerfilMotorista = {
  nome: string;
  email: string;
  telefone: string | null;
  apresentacao: string | null;
  regiaoAtendimento: string | null;
  /** null = aguardando aprovação: o motorista ainda não aparece na busca das famílias. */
  aprovadoEm: string | null;
  veiculos: VeiculoDoMotorista[];
};
