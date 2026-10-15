import { and, count, eq, gt, gte, isNull } from 'drizzle-orm';
import type { Db } from '../../db/index.js';
import { schema } from '../../db/index.js';
import type { UsuarioRow } from './auth.repository.js';

// Camada de dados da recuperação de senha. O service só conhece esta interface.
export interface RecuperacaoRepository {
  findUsuarioPorEmail(email: string): Promise<UsuarioRow | undefined>;
  findUsuarioPorId(id: string): Promise<UsuarioRow | undefined>;
  /** Pedidos criados pelo usuário desde a data (limite de pedidos por e-mail). */
  contarPedidosDesde(usuarioId: string, desde: Date): Promise<number>;
  /**
   * Cria um pedido e, na mesma transação, invalida os pedidos anteriores ainda não usados:
   * só o link mais recente vale.
   */
  criarPedido(input: { usuarioId: string; tokenHash: string; expiraEm: Date }): Promise<void>;
  /**
   * Consome o token de forma ATÔMICA: um único UPDATE que só acerta se o token ainda não foi
   * usado e não expirou. Duas requisições simultâneas com o mesmo token: só uma recebe o
   * usuário. Retorna o id do usuário, ou undefined se o token é inválido.
   */
  consumirToken(tokenHash: string): Promise<string | undefined>;
  /**
   * Numa transação: grava a nova senha, zera o bloqueio de login e revoga TODAS as sessões
   * (refresh tokens) do usuário, para derrubar um invasor que estivesse logado.
   */
  trocarSenhaERevogarSessoes(usuarioId: string, senhaHash: string): Promise<void>;
}

export function createRecuperacaoRepository(db: Db): RecuperacaoRepository {
  const { usuarios, recuperacoesSenha, refreshTokens } = schema;

  return {
    async findUsuarioPorEmail(email) {
      const [row] = await db.select().from(usuarios).where(eq(usuarios.email, email)).limit(1);
      return row;
    },

    async findUsuarioPorId(id) {
      const [row] = await db.select().from(usuarios).where(eq(usuarios.id, id)).limit(1);
      return row;
    },

    async contarPedidosDesde(usuarioId, desde) {
      const [row] = await db
        .select({ total: count() })
        .from(recuperacoesSenha)
        .where(
          and(eq(recuperacoesSenha.usuarioId, usuarioId), gte(recuperacoesSenha.criadoEm, desde)),
        );
      return row?.total ?? 0;
    },

    async criarPedido(input) {
      await db.transaction(async (tx) => {
        await tx
          .update(recuperacoesSenha)
          .set({ usadoEm: new Date() })
          .where(
            and(
              eq(recuperacoesSenha.usuarioId, input.usuarioId),
              isNull(recuperacoesSenha.usadoEm),
            ),
          );
        await tx.insert(recuperacoesSenha).values(input);
      });
    },

    async consumirToken(tokenHash) {
      const [row] = await db
        .update(recuperacoesSenha)
        .set({ usadoEm: new Date() })
        .where(
          and(
            eq(recuperacoesSenha.tokenHash, tokenHash),
            isNull(recuperacoesSenha.usadoEm),
            gt(recuperacoesSenha.expiraEm, new Date()),
          ),
        )
        .returning({ usuarioId: recuperacoesSenha.usuarioId });
      return row?.usuarioId;
    },

    async trocarSenhaERevogarSessoes(usuarioId, senhaHash) {
      await db.transaction(async (tx) => {
        await tx
          .update(usuarios)
          .set({ senhaHash, tentativasFalhas: 0, bloqueadoAte: null })
          .where(eq(usuarios.id, usuarioId));
        await tx
          .update(refreshTokens)
          .set({ revogadoEm: new Date() })
          .where(and(eq(refreshTokens.usuarioId, usuarioId), isNull(refreshTokens.revogadoEm)));
      });
    },
  };
}
