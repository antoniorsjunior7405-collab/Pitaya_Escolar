import { randomInt } from 'node:crypto';
import { parseArgs } from 'node:util';
import { and, eq } from 'drizzle-orm';
import { createDb, schema } from '../db/index.js';

// Cria dados de demonstração numa organização existente: 1 veículo, 1 rota para o motorista
// e 3 alunos vinculados ao responsável, com pontos de parada.
// Motorista e responsável precisam já ter criado a conta no app com o código de convite.
//
// Uso: npm run seed:demo -- --convite CODIGO --motorista m@x.com --responsavel r@x.com
const { values } = parseArgs({
  options: {
    convite: { type: 'string' },
    motorista: { type: 'string' },
    responsavel: { type: 'string' },
  },
});

const uso = 'Uso: npm run seed:demo -- --convite CODIGO --motorista m@x.com --responsavel r@x.com';
if (!values.convite || !values.motorista || !values.responsavel) {
  console.error(uso);
  process.exit(1);
}

const { db, pool } = createDb();
const { organizacoes, usuarios, membros, veiculos, rotas, alunos, rotaAlunos, responsaveisAlunos } =
  schema;

async function membroPorEmail(
  organizacaoId: string,
  email: string,
  papel: 'MOTORISTA' | 'RESPONSAVEL',
) {
  const [row] = await db
    .select({ id: usuarios.id })
    .from(membros)
    .innerJoin(usuarios, eq(usuarios.id, membros.usuarioId))
    .where(
      and(
        eq(membros.organizacaoId, organizacaoId),
        eq(membros.papel, papel),
        eq(usuarios.email, email.trim().toLowerCase()),
      ),
    )
    .limit(1);
  if (!row) {
    throw new Error(
      `${email} não tem conta de ${papel.toLowerCase()} nesta organização. Crie a conta no app com o código de convite.`,
    );
  }
  return row.id;
}

// Pontos de parada de exemplo (região central de São Paulo).
const PARADAS = [
  { nome: 'Ana Demo', endereco: 'Rua Augusta, 1500', latitude: -23.5567, longitude: -46.6622 },
  { nome: 'Bruno Demo', endereco: 'Av. Paulista, 900', latitude: -23.5641, longitude: -46.6527 },
  {
    nome: 'Carla Demo',
    endereco: 'Rua da Consolação, 2200',
    latitude: -23.5532,
    longitude: -46.6596,
  },
];

try {
  const [org] = await db
    .select({ id: organizacoes.id, nome: organizacoes.nome })
    .from(organizacoes)
    .where(eq(organizacoes.codigoConvite, values.convite.trim().toUpperCase()))
    .limit(1);
  if (!org) throw new Error('Código de convite não encontrado');

  const motoristaId = await membroPorEmail(org.id, values.motorista, 'MOTORISTA');
  const responsavelId = await membroPorEmail(org.id, values.responsavel, 'RESPONSAVEL');

  await db.transaction(async (tx) => {
    const placa = `DEM${randomInt(0, 10)}A${String(randomInt(0, 100)).padStart(2, '0')}`;
    const [veiculo] = await tx
      .insert(veiculos)
      .values({ organizacaoId: org.id, placa, modelo: 'Van Sprinter (demo)', capacidade: 15 })
      .returning({ id: veiculos.id });
    if (!veiculo) throw new Error('falha ao criar veículo');

    const [rota] = await tx
      .insert(rotas)
      .values({
        organizacaoId: org.id,
        nome: 'Rota Manhã - Demo',
        periodo: 'MANHA',
        motoristaId,
        veiculoId: veiculo.id,
      })
      .returning({ id: rotas.id });
    if (!rota) throw new Error('falha ao criar rota');

    for (const [i, parada] of PARADAS.entries()) {
      const [aluno] = await tx
        .insert(alunos)
        .values({ organizacaoId: org.id, nome: parada.nome })
        .returning({ id: alunos.id });
      if (!aluno) throw new Error('falha ao criar aluno');
      await tx
        .insert(responsaveisAlunos)
        .values({ alunoId: aluno.id, responsavelId, parentesco: 'Responsável' });
      await tx.insert(rotaAlunos).values({
        rotaId: rota.id,
        alunoId: aluno.id,
        ordem: i + 1,
        endereco: parada.endereco,
        latitude: parada.latitude,
        longitude: parada.longitude,
      });
    }
    console.log(
      `Demo criada em "${org.nome}": veículo ${placa}, rota "Rota Manhã - Demo", 3 alunos.`,
    );
  });
} catch (erro) {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
} finally {
  await pool.end();
}
