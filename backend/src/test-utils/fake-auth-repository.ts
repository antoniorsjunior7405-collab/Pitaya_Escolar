import { randomUUID } from 'node:crypto';
import type {
  AuthRepository,
  MembroInfo,
  RefreshTokenRow,
  UsuarioRow,
} from '../modules/auth/auth.repository.js';

// Repositório em memória para testes: sem banco, rápido e isolado por teste.
export function criarFakeAuthRepository(opts: { convite?: string } = {}) {
  const convite = opts.convite ?? 'CONVITE-TESTE';
  const orgId = randomUUID();
  const usuarios: UsuarioRow[] = [];
  const membros: { usuarioId: string; papel: MembroInfo['papel'] }[] = [];
  const tokens = new Map<string, RefreshTokenRow & { tokenHash: string }>();

  const repo: AuthRepository = {
    async findOrganizacaoPorConvite(codigo) {
      return codigo === convite ? { id: orgId, ativa: true } : undefined;
    },
    async findUsuarioPorEmail(email) {
      return usuarios.find((u) => u.email === email);
    },
    async findUsuarioPorId(id) {
      return usuarios.find((u) => u.id === id);
    },
    async criarUsuarioComMembro({ papel, organizacaoId: _o, telefone, ...dados }) {
      if (usuarios.some((u) => u.email === dados.email)) return undefined;
      const usuario: UsuarioRow = {
        id: randomUUID(),
        telefone: telefone ?? null,
        ativo: true,
        superAdmin: false,
        tentativasFalhas: 0,
        bloqueadoAte: null,
        criadoEm: new Date(),
        ...dados,
      };
      usuarios.push(usuario);
      membros.push({ usuarioId: usuario.id, papel });
      return usuario;
    },
    async listarMembros(usuarioId) {
      return membros
        .filter((m) => m.usuarioId === usuarioId)
        .map((m) => ({ organizacaoId: orgId, organizacaoNome: 'Org Teste', papel: m.papel }));
    },
    async salvarRefreshToken({ usuarioId, tokenHash, expiraEm }) {
      tokens.set(tokenHash, { id: randomUUID(), usuarioId, tokenHash, expiraEm, revogadoEm: null });
    },
    async findRefreshToken(tokenHash) {
      return tokens.get(tokenHash);
    },
    async revogarRefreshToken(id) {
      for (const t of tokens.values()) if (t.id === id && !t.revogadoEm) t.revogadoEm = new Date();
    },
    async removerTokensVencidos(usuarioId) {
      for (const [hash, t] of tokens) {
        if (t.usuarioId === usuarioId && t.expiraEm.getTime() < Date.now()) tokens.delete(hash);
      }
    },
    async registrarFalhaLogin(usuarioId, limite, bloqueioMs) {
      const u = usuarios.find((x) => x.id === usuarioId);
      if (!u) return;
      if (u.tentativasFalhas + 1 >= limite) {
        u.tentativasFalhas = 0;
        u.bloqueadoAte = new Date(Date.now() + bloqueioMs);
      } else {
        u.tentativasFalhas += 1;
      }
    },
    async limparFalhasLogin(usuarioId) {
      const u = usuarios.find((x) => x.id === usuarioId);
      if (u) {
        u.tentativasFalhas = 0;
        u.bloqueadoAte = null;
      }
    },
    async revogarTodosDoUsuario(usuarioId) {
      for (const t of tokens.values()) {
        if (t.usuarioId === usuarioId && !t.revogadoEm) t.revogadoEm = new Date();
      }
    },
  };

  return { repo, convite, usuarios, tokens };
}
