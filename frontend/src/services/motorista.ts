import { api } from '@/lib/api';
import type {
  Evento,
  RotaDetalhe,
  RotaResumo,
  TipoEvento,
  Viagem,
  ViagemHistorico,
} from '@/types';

// Chamadas da área do motorista. As telas usam estas funções (nunca URLs diretas).

export const chavesMotorista = {
  rotas: ['motorista', 'rotas'] as const,
  rota: (rotaId: string) => ['motorista', 'rota', rotaId] as const,
  historico: ['motorista', 'historico'] as const,
};

export const listarRotas = () => api<RotaResumo[]>('/v1/motorista/rotas');

export const detalharRota = (rotaId: string) =>
  api<RotaDetalhe>(`/v1/motorista/rotas/${encodeURIComponent(rotaId)}`);

export const iniciarViagem = (rotaId: string) =>
  api<Viagem>(`/v1/motorista/rotas/${encodeURIComponent(rotaId)}/viagens`, { method: 'POST' });

export const registrarEvento = (viagemId: string, alunoId: string, tipo: TipoEvento) =>
  api<Evento>(`/v1/motorista/viagens/${encodeURIComponent(viagemId)}/eventos`, {
    method: 'POST',
    body: { alunoId, tipo },
  });

export const finalizarViagem = (viagemId: string) =>
  api<Viagem>(`/v1/motorista/viagens/${encodeURIComponent(viagemId)}/finalizar`, {
    method: 'POST',
  });

export const enviarPosicao = (
  viagemId: string,
  posicao: { latitude: number; longitude: number; velocidade: number | null },
) =>
  api<void>(`/v1/motorista/viagens/${encodeURIComponent(viagemId)}/posicao`, {
    method: 'PUT',
    body: posicao,
  });

export const listarHistorico = () => api<ViagemHistorico[]>('/v1/motorista/viagens?limit=30');
