import { fireEvent, render, screen } from '@testing-library/react-native';

import { CartaoAlunoViagem } from '@/components/cartao-aluno-viagem';
import { ConfirmacaoChegada } from '@/components/confirmacao-chegada';
import type { AlunoDaRota, StatusAluno } from '@/types';

const aluno = (status: StatusAluno, chegadaConfirmada = false): AlunoDaRota => ({
  id: 'a1',
  nome: 'Ana',
  ordem: 1,
  endereco: null,
  status,
  chegadaConfirmada,
});

async function renderCartao(status: StatusAluno, extra: { chegadaConfirmada?: boolean } = {}) {
  const onRegistrar = jest.fn();
  await render(
    <CartaoAlunoViagem
      aluno={aluno(status, extra.chegadaConfirmada)}
      status={status}
      emAndamento
      enviando={null}
      ocupado={false}
      onRegistrar={onRegistrar}
    />,
  );
  return { onRegistrar };
}

test('aluno aguardando: o motorista pode marcar o embarque ou a falta', async () => {
  const { onRegistrar } = await renderCartao('AGUARDANDO');
  await fireEvent.press(screen.getByRole('button', { name: 'Faltou: Ana' }));
  expect(onRegistrar).toHaveBeenCalledWith('AUSENTE');
  expect(screen.getByRole('button', { name: 'Embarcou: Ana' })).toBeTruthy();
});

test('aluno que faltou aparece como "Faltou" e ainda pode embarcar', async () => {
  const { onRegistrar } = await renderCartao('AUSENTE');
  expect(screen.getByLabelText('Status: Faltou')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Embarcou: Ana' }));
  expect(onRegistrar).toHaveBeenCalledWith('EMBARCADO');
});

test('motorista vê quando o responsável confirmou a chegada', async () => {
  await renderCartao('ENTREGUE', { chegadaConfirmada: true });
  expect(screen.getByText('O responsável confirmou a chegada.')).toBeTruthy();
  expect(screen.queryByRole('button')).toBeNull();
});

test('responsável confirma a chegada depois da entrega', async () => {
  const onConfirmar = jest.fn();
  await render(
    <ConfirmacaoChegada
      nome="Ana"
      confirmada={false}
      carregando={false}
      onConfirmar={onConfirmar}
    />,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Confirmar chegada de Ana' }));
  expect(onConfirmar).toHaveBeenCalled();
});

test('depois de confirmada, a chegada aparece como confirmada e o botão some', async () => {
  await render(
    <ConfirmacaoChegada nome="Ana" confirmada carregando={false} onConfirmar={jest.fn()} />,
  );
  expect(screen.getByText('Chegada confirmada')).toBeTruthy();
  expect(screen.queryByRole('button')).toBeNull();
});
