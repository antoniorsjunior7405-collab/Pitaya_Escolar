import { z } from 'zod';

// ── Cadastro do filho pela própria família (gestão direta família–motorista) ──
// strictObject: campo desconhecido é recusado (400), conforme BOAS_PRATICAS §7. Organização,
// responsável e autorização NUNCA vêm do corpo: saem do token e das regras do service.

export const alunoParams = z.object({ alunoId: z.uuid() });

// Só o nome (minimização de dados de criança, LGPD). Campo novo precisa de finalidade escrita.
export const filhoBody = z.strictObject({
  nome: z.string().trim().min(2).max(120),
  // Aceite do termo de uso dos dados da criança (LGPD, art. 14). Sem ele, 400.
  consentimento: z.literal(true),
});

// Edição: mesma regra do nome; o consentimento já foi dado no cadastro.
export const filhoEdicaoBody = filhoBody.pick({ nome: true });

export const filho = z.object({ id: z.uuid(), nome: z.string() });

export type FilhoInput = z.infer<typeof filhoBody>;
export type FilhoEdicaoInput = z.infer<typeof filhoEdicaoBody>;
