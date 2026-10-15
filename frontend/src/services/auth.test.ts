import { http } from '@/lib/http';
import { pedirRecuperacao, redefinirSenha } from '@/services/auth';

jest.mock('@/lib/http', () => ({
  ...jest.requireActual<typeof import('@/lib/http')>('@/lib/http'),
  http: jest.fn(),
}));
jest.mock('@/lib/session-tokens', () => ({ guardarTokens: jest.fn(), limparTokens: jest.fn() }));
jest.mock('@/lib/token-storage', () => ({ lerRefreshToken: jest.fn() }));

const httpMock = jest.mocked(http);

beforeEach(() => jest.clearAllMocks());

test('pedirRecuperacao: POST com o e-mail no corpo e devolve a mensagem do servidor', async () => {
  httpMock.mockResolvedValue({ mensagem: 'Se o e-mail estiver cadastrado…' });
  await expect(pedirRecuperacao('maria@exemplo.com')).resolves.toBe(
    'Se o e-mail estiver cadastrado…',
  );
  expect(httpMock).toHaveBeenCalledWith(
    '/v1/auth/esqueci-senha',
    expect.objectContaining({ method: 'POST', body: { email: 'maria@exemplo.com' } }),
  );
});

test('redefinirSenha: o token vai no CORPO do POST, nunca na URL', async () => {
  httpMock.mockResolvedValue(undefined);
  await redefinirSenha('token-secreto-123', 'senha-nova-456');
  const [caminho, opcoes] = httpMock.mock.calls[0] ?? [];
  expect(caminho).toBe('/v1/auth/redefinir-senha');
  expect(caminho).not.toContain('token-secreto-123');
  expect(opcoes).toMatchObject({
    method: 'POST',
    body: { token: 'token-secreto-123', senha: 'senha-nova-456' },
  });
});
