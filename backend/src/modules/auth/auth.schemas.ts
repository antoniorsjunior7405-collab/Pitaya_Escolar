import { z } from 'zod';

const email = z.string().trim().toLowerCase().pipe(z.email().max(254));
const senha = z.string().min(8, 'A senha precisa de pelo menos 8 caracteres').max(128);

// ADMIN nunca se cadastra sozinho: é criado pelo script de seed ou por outro admin.
export const papelCadastro = z.enum(['MOTORISTA', 'RESPONSAVEL']);

export const cadastroBody = z.object({
  nome: z.string().trim().min(2).max(120),
  email,
  senha,
  telefone: z.string().trim().min(8).max(20).optional(),
  papel: papelCadastro,
  codigoConvite: z.string().trim().min(4).max(64),
});

export const loginBody = z.object({ email, senha: z.string().min(1).max(128) });
export const refreshBody = z.object({ refreshToken: z.string().min(20).max(200) });

const usuarioPublico = z.object({
  id: z.uuid(),
  nome: z.string(),
  email: z.string(),
  telefone: z.string().nullable(),
});

const membro = z.object({
  organizacaoId: z.uuid(),
  organizacaoNome: z.string(),
  papel: z.enum(['ADMIN', 'MOTORISTA', 'RESPONSAVEL']),
});

export const sessaoResponse = z.object({
  usuario: usuarioPublico,
  accessToken: z.string(),
  refreshToken: z.string(),
});

export const tokensResponse = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});

export const meResponse = z.object({
  usuario: usuarioPublico,
  organizacoes: z.array(membro),
});

export type CadastroInput = z.infer<typeof cadastroBody>;
