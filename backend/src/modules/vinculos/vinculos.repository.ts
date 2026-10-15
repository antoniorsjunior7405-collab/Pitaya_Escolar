import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  gt,
  gte,
  ilike,
  isNotNull,
  isNull,
  lte,
  sql,
} from 'drizzle-orm';
import { alias, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { registrarAuditoria } from '../../db/auditoria.js';
import type { Db } from '../../db/index.js';
import { schema } from '../../db/index.js';
import type { EstadoSolicitacao } from './vinculos.schemas.js';

export type MotoristaPublicoRow = {
  id: string;
  nome: string;
  regiaoAtendimento: string | null;
  apresentacao: string | null;
  veiculoModelo: string | null;
};

/** Pedido visto pelo responsável. motoristaTelefone só vem preenchido depois do aceite. */
export type SolicitacaoRow = {
  id: string;
  estado: EstadoSolicitacao;
  criadoEm: Date;
  expiraEm: Date;
  respondidaEm: Date | null;
  responsavelId: string;
  alunoId: string;
  alunoNome: string;
  motoristaId: string;
  motoristaNome: string;
  motoristaRegiao: string | null;
  motoristaTelefone: string | null;
};

/** Pedido visto pelo motorista. Os nomes completos não saem do service. */
export type PedidoRecebidoRow = {
  id: string;
  estado: EstadoSolicitacao;
  criadoEm: Date;
  expiraEm: Date;
  alunoNome: string;
  responsavelNome: string;
};

export type ResultadoPedido =
  | { tipo: 'criada' | 'existente'; solicitacao: SolicitacaoRow }
  | {
      tipo:
        | 'aluno-nao-encontrado'
        | 'motorista-nao-encontrado'
        | 'ja-vinculado'
        | 'pendente-de-outro-responsavel'
        | 'recusada-recentemente'
        | 'limite';
    };

/** Resultado de uma mudança de estado atômica (cancelar, aceitar, recusar). */
export type ResultadoMudanca = 'ok' | 'nao-encontrada' | 'ja-respondida';
/** Resposta do motorista: além da mudança, a conta dele precisa continuar habilitada. */
export type ResultadoResposta = ResultadoMudanca | 'motorista-nao-habilitado';

// Camada de dados do módulo. O service só conhece esta interface (facilita testes).
export interface VinculosRepository {
  /** Só motoristas aprovados, ativos e de organização ativa. Ordem estável: nome, id. */
  buscarMotoristas(filtro: {
    termo?: string | undefined;
    regiao?: string | undefined;
    limit: number;
    cursor?: string | undefined;
  }): Promise<MotoristaPublicoRow[]>;
  /**
   * Na mesma transação: confere a posse do aluno, o motorista, vínculo já ativo, recusa recente
   * e o limite de pendentes; devolve o pendente que já existe (idempotente) ou cria um novo,
   * com registro de auditoria. A conferência trava a conta do responsável (sem corrida).
   */
  criarSolicitacao(input: {
    responsavelId: string;
    alunoId: string;
    motoristaId: string;
    expiraEm: Date;
    maxPendentes: number;
    recusadaDesde: Date;
  }): Promise<ResultadoPedido>;
  listarSolicitacoesDoResponsavel(responsavelId: string, limit: number): Promise<SolicitacaoRow[]>;
  /** undefined se o pedido não é do responsável (sem IDOR). */
  buscarSolicitacaoDoResponsavel(
    responsavelId: string,
    solicitacaoId: string,
  ): Promise<SolicitacaoRow | undefined>;
  cancelarSolicitacao(responsavelId: string, solicitacaoId: string): Promise<ResultadoMudanca>;
  /** Só pendentes e não vencidos de aluno ativo, endereçados a motorista ainda habilitado. */
  listarPedidosRecebidos(motoristaId: string, limit: number): Promise<PedidoRecebidoRow[]>;
  buscarPedidoRecebido(
    motoristaId: string,
    solicitacaoId: string,
  ): Promise<PedidoRecebidoRow | undefined>;
  /**
   * Aceitar cria o vínculo ativo na mesma transação. Motorista que perdeu a aprovação (ou a
   * conta, ou a organização) não responde; pedido de aluno já excluído não pode ser aceito.
   */
  responderSolicitacao(
    motoristaId: string,
    solicitacaoId: string,
    decisao: 'ACEITA' | 'RECUSADA',
  ): Promise<ResultadoResposta>;
}

/**
 * Padrão "contém" para ILIKE com os curingas do usuário escapados: "%" ou "_" digitados não
 * podem casar com todos os nomes e furar o filtro obrigatório. A barra é o escape padrão do LIKE.
 */
export function padraoContem(texto: string): string {
  return `%${texto.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export function createVinculosRepository(db: Db): VinculosRepository {
  const {
    usuarios,
    perfisMotorista,
    membros,
    organizacoes,
    veiculos,
    alunos,
    responsaveisAlunos,
    solicitacoesVinculo: s,
    vinculosMotoristaAluno,
  } = schema;
  const motorista = alias(usuarios, 'motorista');
  const responsavel = alias(usuarios, 'responsavel');
  const perfil = alias(perfisMotorista, 'perfil');

  type Executor = Pick<Db, 'select'>;

  // Pendente com o prazo vencido já é lido como EXPIRADA, mesmo antes de ser gravado assim.
  const estadoEfetivo = sql<EstadoSolicitacao>`CASE WHEN ${s.estado} = 'PENDENTE' AND ${s.expiraEm} <= now() THEN 'EXPIRADA' ELSE ${s.estado} END`;
  const pendenteValido = and(eq(s.estado, 'PENDENTE'), gt(s.expiraEm, sql`now()`));

  // Motorista que pode ser encontrado e receber pedidos: conta ativa, aprovado pela plataforma
  // e membro MOTORISTA de uma organização ativa.
  const visivel = (usuarioId: AnyPgColumn, ativo: AnyPgColumn, aprovadoEm: AnyPgColumn) =>
    and(
      eq(ativo, true),
      isNotNull(aprovadoEm),
      exists(
        db
          .select({ um: sql`1` })
          .from(membros)
          .innerJoin(organizacoes, eq(organizacoes.id, membros.organizacaoId))
          .where(
            and(
              eq(membros.usuarioId, usuarioId),
              eq(membros.papel, 'MOTORISTA'),
              eq(organizacoes.ativa, true),
            ),
          ),
      ),
    );

  // Aluno ativo com vínculo AUTORIZADO do responsável (da família ou da escola).
  const doResponsavel = (responsavelId: string) =>
    and(
      eq(alunos.ativo, true),
      exists(
        db
          .select({ um: sql`1` })
          .from(responsaveisAlunos)
          .where(
            and(
              eq(responsaveisAlunos.alunoId, alunos.id),
              eq(responsaveisAlunos.responsavelId, responsavelId),
              eq(responsaveisAlunos.autorizado, true),
            ),
          ),
      ),
    );

  const colunasSolicitacao = {
    id: s.id,
    estado: estadoEfetivo,
    criadoEm: s.criadoEm,
    expiraEm: s.expiraEm,
    respondidaEm: s.respondidaEm,
    responsavelId: s.responsavelId,
    alunoId: alunos.id,
    alunoNome: alunos.nome,
    motoristaId: motorista.id,
    motoristaNome: motorista.nome,
    motoristaRegiao: perfil.regiaoAtendimento,
    // O contato do motorista só é liberado à família depois do aceite.
    motoristaTelefone: sql<
      string | null
    >`CASE WHEN ${s.estado} = 'ACEITA' THEN ${motorista.telefone} END`,
  };

  const selecionarSolicitacoes = (executor: Executor) =>
    executor
      .select(colunasSolicitacao)
      .from(s)
      .innerJoin(alunos, eq(alunos.id, s.alunoId))
      .innerJoin(motorista, eq(motorista.id, s.motoristaId))
      .leftJoin(perfil, eq(perfil.usuarioId, motorista.id));

  // O mesmo critério da busca, para um motorista dado: quem perde a aprovação não recebe
  // pedidos novos, não vê os que tinha e não consegue aceitá-los.
  const motoristaHabilitado = (executor: Executor, motoristaId: string) =>
    executor
      .select({ id: motorista.id })
      .from(motorista)
      .innerJoin(perfil, eq(perfil.usuarioId, motorista.id))
      .where(
        and(
          eq(motorista.id, motoristaId),
          visivel(motorista.id, motorista.ativo, perfil.aprovadoEm),
        ),
      );

  const selecionarPedidosRecebidos = (executor: Executor) =>
    executor
      .select({
        id: s.id,
        estado: estadoEfetivo,
        criadoEm: s.criadoEm,
        expiraEm: s.expiraEm,
        alunoNome: alunos.nome,
        responsavelNome: responsavel.nome,
      })
      .from(s)
      .innerJoin(alunos, eq(alunos.id, s.alunoId))
      .innerJoin(responsavel, eq(responsavel.id, s.responsavelId));

  return {
    buscarMotoristas({ termo, regiao, limit, cursor }) {
      // Modelo do veículo próprio do motorista (o primeiro cadastrado). Placa não sai.
      const veiculoModelo = sql<string | null>`(
        SELECT ${veiculos.modelo} FROM ${veiculos}
        WHERE ${veiculos.motoristaId} = ${usuarios.id} AND ${veiculos.ativo}
        ORDER BY ${veiculos.criadoEm} LIMIT 1
      )`;
      return db
        .select({
          id: usuarios.id,
          nome: usuarios.nome,
          regiaoAtendimento: perfisMotorista.regiaoAtendimento,
          apresentacao: perfisMotorista.apresentacao,
          veiculoModelo,
        })
        .from(usuarios)
        .innerJoin(perfisMotorista, eq(perfisMotorista.usuarioId, usuarios.id))
        .where(
          and(
            visivel(usuarios.id, usuarios.ativo, perfisMotorista.aprovadoEm),
            termo ? ilike(usuarios.nome, padraoContem(termo)) : undefined,
            regiao ? ilike(perfisMotorista.regiaoAtendimento, padraoContem(regiao)) : undefined,
            // Paginação por cursor: continua depois do último motorista da página anterior.
            cursor
              ? sql`(${usuarios.nome}, ${usuarios.id}) > (SELECT u2.nome, u2.id FROM usuarios u2 WHERE u2.id = ${cursor})`
              : undefined,
          ),
        )
        .orderBy(asc(usuarios.nome), asc(usuarios.id))
        .limit(limit);
    },

    criarSolicitacao({
      responsavelId,
      alunoId,
      motoristaId,
      expiraEm,
      maxPendentes,
      recusadaDesde,
    }) {
      return db.transaction(async (tx): Promise<ResultadoPedido> => {
        // Trava a conta do responsável: pedidos simultâneos não furam o limite de pendentes.
        await tx
          .select({ id: usuarios.id })
          .from(usuarios)
          .where(eq(usuarios.id, responsavelId))
          .for('update');

        const [aluno] = await tx
          .select({ id: alunos.id })
          .from(alunos)
          .where(and(eq(alunos.id, alunoId), doResponsavel(responsavelId)))
          .limit(1);
        if (!aluno) return { tipo: 'aluno-nao-encontrado' };

        const [destino] = await motoristaHabilitado(tx, motoristaId).limit(1);
        if (!destino) return { tipo: 'motorista-nao-encontrado' };

        const [ativo] = await tx
          .select({ id: vinculosMotoristaAluno.id })
          .from(vinculosMotoristaAluno)
          .where(
            and(
              eq(vinculosMotoristaAluno.alunoId, alunoId),
              eq(vinculosMotoristaAluno.motoristaId, motoristaId),
              isNull(vinculosMotoristaAluno.fimEm),
            ),
          )
          .limit(1);
        if (ativo) return { tipo: 'ja-vinculado' };

        // Pendente vencido vira EXPIRADA de vez: libera o índice único para o pedido novo.
        await tx
          .update(s)
          .set({ estado: 'EXPIRADA', respondidaEm: new Date() })
          .where(
            and(
              eq(s.alunoId, alunoId),
              eq(s.motoristaId, motoristaId),
              eq(s.estado, 'PENDENTE'),
              lte(s.expiraEm, sql`now()`),
            ),
          );

        const pendente = async () => {
          const [row] = await selecionarSolicitacoes(tx)
            .where(and(eq(s.alunoId, alunoId), eq(s.motoristaId, motoristaId), pendenteValido))
            .limit(1);
          return row;
        };
        const existente = await pendente();
        if (existente) {
          // Reenvio do mesmo pedido (toque duplo, rede ruim) devolve o que já existe.
          return existente.responsavelId === responsavelId
            ? { tipo: 'existente', solicitacao: existente }
            : { tipo: 'pendente-de-outro-responsavel' };
        }

        const [recusa] = await tx
          .select({ id: s.id })
          .from(s)
          .where(
            and(
              eq(s.responsavelId, responsavelId),
              eq(s.motoristaId, motoristaId),
              eq(s.estado, 'RECUSADA'),
              gte(s.respondidaEm, recusadaDesde),
            ),
          )
          .limit(1);
        if (recusa) return { tipo: 'recusada-recentemente' };

        const [pendentes] = await tx
          .select({ total: count() })
          .from(s)
          .where(and(eq(s.responsavelId, responsavelId), pendenteValido));
        if ((pendentes?.total ?? 0) >= maxPendentes) return { tipo: 'limite' };

        const [nova] = await tx
          .insert(s)
          .values({ alunoId, responsavelId, motoristaId, expiraEm })
          .onConflictDoNothing()
          .returning({ id: s.id });
        if (!nova) {
          // Outro pedido igual entrou no mesmo instante (índice único parcial).
          const corrida = await pendente();
          return corrida?.responsavelId === responsavelId
            ? { tipo: 'existente', solicitacao: corrida }
            : { tipo: 'pendente-de-outro-responsavel' };
        }
        await registrarAuditoria(tx, {
          usuarioId: responsavelId,
          organizacaoId: null,
          acao: 'SOLICITACAO_CRIADA',
          entidade: 'solicitacao',
          entidadeId: nova.id,
        });
        const [criada] = await selecionarSolicitacoes(tx).where(eq(s.id, nova.id)).limit(1);
        if (!criada) throw new Error('falha ao ler o pedido criado');
        return { tipo: 'criada', solicitacao: criada };
      });
    },

    listarSolicitacoesDoResponsavel(responsavelId, limit) {
      return selecionarSolicitacoes(db)
        .where(eq(s.responsavelId, responsavelId))
        .orderBy(desc(s.criadoEm))
        .limit(limit);
    },

    async buscarSolicitacaoDoResponsavel(responsavelId, solicitacaoId) {
      const [row] = await selecionarSolicitacoes(db)
        .where(and(eq(s.id, solicitacaoId), eq(s.responsavelId, responsavelId)))
        .limit(1);
      return row;
    },

    cancelarSolicitacao(responsavelId, solicitacaoId) {
      return db.transaction(async (tx): Promise<ResultadoMudanca> => {
        // Conferir e mudar numa operação só: se o motorista aceitar no mesmo instante, só um
        // dos dois vence (mesma solução do refresh token).
        const [row] = await tx
          .update(s)
          .set({ estado: 'CANCELADA', respondidaEm: new Date() })
          .where(and(eq(s.id, solicitacaoId), eq(s.responsavelId, responsavelId), pendenteValido))
          .returning({ id: s.id });
        if (!row) {
          const [existe] = await tx
            .select({ id: s.id })
            .from(s)
            .where(and(eq(s.id, solicitacaoId), eq(s.responsavelId, responsavelId)))
            .limit(1);
          return existe ? 'ja-respondida' : 'nao-encontrada';
        }
        await registrarAuditoria(tx, {
          usuarioId: responsavelId,
          organizacaoId: null,
          acao: 'SOLICITACAO_CANCELADA',
          entidade: 'solicitacao',
          entidadeId: row.id,
        });
        return 'ok';
      });
    },

    listarPedidosRecebidos(motoristaId, limit) {
      return selecionarPedidosRecebidos(db)
        .where(
          and(
            eq(s.motoristaId, motoristaId),
            pendenteValido,
            eq(alunos.ativo, true),
            exists(motoristaHabilitado(db, motoristaId)),
          ),
        )
        .orderBy(asc(s.criadoEm))
        .limit(limit);
    },

    async buscarPedidoRecebido(motoristaId, solicitacaoId) {
      const [row] = await selecionarPedidosRecebidos(db)
        .where(and(eq(s.id, solicitacaoId), eq(s.motoristaId, motoristaId)))
        .limit(1);
      return row;
    },

    responderSolicitacao(motoristaId, solicitacaoId, decisao) {
      return db.transaction(async (tx): Promise<ResultadoResposta> => {
        const [habilitado] = await motoristaHabilitado(tx, motoristaId).limit(1);
        if (!habilitado) return 'motorista-nao-habilitado';

        // Aluno ativo conferido no mesmo UPDATE: pedido de aluno excluído não vira vínculo.
        const alunoAtivo = exists(
          tx
            .select({ um: sql`1` })
            .from(alunos)
            .where(and(eq(alunos.id, s.alunoId), eq(alunos.ativo, true))),
        );
        const [row] = await tx
          .update(s)
          .set({ estado: decisao, respondidaEm: new Date() })
          .where(
            and(
              eq(s.id, solicitacaoId),
              eq(s.motoristaId, motoristaId),
              pendenteValido,
              alunoAtivo,
            ),
          )
          .returning({ id: s.id, alunoId: s.alunoId });
        if (!row) {
          const [existe] = await tx
            .select({ id: s.id })
            .from(s)
            .where(and(eq(s.id, solicitacaoId), eq(s.motoristaId, motoristaId)))
            .limit(1);
          return existe ? 'ja-respondida' : 'nao-encontrada';
        }
        if (decisao === 'ACEITA') {
          await tx
            .insert(vinculosMotoristaAluno)
            .values({ alunoId: row.alunoId, motoristaId, solicitacaoId: row.id })
            .onConflictDoNothing();
        }
        await registrarAuditoria(tx, {
          usuarioId: motoristaId,
          organizacaoId: null,
          acao: decisao === 'ACEITA' ? 'SOLICITACAO_ACEITA' : 'SOLICITACAO_RECUSADA',
          entidade: 'solicitacao',
          entidadeId: row.id,
        });
        return 'ok';
      });
    },
  };
}
