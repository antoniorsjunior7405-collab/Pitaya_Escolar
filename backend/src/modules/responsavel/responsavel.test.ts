import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { buildApp } from '../../app.js';
import type { Membro } from '../../shared/acesso/acesso.js';
import { autorizacao, depsDeTeste, parcial } from '../../test-utils/deps.js';
import { criarFakeResponsavelRepository } from '../../test-utils/fake-responsavel-repository.js';
import {
  converter,
  NOME_ANONIMIZADO,
  type AcompanhamentoRow,
  type ResponsavelRepository,
} from './responsavel.repository.js';
import { MAX_FILHOS_POR_RESPONSAVEL, TERMO_CADASTRO_ALUNO_VERSAO } from './responsavel.service.js';

const linha = (extra: Partial<AcompanhamentoRow> = {}): AcompanhamentoRow => ({
  id: randomUUID(),
  nome: 'Ana',
  statusAluno: 'EMBARCADO',
  chegadaConfirmada: false,
  viagemId: randomUUID(),
  viagemStatus: 'EM_ANDAMENTO',
  rotaNome: 'Rota Manhã',
  motoristaNome: 'Carlos',
  motoristaTelefone: null,
  veiculoPlaca: 'ABC1D23',
  veiculoModelo: 'Van',
  latitude: -23.55,
  longitude: -46.63,
  velocidade: null,
  posicaoAtualizadaEm: new Date(),
  ...extra,
});

async function cenario(linhas: AcompanhamentoRow[]) {
  const responsavel = randomUUID();
  const membros: Membro[] = [
    { usuarioId: responsavel, organizacaoId: randomUUID(), papel: 'RESPONSAVEL' },
  ];
  const confirmacoes: { viagemId: string; alunoId: string; responsavelId: string }[] = [];
  const responsavelRepository = parcial<ResponsavelRepository>('responsavelRepository', {
    listarAcompanhamento: async (_escopo, _hoje, alunoId) =>
      alunoId ? linhas.filter((l) => l.id === alunoId) : linhas,
    confirmarChegada: async (input) => {
      confirmacoes.push(input);
      return confirmacoes.length === 1;
    },
  });
  const app = await buildApp(depsDeTeste({ responsavelRepository }));
  return { app, responsavel, confirmacoes, h: autorizacao(app, responsavel, membros) };
}

test('detalhe traz a posição durante a viagem; sem viagem, posição e viagem vêm nulas', async () => {
  const emViagem = linha();
  const semViagem = linha({
    viagemId: null,
    viagemStatus: null,
    statusAluno: 'AGUARDANDO',
    latitude: null,
    longitude: null,
    posicaoAtualizadaEm: null,
  });
  const { app, h } = await cenario([emViagem, semViagem]);

  const a = await app.inject({
    method: 'GET',
    url: `/v1/responsavel/filhos/${emViagem.id}`,
    headers: h,
  });
  assert.equal(a.statusCode, 200);
  assert.equal(a.json<{ posicao: { latitude: number } }>().posicao.latitude, -23.55);

  const b = await app.inject({
    method: 'GET',
    url: `/v1/responsavel/filhos/${semViagem.id}`,
    headers: h,
  });
  assert.deepEqual(
    {
      viagem: b.json<{ viagem: unknown }>().viagem,
      posicao: b.json<{ posicao: unknown }>().posicao,
    },
    { viagem: null, posicao: null },
  );
  await app.close();
});

test('filho de outra família → 404; motorista na área do responsável → 403', async () => {
  const { app, h } = await cenario([linha()]);
  const res = await app.inject({
    method: 'GET',
    url: `/v1/responsavel/filhos/${randomUUID()}`,
    headers: h,
  });
  assert.equal(res.statusCode, 404);

  const motorista = randomUUID();
  const hm = autorizacao(app, motorista, [
    { usuarioId: motorista, organizacaoId: randomUUID(), papel: 'MOTORISTA' },
  ]);
  assert.equal(
    (await app.inject({ method: 'GET', url: '/v1/responsavel/filhos', headers: hm })).statusCode,
    403,
  );
  await app.close();
});

