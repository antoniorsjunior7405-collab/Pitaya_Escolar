import { z } from 'zod';

const periodo = z.enum(['MANHA', 'TARDE', 'NOITE']);
const papel = z.enum(['ADMIN', 'MOTORISTA', 'RESPONSAVEL']);
const texto = (max: number) => z.string().trim().min(1).max(max);

export const organizacaoResponse = z.object({ nome: z.string(), codigoConvite: z.string() });

export const membrosQuery = z.object({ papel: papel.optional() });
export const membro = z.object({
  id: z.uuid(),
  nome: z.string(),
  email: z.string(),
  telefone: z.string().nullable(),
  papel,
});

export const veiculoBody = z.object({
  // Placa no padrão antigo (ABC-1234) ou Mercosul (ABC1D23); normalizada para maiúsculas.
  placa: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}-?\d[A-Z0-9]\d{2}$/, 'Placa inválida'),
  modelo: texto(80),
  capacidade: z.number().int().min(1).max(100).optional(),
});
export const veiculo = z.object({
  id: z.uuid(),
  placa: z.string(),
  modelo: z.string(),
  capacidade: z.number().int().nullable(),
});

export const alunoBody = z.object({ nome: texto(120) });
export const aluno = z.object({ id: z.uuid(), nome: z.string() });

export const vinculoBody = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  parentesco: texto(40).optional(),
});

export const rotaBody = z.object({
  nome: texto(80),
  periodo: periodo.optional(),
  motoristaId: z.uuid(),
  veiculoId: z.uuid(),
});
export const rota = z.object({
  id: z.uuid(),
  nome: z.string(),
  periodo: periodo.nullable(),
  motoristaNome: z.string(),
  veiculoPlaca: z.string(),
});

export const rotaAlunoBody = z.object({
  alunoId: z.uuid(),
  ordem: z.number().int().min(1).max(500),
  endereco: texto(200).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const alunoDetalhe = aluno.extend({
  responsaveis: z.array(
    z.object({
      id: z.uuid(),
      nome: z.string(),
      email: z.string(),
      parentesco: z.string().nullable(),
      autorizado: z.boolean(),
    }),
  ),
});

export const rotaDetalhe = rota.extend({
  alunos: z.array(
    z.object({
      id: z.uuid(),
      nome: z.string(),
      ordem: z.number().int(),
      endereco: z.string().nullable(),
    }),
  ),
});

export const alunoParams = z.object({ alunoId: z.uuid() });
export const rotaParams = z.object({ rotaId: z.uuid() });

export type VeiculoInput = z.infer<typeof veiculoBody>;
export type RotaInput = z.infer<typeof rotaBody>;
export type RotaAlunoInput = z.infer<typeof rotaAlunoBody>;
export type VinculoInput = z.infer<typeof vinculoBody>;
