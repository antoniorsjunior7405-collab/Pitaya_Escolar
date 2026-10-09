import { ApiError, http, TIMEOUT_LONGO_MS } from '@/lib/http';
import { apagarRefreshToken, lerRefreshToken, salvarRefreshToken } from '@/lib/token-storage';
import type { Tokens } from '@/types/api';

// Estado dos tokens da sessão atual. O access token fica só em memória; o refresh token
// é persistido no armazenamento seguro. Cada refresh token vale uma única vez (o backend
// rotaciona), por isso a renovação é "single-flight": chamadas simultâneas compartilham
// a mesma requisição, senão a segunda reutilizaria um token já gasto e derrubaria a sessão.

let accessToken: string | null = null;
let renovando: Promise<string | null> | null = null;

export function getAccessToken() {
  return accessToken;
}

export async function guardarTokens(tokens: Tokens) {
  accessToken = tokens.accessToken;
  await salvarRefreshToken(tokens.refreshToken);
}

export async function limparTokens() {
  accessToken = null;
  await apagarRefreshToken();
}

/**
 * Troca o refresh token por um novo par de tokens.
 * Retorna o novo access token, ou null se a sessão não vale mais (token inválido/expirado).
 * Falhas de rede/servidor são relançadas: a sessão pode continuar válida, só não deu para checar.
 */
export function renovarTokens(): Promise<string | null> {
  renovando ??= (async () => {
    const refreshToken = await lerRefreshToken();
    if (!refreshToken) return null;
    try {
      const tokens = await http<Tokens>('/v1/auth/refresh', {
        method: 'POST',
        body: { refreshToken },
        timeoutMs: TIMEOUT_LONGO_MS,
      });
      await guardarTokens(tokens);
      return tokens.accessToken;
    } catch (erro) {
      if (erro instanceof ApiError && !erro.indisponivel) {
        await limparTokens();
        return null;
      }
      throw erro;
    }
  })().finally(() => {
    renovando = null;
  });
  return renovando;
}
