import { and, eq } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import type { Db } from '../../db/index.js';
import { schema } from '../../db/index.js';
import { ForbiddenError, UnauthorizedError } from '../errors/app-error.js';

export type Papel = (typeof schema.papelEnum.enumValues)[number];

/** Quem está fazendo a requisição, e em nome de qual organização. */
export type Membro = { usuarioId: string; organizacaoId: string; papel: Papel };

export interface AcessoRepository {
  /** Vínculo ativo do usuário com o papel pedido (organização ativa e usuário ativo). */
  buscarMembro(usuarioId: string, papel: Papel): Promise<Membro | undefined>;
}

declare module 'fastify' {
  interface FastifyRequest {
    membro?: Membro;
  }
}

export function createAcessoRepository(db: Db): AcessoRepository {
  const { membros, organizacoes, usuarios } = schema;
  return {
    async buscarMembro(usuarioId, papel) {
      const [row] = await db
        .select({
          usuarioId: membros.usuarioId,
          organizacaoId: membros.organizacaoId,
          papel: membros.papel,
        })
        .from(membros)
        .innerJoin(organizacoes, eq(organizacoes.id, membros.organizacaoId))
        .innerJoin(usuarios, eq(usuarios.id, membros.usuarioId))
        .where(
          and(
            eq(membros.usuarioId, usuarioId),
            eq(membros.papel, papel),
            eq(organizacoes.ativa, true),
            eq(usuarios.ativo, true),
          ),
        )
        .orderBy(membros.criadoEm)
        .limit(1);
      return row;
    },
  };
}

/**
 * Hook que exige um papel. Usado no escopo de cada módulo (motorista, responsável, admin):
 * toda rota daquele módulo passa por aqui, então nenhuma rota "esquece" a checagem.
 * Deve rodar depois de app.authenticate.
 */
export function exigirPapel(repo: AcessoRepository, papel: Papel) {
  return async function verificarPapel(req: FastifyRequest) {
    const membro = await repo.buscarMembro(req.user.sub, papel);
    if (!membro) throw new ForbiddenError('Sem permissão para esta área');
    req.membro = membro;
  };
}

/** Membro da requisição atual (já validado pelo hook exigirPapel). */
export function membroDe(req: FastifyRequest): Membro {
  if (!req.membro) throw new UnauthorizedError('Sessão inválida');
  return req.membro;
}
