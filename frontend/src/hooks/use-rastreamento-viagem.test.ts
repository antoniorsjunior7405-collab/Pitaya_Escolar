import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';

import { useRastreamentoViagem } from '@/hooks/use-rastreamento-viagem';
import { enviarPosicao } from '@/services/motorista';

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied' },
  requestForegroundPermissionsAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
}));
jest.mock('@/services/motorista', () => ({ enviarPosicao: jest.fn() }));

const pedirPermissao = jest.mocked(Location.requestForegroundPermissionsAsync);
const assistir = jest.mocked(Location.watchPositionAsync);
const enviar = jest.mocked(enviarPosicao);
const remover = jest.fn();

type Leitura = Parameters<Parameters<typeof Location.watchPositionAsync>[1]>[0];
let emitir: (latitude: number, longitude: number) => void;

beforeEach(() => {
  jest.clearAllMocks();
  pedirPermissao.mockResolvedValue({ status: 'granted' } as Location.LocationPermissionResponse);
  enviar.mockResolvedValue(undefined);
  assistir.mockImplementation(async (_opcoes, callback) => {
    emitir = (latitude, longitude) =>
      callback({ coords: { latitude, longitude, speed: 5 } } as Leitura);
    return { remove: remover };
  });
});

test('sem viagem: fica inativo e não liga o GPS', async () => {
  const { result } = await renderHook(() => useRastreamentoViagem(null));
  expect(result.current).toEqual({ estado: 'inativo', posicao: null });
  expect(pedirPermissao).not.toHaveBeenCalled();
});

test('expõe a posição lida pelo GPS e envia ao servidor', async () => {
  const { result } = await renderHook(() => useRastreamentoViagem('v1'));
  await waitFor(() => expect(assistir).toHaveBeenCalled());

  await act(async () => emitir(-23.5, -46.6));

  expect(result.current.posicao).toEqual({ latitude: -23.5, longitude: -46.6 });
  expect(result.current.estado).toBe('ativo');
  expect(enviar).toHaveBeenCalledWith('v1', { latitude: -23.5, longitude: -46.6, velocidade: 5 });
});

test('o mapa acompanha cada leitura, mas o envio respeita o intervalo mínimo', async () => {
  const { result } = await renderHook(() => useRastreamentoViagem('v1'));
  await waitFor(() => expect(assistir).toHaveBeenCalled());

  await act(async () => emitir(-23.5, -46.6));
  await act(async () => emitir(-23.6, -46.7));

  expect(result.current.posicao).toEqual({ latitude: -23.6, longitude: -46.7 });
  expect(enviar).toHaveBeenCalledTimes(1);
});

test('nova viagem não mostra a posição da anterior', async () => {
  const { result, rerender } = await renderHook((id: string) => useRastreamentoViagem(id), {
    initialProps: 'v1',
  });
  await waitFor(() => expect(assistir).toHaveBeenCalledTimes(1));
  await act(async () => emitir(-23.5, -46.6));

  await rerender('v2');

  expect(remover).toHaveBeenCalled();
  expect(result.current.posicao).toBeNull();
});

test('sem permissão: avisa e não liga o GPS', async () => {
  pedirPermissao.mockResolvedValue({ status: 'denied' } as Location.LocationPermissionResponse);
  const { result } = await renderHook(() => useRastreamentoViagem('v1'));

  await waitFor(() => expect(result.current.estado).toBe('sem-permissao'));
  expect(assistir).not.toHaveBeenCalled();
  expect(result.current.posicao).toBeNull();
});

test('ao sair da tela remove a assinatura do GPS', async () => {
  const { unmount } = await renderHook(() => useRastreamentoViagem('v1'));
  await waitFor(() => expect(assistir).toHaveBeenCalled());

  await unmount();

  expect(remover).toHaveBeenCalledTimes(1);
});
