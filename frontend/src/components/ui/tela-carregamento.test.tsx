import { render, screen } from '@testing-library/react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { Marca } from '@/components/marca';
import { PrimaryButton } from '@/components/ui/primary-button';
import { TelaCarregamento } from '@/components/ui/tela-carregamento';

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  ...jest.requireActual('react-native-reanimated'),
  useReducedMotion: jest.fn(() => false),
}));

test('TelaCarregamento anuncia o carregamento padrão ao leitor de tela', async () => {
  await render(<TelaCarregamento />);
  expect(screen.getByText('Carregando…')).toBeTruthy();
  expect(screen.getByRole('progressbar', { name: 'Carregando…' })).toBeTruthy();
});

test('TelaCarregamento mostra mensagem e descrição de quem a reaproveita', async () => {
  await render(
    <TelaCarregamento
      mensagem="Enviando pedido…"
      descricao="O servidor pode levar alguns segundos para acordar."
    />,
  );
  expect(screen.getByText('Enviando pedido…')).toBeTruthy();
  expect(screen.getByText('O servidor pode levar alguns segundos para acordar.')).toBeTruthy();
  // Mensagem e descrição são lidas juntas, como um único aviso de progresso.
  expect(
    screen.getByRole('progressbar', {
      name: 'Enviando pedido… O servidor pode levar alguns segundos para acordar.',
    }),
  ).toBeTruthy();
});

test('TelaCarregamento sem descrição não deixa texto vazio na tela', async () => {
  await render(<TelaCarregamento mensagem="Buscando motoristas…" />);
  expect(screen.getAllByText(/./)).toHaveLength(1);
});

test('TelaCarregamento aceita ações no espaço de children', async () => {
  const onPress = jest.fn();
  await render(
    <TelaCarregamento mensagem="Aguardando o motorista…">
      <PrimaryButton titulo="Cancelar pedido" variante="secundario" onPress={onPress} />
    </TelaCarregamento>,
  );
  expect(screen.getByRole('button', { name: 'Cancelar pedido' })).toBeTruthy();
});

test('com "reduzir movimento" ligado a tela continua funcionando (carro parado)', async () => {
  jest.mocked(useReducedMotion).mockReturnValue(true);
  await render(<TelaCarregamento mensagem="Carregando rota…" />);
  expect(screen.getByRole('progressbar', { name: 'Carregando rota…' })).toBeTruthy();
});

test('Marca continua com o selo da pitaya depois da extração do SeloPitaya', async () => {
  await render(<Marca subtitulo="Transporte escolar" />);
  expect(screen.getByLabelText('Pitaya Escolar')).toBeTruthy();
  expect(screen.getByText('Transporte escolar')).toBeTruthy();
});
