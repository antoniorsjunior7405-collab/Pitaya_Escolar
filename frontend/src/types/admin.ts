// Tipos da área administrativa (espelham backend/src/modules/admin/admin.schemas.ts).
import type { Papel } from '@/types/api';
import type { Periodo } from '@/types';

export type Organizacao = { nome: string; codigoConvite: string };

export type Membro = {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  papel: Papel;
};

export type VeiculoAdmin = { id: string; placa: string; modelo: string; capacidade: number | null };

export type AlunoAdmin = { id: string; nome: string };

export type AlunoDetalheAdmin = AlunoAdmin & {
  responsaveis: {
    id: string;
    nome: string;
    email: string;
    parentesco: string | null;
    autorizado: boolean;
  }[];
};

export type RotaAdmin = {
  id: string;
  nome: string;
  periodo: Periodo | null;
  motoristaNome: string;
  veiculoPlaca: string;
};

export type RotaDetalheAdmin = RotaAdmin & {
  alunos: { id: string; nome: string; ordem: number; endereco: string | null }[];
};
