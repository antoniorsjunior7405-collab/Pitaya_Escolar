import { api } from '@/lib/api';
import type { EstadoPedido, PaginaMotoristas, Pedido, PedidoRecebido } from '@/types';

// Busca de motoristas, pedido de transporte (tela de espera) e resposta do motorista.
// As telas usam estas funções (nunca URLs diretas).

export type FiltroBusca = { termo: string; regiao: string };

export const chavesVinculos = {
  busca: (filtro: FiltroBusca) => ['vinculos', 'busca', filtro] as const,
  pedidos: ['vinculos', 'pedidos'] as const,
  pedido: (pedidoId: string) => ['vinculos', 'pedido', pedidoId] as const,
  recebidos: ['vinculos', 'recebidos'] as const,
};

/** O servidor exige pelo menos 3 letras no nome ou na região (não existe "listar todos"). */
export const MIN_LETRAS_BUSCA = 3;

/** Enquanto o motorista não responde, a tela de espera consulta o servidor neste intervalo. */
export const INTERVALO_PEDIDO_MS = 15_000;

/** Num estado final a resposta não muda mais: parar de consultar poupa bateria, dados e servidor. */
export function intervaloDoPedido(estado: EstadoPedido | undefined): number | false {
  return estado === undefined || estado === 'PENDENTE' ? INTERVALO_PEDIDO_MS : false;
}

export function filtroValido({ termo, regiao }: FiltroBusca): boolean {
  return termo.trim().length >= MIN_LETRAS_BUSCA || regiao.trim().length >= MIN_LETRAS_BUSCA;
}

/** Monta a query string só com os campos preenchidos (o servidor recusa campo vazio ou curto). */
function queryDaBusca({ termo, regiao }: FiltroBusca, cursor: string | null) {
  const partes: [string, string][] = [];
  if (termo.trim().length >= MIN_LETRAS_BUSCA) partes.push(['termo', termo.trim()]);
  if (regiao.trim().length >= MIN_LETRAS_BUSCA) partes.push(['regiao', regiao.trim()]);
  if (cursor) partes.push(['cursor', cursor]);
  return partes.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
}

// ── Responsável ──────────────────────────────────────────────────────────────

export const buscarMotoristas = (filtro: FiltroBusca, cursor: string | null) =>
  api<PaginaMotoristas>(`/v1/responsavel/motoristas?${queryDaBusca(filtro, cursor)}`);

export const pedirTransporte = (motoristaId: string, alunoId: string) =>
  api<Pedido>('/v1/responsavel/solicitacoes', {
    method: 'POST',
    body: { motoristaId, alunoId },
  });

export const listarPedidos = () => api<Pedido[]>('/v1/responsavel/solicitacoes?limit=20');

export const detalharPedido = (pedidoId: string) =>
  api<Pedido>(`/v1/responsavel/solicitacoes/${encodeURIComponent(pedidoId)}`);

export const cancelarPedido = (pedidoId: string) =>
  api<Pedido>(`/v1/responsavel/solicitacoes/${encodeURIComponent(pedidoId)}/cancelar`, {
    method: 'POST',
  });

// ── Motorista ────────────────────────────────────────────────────────────────

export const listarPedidosRecebidos = () =>
  api<PedidoRecebido[]>('/v1/motorista/solicitacoes?limit=20');

export const responderPedido = (pedidoId: string, decisao: 'aceitar' | 'recusar') =>
  api<PedidoRecebido>(`/v1/motorista/solicitacoes/${encodeURIComponent(pedidoId)}/${decisao}`, {
    method: 'POST',
  });
