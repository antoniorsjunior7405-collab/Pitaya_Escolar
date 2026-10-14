import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { AvisoRastreamento } from '@/components/aviso-rastreamento';
import { Colors } from '@/constants/theme';

const corDe = (texto: string) =>
  StyleSheet.flatten(screen.getByText(texto, { exact: false }).props.style).color;

test('sem viagem (inativo) não mostra aviso', async () => {
  await render(<AvisoRastreamento estado="inativo" />);
  expect(screen.toJSON()).toBeNull();
});

test.each(['aguardando-gps', 'ativo'] as const)(
  'aviso informativo (%s) não é anunciado como alerta e não usa a cor de erro',
  async (estado) => {
    await render(<AvisoRastreamento estado={estado} />);
    expect(screen.queryByRole('alert')).toBeNull();
    const texto =
      estado === 'ativo' ? 'Localização sendo compartilhada' : 'Obtendo sua localização';
    expect(corDe(texto)).toBe(Colors.light.textSecondary);
  },
);

test.each([
  ['sem-permissao', 'Sem permissão de localização'],
  ['erro', 'Falha ao enviar a localização'],
] as const)('falha (%s) é anunciada como alerta e aparece em vermelho', async (estado, texto) => {
  await render(<AvisoRastreamento estado={estado} />);
  expect(screen.getByRole('alert')).toHaveTextContent(texto, { exact: false });
  expect(corDe(texto)).toBe(Colors.light.danger);
});
