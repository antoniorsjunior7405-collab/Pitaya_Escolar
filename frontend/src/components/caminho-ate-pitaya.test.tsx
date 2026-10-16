import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { getAnimatedStyle, useReducedMotion } from 'react-native-reanimated';

import { CaminhoAtePitaya } from '@/components/caminho-ate-pitaya';

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  ...jest.requireActual('react-native-reanimated'),
  useReducedMotion: jest.fn(() => false),
}));

// Largura 300 - carro (112) - metade da pitaya (32) = 156 de estrada a percorrer.
const LARGURA = 300;
const DISTANCIA = 156;
// O desenho é escondido do leitor de tela; nos testes é preciso pedir para incluí-lo.
const OCULTOS = { includeHiddenElements: true };

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

async function montar() {
  await render(<CaminhoAtePitaya />);
  await fireEvent(screen.getByTestId('caminho-ate-pitaya', OCULTOS), 'layout', {
    nativeEvent: { layout: { width: LARGURA, height: 120, x: 0, y: 0 } },
  });
  // O estilo animado é recalculado no frame seguinte à medição.
  await act(() => jest.advanceTimersByTime(16));
}

function posicaoDoCarro() {
  const estilo = getAnimatedStyle(screen.getByTestId('carro', OCULTOS)) as {
    transform: { translateX?: number }[];
  };
  return estilo.transform[0].translateX ?? 0;
}

test('o carro anda pela estrada em direção à pitaya', async () => {
  jest.mocked(useReducedMotion).mockReturnValue(false);
  await montar();
  const inicio = posicaoDoCarro();

  await act(() => jest.advanceTimersByTime(1300));
  const meio = posicaoDoCarro();

  expect(meio).toBeGreaterThan(inicio);
  expect(meio).toBeLessThanOrEqual(DISTANCIA);
});

test('a estrada é tracejada e acompanha a largura disponível', async () => {
  await montar();
  // Traço de 10 + espaço de 8 → 16 traços em 300 de largura.
  expect(screen.getByTestId('estrada', OCULTOS).children).toHaveLength(16);
});

test('com "reduzir movimento" o carro fica parado no meio do caminho', async () => {
  jest.mocked(useReducedMotion).mockReturnValue(true);
  await montar();
  const antes = posicaoDoCarro();

  await act(() => jest.advanceTimersByTime(2000));

  expect(posicaoDoCarro()).toBe(antes);
  expect(antes).toBeCloseTo(DISTANCIA / 2);
});

test('o desenho é decorativo e fica escondido do leitor de tela', async () => {
  await render(<CaminhoAtePitaya />);
  expect(screen.queryByTestId('caminho-ate-pitaya')).toBeNull();
  expect(screen.queryByTestId('caminho-ate-pitaya', OCULTOS)).not.toBeNull();
});
