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
}

export function createMotoristaRepository(db: Db): MotoristaRepository {
  const { rotas, veiculos, rotaAlunos, alunos, viagens, eventosViagem, posicoesViagem } = schema;

  const daRota = (escopo: Escopo) =>
    and(
      eq(rotas.organizacaoId, escopo.organizacaoId),
      eq(rotas.motoristaId, escopo.motoristaId),
      eq(rotas.ativa, true),
    );

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

    async finalizarViagem(viagemId) {
      const [row] = await db
        .update(viagens)
        .set({ status: 'FINALIZADA', finalizadaEm: new Date() })
        .where(and(eq(viagens.id, viagemId), eq(viagens.status, 'EM_ANDAMENTO')))
        .returning(colunasViagem);
      return row;
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
  };
}