test('confirmar chegada: depois da entrega grava na viagem do filho, com o responsável do token', async () => {
  const entregue = linha({ statusAluno: 'ENTREGUE', viagemStatus: 'FINALIZADA' });
  const { app, h, responsavel, confirmacoes } = await cenario([entregue]);
  const confirmar = () =>
    app.inject({
      method: 'POST',
      url: `/v1/responsavel/filhos/${entregue.id}/chegada`,
      headers: h,
    });

  const res = await confirmar();
  assert.equal(res.statusCode, 200, res.body);
  assert.equal(res.json<{ chegadaConfirmada: boolean }>().chegadaConfirmada, true);
  assert.deepEqual(confirmacoes, [
    { viagemId: entregue.viagemId, alunoId: entregue.id, responsavelId: responsavel },
  ]);

  // Confirmar de novo (ex.: toque duplo, reenvio sem rede) não é erro.
  assert.equal((await confirmar()).statusCode, 200);
  await app.close();
});

test('confirmar chegada: antes da entrega, aluno ausente ou sem viagem → 422 e nada é gravado', async () => {
  const situacoes = [
    linha({ statusAluno: 'AGUARDANDO' }),
    linha({ statusAluno: 'EMBARCADO' }),
    linha({ statusAluno: 'AUSENTE' }),
    linha({ statusAluno: 'AGUARDANDO', viagemId: null, viagemStatus: null }),
  ];
  const { app, h, confirmacoes } = await cenario(situacoes);
  for (const filho of situacoes) {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/responsavel/filhos/${filho.id}/chegada`,
      headers: h,
    });
    assert.equal(res.statusCode, 422, filho.statusAluno);
  }
  assert.equal(confirmacoes.length, 0);
  await app.close();
});

test('confirmar chegada: filho de outra família → 404; motorista → 403', async () => {
  const { app, h, confirmacoes } = await cenario([linha({ statusAluno: 'ENTREGUE' })]);
  const alheio = await app.inject({
    method: 'POST',
    url: `/v1/responsavel/filhos/${randomUUID()}/chegada`,
    headers: h,
  });
  assert.equal(alheio.statusCode, 404);

  const motorista = randomUUID();
  const hm = autorizacao(app, motorista, [
    { usuarioId: motorista, organizacaoId: randomUUID(), papel: 'MOTORISTA' },
  ]);
  const doMotorista = await app.inject({
    method: 'POST',
    url: `/v1/responsavel/filhos/${randomUUID()}/chegada`,
    headers: hm,
  });
  assert.equal(doMotorista.statusCode, 403);
  assert.equal(confirmacoes.length, 0);
  await app.close();
});

// ── Filho cadastrado pela própria família ────────────────────────────────────

// Cenário: duas famílias na mesma escola, mais um motorista e um admin dessa escola.
async function cenarioCadastro() {
  const org = randomUUID();
  const ids = {
    familia: randomUUID(),
    outraFamilia: randomUUID(),
    motorista: randomUUID(),
    admin: randomUUID(),
  };
  const membros: Membro[] = [
    { usuarioId: ids.familia, organizacaoId: org, papel: 'RESPONSAVEL' },
    { usuarioId: ids.outraFamilia, organizacaoId: org, papel: 'RESPONSAVEL' },
    { usuarioId: ids.motorista, organizacaoId: org, papel: 'MOTORISTA' },
    { usuarioId: ids.admin, organizacaoId: org, papel: 'ADMIN' },
  ];
  const fake = criarFakeResponsavelRepository();
  const app = await buildApp(depsDeTeste({ responsavelRepository: fake.repo }));
  const auth = (sub: string) => autorizacao(app, sub, membros);
  const enviar = (sub: string, method: 'POST' | 'PUT' | 'DELETE', url: string, payload?: object) =>
    app.inject({ method, url: `/v1/responsavel${url}`, headers: auth(sub), payload });
  const cadastrar = async (sub: string, nome = 'Ana Souza') => {
    const res = await enviar(sub, 'POST', '/filhos', { nome, consentimento: true });
    assert.equal(res.statusCode, 201, res.body);
    return res.json<{ id: string; nome: string }>();
  };
  return { app, org, ids, fake, auth, enviar, cadastrar };
}

test('cadastro de filho: sem token → 401; motorista e admin → 403', async () => {
  const { app, ids, enviar } = await cenarioCadastro();
  const corpo = { nome: 'Ana', consentimento: true };
  const semToken = await app.inject({
    method: 'POST',
    url: '/v1/responsavel/filhos',
    payload: corpo,
  });
  assert.equal(semToken.statusCode, 401);
  // Corpos VÁLIDOS: o Fastify valida o corpo antes do hook de papel (preHandler).
  for (const sub of [ids.motorista, ids.admin]) {
    assert.equal((await enviar(sub, 'POST', '/filhos', corpo)).statusCode, 403);
    assert.equal(
      (await enviar(sub, 'PUT', `/filhos/${randomUUID()}`, { nome: 'Ana' })).statusCode,
      403,
    );
    assert.equal((await enviar(sub, 'DELETE', `/filhos/${randomUUID()}`)).statusCode, 403);
  }
  await app.close();
});

test('cadastro de filho: cria sem escola, com vínculo autorizado, consentimento e auditoria', async () => {
  const { app, ids, fake, auth, cadastrar } = await cenarioCadastro();
  const filho = await cadastrar(ids.familia, '  Ana Souza  ');
  assert.equal(filho.nome, 'Ana Souza');

  const lista = await app.inject({
    method: 'GET',
    url: '/v1/responsavel/filhos',
    headers: auth(ids.familia),
  });
  assert.deepEqual(
    lista.json<{ id: string }[]>().map((f) => f.id),
    [filho.id],
  );
  // A outra família não vê, nem por id.
  const alheio = await app.inject({
    method: 'GET',
    url: `/v1/responsavel/filhos/${filho.id}`,
    headers: auth(ids.outraFamilia),
  });
  assert.equal(alheio.statusCode, 404);

  assert.equal(fake.alunos[0]?.organizacaoId, null);
  assert.equal(fake.alunos[0]?.criadoPor, ids.familia);
  const vinculo = fake.vinculos[0];
  assert.equal(vinculo?.responsavelId, ids.familia);
  assert.equal(vinculo?.autorizado, true);
  assert.ok(vinculo?.consentimentoEm instanceof Date);
  assert.equal(vinculo?.termoVersao, TERMO_CADASTRO_ALUNO_VERSAO);
  assert.deepEqual(fake.auditoria, [
    { usuarioId: ids.familia, acao: 'ALUNO_CRIADO', entidadeId: filho.id },
  ]);
  await app.close();
});

test('cadastro de filho: sem consentimento, campo extra ou nome inválido → 400 e nada é gravado', async () => {
  const { app, ids, fake, enviar } = await cenarioCadastro();
  const invalidos = [
    { nome: 'Ana' },
    { nome: 'Ana', consentimento: false },
    { nome: 'Ana', consentimento: 'sim' },
    // Mass assignment: escola, responsável e autorização nunca vêm do corpo.
    { nome: 'Ana', consentimento: true, organizacaoId: randomUUID() },
    { nome: 'Ana', consentimento: true, responsavelId: ids.outraFamilia },
    { nome: 'Ana', consentimento: true, autorizado: true },
    // Minimização: dado que o transporte não precisa é recusado.
    { nome: 'Ana', consentimento: true, cpf: '12345678900' },
    { nome: 'A', consentimento: true },
    { nome: '   ', consentimento: true },
    { nome: 'A'.repeat(121), consentimento: true },
  ];
  for (const corpo of invalidos) {
    const res = await enviar(ids.familia, 'POST', '/filhos', corpo);
    assert.equal(res.statusCode, 400, JSON.stringify(corpo));
  }
  assert.equal(fake.alunos.length, 0);
  assert.equal(fake.auditoria.length, 0);
  await app.close();
});

test(`cadastro de filho: o ${MAX_FILHOS_POR_RESPONSAVEL + 1}º filho → 422 (limite por responsável)`, async () => {
  const { app, ids, enviar, cadastrar } = await cenarioCadastro();
  for (let i = 0; i < MAX_FILHOS_POR_RESPONSAVEL; i++) await cadastrar(ids.familia, `Filho ${i}`);
  const excedente = await enviar(ids.familia, 'POST', '/filhos', {
    nome: 'Mais um',
    consentimento: true,
  });
  assert.equal(excedente.statusCode, 422);
  // O limite é por responsável: a outra família continua podendo cadastrar.
  await cadastrar(ids.outraFamilia);
  await app.close();
});

test('editar filho: só o da própria família; aluno da escola ou de outra família → 404', async () => {
  const { app, org, ids, fake, enviar, cadastrar } = await cenarioCadastro();
  const meu = await cadastrar(ids.familia);
  const deOutro = await cadastrar(ids.outraFamilia, 'Bia');
  // Aluno da escola, vinculado e autorizado para esta família: continua sendo da escola.
  const daEscola = fake.adicionarAlunoDaEscola(org, ids.familia);

  const ok = await enviar(ids.familia, 'PUT', `/filhos/${meu.id}`, { nome: ' Ana Lima ' });
  assert.equal(ok.statusCode, 200, ok.body);
  assert.equal(ok.json<{ nome: string }>().nome, 'Ana Lima');

  for (const id of [deOutro.id, daEscola.id, randomUUID()]) {
    assert.equal(
      (await enviar(ids.familia, 'PUT', `/filhos/${id}`, { nome: 'Invasor' })).statusCode,
      404,
    );
  }
  assert.equal(fake.alunos.find((a) => a.id === deOutro.id)?.nome, 'Bia');
  assert.equal(daEscola.nome, 'Aluno da Escola');

  const extra = await enviar(ids.familia, 'PUT', `/filhos/${meu.id}`, {
    nome: 'Ana',
    ativo: false,
  });
  assert.equal(extra.statusCode, 400);
  assert.equal(
    (await enviar(ids.familia, 'PUT', '/filhos/nao-e-uuid', { nome: 'Ana' })).statusCode,
    400,
  );
  assert.equal(fake.auditoria.filter((r) => r.acao === 'ALUNO_EDITADO').length, 1);
  await app.close();
});

test('excluir filho: sem histórico apaga; com histórico anonimiza; de outro → 404', async () => {
  const { app, org, ids, fake, auth, enviar, cadastrar } = await cenarioCadastro();
  const semHistorico = await cadastrar(ids.familia, 'Ana');
  const comHistorico = await cadastrar(ids.familia, 'Bruno');
  const deOutro = await cadastrar(ids.outraFamilia, 'Bia');
  const daEscola = fake.adicionarAlunoDaEscola(org, ids.familia);
  const alunoBruno = fake.alunos.find((a) => a.id === comHistorico.id);
  if (alunoBruno) alunoBruno.temHistorico = true;

  for (const id of [deOutro.id, daEscola.id]) {
    assert.equal((await enviar(ids.familia, 'DELETE', `/filhos/${id}`)).statusCode, 404);
  }

  assert.equal((await enviar(ids.familia, 'DELETE', `/filhos/${semHistorico.id}`)).statusCode, 204);
  assert.ok(!fake.alunos.some((a) => a.id === semHistorico.id));

  assert.equal((await enviar(ids.familia, 'DELETE', `/filhos/${comHistorico.id}`)).statusCode, 204);
  assert.deepEqual(
    { nome: alunoBruno?.nome, ativo: alunoBruno?.ativo, criadoPor: alunoBruno?.criadoPor },
    { nome: NOME_ANONIMIZADO, ativo: false, criadoPor: null },
  );
  assert.ok(!fake.vinculos.some((v) => v.alunoId === comHistorico.id));

  // Já excluído: 404, e some da lista da família.
  assert.equal((await enviar(ids.familia, 'DELETE', `/filhos/${comHistorico.id}`)).statusCode, 404);
  const lista = await app.inject({
    method: 'GET',
    url: '/v1/responsavel/filhos',
    headers: auth(ids.familia),
  });
  assert.deepEqual(
    lista.json<{ id: string }[]>().map((f) => f.id),
    [daEscola.id],
  );
  assert.deepEqual(
    fake.auditoria.filter((r) => r.acao !== 'ALUNO_CRIADO').map((r) => r.acao),
    ['ALUNO_EXCLUIDO', 'ALUNO_ANONIMIZADO'],
  );
  await app.close();
});

test('conversão da linha crua: driver devolve data, números e booleanos como texto', () => {
  const r = converter({
    ...linha(),
    latitude: '-23.5615',
    longitude: '-46.656',
    velocidade: null,
    posicaoAtualizadaEm: '2026-10-09 18:21:56.925+00',
    chegadaConfirmada: 't',
  });
  assert.equal(r.chegadaConfirmada, true);
  assert.equal(r.latitude, -23.5615);
  assert.ok(r.posicaoAtualizadaEm instanceof Date);
  assert.equal(r.posicaoAtualizadaEm.toISOString(), '2026-10-09T18:21:56.925Z');
});
