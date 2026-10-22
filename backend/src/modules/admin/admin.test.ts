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

// ── Aprovação do motorista ───────────────────────────────────────────────────

// Organização A: admin, motorista aguardando aprovação, motorista com conta desativada,
// responsável e uma pessoa que é admin E motorista. Organização B: um motorista e o admin dela.
// O fake reproduz o repositório: só MOTORISTA ativo da organização, data original mantida ao
// reaprovar e auditoria apenas quando a situação muda.
async function cenarioAprovacao() {
  const orgA = randomUUID();
  const orgB = randomUUID();
  const ids = {
    adminA: randomUUID(),
    motoristaA: randomUUID(),
    desativadoA: randomUUID(),
    responsavelA: randomUUID(),
    adminMotoristaA: randomUUID(),
    motoristaB: randomUUID(),
    adminB: randomUUID(),
  };
  const membros = [
    { usuarioId: ids.adminA, organizacaoId: orgA, papel: 'ADMIN' as const },
    { usuarioId: ids.motoristaA, organizacaoId: orgA, papel: 'MOTORISTA' as const },
    { usuarioId: ids.desativadoA, organizacaoId: orgA, papel: 'MOTORISTA' as const },
    { usuarioId: ids.responsavelA, organizacaoId: orgA, papel: 'RESPONSAVEL' as const },
    { usuarioId: ids.adminMotoristaA, organizacaoId: orgA, papel: 'ADMIN' as const },
    { usuarioId: ids.adminMotoristaA, organizacaoId: orgA, papel: 'MOTORISTA' as const },
    { usuarioId: ids.motoristaB, organizacaoId: orgB, papel: 'MOTORISTA' as const },
    { usuarioId: ids.adminB, organizacaoId: orgB, papel: 'ADMIN' as const },
  ];
  const desativados = new Set<string>([ids.desativadoA]);
  const aprovados = new Map<string, Date>();
  const auditoria: { usuarioId: string; acao: string; entidadeId: string }[] = [];

  const adminRepository = parcial<AdminRepository>('adminRepository', {
    listarMembros: async (org, papel) =>
      membros
        .filter((m) => m.organizacaoId === org && (!papel || m.papel === papel))
        .map((m) => ({
          id: m.usuarioId,
          nome: 'Pessoa',
          email: `${m.usuarioId}@teste.dev`,
          telefone: null,
          papel: m.papel,
          aprovadoEm: m.papel === 'MOTORISTA' ? (aprovados.get(m.usuarioId) ?? null) : null,
        })),
    definirAprovacaoMotorista: async ({ organizacaoId, motoristaId, adminId, aprovar }) => {
      const ehMotorista = membros.some(
        (m) =>
          m.organizacaoId === organizacaoId &&
          m.usuarioId === motoristaId &&
          m.papel === 'MOTORISTA',
      );
      if (!ehMotorista || desativados.has(motoristaId)) return undefined;
      const atual = aprovados.get(motoristaId) ?? null;
      if (aprovar === (atual !== null)) return { aprovadoEm: atual };
      if (aprovar) aprovados.set(motoristaId, new Date());
      else aprovados.delete(motoristaId);
      auditoria.push({
        usuarioId: adminId,
        acao: aprovar ? 'MOTORISTA_APROVADO' : 'MOTORISTA_APROVACAO_REVOGADA',
        entidadeId: motoristaId,
      });
      return { aprovadoEm: aprovados.get(motoristaId) ?? null };
    },
  });

  const app = await buildApp(depsDeTeste({ adminRepository }));
  const h = (sub: string) => autorizacao(app, sub, membros);
  const aprovacao = (
    sub: string,
    motoristaId: string,
    method: 'PUT' | 'DELETE' = 'PUT',
    headers: Record<string, string> = h(sub),
  ) => app.inject({ method, url: `/v1/admin/motoristas/${motoristaId}/aprovacao`, headers });
  return { app, ids, h, aprovados, auditoria, aprovacao };
}

