// Teste do layout raiz (src/app/_layout.tsx). Fica fora de src/app/ porque tudo que está
// lá o Expo Router trata como rota.
import { render, screen } from '@testing-library/react-native';
import { SplashScreen } from 'expo-router';
import type { PropsWithChildren } from 'react';

import RootLayout from '@/app/_layout';
import { useSession } from '@/context/session';

jest.mock('expo-router', () => {
  const Passa = ({ children }: PropsWithChildren) => children ?? null;
  const Stack = Object.assign(Passa, { Protected: Passa, Screen: () => null });
  return {
    Stack,
    SplashScreen: { preventAutoHideAsync: jest.fn(() => Promise.resolve()), hide: jest.fn() },
  };
});
jest.mock('@/context/session', () => ({
  SessionProvider: ({ children }: PropsWithChildren) => children,
  useSession: jest.fn(),
}));
jest.mock('@/hooks/use-stack-options', () => ({ useStackOptions: () => ({}) }));
jest.mock('@/components/servidor-indisponivel', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return { ServidorIndisponivel: () => <Text>Servidor indisponível</Text> };
});

const useSessionMock = jest.mocked(useSession);
const hideMock = jest.mocked(SplashScreen.hide);

function sessao(status: ReturnType<typeof useSession>['status']) {
  useSessionMock.mockReturnValue({ status, papel: null } as ReturnType<typeof useSession>);
}

beforeEach(() => jest.clearAllMocks());

test('enquanto verifica a sessão a splash continua visível e nada é desenhado', async () => {
  sessao('carregando');
  await render(<RootLayout />);
  expect(hideMock).not.toHaveBeenCalled();
  expect(screen.toJSON()).toBeNull();
});

test('quando a sessão é resolvida a splash é escondida (uma vez, fora do render)', async () => {
  sessao('carregando');
  const { rerender } = await render(<RootLayout />);
  expect(hideMock).not.toHaveBeenCalled();

  sessao('anonimo');
  await rerender(<RootLayout />);
  expect(hideMock).toHaveBeenCalledTimes(1);

  // Re-render com o mesmo status não esconde de novo.
  await rerender(<RootLayout />);
  expect(hideMock).toHaveBeenCalledTimes(1);
});

test('servidor indisponível também esconde a splash e mostra a tela de indisponível', async () => {
  sessao('indisponivel');
  await render(<RootLayout />);
  expect(hideMock).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Servidor indisponível')).toBeTruthy();
});
