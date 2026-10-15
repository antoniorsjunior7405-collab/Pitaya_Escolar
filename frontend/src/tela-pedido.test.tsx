// Testes da tela de espera do pedido de transporte (src/app/responsavel/pedido/[id].tsx). Ficam
// fora de src/app/ porque tudo que está lá o Expo Router trata como rota.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { PropsWithChildren } from 'react';

import PedidoTransporte from '@/app/responsavel/pedido/[id]';
import { ApiError } from '@/lib/http';
import { cancelarPedido, detalharPedido } from '@/services/vinculos';
import type { EstadoPedido, Pedido } from '@/types';

jest.setTimeout(20_000);

jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
  useRouter: () => jest.requireMock<{ router: unknown }>('expo-router').router,
  useLocalSearchParams: jest.fn(),
}));
// A tela só fala com o servidor pelo service (mocado abaixo); a camada de sessão não entra.
jest.mock('@/lib/api', () => ({ api: jest.fn() }));
jest.mock('@/services/vinculos', () => ({
  ...jest.requireActual<typeof import('@/services/vinculos')>('@/services/vinculos'),
  detalharPedido: jest.fn(),
  cancelarPedido: jest.fn(),
}));

const detalharMock = jest.mocked(detalharPedido);
const cancelarMock = jest.mocked(cancelarPedido);

const pedido = (estado: EstadoPedido): Pedido => ({
  id: 'p-1',
  estado,
  criadoEm: new Date().toISOString(),
  expiraEm: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
  respondidaEm: estado === 'PENDENTE' ? null : new Date().toISOString(),
  aluno: { id: 'a-1', nome: 'Ana' },
  motorista: { id: 'm-1', nome: 'Carlos Souza', regiaoAtendimento: 'Zona Sul', telefone: null },
});

let client: QueryClient;

async function renderizar() {
  // gcTime infinito: ao desmontar, o Query não agenda o timer de limpeza (5 min), que
  // seguraria o Jest aberto depois dos testes.
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
  const Wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  await render(<PedidoTransporte />, { wrapper: Wrapper });
  return client;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'p-1' });
});

// A tela consulta o servidor de tempos em tempos: limpa o cache para não deixar timer vivo.
afterEach(() => client.clear());

test('pendente: mostra a espera e cancela o pedido pelo botão', async () => {
  detalharMock.mockResolvedValue(pedido('PENDENTE'));
  cancelarMock.mockResolvedValue(pedido('CANCELADA'));
  await renderizar();

  expect(await screen.findByText('Aguardando o motorista responder')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Cancelar pedido' }));

  expect(cancelarMock).toHaveBeenCalled();
  expect(await screen.findByText('Você cancelou este pedido')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Cancelar pedido' })).toBeNull();
});

test('sem conexão: mantém o último status conhecido e oferece tentar de novo', async () => {
  detalharMock.mockResolvedValueOnce(pedido('PENDENTE'));
  await renderizar();
  expect(await screen.findByText('Aguardando o motorista responder')).toBeTruthy();

  detalharMock.mockRejectedValue(new ApiError(0, 'NETWORK', 'Sem conexão com a internet.'));
  await client.refetchQueries();

  expect(await screen.findByText(/Mostrando o último status conhecido/)).toBeTruthy();
  expect(screen.getByText('Aguardando o motorista responder')).toBeTruthy();
  expect(screen.queryByText('O motorista não aceitou')).toBeNull();
  expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy();
});

test('recusado: leva a família de volta para a busca', async () => {
  detalharMock.mockResolvedValue(pedido('RECUSADA'));
  await renderizar();

  await fireEvent.press(await screen.findByRole('button', { name: 'Buscar outro motorista' }));

  expect(router.replace).toHaveBeenCalledWith('/responsavel/buscar-motorista');
});
