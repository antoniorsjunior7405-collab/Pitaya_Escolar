import { api } from '@/lib/api';
import {
  buscarMotoristas,
  filtroValido,
  INTERVALO_PEDIDO_MS,
  intervaloDoPedido,
  listarPedidos,
  listarPedidosRecebidos,
  pedirTransporte,
  responderPedido,
} from '@/services/vinculos';

jest.mock('@/lib/api', () => ({ api: jest.fn() }));

const apiMock = jest.mocked(api);

beforeEach(() => jest.clearAllMocks());

test('intervaloDoPedido: consulta enquanto PENDENTE e para em qualquer estado final', () => {
  expect(intervaloDoPedido(undefined)).toBe(INTERVALO_PEDIDO_MS);
  expect(intervaloDoPedido('PENDENTE')).toBe(INTERVALO_PEDIDO_MS);
  for (const final of ['ACEITA', 'RECUSADA', 'CANCELADA', 'EXPIRADA'] as const) {
    expect(intervaloDoPedido(final)).toBe(false);
  }
});

test('filtroValido: exige 3 letras no nome ou na região (espaços não contam)', () => {
  expect(filtroValido({ termo: '  Ca ', regiao: '' })).toBe(false);
  expect(filtroValido({ termo: 'Car', regiao: '' })).toBe(true);
  expect(filtroValido({ termo: '', regiao: 'Sul' })).toBe(true);
});

test('buscarMotoristas: envia só os campos válidos, codificados, e o cursor da página', async () => {
  apiMock.mockResolvedValue({ itens: [], proximoCursor: null });

  await buscarMotoristas({ termo: ' São José ', regiao: 'Z' }, 'cursor-1');

  expect(apiMock).toHaveBeenCalledWith(
    '/v1/responsavel/motoristas?termo=S%C3%A3o%20Jos%C3%A9&cursor=cursor-1',
  );
});

test('listarPedidos e listarPedidosRecebidos: primeira página sem cursor; as seguintes com ele', async () => {
  apiMock.mockResolvedValue({ itens: [], proximoCursor: null });

  await listarPedidos(null);
  await listarPedidosRecebidos('c/1');

  expect(apiMock).toHaveBeenNthCalledWith(1, '/v1/responsavel/solicitacoes');
  expect(apiMock).toHaveBeenNthCalledWith(2, '/v1/motorista/solicitacoes?cursor=c%2F1');
});

test('pedirTransporte e responderPedido: ids no corpo ou codificados no caminho', async () => {
  apiMock.mockResolvedValue({});

  await pedirTransporte('m-1', 'a-1');
  await responderPedido('id/estranho', 'aceitar');

  expect(apiMock).toHaveBeenNthCalledWith(1, '/v1/responsavel/solicitacoes', {
    method: 'POST',
    body: { motoristaId: 'm-1', alunoId: 'a-1' },
  });
  expect(apiMock).toHaveBeenNthCalledWith(2, '/v1/motorista/solicitacoes/id%2Festranho/aceitar', {
    method: 'POST',
  });
});
