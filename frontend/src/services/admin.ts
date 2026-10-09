import { api } from '@/lib/api';
import type { Periodo } from '@/types';
import type {
  AlunoAdmin,
  AlunoDetalheAdmin,
  Membro,
  Organizacao,
  RotaAdmin,
  RotaDetalheAdmin,
  VeiculoAdmin,
} from '@/types/admin';
import type { Papel } from '@/types/api';

// Cadastros da organização (área do admin).

export const chavesAdmin = {
  organizacao: ['admin', 'organizacao'] as const,
  membros: (papel?: Papel) => ['admin', 'membros', papel ?? 'todos'] as const,
  veiculos: ['admin', 'veiculos'] as const,
  alunos: ['admin', 'alunos'] as const,
  aluno: (id: string) => ['admin', 'aluno', id] as const,
  rotas: ['admin', 'rotas'] as const,
  rota: (id: string) => ['admin', 'rota', id] as const,
};

const id = (valor: string) => encodeURIComponent(valor);

export const buscarOrganizacao = () => api<Organizacao>('/v1/admin/organizacao');

export const listarMembros = (papel?: Papel) =>
  api<Membro[]>(`/v1/admin/membros${papel ? `?papel=${papel}` : ''}`);

export const listarVeiculos = () => api<VeiculoAdmin[]>('/v1/admin/veiculos');
export const criarVeiculo = (dados: { placa: string; modelo: string; capacidade?: number }) =>
  api<VeiculoAdmin>('/v1/admin/veiculos', { method: 'POST', body: dados });

export const listarAlunos = () => api<AlunoAdmin[]>('/v1/admin/alunos');
export const detalharAluno = (alunoId: string) =>
  api<AlunoDetalheAdmin>(`/v1/admin/alunos/${id(alunoId)}`);
export const criarAluno = (nome: string) =>
  api<AlunoAdmin>('/v1/admin/alunos', { method: 'POST', body: { nome } });
export const vincularResponsavel = (alunoId: string, dados: { email: string; parentesco?: string }) =>
  api<void>(`/v1/admin/alunos/${id(alunoId)}/responsaveis`, { method: 'POST', body: dados });

export const listarRotas = () => api<RotaAdmin[]>('/v1/admin/rotas');
export const detalharRota = (rotaId: string) =>
  api<RotaDetalheAdmin>(`/v1/admin/rotas/${id(rotaId)}`);
export const criarRota = (dados: {
  nome: string;
  periodo?: Periodo;
  motoristaId: string;
  veiculoId: string;
}) => api<{ id: string }>('/v1/admin/rotas', { method: 'POST', body: dados });
export const adicionarAlunoNaRota = (
  rotaId: string,
  dados: { alunoId: string; ordem: number; endereco?: string },
) => api<void>(`/v1/admin/rotas/${id(rotaId)}/alunos`, { method: 'POST', body: dados });
