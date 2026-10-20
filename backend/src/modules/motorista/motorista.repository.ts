import { and, asc, count, desc, eq, lt } from 'drizzle-orm';
import {
  buscarViagemAtual,
  colunasViagem,
  listarEventos,
  type EventoRow,
  type TipoEvento,
  type ViagemRow,
} from '../../db/consultas.js';
import { ehViolacaoUnica } from '../../db/erros.js';
import type { Db } from '../../db/index.js';
import { schema } from '../../db/index.js';

export type Escopo = { organizacaoId: string; motoristaId: string };

export type RotaRow = {
  id: string;
  nome: string;
  periodo: 'MANHA' | 'TARDE' | 'NOITE' | null;
  veiculoId: string;
  veiculo: { placa: string; modelo: string };
};

export type AlunoDaRota = { id: string; nome: string; ordem: number; endereco: string | null };

export type HistoricoRow = {
  id: string;
  rotaNome: string;
  data: string;
  iniciadaEm: Date | null;
  finalizadaEm: Date | null;
  alunosAtendidos: number;
};

export type PerfilRow = {
  nome: string;
  email: string;
  telefone: string | null;
  apresentacao: string | null;
  regiaoAtendimento: string | null;
  /** null enquanto a plataforma não confere os documentos: o motorista não aparece na busca. */
  aprovadoEm: Date | null;
};

export type DadosPerfil = Omit<PerfilRow, 'email' | 'aprovadoEm'>;

export type VeiculoRow = { id: string; placa: string; modelo: string; capacidade: number | null };

export type DadosVeiculo = Omit<VeiculoRow, 'id'>;

// Toda consulta é filtrada por organização E motorista: um motorista nunca enxerga
// rotas/viagens de outro, mesmo conhecendo o id (evita IDOR).
export interface MotoristaRepository {
  listarRotas(escopo: Escopo): Promise<(Omit<RotaRow, 'veiculoId'> & { totalAlunos: number })[]>;
  buscarRota(escopo: Escopo, rotaId: string): Promise<RotaRow | undefined>;
  listarAlunosDaRota(rotaId: string): Promise<AlunoDaRota[]>;
  alunoEstaNaRota(rotaId: string, alunoId: string): Promise<boolean>;
  buscarViagemAtual(rotaId: string, hoje: string): Promise<ViagemRow | undefined>;
  buscarViagem(escopo: Escopo, viagemId: string): Promise<ViagemRow | undefined>;
  listarEventos(viagemId: string): Promise<EventoRow[]>;
  /** Cria a viagem já EM_ANDAMENTO. undefined se a rota já tem uma em andamento. */
  criarViagemEmAndamento(input: {
    escopo: Escopo;
    rotaId: string;
    veiculoId: string;
    data: string;
  }): Promise<ViagemRow | undefined>;
  /** Grava o evento. undefined se ele já existia (reenvio). */
  registrarEvento(input: {
    viagemId: string;
    alunoId: string;
    tipo: TipoEvento;
    registradoPor: string;
  }): Promise<EventoRow | undefined>;
  finalizarViagem(viagemId: string): Promise<ViagemRow | undefined>;
  salvarPosicao(
    viagemId: string,
    posicao: { latitude: number; longitude: number; velocidade: number | null },
  ): Promise<void>;
  historico(escopo: Escopo, limite: number, antesDe?: Date): Promise<HistoricoRow[]>;

  /** Perfil do próprio usuário. undefined se a conta não existe ou está inativa. */
  buscarPerfil(usuarioId: string): Promise<PerfilRow | undefined>;
  /**
   * Grava nome/telefone (usuarios) e o perfil (perfis_motorista) na mesma transação.
   * false (e nada gravado) se a conta não existe ou está inativa.
   */
  salvarPerfil(usuarioId: string, dados: DadosPerfil): Promise<boolean>;

  /** Só os veículos ativos do próprio motorista, naquela organização. */
  listarVeiculos(escopo: Escopo): Promise<VeiculoRow[]>;
  /** undefined se a placa já existe. */
  criarVeiculo(escopo: Escopo, dados: DadosVeiculo): Promise<VeiculoRow | undefined>;
  atualizarVeiculo(
    escopo: Escopo,
    veiculoId: string,
    dados: DadosVeiculo,
  ): Promise<VeiculoRow | 'nao-encontrado' | 'placa-duplicada'>;
}

