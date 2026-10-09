import { fireEvent, render, screen } from '@testing-library/react-native';

import { StatusBadge } from '@/components/status-badge';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Seletor } from '@/components/ui/seletor';

test('StatusBadge mostra o status em TEXTO (não só cor) e anuncia ao leitor de tela', async () => {
  await render(<StatusBadge status="EMBARCADO" />);
  expect(screen.getByText('Embarcado')).toBeTruthy();
  expect(screen.getByLabelText('Status: Embarcado')).toBeTruthy();
});

test('PrimaryButton desabilitado não dispara a ação e anuncia o estado', async () => {
  const onPress = jest.fn();
  await render(<PrimaryButton titulo="Entrar" onPress={onPress} desabilitado />);
  const botao = screen.getByRole('button', { name: 'Entrar' });
  await fireEvent.press(botao);
  expect(onPress).not.toHaveBeenCalled();
  expect(botao.props.accessibilityState).toMatchObject({ disabled: true });
});

test('PrimaryButton carregando troca o texto pelo indicador e fica ocupado', async () => {
  await render(<PrimaryButton titulo="Salvar" onPress={jest.fn()} carregando />);
  expect(screen.queryByText('Salvar')).toBeNull();
  expect(screen.getByRole('button').props.accessibilityState).toMatchObject({ busy: true });
});

test('Seletor marca a opção escolhida e avisa a mudança', async () => {
  const onChange = jest.fn();
  await render(
    <Seletor
      rotulo="Período"
      opcoes={[
        { valor: 'MANHA', rotulo: 'Manhã' },
        { valor: 'TARDE', rotulo: 'Tarde' },
      ]}
      valor="MANHA"
      onChange={onChange}
    />,
  );
  expect(screen.getByRole('radio', { name: 'Manhã' }).props.accessibilityState).toMatchObject({
    checked: true,
  });
  await fireEvent.press(screen.getByRole('radio', { name: 'Tarde' }));
  expect(onChange).toHaveBeenCalledWith('TARDE');
});

test('Seletor sem opções mostra a orientação de vazio', async () => {
  await render(
    <Seletor
      rotulo="Motorista"
      opcoes={[]}
      valor={null}
      onChange={jest.fn()}
      vazio="Nenhum motorista ainda."
    />,
  );
  expect(screen.getByText('Nenhum motorista ainda.')).toBeTruthy();
});
