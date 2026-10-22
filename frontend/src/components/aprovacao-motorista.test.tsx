import { fireEvent, render, screen } from '@testing-library/react-native';

import { AprovacaoMotorista } from '@/components/aprovacao-motorista';

function renderAprovacao(props: { aprovado: boolean; desabilitado?: boolean }) {
  const onAprovar = jest.fn();
  const onRevogar = jest.fn();
  return {
    onAprovar,
    onRevogar,
    pronto: render(
      <AprovacaoMotorista
        nome="Carlos"
        aprovado={props.aprovado}
        carregando={false}
        desabilitado={props.desabilitado ?? false}
        onAprovar={onAprovar}
        onRevogar={onRevogar}
      />,
    ),
  };
}

test('motorista aguardando: mostra a situação em texto e o botão de aprovar', async () => {
  const { onAprovar, onRevogar, pronto } = renderAprovacao({ aprovado: false });
  await pronto;
  expect(screen.getByLabelText('Status: Aguardando aprovação')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Aprovar Carlos' }));
  expect(onAprovar).toHaveBeenCalled();
  expect(onRevogar).not.toHaveBeenCalled();
});

test('motorista aprovado: mostra "Aprovado" e o botão de revogar', async () => {
  const { onAprovar, onRevogar, pronto } = renderAprovacao({ aprovado: true });
  await pronto;
  expect(screen.getByLabelText('Status: Aprovado')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Revogar aprovação de Carlos' }));
  expect(onRevogar).toHaveBeenCalled();
  expect(onAprovar).not.toHaveBeenCalled();
});

test('enquanto outra aprovação está em andamento, o botão fica inativo', async () => {
  const { onAprovar, pronto } = renderAprovacao({ aprovado: false, desabilitado: true });
  await pronto;
  const botao = screen.getByRole('button', { name: 'Aprovar Carlos' });
  await fireEvent.press(botao);
  expect(onAprovar).not.toHaveBeenCalled();
  expect(botao.props.accessibilityState).toMatchObject({ disabled: true });
});