test('aprovação: admin aprova motorista da organização; repetir mantém a data e não duplica a auditoria', async () => {
  const { app, ids, aprovados, auditoria, aprovacao } = await cenarioAprovacao();

  const primeira = await aprovacao(ids.adminA, ids.motoristaA);
  assert.equal(primeira.statusCode, 200, primeira.body);
  const { aprovadoEm } = primeira.json<{ aprovadoEm: string }>();
  assert.ok(aprovadoEm);
  assert.ok(aprovados.has(ids.motoristaA));

  const repetida = await aprovacao(ids.adminA, ids.motoristaA);
  assert.equal(repetida.statusCode, 200);
  assert.equal(repetida.json<{ aprovadoEm: string }>().aprovadoEm, aprovadoEm);
  assert.deepEqual(auditoria, [
    { usuarioId: ids.adminA, acao: 'MOTORISTA_APROVADO', entidadeId: ids.motoristaA },
  ]);
  await app.close();
});

test('aprovação: revogar tira a aprovação e fica na auditoria; revogar de novo não muda nada', async () => {
  const { app, ids, aprovados, auditoria, aprovacao } = await cenarioAprovacao();
  await aprovacao(ids.adminA, ids.motoristaA);

  const revogada = await aprovacao(ids.adminA, ids.motoristaA, 'DELETE');
  assert.equal(revogada.statusCode, 200, revogada.body);
  assert.equal(revogada.json<{ aprovadoEm: null }>().aprovadoEm, null);
  assert.equal(aprovados.has(ids.motoristaA), false);

  assert.equal((await aprovacao(ids.adminA, ids.motoristaA, 'DELETE')).statusCode, 200);
  assert.deepEqual(
    auditoria.map((a) => a.acao),
    ['MOTORISTA_APROVADO', 'MOTORISTA_APROVACAO_REVOGADA'],
  );
  await app.close();
});

test('aprovação: motorista de outra organização, conta desativada, responsável ou id inexistente → 404', async () => {
  const { app, ids, auditoria, aprovacao } = await cenarioAprovacao();
  for (const alvo of [ids.motoristaB, ids.desativadoA, ids.responsavelA, randomUUID()]) {
    assert.equal((await aprovacao(ids.adminA, alvo)).statusCode, 404);
  }
  // O admin da outra organização também não mexe no motorista de A.
  assert.equal((await aprovacao(ids.adminB, ids.motoristaA)).statusCode, 404);
  assert.equal(auditoria.length, 0);
  await app.close();
});

test('aprovação: sem token → 401; motorista → 403; aprovar a própria conta → 403; id inválido → 400', async () => {
  const { app, ids, aprovados, aprovacao } = await cenarioAprovacao();
  assert.equal((await aprovacao(ids.adminA, ids.motoristaA, 'PUT', {})).statusCode, 401);
  assert.equal((await aprovacao(ids.motoristaA, ids.motoristaA)).statusCode, 403);

  const propria = await aprovacao(ids.adminMotoristaA, ids.adminMotoristaA);
  assert.equal(propria.statusCode, 403);
  assert.match(propria.json<{ message: string }>().message, /outro administrador/);

  assert.equal((await aprovacao(ids.adminA, 'nao-e-uuid')).statusCode, 400);
  assert.equal(aprovados.size, 0);
  await app.close();
});

test('lista de motoristas mostra quem está aprovado e quem aguarda aprovação', async () => {
  const { app, ids, h, aprovacao } = await cenarioAprovacao();
  await aprovacao(ids.adminA, ids.motoristaA);
  const res = await app.inject({
    method: 'GET',
    url: '/v1/admin/membros?papel=MOTORISTA',
    headers: h(ids.adminA),
  });
  assert.equal(res.statusCode, 200);
  const lista = res.json<{ id: string; aprovadoEm: string | null }[]>();
  assert.ok(lista.find((m) => m.id === ids.motoristaA)?.aprovadoEm);
  assert.equal(lista.find((m) => m.id === ids.desativadoA)?.aprovadoEm, null);
  await app.close();
});
