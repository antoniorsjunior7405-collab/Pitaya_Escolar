import { ApiError, http, mensagemDeErro } from '@/lib/http';

// Classificação das falhas: decide se o app mostra "sem conexão" (e mantém a sessão)
// ou trata como erro do pedido. Errar aqui desloga pessoas à toa ou esconde quedas.

const resposta = (status: number, corpo: string, contentType = 'application/json') =>
  new Response(corpo, { status, headers: { 'content-type': contentType } });

const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.exemplo.com/';
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

async function erroDe(promessa: Promise<unknown>): Promise<ApiError> {
  try {
    await promessa;
  } catch (e) {
    if (e instanceof ApiError) return e;
    throw e;
  }
  throw new Error('deveria ter lançado ApiError');
}

test('monta a URL sem barra duplicada e devolve o JSON', async () => {
  fetchMock.mockResolvedValue(resposta(200, '{"ok":true}'));
  await expect(http('/v1/x')).resolves.toEqual({ ok: true });
  expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.exemplo.com/v1/x');
});

test('204 devolve undefined', async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
  await expect(http('/v1/x', { method: 'POST' })).resolves.toBeUndefined();
});

test('erro da API (4xx) usa a mensagem do servidor e NÃO é indisponibilidade', async () => {
  fetchMock.mockResolvedValue(resposta(401, '{"code":"UNAUTHORIZED","message":"Sessão inválida"}'));
  const erro = await erroDe(http('/v1/x'));
  expect(erro).toMatchObject({ status: 401, code: 'UNAUTHORIZED', indisponivel: false });
  expect(mensagemDeErro(erro)).toBe('Sessão inválida');
});

test('5xx sem JSON (servidor acordando) é indisponibilidade com mensagem clara', async () => {
  fetchMock.mockResolvedValue(resposta(503, '<html>Service Unavailable</html>', 'text/html'));
  const erro = await erroDe(http('/v1/x'));
  expect(erro.indisponivel).toBe(true);
  expect(erro.message).toMatch(/fora do ar ou iniciando/);
});

test('falha de rede vira NETWORK (indisponível)', async () => {
  fetchMock.mockRejectedValue(new TypeError('Network request failed'));
  await expect(erroDe(http('/v1/x'))).resolves.toMatchObject({
    code: 'NETWORK',
    indisponivel: true,
  });
});

test('sem resposta dentro do prazo vira TIMEOUT', async () => {
  fetchMock.mockImplementation(
    (_url, init) =>
      new Promise((_resolver, rejeitar) => {
        init?.signal?.addEventListener('abort', () =>
          rejeitar(Object.assign(new Error('aborted'), { name: 'AbortError' })),
        );
      }),
  );
  await expect(erroDe(http('/v1/x', { timeoutMs: 20 }))).resolves.toMatchObject({
    code: 'TIMEOUT',
    indisponivel: true,
  });
});

test('sem EXPO_PUBLIC_API_URL avisa que é configuração', async () => {
  delete process.env.EXPO_PUBLIC_API_URL;
  const erro = await erroDe(http('/v1/x'));
  expect(erro.code).toBe('CONFIG');
  expect(fetchMock).not.toHaveBeenCalled();
});
