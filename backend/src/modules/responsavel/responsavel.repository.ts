import { and, asc, eq, type SQL } from 'drizzle-orm';
import {
  buscarViagemAtual,
  listarEventos,
  type EventoRow,
  type ViagemRow,
} from '../../db/consultas.js';
import type { Db } from '../../db/index.js';
import { schema } from '../../db/index.js';

export type Escopo = { organizacaoId: string; responsavelId: string };

export type RotaDoAluno = {
  rotaId: string;
  rotaNome: string;
  motorista: { nome: string; telefone: string | null };
  veiculo: { placa: string; modelo: string };
};

export type Posicao = {
  latitude: number;
  longitude: number;
  velocidade: number | null;
  atualizadaEm: Date;
};

// Só aparecem alunos vinculados a ESTE responsável com autorizado = true (orçamento:
// "exibição da localização para os responsáveis autorizados").
export interface ResponsavelRepository {
  listarFilhos(escopo: Escopo): Promise<{ id: string; nome: string }[]>;
  buscarFilho(escopo: Escopo, alunoId: string): Promise<{ id: string; nome: string } | undefined>;
  listarRotasDoAluno(alunoId: string): Promise<RotaDoAluno[]>;
  buscarViagemAtual(rotaId: string, hoje: string): Promise<ViagemRow | undefined>;
  listarEventos(viagemId: string): Promise<EventoRow[]>;
  buscarPosicao(viagemId: string): Promise<Posicao | undefined>;
}

export function createResponsavelRepository(db: Db): ResponsavelRepository {
  const { alunos, responsaveisAlunos, rotaAlunos, rotas, usuarios, veiculos, posicoesViagem } =
    schema;

  const filhosDe = (escopo: Escopo, ...extras: SQL[]) =>
    db
      .select({ id: alunos.id, nome: alunos.nome })
      .from(responsaveisAlunos)
      .innerJoin(alunos, eq(alunos.id, responsaveisAlunos.alunoId))
      .where(
        and(
          eq(responsaveisAlunos.responsavelId, escopo.responsavelId),
          eq(responsaveisAlunos.autorizado, true),
          eq(alunos.organizacaoId, escopo.organizacaoId),
          eq(alunos.ativo, true),
          ...extras,
        ),
      );

  return {
    listarFilhos: (escopo) => filhosDe(escopo).orderBy(asc(alunos.nome)),

    async buscarFilho(escopo, alunoId) {
      const [row] = await filhosDe(escopo, eq(alunos.id, alunoId)).limit(1);
      return row;
    },

    async listarRotasDoAluno(alunoId) {
      return db
        .select({
          rotaId: rotas.id,
          rotaNome: rotas.nome,
          motorista: { nome: usuarios.nome, telefone: usuarios.telefone },
          veiculo: { placa: veiculos.placa, modelo: veiculos.modelo },
        })
        .from(rotaAlunos)
        .innerJoin(rotas, eq(rotas.id, rotaAlunos.rotaId))
        .innerJoin(usuarios, eq(usuarios.id, rotas.motoristaId))
        .innerJoin(veiculos, eq(veiculos.id, rotas.veiculoId))
        .where(and(eq(rotaAlunos.alunoId, alunoId), eq(rotas.ativa, true)))
        .orderBy(asc(rotas.nome));
    },

    buscarViagemAtual: (rotaId, hoje) => buscarViagemAtual(db, rotaId, hoje),
    listarEventos: (viagemId) => listarEventos(db, viagemId),

    async buscarPosicao(viagemId) {
      const [row] = await db
        .select({
          latitude: posicoesViagem.latitude,
          longitude: posicoesViagem.longitude,
          velocidade: posicoesViagem.velocidade,
          atualizadaEm: posicoesViagem.atualizadaEm,
        })
        .from(posicoesViagem)
        .where(eq(posicoesViagem.viagemId, viagemId))
        .limit(1);
      return row;
    },
  };
}