export function createMotoristaRepository(db: Db): MotoristaRepository {
  const {
    rotas,
    veiculos,
    rotaAlunos,
    alunos,
    viagens,
    eventosViagem,
    posicoesViagem,
    usuarios,
    perfisMotorista,
  } = schema;

  const daRota = (escopo: Escopo) =>
    and(
      eq(rotas.organizacaoId, escopo.organizacaoId),
      eq(rotas.motoristaId, escopo.motoristaId),
      eq(rotas.ativa, true),
    );

  // Veículo do PRÓPRIO motorista: organização e dono conferidos juntos (evita IDOR).
  const doMotorista = (escopo: Escopo) =>
    and(
      eq(veiculos.organizacaoId, escopo.organizacaoId),
      eq(veiculos.motoristaId, escopo.motoristaId),
      eq(veiculos.ativo, true),
    );

  const colunasVeiculo = {
    id: veiculos.id,
    placa: veiculos.placa,
    modelo: veiculos.modelo,
    capacidade: veiculos.capacidade,
  };

  return {
    async listarRotas(escopo) {
      return db
        .select({
          id: rotas.id,
          nome: rotas.nome,
          periodo: rotas.periodo,
          veiculo: { placa: veiculos.placa, modelo: veiculos.modelo },
          totalAlunos: count(rotaAlunos.alunoId),
        })
        .from(rotas)
        .innerJoin(veiculos, eq(veiculos.id, rotas.veiculoId))
        .leftJoin(rotaAlunos, eq(rotaAlunos.rotaId, rotas.id))
        .where(daRota(escopo))
        .groupBy(rotas.id, veiculos.id)
        .orderBy(asc(rotas.nome));
    },

    async buscarRota(escopo, rotaId) {
      const [row] = await db
        .select({
          id: rotas.id,
          nome: rotas.nome,
          periodo: rotas.periodo,
          veiculoId: rotas.veiculoId,
          veiculo: { placa: veiculos.placa, modelo: veiculos.modelo },
        })
        .from(rotas)
        .innerJoin(veiculos, eq(veiculos.id, rotas.veiculoId))
        .where(and(daRota(escopo), eq(rotas.id, rotaId)))
        .limit(1);
      return row;
    },

    async listarAlunosDaRota(rotaId) {
      return db
        .select({
          id: alunos.id,
          nome: alunos.nome,
          ordem: rotaAlunos.ordem,
          endereco: rotaAlunos.endereco,
        })
        .from(rotaAlunos)
        .innerJoin(alunos, eq(alunos.id, rotaAlunos.alunoId))
        .where(and(eq(rotaAlunos.rotaId, rotaId), eq(alunos.ativo, true)))
        .orderBy(asc(rotaAlunos.ordem));
    },

    async alunoEstaNaRota(rotaId, alunoId) {
      const [row] = await db
        .select({ alunoId: rotaAlunos.alunoId })
        .from(rotaAlunos)
        .where(and(eq(rotaAlunos.rotaId, rotaId), eq(rotaAlunos.alunoId, alunoId)))
        .limit(1);
      return row !== undefined;
    },

    buscarViagemAtual: (rotaId, hoje) => buscarViagemAtual(db, rotaId, hoje),
    listarEventos: (viagemId) => listarEventos(db, viagemId),

    async buscarViagem(escopo, viagemId) {
      const [row] = await db
        .select(colunasViagem)
        .from(viagens)
        .where(
          and(
            eq(viagens.id, viagemId),
            eq(viagens.organizacaoId, escopo.organizacaoId),
            eq(viagens.motoristaId, escopo.motoristaId),
          ),
        )
        .limit(1);
      return row;
    },

    async criarViagemEmAndamento({ escopo, rotaId, veiculoId, data }) {
      try {
        const [row] = await db
          .insert(viagens)
          .values({
            organizacaoId: escopo.organizacaoId,
            motoristaId: escopo.motoristaId,
            rotaId,
            veiculoId,
            data,
            status: 'EM_ANDAMENTO',
            iniciadaEm: new Date(),
          })
          .returning(colunasViagem);
        return row;
      } catch (erro) {
        // Índice único parcial: só uma viagem EM_ANDAMENTO por rota (corrida entre dois toques).
        if (ehViolacaoUnica(erro)) return undefined;
        throw erro;
      }
    },

    async registrarEvento(input) {
      const [row] = await db
        .insert(eventosViagem)
        .values(input)
        .onConflictDoNothing({
          target: [eventosViagem.viagemId, eventosViagem.alunoId, eventosViagem.tipo],
        })
        .returning({
          alunoId: eventosViagem.alunoId,
          tipo: eventosViagem.tipo,
          registradoEm: eventosViagem.registradoEm,
        });
      return row;
    },

    // Finaliza e APAGA a última posição do veículo na mesma transação: fora da viagem a
    // localização não tem mais uso e não deve ficar guardada (LGPD: dados de menores).
    async finalizarViagem(viagemId) {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .update(viagens)
          .set({ status: 'FINALIZADA', finalizadaEm: new Date() })
          .where(and(eq(viagens.id, viagemId), eq(viagens.status, 'EM_ANDAMENTO')))
          .returning(colunasViagem);
        if (row) await tx.delete(posicoesViagem).where(eq(posicoesViagem.viagemId, viagemId));
        return row;
      });
    },

    async salvarPosicao(viagemId, posicao) {
      const agora = new Date();
      await db
        .insert(posicoesViagem)
        .values({ viagemId, ...posicao, atualizadaEm: agora })
        .onConflictDoUpdate({
          target: posicoesViagem.viagemId,
          set: { ...posicao, atualizadaEm: agora },
        });
    },

    async historico(escopo, limite, antesDe) {
      return db
        .select({
          id: viagens.id,
          rotaNome: rotas.nome,
          data: viagens.data,
          iniciadaEm: viagens.iniciadaEm,
          finalizadaEm: viagens.finalizadaEm,
          alunosAtendidos: count(eventosViagem.id),
        })
        .from(viagens)
        .innerJoin(rotas, eq(rotas.id, viagens.rotaId))
        .leftJoin(
          eventosViagem,
          and(eq(eventosViagem.viagemId, viagens.id), eq(eventosViagem.tipo, 'EMBARCADO')),
        )
        .where(
          and(
            eq(viagens.organizacaoId, escopo.organizacaoId),
            eq(viagens.motoristaId, escopo.motoristaId),
            eq(viagens.status, 'FINALIZADA'),
            antesDe ? lt(viagens.finalizadaEm, antesDe) : undefined,
          ),
        )
        .groupBy(viagens.id, rotas.id)
        .orderBy(desc(viagens.finalizadaEm))
        .limit(limite);
    },

    async buscarPerfil(usuarioId) {
      const [row] = await db
        .select({
          nome: usuarios.nome,
          email: usuarios.email,
          telefone: usuarios.telefone,
          apresentacao: perfisMotorista.apresentacao,
          regiaoAtendimento: perfisMotorista.regiaoAtendimento,
          aprovadoEm: perfisMotorista.aprovadoEm,
        })
        .from(usuarios)
        // LEFT JOIN: o motorista recém-cadastrado ainda não tem linha em perfis_motorista.
        .leftJoin(perfisMotorista, eq(perfisMotorista.usuarioId, usuarios.id))
        .where(and(eq(usuarios.id, usuarioId), eq(usuarios.ativo, true)))
        .limit(1);
      return row;
    },

    salvarPerfil(usuarioId, dados) {
      return db.transaction(async (tx) => {
        // O token de acesso continua válido por alguns minutos depois que a conta é
        // desativada: a conferência de "ativo" fica aqui, junto da escrita.
        const atualizados = await tx
          .update(usuarios)
          .set({ nome: dados.nome, telefone: dados.telefone })
          .where(and(eq(usuarios.id, usuarioId), eq(usuarios.ativo, true)))
          .returning({ id: usuarios.id });
        if (atualizados.length === 0) return false;
        const perfil = {
          apresentacao: dados.apresentacao,
          regiaoAtendimento: dados.regiaoAtendimento,
          atualizadoEm: new Date(),
        };
        await tx
          .insert(perfisMotorista)
          .values({ usuarioId, ...perfil })
          .onConflictDoUpdate({ target: perfisMotorista.usuarioId, set: perfil });
        return true;
      });
    },

    listarVeiculos(escopo) {
      return db
        .select(colunasVeiculo)
        .from(veiculos)
        .where(doMotorista(escopo))
        .orderBy(asc(veiculos.placa));
    },

    async criarVeiculo(escopo, dados) {
      try {
        const [row] = await db
          .insert(veiculos)
          .values({
            organizacaoId: escopo.organizacaoId,
            motoristaId: escopo.motoristaId,
            ...dados,
          })
          .returning(colunasVeiculo);
        return row;
      } catch (erro) {
        if (ehViolacaoUnica(erro)) return undefined;
        throw erro;
      }
    },

    async atualizarVeiculo(escopo, veiculoId, dados) {
      try {
        const [row] = await db
          .update(veiculos)
          .set(dados)
          .where(and(doMotorista(escopo), eq(veiculos.id, veiculoId)))
          .returning(colunasVeiculo);
        return row ?? 'nao-encontrado';
      } catch (erro) {
        if (ehViolacaoUnica(erro)) return 'placa-duplicada';
        throw erro;
      }
    },
  };
}
