import { ApiError, http, type OpcoesHttp } from '@/lib/http';
import { getAccessToken, renovarTokens } from '@/lib/session-tokens';

// Cliente autenticado: todas as telas/serviços chamam a API por aqui.
// Anexa o access token e, se o servidor responder 401 (token expirado), renova a
// sessão uma vez e repete a chamada.

type Opcoes = Omit<OpcoesHttp, 'headers'>;

const comToken = (token: string | null) =>
  token ? { Authorization: `Bearer ${token}` } : undefined;

let aoExpirar: (() => void) | undefined;

/** O provider de sessão registra aqui o que fazer quando a sessão não puder mais ser renovada. */
export function aoSessaoExpirar(callback: () => void) {
  aoExpirar = callback;
}

export async function api<T>(path: string, opcoes: Opcoes = {}): Promise<T> {
  try {
    return await http<T>(path, { ...opcoes, headers: comToken(getAccessToken()) });
  } catch (erro) {
    if (!(erro instanceof ApiError) || erro.status !== 401) throw erro;
  }

  const novoToken = await renovarTokens();
  if (!novoToken) {
    aoExpirar?.();
    throw new ApiError(401, 'UNAUTHORIZED', 'Sua sessão expirou. Entre novamente.');
  }
  return http<T>(path, { ...opcoes, headers: comToken(novoToken) });
}
