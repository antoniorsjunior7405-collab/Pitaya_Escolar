import { ApiError, http } from '@/lib/http';
import { getAccessToken, renovarTokens } from '@/lib/session-tokens';
import { apagarRefreshToken, lerRefreshToken, salvarRefreshToken } from '@/lib/token-storage';

jest.mock('@/lib/token-storage', () => ({
  lerRefreshToken: jest.fn(),
  salvarRefreshToken: jest.fn(),
  apagarRefreshToken: jest.fn(),
}));
jest.mock('@/lib/http', () => ({
  ...jest.requireActual<typeof import('@/lib/http')>('@/lib/http'),
  http: jest.fn(),
}));

const httpMock = jest.mocked(http);
const lerMock = jest.mocked(lerRefreshToken);

beforeEach(() => {
  jest.clearAllMocks();
  lerMock.mockResolvedValue('refresh-antigo');
});

test('chamadas simultâneas fazem UMA renovação (o refresh token só vale uma vez)', async () => {
  httpMock.mockResolvedValue({ accessToken: 'acesso-novo', refreshToken: 'refresh-novo' });

  const [a, b, c] = await Promise.all([renovarTokens(), renovarTokens(), renovarTokens()]);

  expect(httpMock).toHaveBeenCalledTimes(1);
  expect([a, b, c]).toEqual(['acesso-novo', 'acesso-novo', 'acesso-novo']);
  expect(salvarRefreshToken).toHaveBeenCalledWith('refresh-novo');
  expect(getAccessToken()).toBe('acesso-novo');
});

test('sessão recusada pelo servidor (401) apaga os tokens e devolve null', async () => {
  httpMock.mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'Sessão inválida'));
  await expect(renovarTokens()).resolves.toBeNull();
  expect(apagarRefreshToken).toHaveBeenCalled();
});

test('sem rede NÃO apaga a sessão: o erro sobe para a tela de indisponível', async () => {
  httpMock.mockRejectedValue(new ApiError(0, 'NETWORK', 'Sem conexão'));
  await expect(renovarTokens()).rejects.toMatchObject({ code: 'NETWORK' });
  expect(apagarRefreshToken).not.toHaveBeenCalled();
});

test('sem refresh token salvo não chama o servidor', async () => {
  lerMock.mockResolvedValue(null);
  await expect(renovarTokens()).resolves.toBeNull();
  expect(httpMock).not.toHaveBeenCalled();
});
