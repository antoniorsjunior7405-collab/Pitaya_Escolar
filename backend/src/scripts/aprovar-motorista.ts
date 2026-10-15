import { parseArgs } from 'node:util';
import { and, eq } from 'drizzle-orm';
import { createDb, schema } from '../db/index.js';

// Aprova (ou revoga) um motorista na plataforma. Só motorista aprovado aparece na busca das
// famílias e recebe pedidos de vínculo. Aprove depois de conferir os documentos do condutor
// escolar (CTB art. 138: idade, CNH categoria D, curso especializado).
//
// Uso: npm run aprovar:motorista -- --email m@x.com
//      npm run aprovar:motorista -- --email m@x.com --revogar
const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    revogar: { type: 'boolean', default: false },
  },
});

if (!values.email) {
  console.error('Uso: npm run aprovar:motorista -- --email m@x.com [--revogar]');
  process.exit(1);
}

const { db, pool } = createDb();
const { usuarios, membros, perfisMotorista } = schema;

try {
  const [motorista] = await db
    .select({ id: usuarios.id, nome: usuarios.nome })
    .from(usuarios)
    .innerJoin(membros, eq(membros.usuarioId, usuarios.id))
    .where(
      and(eq(usuarios.email, values.email.trim().toLowerCase()), eq(membros.papel, 'MOTORISTA')),
    )
    .limit(1);
  if (!motorista) throw new Error(`${values.email} não tem conta de motorista`);

  const aprovadoEm = values.revogar ? null : new Date();
  await db
    .insert(perfisMotorista)
    .values({ usuarioId: motorista.id, aprovadoEm })
    .onConflictDoUpdate({ target: perfisMotorista.usuarioId, set: { aprovadoEm } });

  console.log(
    values.revogar
      ? `Aprovação de ${motorista.nome} revogada: não aparece mais na busca.`
      : `Aprovação de ${motorista.nome} registrada: já aparece na busca das famílias.`,
  );
} catch (erro) {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
} finally {
  await pool.end();
}
