import type { Db } from './client.js';
import { registrosAuditoria } from './schema.js';

export type AcaoAuditada =
  'ALUNO_CRIADO' | 'ALUNO_EDITADO' | 'ALUNO_EXCLUIDO' | 'ALUNO_ANONIMIZADO';

export type RegistroAuditoria = {
  usuarioId: string;
  organizacaoId: string | null;
  acao: AcaoAuditada;
  entidade: 'aluno';
  entidadeId: string;
};

/**
 * Grava quem fez a ação. Chame com a MESMA transação da ação: ou as duas ficam gravadas,
 * ou nenhuma. Nunca passe dados pessoais (nome, endereço): só ids.
 */
export async function registrarAuditoria(
  executor: Pick<Db, 'insert'>,
  registro: RegistroAuditoria,
) {
  await executor.insert(registrosAuditoria).values(registro);
}
