// Contrato com o backend (backend/src/modules/auth/auth.schemas.ts).
// Quando o backend ganhar OpenAPI, estes tipos passam a ser gerados.

export type Papel = 'ADMIN' | 'MOTORISTA' | 'RESPONSAVEL';

export type Usuario = {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
};

export type Organizacao = {
  organizacaoId: string;
  organizacaoNome: string;
  papel: Papel;
};

export type Tokens = {
  accessToken: string;
  refreshToken: string;
};

export type SessaoResponse = Tokens & { usuario: Usuario };
export type MeResponse = { usuario: Usuario; organizacoes: Organizacao[] };

export type CadastroInput = {
  nome: string;
  email: string;
  senha: string;
  telefone?: string;
  papel: Exclude<Papel, 'ADMIN'>;
  codigoConvite: string;
};
