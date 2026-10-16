import { render, screen } from '@testing-library/react-native';

import { StatusPedido, textoDoPrazo } from '@/components/status-pedido';
import type { EstadoPedido, Pedido } from '@/types';

const AGORA = new Date('2026-10-15T12:00:00Z').getTime();
const DIA = 24 * 60 * 60 * 1000;

const pedido = (estado: EstadoPedido, telefone: string | null = null): Pedido => ({
  id: 'p-1',
  estado,
  criadoEm: new Date(AGORA - 2 * 60 * 60 * 1000).toISOString(),
  expiraEm: new Date(AGORA + 6 * DIA).toISOString(),
  respondidaEm: estado === 'PENDENTE' ? null : new Date(AGORA).toISOString(),
  aluno: { id: 'a-1', nome: 'Ana' },
  motorista: { id: 'm-1', nome: 'Carlos Souza', regiaoAtendimento: 'Zona Sul', telefone },
});

test.each([
  ['PENDENTE', 'Aguardando o motorista responder'],
  ['ACEITA', 'Motorista confirmou'],
  ['RECUSADA', 'O motorista não aceitou'],
  ['CANCELADA', 'Você cancelou este pedido'],
  ['EXPIRADA', 'O pedido venceu'],
] as const)('status %s mostra o texto "%s" (não só a cor)', async (estado, titulo) => {
  await render(<StatusPedido pedido={pedido(estado)} agora={AGORA} />);
  expect(screen.getByText(titulo)).toBeTruthy();
});

test('pendente mostra para quem é, há quanto tempo e quando vence; sem telefone', async () => {
  await render(<StatusPedido pedido={pedido('PENDENTE', '11999990000')} agora={AGORA} />);

  expect(screen.getByText('Para: Ana · enviado há 2 h')).toBeTruthy();
  expect(screen.getByText('O pedido vence em 6 dias')).toBeTruthy();
  expect(screen.queryByText(/Telefone/)).toBeNull();
  expect(screen.getByLabelText('Etapa 2 de 3: aguardando resposta')).toBeTruthy();
});

test('aceito mostra o telefone do motorista para combinar os detalhes', async () => {
  await render(<StatusPedido pedido={pedido('ACEITA', '11999990000')} agora={AGORA} />);
  expect(screen.getByText('Telefone: 11999990000')).toBeTruthy();
});

test('o status fica numa região ao vivo, para o leitor de tela anunciar a resposta', async () => {
  await render(<StatusPedido pedido={pedido('PENDENTE')} agora={AGORA} />);
  // Sobe a árvore a partir do título até achar quem declara a região ao vivo.
  let no = screen.getByText('Aguardando o motorista responder').parent;
  while (no && no.props.accessibilityLiveRegion === undefined) no = no.parent;
  expect(no?.props.accessibilityLiveRegion).toBe('polite');
});

test('textoDoPrazo: hoje, 1 dia e vários dias', () => {
  expect(textoDoPrazo(new Date(AGORA - 1000).toISOString(), AGORA)).toBe('vence hoje');
  expect(textoDoPrazo(new Date(AGORA + DIA).toISOString(), AGORA)).toBe('vence em 1 dia');
  expect(textoDoPrazo(new Date(AGORA + 3 * DIA).toISOString(), AGORA)).toBe('vence em 3 dias');
});
