import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { buildApp } from '../../app.js';
import { autorizacao, depsDeTeste, parcial } from '../../test-utils/deps.js';
import type { AdminRepository } from './admin.repository.js';

// Organização A tem dois motoristas, um veículo da frota, um veículo particular do segundo
// motorista e uma rota; a organização B tem os seus. O admin de A não pode usar nada de B,
// nem por id, nem pôr o veículo particular de um motorista na rota de outro.
async function cenario() {
  const orgA = randomUUID();
  const orgB = randomUUID();
  const ids = {
    adminA: randomUUID(),
    motoristaA: randomUUID(),
    motoristaA2: randomUUID(),
    motoristaB: randomUUID(),
    veiculoA: randomUUID(),
    veiculoParticularA2: randomUUID(),
    veiculoB: randomUUID(),
    rotaA: randomUUID(),
    alunoA: randomUUID(),
    alunoB: randomUUID(),
  };
  const da = new Map<string, string>([
    [ids.veiculoA, orgA],
    [ids.veiculoParticularA2, orgA],
    [ids.veiculoB, orgB],
    [ids.rotaA, orgA],
    [ids.alunoA, orgA],
    [ids.alunoB, orgB],
  ]);
  const membros = [
    { usuarioId: ids.adminA, organizacaoId: orgA, papel: 'ADMIN' as const },
    { usuarioId: ids.motoristaA, organizacaoId: orgA, papel: 'MOTORISTA' as const },
    { usuarioId: ids.motoristaA2, organizacaoId: orgA, papel: 'MOTORISTA' as const },
    { usuarioId: ids.motoristaB, organizacaoId: orgB, papel: 'MOTORISTA' as const },
  ];
  // Dono do veículo (ausente = frota da organização).
  const dono = new Map<string, string>([[ids.veiculoParticularA2, ids.motoristaA2]]);

  const adminRepository = parcial<AdminRepository>('adminRepository', {
    buscarMembroPorId: async (org, usuarioId, papel) =>
      membros.some(
        (m) => m.organizacaoId === org && m.usuarioId === usuarioId && m.papel === papel,
      ),
    buscarMembroPorEmail: async () => undefined,
    veiculoDisponivelParaRota: async (org, id, motoristaId) =>
      da.get(id) === org && (dono.get(id) ?? motoristaId) === motoristaId,
    alunoDaOrganizacao: async (org, id) => da.get(id) === org,
    rotaDaOrganizacao: async (org, id) => da.get(id) === org,
    criarRota: async () => ({ id: randomUUID() }),
    adicionarAlunoNaRota: async () => 'ok',
  });

  const app = await buildApp(depsDeTeste({ adminRepository }));
  const h = (sub: string) => autorizacao(app, sub, membros);
  return { app, ids, h };
}

test('área admin: motorista recebe 403', async () => {
  const { app, ids, h } = await cenario();
  const res = await app.inject({
    method: 'GET',
    url: '/v1/admin/rotas',
    headers: h(ids.motoristaA),
  });
  assert.equal(res.statusCode, 403);
  await app.close();
});

test('criar rota: motorista ou veículo de outra organização → 404; da mesma → 201', async () => {
  const { app, ids, h } = await cenario();
  const criar = (motoristaId: string, veiculoId: string) =>
    app.inject({
      method: 'POST',
      url: '/v1/admin/rotas',
      headers: h(ids.adminA),
      payload: { nome: 'Rota X', motoristaId, veiculoId },
    });
  assert.equal((await criar(ids.motoristaB, ids.veiculoA)).statusCode, 404);
  assert.equal((await criar(ids.motoristaA, ids.veiculoB)).statusCode, 404);
  assert.equal((await criar(ids.motoristaA, ids.veiculoA)).statusCode, 201);
  await app.close();
});

test('criar rota: veículo particular de outro motorista → 404; do próprio motorista → 201', async () => {
  const { app, ids, h } = await cenario();
  const criar = (motoristaId: string, veiculoId: string) =>
    app.inject({
      method: 'POST',
      url: '/v1/admin/rotas',
      headers: h(ids.adminA),
      payload: { nome: 'Rota Y', motoristaId, veiculoId },
    });
  assert.equal((await criar(ids.motoristaA, ids.veiculoParticularA2)).statusCode, 404);
  assert.equal((await criar(ids.motoristaA2, ids.veiculoParticularA2)).statusCode, 201);
  await app.close();
});

test('aluno de outra organização não entra na rota; responsável inexistente → 404', async () => {
  const { app, ids, h } = await cenario();
  const naRota = await app.inject({
    method: 'POST',
    url: `/v1/admin/rotas/${ids.rotaA}/alunos`,
    headers: h(ids.adminA),
    payload: { alunoId: ids.alunoB, ordem: 1 },
  });
  assert.equal(naRota.statusCode, 404);

  const vinculo = await app.inject({
    method: 'POST',
    url: `/v1/admin/alunos/${ids.alunoA}/responsaveis`,
    headers: h(ids.adminA),
    payload: { email: 'ninguem@example.com' },
  });
  assert.equal(vinculo.statusCode, 404);
  await app.close();
});

test('placa inválida é recusada na validação (400)', async () => {
  const { app, ids, h } = await cenario();
  const res = await app.inject({
    method: 'POST',
    url: '/v1/admin/veiculos',
    headers: h(ids.adminA),
    payload: { placa: 'E2E1A71', modelo: 'Van' },
  });
  assert.equal(res.statusCode, 400);
  await app.close();
});
