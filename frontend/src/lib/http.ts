// Camada HTTP de baixo nível, sem autenticação: monta a URL, aplica timeout e
// transforma qualquer falha em ApiError com mensagem pronta para o usuário.

/** Operações do dia a dia: se passar disso, é melhor avisar do que deixar a pessoa esperando. */
const TIMEOUT_PADRAO_MS = 30_000;
/**
 * Login, cadastro e restauração da sessão são as primeiras chamadas depois que o servidor
 * gratuito "acorda" (o Render leva cerca de 1 minuto): esperamos mais nelas.
 */
export const TIMEOUT_LONGO_MS = 90_000;

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

export type OpcoesHttp = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
};

function baseUrl(): string {
  // Acesso estático: o Expo só substitui process.env.EXPO_PUBLIC_* escrito assim.
  const url = process.env.EXPO_PUBLIC_API_URL;
  if (!url) {
    throw new ApiError(
      0,
      'CONFIG',
      'O app está sem o endereço do servidor (EXPO_PUBLIC_API_URL). Rode o app pela pasta frontend.',
    );
  }
  return url.replace(/\/+$/, '');
}

export async function http<T>(path: string, opcoes: OpcoesHttp = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opcoes.timeoutMs ?? TIMEOUT_PADRAO_MS);

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
        erro.message ??
          (resposta.status >= 500
            ? 'O servidor está fora do ar ou iniciando. Tente novamente em instantes.'
            : 'Não foi possível concluir a operação.'),
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
