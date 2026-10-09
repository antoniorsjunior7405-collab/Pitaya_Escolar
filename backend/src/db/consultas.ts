import { and, asc, desc, eq, or, sql } from 'drizzle-orm';
import type { Db } from './client.js';
import * as schema from './schema.js';

export type StatusViagem = (typeof schema.statusViagemEnum.enumValues)[number];
export type TipoEvento = (typeof schema.tipoEventoEnum.enumValues)[number];

export type ViagemRow = {
  id: string;
  rotaId: string;
  status: StatusViagem;
  data: string;
  iniciadaEm: Date | null;
  finalizadaEm: Date | null;
};

export type EventoRow = { alunoId: string; tipo: TipoEvento; registradoEm: Date };

const colunasViagem = {
  id: schema.viagens.id,
  rotaId: schema.viagens.rotaId,
  status: schema.viagens.status,
  data: schema.viagens.data,
  iniciadaEm: schema.viagens.iniciadaEm,
  finalizadaEm: schema.viagens.finalizadaEm,
};

// Consultas de leitura usadas por mais de um módulo (motorista e responsável).

/**
 * "Viagem atual" de uma rota: a que está em andamento; se não houver, a mais recente de hoje
 * (pode estar finalizada); se não houver nenhuma hoje, undefined.
 */
export async function buscarViagemAtual(
  db: Db,
  rotaId: string,
  hoje: string,
): Promise<ViagemRow | undefined> {
  const { viagens } = schema;
  const [row] = await db
    .select(colunasViagem)
    .from(viagens)
    .where(
      and(
        eq(viagens.rotaId, rotaId),
        or(eq(viagens.status, 'EM_ANDAMENTO'), eq(viagens.data, hoje)),
      ),
    )
    .orderBy(desc(sql`${viagens.status} = 'EM_ANDAMENTO'`), desc(viagens.criadoEm))
    .limit(1);
  return row;
}

export async function listarEventos(db: Db, viagemId: string): Promise<EventoRow[]> {
  const { eventosViagem } = schema;
  return db
    .select({
      alunoId: eventosViagem.alunoId,
      tipo: eventosViagem.tipo,
      registradoEm: eventosViagem.registradoEm,
    })
    .from(eventosViagem)
    .where(eq(eventosViagem.viagemId, viagemId))
    .orderBy(asc(eventosViagem.registradoEm));
}

export { colunasViagem };
