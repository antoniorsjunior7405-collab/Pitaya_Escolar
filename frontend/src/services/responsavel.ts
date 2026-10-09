import { api } from '@/lib/api';
import type { FilhoDetalhe, FilhoResumo } from '@/types';

// Chamadas da área do responsável.

export const chavesResponsavel = {
  filhos: ['responsavel', 'filhos'] as const,
  filho: (alunoId: string) => ['responsavel', 'filho', alunoId] as const,
};

export const listarFilhos = () => api<FilhoResumo[]>('/v1/responsavel/filhos');

export const acompanharFilho = (alunoId: string) =>
  api<FilhoDetalhe>(`/v1/responsavel/filhos/${encodeURIComponent(alunoId)}`);
