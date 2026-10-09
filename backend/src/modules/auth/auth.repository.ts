import { and, eq, isNull } from 'drizzle-orm';
import type { Db } from '../../db/index.js';
import { schema } from '../../db/index.js';

export type UsuarioRow = typeof schema.usuarios.$inferSelect;
export type Papel = (typeof schema.papelEnum.enumValues)[number];

export type MembroInfo = { organizacaoId: string; organizacaoNome: string; papel: Papel };
export type RefreshTokenRow = {
  id: string;
  usuarioId: string;
  expiraEm: Date;
  revogadoEm: Date | null;
};

// Camada de dados do módulo. O service só conhece esta interface (facilita testes).
export interface AuthRepository {
  findOrganizacaoPorConvite(codigo: string): Promise<{ id: string; ativa: boolean } | undefined>;
  findUsuarioPorEmail(email: string): Promise<UsuarioRow | undefined>;
  findUsuarioPorId(id: string): Promise<UsuarioRow | undefined>;
  /** Cria usuário + vínculo com a organização numa transação. Retorna undefined se o e-mail já existe. */
  criarUsuarioComMembro(input: {
    nome: string;
    email: string;
    senhaHash: string;
    telefone?: string | undefined;
    organizacaoId: string;
    papel: Papel;
  }): Promise<UsuarioRow | undefined>;
  listarMembros(usuarioId: string): Promise<MembroInfo[]>;
  salvarRefreshToken(input: {
    usuarioId: string;
    tokenHash: string;
    expiraEm: Date;
  }): Promise<void>;
  findRefreshToken(tokenHash: string): Promise<RefreshTokenRow | undefined>;
  revogarRefreshToken(id: string): Promise<void>;
  revogarTodosDoUsuario(usuarioId: string): Promise<void>;
}

export function createAuthRepository(db: Db): AuthRepository {
  const { usuarios, membros, organizacoes, refreshTokens } = schema;

  return {
    async findOrganizacaoPorConvite(codigo) {
      const [row] = await db
        .select({ id: organizacoes.id, ativa: organizacoes.ativa })
        .from(organizacoes)
        .where(eq(organizacoes.codigoConvite, codigo))
        .limit(1);
      return row;
    },

    async findUsuarioPorEmail(email) {
      const [row] = await db.select().from(usuarios).where(eq(usuarios.email, email)).limit(1);
      return row;
    },

    async findUsuarioPorId(id) {
      const [row] = await db.select().from(usuarios).where(eq(usuarios.id, id)).limit(1);
      return row;
    },

    async criarUsuarioComMembro({ organizacaoId, papel, ...dados }) {
      return db.transaction(async (tx) => {
        const [usuario] = await tx
          .insert(usuarios)
          .values({ ...dados, telefone: dados.telefone ?? null })
          .onConflictDoNothing({ target: usuarios.email })
          .returning();
        if (!usuario) return undefined; // e-mail já cadastrado
        await tx.insert(membros).values({ organizacaoId, usuarioId: usuario.id, papel });
        return usuario;
      });
    },

    async listarMembros(usuarioId) {
      return db
        .select({
          organizacaoId: membros.organizacaoId,
          organizacaoNome: organizacoes.nome,
          papel: membros.papel,
        })
        .from(membros)
        .innerJoin(organizacoes, eq(organizacoes.id, membros.organizacaoId))
        .where(and(eq(membros.usuarioId, usuarioId), eq(organizacoes.ativa, true)));
    },

    async salvarRefreshToken(input) {
      await db.insert(refreshTokens).values(input);
    },

    async findRefreshToken(tokenHash) {
      const [row] = await db
        .select({
          id: refreshTokens.id,
          usuarioId: refreshTokens.usuarioId,
          expiraEm: refreshTokens.expiraEm,
          revogadoEm: refreshTokens.revogadoEm,
        })
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, tokenHash))
        .limit(1);
      return row;
    },

    async revogarRefreshToken(id) {
      await db
        .update(refreshTokens)
        .set({ revogadoEm: new Date() })
        .where(and(eq(refreshTokens.id, id), isNull(refreshTokens.revogadoEm)));
    },

    async revogarTodosDoUsuario(usuarioId) {
      await db
        .update(refreshTokens)
        .set({ revogadoEm: new Date() })
        .where(and(eq(refreshTokens.usuarioId, usuarioId), isNull(refreshTokens.revogadoEm)));
    },
  };
}
