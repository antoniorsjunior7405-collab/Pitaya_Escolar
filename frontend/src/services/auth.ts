import { api } from '@/lib/api';
import { http, TIMEOUT_LONGO_MS } from '@/lib/http';
import { guardarTokens, limparTokens } from '@/lib/session-tokens';
import { lerRefreshToken } from '@/lib/token-storage';
import type { CadastroInput, MeResponse, SessaoResponse } from '@/types/api';

// Chamadas do módulo de autenticação. As telas não conhecem URLs nem tokens.

export async function login(email: string, senha: string): Promise<MeResponse> {
  const sessao = await http<SessaoResponse>('/v1/auth/login', {
    method: 'POST',
    body: { email, senha },
    timeoutMs: TIMEOUT_LONGO_MS,
  });
  await guardarTokens(sessao);
  return buscarMe();
}

export async function cadastrar(dados: CadastroInput): Promise<MeResponse> {
  const sessao = await http<SessaoResponse>('/v1/auth/cadastro', {
    method: 'POST',
    body: dados,
    timeoutMs: TIMEOUT_LONGO_MS,
  });
  await guardarTokens(sessao);
  return buscarMe();
}

export function buscarMe(): Promise<MeResponse> {
  return api<MeResponse>('/v1/auth/me', { timeoutMs: TIMEOUT_LONGO_MS });
}

/** Revoga a sessão no servidor (best effort) e apaga os tokens do aparelho. */
export async function sair(): Promise<void> {
  const refreshToken = await lerRefreshToken();
  try {
    if (refreshToken) {
      await http<void>('/v1/auth/logout', { method: 'POST', body: { refreshToken } });
    }
  } catch {
    // Sem rede o servidor não é avisado, mas o aparelho sai do mesmo jeito.
  } finally {
    await limparTokens();
  }
}
