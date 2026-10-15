import { randomUUID } from 'node:crypto';
import type { RecuperacaoRepository } from '../modules/auth/recuperacao.repository.js';
import type { EnviadorEmail, MensagemEmail } from '../shared/email/email.js';
import type { criarFakeAuthRepository } from './fake-auth-repository.js';

type Pedido = {
  id: string;
  usuarioId: string;
  tokenHash: string;
  expiraEm: Date;
  usadoEm: Date | null;
  criadoEm: Date;
};

/**
 * Repositório de recuperação em memória. Usa os MESMOS usuários e sessões do fake de auth,
 * para testar o fluxo inteiro: cadastro → esqueci → redefinir → login.
 */
export function criarFakeRecuperacaoRepository(auth: ReturnType<typeof criarFakeAuthRepository>) {
  const pedidos: Pedido[] = [];

  const repo: RecuperacaoRepository = {
    async findUsuarioPorEmail(email) {
      return auth.usuarios.find((u) => u.email === email);
    },
    async findUsuarioPorId(id) {
      return auth.usuarios.find((u) => u.id === id);
    },
    async contarPedidosDesde(usuarioId, desde) {
      return pedidos.filter((p) => p.usuarioId === usuarioId && p.criadoEm >= desde).length;
    },
    async criarPedido({ usuarioId, tokenHash, expiraEm }) {
      for (const p of pedidos) if (p.usuarioId === usuarioId && !p.usadoEm) p.usadoEm = new Date();
      pedidos.push({
        id: randomUUID(),
        usuarioId,
        tokenHash,
        expiraEm,
        usadoEm: null,
        criadoEm: new Date(),
      });
    },
    // Mesma semântica do UPDATE atômico: confere e marca no mesmo passo (sem await no meio).
    async consumirToken(tokenHash) {
      const p = pedidos.find(
        (x) => x.tokenHash === tokenHash && !x.usadoEm && x.expiraEm.getTime() > Date.now(),
      );
      if (!p) return undefined;
      p.usadoEm = new Date();
      return p.usuarioId;
    },
    async trocarSenhaERevogarSessoes(usuarioId, senhaHash) {
      const u = auth.usuarios.find((x) => x.id === usuarioId);
      if (u) Object.assign(u, { senhaHash, tentativasFalhas: 0, bloqueadoAte: null });
      for (const t of auth.tokens.values()) {
        if (t.usuarioId === usuarioId && !t.revogadoEm) t.revogadoEm = new Date();
      }
    },
  };

  return { repo, pedidos };
}

/** Enviador que guarda as mensagens em vez de enviar. `falhar` simula o provedor fora do ar. */
export function criarFakeEnviadorEmail(opts: { falhar?: boolean } = {}) {
  const enviados: MensagemEmail[] = [];
  const enviador: EnviadorEmail = {
    async enviar(mensagem) {
      enviados.push(mensagem);
      if (opts.falhar) throw new Error('provedor fora do ar');
    },
  };
  /** Token do link do último e-mail enviado para o endereço. */
  const tokenDoUltimoEmail = (para: string) => {
    const texto = enviados.filter((m) => m.para === para).at(-1)?.texto ?? '';
    return /[?&]token=([A-Za-z0-9_-]+)/.exec(texto)?.[1];
  };
  return { enviador, enviados, tokenDoUltimoEmail };
}
