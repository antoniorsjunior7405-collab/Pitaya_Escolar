import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import { createDb, schema } from '../db/index.js';
import { hashSenha } from '../modules/auth/index.js';

// Cria uma organização e o primeiro ADMIN dela. Imprime o código de convite que
// motoristas e responsáveis usam no cadastro.
//
// Uso: npm run seed:admin -- --org "Nome" --nome "Fulano" --email a@b.com --senha "..."
const { values } = parseArgs({
  options: {
    org: { type: 'string' },
    nome: { type: 'string' },
    email: { type: 'string' },
    senha: { type: 'string' },
  },
});

const { org, nome, email, senha } = values;
if (!org || !nome || !email || !senha) {
  console.error(
    'Uso: npm run seed:admin -- --org "Nome" --nome "Fulano" --email a@b.com --senha "..."',
  );
  process.exit(1);
}
if (senha.length < 8) {
  console.error('A senha precisa de pelo menos 8 caracteres');
  process.exit(1);
}

const { db, pool } = createDb();
const codigoConvite = randomBytes(5).toString('hex').toUpperCase();

await db.transaction(async (tx) => {
  const [organizacao] = await tx
    .insert(schema.organizacoes)
    .values({ nome: org, codigoConvite })
    .returning();
  const [usuario] = await tx
    .insert(schema.usuarios)
    .values({ nome, email: email.trim().toLowerCase(), senhaHash: await hashSenha(senha) })
    .returning();
  if (!organizacao || !usuario) throw new Error('falha ao criar');
  await tx
    .insert(schema.membros)
    .values({ organizacaoId: organizacao.id, usuarioId: usuario.id, papel: 'ADMIN' });
});

console.log(`Organização "${org}" criada. Admin: ${email}`);
console.log(`Código de convite: ${codigoConvite}`);
await pool.end();
