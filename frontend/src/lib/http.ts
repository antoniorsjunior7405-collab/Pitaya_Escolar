// Camada HTTP de baixo nível, sem autenticação: monta a URL, aplica timeout e
// transforma qualquer falha em ApiError com mensagem pronta para o usuário.

// No plano gratuito o servidor "dorme" e a primeira chamada pode levar cerca de 1 minuto.
const TIMEOUT_MS = 60_000;

export type ApiErrorCode = 'NETWORK' | 'TIMEOUT' | 'CONFIG' | 'HTTP';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Falha de infraestrutura (sem resposta ou erro do servidor): vale tentar de novo depois. */
  get indisponivel() {
    return this.status === 0 || this.status >= 500;
  }
}

type Opcoes = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
};

function baseUrl(): string {
  // Acesso estático: o Expo só substitui process.env.EXPO_PUBLIC_* escrito assim.
  const url = process.env.EXPO_PUBLIC_API_URL;
  if (!url) {
    throw new ApiError(0, 'CONFIG', 'URL da API não configurada (EXPO_PUBLIC_API_URL).');
  }
  return url.replace(/\/+$/, '');
}

export async function http<T>(path: string, opcoes: Opcoes = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const resposta = await fetch(`${baseUrl()}${path}`, {
      method: opcoes.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(opcoes.body !== undefined && { 'Content-Type': 'application/json' }),
        ...opcoes.headers,
      },
      body: opcoes.body !== undefined ? JSON.stringify(opcoes.body) : undefined,
      signal: controller.signal,
    });

    if (resposta.status === 204) return undefined as T;

    const texto = await resposta.text();
    let json: unknown;
    try {
      json = texto ? JSON.parse(texto) : undefined;
    } catch {
      json = undefined;
    }

    if (!resposta.ok) {
      const erro = (json ?? {}) as { code?: string; message?: string };
      throw new ApiError(
        resposta.status,
        erro.code ?? 'HTTP',
        erro.message ?? 'Não foi possível concluir a operação.',
      );
    }
    return json as T;
  } catch (erro) {
    if (erro instanceof ApiError) throw erro;
    if (erro instanceof Error && erro.name === 'AbortError') {
      throw new ApiError(0, 'TIMEOUT', 'O servidor demorou demais para responder. Tente de novo.');
    }
    throw new ApiError(0, 'NETWORK', 'Sem conexão com o servidor. Verifique sua internet.');
  } finally {
    clearTimeout(timer);
  }
}

/** Mensagem pronta para mostrar ao usuário a partir de qualquer erro. */
export function mensagemDeErro(erro: unknown): string {
  return erro instanceof ApiError ? erro.message : 'Algo deu errado. Tente novamente.';
}
