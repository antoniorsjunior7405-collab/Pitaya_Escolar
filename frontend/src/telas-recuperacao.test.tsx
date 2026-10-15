// Testes das telas "Esqueci a senha" e "Redefinir senha" (src/app/). Ficam fora de src/app/
// porque tudo que está lá o Expo Router trata como rota.
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { PropsWithChildren } from 'react';

import EsqueciSenha from '@/app/esqueci-senha';
import RedefinirSenha from '@/app/redefinir-senha';
import { useSession } from '@/context/session';
import { ApiError } from '@/lib/http';
import { pedirRecuperacao, redefinirSenha } from '@/services/auth';

// Telas inteiras: na primeira execução (cache frio do Jest) compilar tudo pode passar dos 5 s
// padrão. O limite maior evita falso negativo em CI; o tempo normal é bem menor.
jest.setTimeout(20_000);

jest.mock('expo-router', () => ({
  Link: ({ children }: PropsWithChildren) => children,
  router: { replace: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));
jest.mock('@/services/auth', () => ({ pedirRecuperacao: jest.fn(), redefinirSenha: jest.fn() }));
jest.mock('@/context/session', () => ({ useSession: jest.fn() }));

const pedirMock = jest.mocked(pedirRecuperacao);
const redefinirMock = jest.mocked(redefinirSenha);
const paramsMock = jest.mocked(useLocalSearchParams);
const sairMock = jest.fn();

function sessao(status: 'anonimo' | 'autenticado') {
  jest
    .mocked(useSession)
    .mockReturnValue({ status, sair: sairMock } as unknown as ReturnType<typeof useSession>);
}

beforeEach(() => {
  jest.clearAllMocks();
  sessao('anonimo');
});

// ── Esqueci a senha ──────────────────────────────────────────────────────────

const MENSAGEM_SERVIDOR = 'Se o e-mail estiver cadastrado, você receberá um link.';

test('esqueci: só envia com e-mail válido, sem espaços, e mostra a resposta do servidor', async () => {
  pedirMock.mockResolvedValue(MENSAGEM_SERVIDOR);
  await render(<EsqueciSenha />);

  const botao = screen.getByRole('button', { name: 'Enviar link' });
  expect(botao.props.accessibilityState).toMatchObject({ disabled: true });

  await fireEvent.changeText(screen.getByLabelText('E-mail'), '  maria@exemplo.com ');
  await fireEvent.press(screen.getByRole('button', { name: 'Enviar link' }));

  expect(pedirMock).toHaveBeenCalledWith('maria@exemplo.com');
  expect(await screen.findByText(MENSAGEM_SERVIDOR)).toBeTruthy();
  expect(screen.getByText('Confira seu e-mail')).toBeTruthy();
});

test('esqueci: sem conexão mostra o erro e mantém o formulário', async () => {
  pedirMock.mockRejectedValue(new ApiError(0, 'NETWORK', 'Sem conexão com o servidor.'));
  await render(<EsqueciSenha />);

  await fireEvent.changeText(screen.getByLabelText('E-mail'), 'maria@exemplo.com');
  await fireEvent.press(screen.getByRole('button', { name: 'Enviar link' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('Sem conexão com o servidor.');
  expect(screen.getByRole('button', { name: 'Enviar link' })).toBeTruthy();
});

test('esqueci: "Enviar de novo" volta para o formulário', async () => {
  pedirMock.mockResolvedValue(MENSAGEM_SERVIDOR);
  await render(<EsqueciSenha />);
  await fireEvent.changeText(screen.getByLabelText('E-mail'), 'maria@exemplo.com');
  await fireEvent.press(screen.getByRole('button', { name: 'Enviar link' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Enviar de novo' }));
  expect(screen.getByRole('button', { name: 'Enviar link' })).toBeTruthy();
});

// ── Redefinir senha ──────────────────────────────────────────────────────────

const TOKEN = 'token-do-link-com-mais-de-vinte-caracteres';

async function preencher(senha: string, confirmacao = senha) {
  await fireEvent.changeText(screen.getByLabelText('Nova senha'), senha);
  await fireEvent.changeText(screen.getByLabelText('Repita a nova senha'), confirmacao);
}

test('redefinir: sem token na URL mostra "Link incompleto" e não chama a API', async () => {
  paramsMock.mockReturnValue({});
  await render(<RedefinirSenha />);
  expect(screen.getByText('Link incompleto')).toBeTruthy();
  expect(screen.queryByLabelText('Nova senha')).toBeNull();
  expect(redefinirMock).not.toHaveBeenCalled();
});

test('redefinir: senha curta ou confirmação diferente bloqueiam o envio', async () => {
  paramsMock.mockReturnValue({ token: TOKEN });
  await render(<RedefinirSenha />);

  await preencher('123', '123');
  expect(screen.getByText('Use pelo menos 8 caracteres.')).toBeTruthy();
  expect(
    screen.getByRole('button', { name: 'Salvar nova senha' }).props.accessibilityState,
  ).toMatchObject({ disabled: true });

  await preencher('senha-nova-456', 'senha-diferente');
  expect(screen.getByText('As senhas não são iguais.')).toBeTruthy();
  expect(
    screen.getByRole('button', { name: 'Salvar nova senha' }).props.accessibilityState,
  ).toMatchObject({ disabled: true });
});

test('redefinir: envia o token do link e a senha; depois leva para o login', async () => {
  paramsMock.mockReturnValue({ token: TOKEN });
  redefinirMock.mockResolvedValue(undefined);
  await render(<RedefinirSenha />);

  await preencher('senha-nova-456');
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar nova senha' }));

  expect(redefinirMock).toHaveBeenCalledWith(TOKEN, 'senha-nova-456');
  expect(await screen.findByText('Senha alterada')).toBeTruthy();
  expect(sairMock).not.toHaveBeenCalled(); // não estava logado

  await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));
  expect(router.replace).toHaveBeenCalledWith('/login');
});

test('redefinir: logado no aparelho, encerra a sessão local depois da troca', async () => {
  sessao('autenticado');
  paramsMock.mockReturnValue({ token: TOKEN });
  redefinirMock.mockResolvedValue(undefined);
  await render(<RedefinirSenha />);

  await preencher('senha-nova-456');
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar nova senha' }));

  await waitFor(() => expect(sairMock).toHaveBeenCalledTimes(1));
  expect(await screen.findByText('Senha alterada')).toBeTruthy();
});

test('redefinir: link inválido ou expirado mostra a mensagem do servidor e não sai', async () => {
  sessao('autenticado');
  paramsMock.mockReturnValue({ token: TOKEN });
  redefinirMock.mockRejectedValue(
    new ApiError(400, 'LINK_INVALIDO', 'Link inválido ou expirado. Peça um novo.'),
  );
  await render(<RedefinirSenha />);

  await preencher('senha-nova-456');
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar nova senha' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Link inválido ou expirado. Peça um novo.',
  );
  expect(sairMock).not.toHaveBeenCalled();
  expect(screen.queryByText('Senha alterada')).toBeNull();
});
