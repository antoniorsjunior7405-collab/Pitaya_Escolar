import type { Membro } from '../../shared/acesso/acesso.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  RegraDeNegocioError,
} from '../../shared/errors/app-error.js';
import type {
  PedidoRecebidoRow,
  SolicitacaoRow,
  VinculosRepository,
} from './vinculos.repository.js';
import type { BuscaMotoristasInput, PedidoInput } from './vinculos.schemas.js';

/** Quanto tempo o motorista tem para responder antes de o pedido vencer sozinho. */
export const PRAZO_PEDIDO_DIAS = 7;
/** Pedidos pendentes ao mesmo tempo por responsável (contra pedidos em massa / spam). */
export const MAX_PEDIDOS_PENDENTES = 5;
/** Depois de uma recusa, o mesmo responsável não insiste com o mesmo motorista por este prazo. */
export const BLOQUEIO_APOS_RECUSA_DIAS = 7;

const DIA_MS = 24 * 60 * 60 * 1000;
const PEDIDO_NAO_ENCONTRADO = 'Pedido não encontrado';

/** Só o primeiro nome: o motorista não precisa do nome completo antes do aceite. */
export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? '';
}

function paraResponsavel(r: SolicitacaoRow) {
  return {
    id: r.id,
    estado: r.estado,
    criadoEm: r.criadoEm,
    expiraEm: r.expiraEm,
    respondidaEm: r.respondidaEm,
    aluno: { id: r.alunoId, nome: r.alunoNome },
    motorista: {
      id: r.motoristaId,
      nome: r.motoristaNome,
      regiaoAtendimento: r.motoristaRegiao,
      telefone: r.motoristaTelefone,
    },
  };
}

function paraMotorista(r: PedidoRecebidoRow) {
  return {
    id: r.id,
    estado: r.estado,
    criadoEm: r.criadoEm,
    expiraEm: r.expiraEm,
    alunoPrimeiroNome: primeiroNome(r.alunoNome),
    responsavelPrimeiroNome: primeiroNome(r.responsavelNome),
  };
}

export function criarVinculosService(repo: VinculosRepository, agora = () => new Date()) {
  /** Pedido de outra família responde 404 (sem IDOR). */
  async function detalharSolicitacao(m: Membro, solicitacaoId: string) {
    const row = await repo.buscarSolicitacaoDoResponsavel(m.usuarioId, solicitacaoId);
    if (!row) throw new NotFoundError(PEDIDO_NAO_ENCONTRADO);
    return paraResponsavel(row);
  }

  return {
    // ── Responsável ────────────────────────────────────────────────────────

    async buscarMotoristas(_m: Membro, filtro: BuscaMotoristasInput) {
      const itens = await repo.buscarMotoristas(filtro);
      // Página cheia: pode haver mais. O cursor é o último da página (ordem nome, id).
      const proximoCursor = itens.length === filtro.limit ? (itens.at(-1)?.id ?? null) : null;
      return { itens, proximoCursor };
    },

    /** Idempotente: repetir o mesmo pedido devolve o pendente que já existe (criada: false). */
    async pedirVinculo(m: Membro, input: PedidoInput) {
      const hoje = agora().getTime();
      const resultado = await repo.criarSolicitacao({
        responsavelId: m.usuarioId,
        alunoId: input.alunoId,
        motoristaId: input.motoristaId,
        expiraEm: new Date(hoje + PRAZO_PEDIDO_DIAS * DIA_MS),
        maxPendentes: MAX_PEDIDOS_PENDENTES,
        recusadaDesde: new Date(hoje - BLOQUEIO_APOS_RECUSA_DIAS * DIA_MS),
      });
      switch (resultado.tipo) {
        case 'criada':
        case 'existente':
          return {
            solicitacao: paraResponsavel(resultado.solicitacao),
            criada: resultado.tipo === 'criada',
          };
        // 404 (e não 403) para não revelar se o aluno existe em outra família.
        case 'aluno-nao-encontrado':
          throw new NotFoundError('Aluno não encontrado');
        case 'motorista-nao-encontrado':
          throw new NotFoundError('Motorista não encontrado');
        case 'ja-vinculado':
          throw new ConflictError('Este motorista já transporta este aluno');
        case 'pendente-de-outro-responsavel':
          throw new ConflictError('Já existe um pedido pendente deste aluno para este motorista');
        case 'recusada-recentemente':
          throw new RegraDeNegocioError(
            `O motorista recusou um pedido seu recentemente. Tente de novo depois de ${BLOQUEIO_APOS_RECUSA_DIAS} dias ou procure outro motorista.`,
          );
        case 'limite':
          throw new RegraDeNegocioError(
            `Você já tem ${MAX_PEDIDOS_PENDENTES} pedidos aguardando resposta. Espere uma resposta ou cancele um deles.`,
          );
      }
    },

    async listarSolicitacoes(m: Membro, limit: number) {
      return (await repo.listarSolicitacoesDoResponsavel(m.usuarioId, limit)).map(paraResponsavel);
    },

    detalharSolicitacao,

    async cancelarSolicitacao(m: Membro, solicitacaoId: string) {
      const resultado = await repo.cancelarSolicitacao(m.usuarioId, solicitacaoId);
      if (resultado === 'nao-encontrada') throw new NotFoundError(PEDIDO_NAO_ENCONTRADO);
      if (resultado === 'ja-respondida') {
        throw new ConflictError('Este pedido já foi respondido ou venceu');
      }
      return detalharSolicitacao(m, solicitacaoId);
    },

    // ── Motorista ──────────────────────────────────────────────────────────

    async listarPedidosRecebidos(m: Membro, limit: number) {
      return (await repo.listarPedidosRecebidos(m.usuarioId, limit)).map(paraMotorista);
    },

    /** Aceitar ou recusar. Pedido de outro motorista responde 404; conta não aprovada, 403. */
    async responder(m: Membro, solicitacaoId: string, decisao: 'ACEITA' | 'RECUSADA') {
      const resultado = await repo.responderSolicitacao(m.usuarioId, solicitacaoId, decisao);
      if (resultado === 'motorista-nao-habilitado') {
        throw new ForbiddenError('Sua conta de motorista não está aprovada para responder pedidos');
      }
      if (resultado === 'nao-encontrada') throw new NotFoundError(PEDIDO_NAO_ENCONTRADO);
      if (resultado === 'ja-respondida') {
        throw new ConflictError('Este pedido já foi respondido, cancelado ou venceu');
      }
      const row = await repo.buscarPedidoRecebido(m.usuarioId, solicitacaoId);
      if (!row) throw new NotFoundError(PEDIDO_NAO_ENCONTRADO);
      return paraMotorista(row);
    },
  };
}

export type VinculosService = ReturnType<typeof criarVinculosService>;
