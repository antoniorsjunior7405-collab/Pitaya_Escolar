import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { buildApp } from '../../app.js';
import type { Membro } from '../../shared/acesso/acesso.js';
import { autorizacao, depsDeTeste } from '../../test-utils/deps.js';
import { criarFakeVinculosRepository } from '../../test-utils/fake-vinculos-repository.js';
import { padraoContem } from './vinculos.repository.js';
import { MAX_PEDIDOS_PENDENTES, primeiroNome } from './vinculos.service.js';

const BASE_R = '/v1/responsavel';
const BASE_M = '/v1/motorista';

/** Um responsável com um filho e um motorista aprovado, cada um com o próprio token. */
async function cenario() {
  const fake = criarFakeVinculosRepository();
  const app = await buildApp(depsDeTeste({ vinculosRepository: fake.repo }));
  const responsavelId = randomUUID();
  const motorista = fake.adicionarMotorista();
  const aluno = fake.adicionarAluno(responsavelId);
  const membros: Membro[] = [
    { usuarioId: responsavelId, organizacaoId: randomUUID(), papel: 'RESPONSAVEL' },
    { usuarioId: motorista.id, organizacaoId: randomUUID(), papel: 'MOTORISTA' },
  ];
  const comoResponsavel = (id = responsavelId) =>
    autorizacao(app, id, [
      ...membros,
      { usuarioId: id, organizacaoId: randomUUID(), papel: 'RESPONSAVEL' },
    ]);
  const comoMotorista = (id = motorista.id) =>
    autorizacao(app, id, [
      ...membros,
      { usuarioId: id, organizacaoId: randomUUID(), papel: 'MOTORISTA' },
    ]);
  const pedir = (corpo: object, headers = comoResponsavel()) =>
    app.inject({ method: 'POST', url: `${BASE_R}/solicitacoes`, headers, payload: corpo });
  return { app, fake, responsavelId, motorista, aluno, comoResponsavel, comoMotorista, pedir };
}

test('busca: sem login responde 401; motorista na busca do responsável responde 403', async () => {
  const { app, comoMotorista } = await cenario();

  const semLogin = await app.inject({ method: 'GET', url: `${BASE_R}/motoristas?termo=Car` });
  const outroPapel = await app.inject({
    method: 'GET',
    url: `${BASE_R}/motoristas?termo=Car`,
    headers: comoMotorista(),
  });

  assert.equal(semLogin.statusCode, 401);
  assert.equal(outroPapel.statusCode, 403);
});

test('busca: sem filtro, com termo curto ou com limite acima do teto responde 400', async () => {
  const { app, comoResponsavel } = await cenario();
  const h = comoResponsavel();

  for (const query of [
    '',
    '?termo=Ca',
    '?regiao=ZS',
    '?termo=Carlos&limit=100',
    '?termo=Car&x=1',
  ]) {
    const res = await app.inject({
      method: 'GET',
      url: `${BASE_R}/motoristas${query}`,
      headers: h,
    });
    assert.equal(res.statusCode, 400, `query "${query}" deveria ser recusada`);
  }
});

test('busca: devolve só motoristas aprovados e só dados públicos (sem telefone, e-mail ou placa)', async () => {
  const { app, fake, motorista, comoResponsavel } = await cenario();
  fake.adicionarMotorista({ nome: 'Carla Não Aprovada', aprovado: false });
  fake.adicionarMotorista({ nome: 'Carlos Desativado', ativo: false });

  const res = await app.inject({
    method: 'GET',
    url: `${BASE_R}/motoristas?termo=car`,
    headers: comoResponsavel(),
  });

  assert.equal(res.statusCode, 200);
  const corpo = res.json<{ itens: Record<string, unknown>[]; proximoCursor: string | null }>();
  assert.deepEqual(
    corpo.itens.map((m) => m.id),
    [motorista.id],
  );
  assert.deepEqual(Object.keys(corpo.itens[0] ?? {}).sort(), [
    'apresentacao',
    'id',
    'nome',
    'regiaoAtendimento',
    'veiculoModelo',
  ]);
  assert.equal(corpo.proximoCursor, null);
});

test('busca: página cheia traz cursor, e o cursor continua de onde parou', async () => {
  const { app, fake, comoResponsavel } = await cenario();
  for (const nome of ['Bruno Alves', 'Bianca Reis', 'Beto Lima']) {
    fake.adicionarMotorista({ nome, regiaoAtendimento: 'Centro' });
  }
  const h = comoResponsavel();

  const p1 = await app.inject({
    method: 'GET',
    url: `${BASE_R}/motoristas?regiao=Centro&limit=2`,
    headers: h,
  });
  const c1 = p1.json<{ itens: { nome: string }[]; proximoCursor: string }>();
  const p2 = await app.inject({
    method: 'GET',
    url: `${BASE_R}/motoristas?regiao=Centro&limit=2&cursor=${c1.proximoCursor}`,
    headers: h,
  });
  const c2 = p2.json<{ itens: { nome: string }[]; proximoCursor: string | null }>();

  assert.deepEqual(
    c1.itens.map((m) => m.nome),
    ['Beto Lima', 'Bianca Reis'],
  );
  assert.deepEqual(
    c2.itens.map((m) => m.nome),
    ['Bruno Alves'],
  );
  assert.equal(c2.proximoCursor, null);
});

test('pedido: cria com 201, repetir devolve o mesmo pedido com 200 e audita uma vez só', async () => {
  const { fake, motorista, aluno, pedir } = await cenario();
  const corpo = { motoristaId: motorista.id, alunoId: aluno.id };

  const primeiro = await pedir(corpo);
  const repetido = await pedir(corpo);

  assert.equal(primeiro.statusCode, 201);
  assert.equal(repetido.statusCode, 200);
  assert.equal(repetido.json<{ id: string }>().id, primeiro.json<{ id: string }>().id);
  const pedido = primeiro.json<{ estado: string; motorista: { telefone: string | null } }>();
  assert.equal(pedido.estado, 'PENDENTE');
  assert.equal(pedido.motorista.telefone, null, 'telefone só depois do aceite');
  assert.deepEqual(
    fake.auditoria.map((a) => a.acao),
    ['SOLICITACAO_CRIADA'],
  );
});

test('pedido: aluno de outra família ou motorista não aprovado respondem 404; campo extra 400', async () => {
  const { fake, motorista, aluno, pedir } = await cenario();
  const alunoDeOutro = fake.adicionarAluno(randomUUID());
  const naoAprovado = fake.adicionarMotorista({ aprovado: false });

  const outraFamilia = await pedir({ motoristaId: motorista.id, alunoId: alunoDeOutro.id });
  const semAprovacao = await pedir({ motoristaId: naoAprovado.id, alunoId: aluno.id });
  const campoExtra = await pedir({
    motoristaId: motorista.id,
    alunoId: aluno.id,
    estado: 'ACEITA',
  });

  assert.equal(outraFamilia.statusCode, 404);
  assert.equal(semAprovacao.statusCode, 404);
  assert.equal(campoExtra.statusCode, 400);
  assert.equal(fake.auditoria.length, 0);
});

test('pedido: passar do limite de pendentes responde 422', async () => {
  const { fake, aluno, pedir } = await cenario();
  for (let i = 0; i < MAX_PEDIDOS_PENDENTES; i++) {
    const m = fake.adicionarMotorista();
    assert.equal((await pedir({ motoristaId: m.id, alunoId: aluno.id })).statusCode, 201);
  }

  const excedente = await pedir({ motoristaId: fake.adicionarMotorista().id, alunoId: aluno.id });

  assert.equal(excedente.statusCode, 422);
});

test('meus pedidos: página cheia traz cursor, que continua sem repetir; cursor alheio dá página vazia', async () => {
  const { app, fake, aluno, pedir, comoResponsavel } = await cenario();
  const ids = new Set<string>();
  for (let i = 0; i < 3; i++) {
    const res = await pedir({ motoristaId: fake.adicionarMotorista().id, alunoId: aluno.id });
    ids.add(res.json<{ id: string }>().id);
  }
  type Pagina = { itens: { id: string }[]; proximoCursor: string | null };
  const listar = async (query: string, headers = comoResponsavel()) =>
    (
      await app.inject({ method: 'GET', url: `${BASE_R}/solicitacoes${query}`, headers })
    ).json<Pagina>();

  const p1 = await listar('?limit=2');
  const p2 = await listar(`?limit=2&cursor=${p1.proximoCursor}`);
  const alheio = await listar(`?cursor=${p1.proximoCursor}`, comoResponsavel(randomUUID()));

  assert.equal(p1.itens.length, 2);
  assert.equal(p2.itens.length, 1);
  assert.equal(p2.proximoCursor, null);
  assert.deepEqual(new Set([...p1.itens, ...p2.itens].map((p) => p.id)), ids);
  assert.deepEqual(alheio, { itens: [], proximoCursor: null });
});

test('tela de espera: status do pedido só para quem pediu; outra família recebe 404', async () => {
  const { app, motorista, aluno, pedir, comoResponsavel } = await cenario();
  const { id } = (await pedir({ motoristaId: motorista.id, alunoId: aluno.id })).json<{
    id: string;
  }>();

  const dono = await app.inject({
    method: 'GET',
    url: `${BASE_R}/solicitacoes/${id}`,
    headers: comoResponsavel(),
  });
  const outro = await app.inject({
    method: 'GET',
    url: `${BASE_R}/solicitacoes/${id}`,
    headers: comoResponsavel(randomUUID()),
  });

  assert.equal(dono.statusCode, 200);
  assert.equal(dono.json<{ estado: string }>().estado, 'PENDENTE');
  assert.equal(outro.statusCode, 404);
});

test('aceite: motorista vê só primeiros nomes; aceitar libera o telefone e cria o vínculo', async () => {
  const { app, fake, motorista, aluno, pedir, comoMotorista, comoResponsavel } = await cenario();
  const { id } = (await pedir({ motoristaId: motorista.id, alunoId: aluno.id })).json<{
    id: string;
  }>();

  const recebidos = await app.inject({
    method: 'GET',
    url: `${BASE_M}/solicitacoes`,
    headers: comoMotorista(),
  });
  const aceite = await app.inject({
    method: 'POST',
    url: `${BASE_M}/solicitacoes/${id}/aceitar`,
    headers: comoMotorista(),
  });
  const status = await app.inject({
    method: 'GET',
    url: `${BASE_R}/solicitacoes/${id}`,
    headers: comoResponsavel(),
  });

  const [recebido] = recebidos.json<{ itens: { criadoEm: string; expiraEm: string }[] }>().itens;
  assert.deepEqual(recebidos.json(), {
    itens: [
      {
        id,
        estado: 'PENDENTE',
        criadoEm: recebido?.criadoEm,
        expiraEm: recebido?.expiraEm,
        alunoPrimeiroNome: 'Ana',
        responsavelPrimeiroNome: 'Maria',
      },
    ],
    proximoCursor: null,
  });
  assert.equal(aceite.statusCode, 200);
  assert.equal(aceite.json<{ estado: string }>().estado, 'ACEITA');
  const s = status.json<{ estado: string; motorista: { telefone: string | null } }>();
  assert.equal(s.estado, 'ACEITA');
  assert.equal(s.motorista.telefone, motorista.telefone);
  assert.deepEqual(fake.vinculos, [{ alunoId: aluno.id, motoristaId: motorista.id }]);
});

test('aceite: pedido de outro motorista responde 404; responsável na área do motorista 403', async () => {
  const { app, fake, motorista, aluno, pedir, comoMotorista, comoResponsavel } = await cenario();
  const { id } = (await pedir({ motoristaId: motorista.id, alunoId: aluno.id })).json<{
    id: string;
  }>();
  // Outro motorista aprovado: o pedido existe, mas não é dele.
  const outro = fake.adicionarMotorista({ nome: 'Pedro Alves' });

  const outroMotorista = await app.inject({
    method: 'POST',
    url: `${BASE_M}/solicitacoes/${id}/aceitar`,
    headers: comoMotorista(outro.id),
  });
  const responsavel = await app.inject({
    method: 'POST',
    url: `${BASE_M}/solicitacoes/${id}/aceitar`,
    headers: comoResponsavel(),
  });

  assert.equal(outroMotorista.statusCode, 404);
  assert.equal(responsavel.statusCode, 403);
});

test('cancelar: pendente vira CANCELADA; cancelar de novo ou aceitar depois responde 409', async () => {
  const { app, fake, motorista, aluno, pedir, comoMotorista, comoResponsavel } = await cenario();
  const { id } = (await pedir({ motoristaId: motorista.id, alunoId: aluno.id })).json<{
    id: string;
  }>();
  const cancelar = () =>
    app.inject({
      method: 'POST',
      url: `${BASE_R}/solicitacoes/${id}/cancelar`,
      headers: comoResponsavel(),
    });

  const primeiro = await cancelar();
  const segundo = await cancelar();
  const aceiteTardio = await app.inject({
    method: 'POST',
    url: `${BASE_M}/solicitacoes/${id}/aceitar`,
    headers: comoMotorista(),
  });

  assert.equal(primeiro.statusCode, 200);
  assert.equal(primeiro.json<{ estado: string }>().estado, 'CANCELADA');
  assert.equal(segundo.statusCode, 409);
  assert.equal(aceiteTardio.statusCode, 409);
  assert.equal(fake.vinculos.length, 0);
  assert.deepEqual(
    fake.auditoria.map((a) => a.acao),
    ['SOLICITACAO_CRIADA', 'SOLICITACAO_CANCELADA'],
  );
});

test('recusa: o mesmo responsável não pode pedir de novo ao mesmo motorista logo depois (422)', async () => {
  const { app, motorista, aluno, pedir, comoMotorista } = await cenario();
  const { id } = (await pedir({ motoristaId: motorista.id, alunoId: aluno.id })).json<{
    id: string;
  }>();

  const recusa = await app.inject({
    method: 'POST',
    url: `${BASE_M}/solicitacoes/${id}/recusar`,
    headers: comoMotorista(),
  });
  const insistencia = await pedir({ motoristaId: motorista.id, alunoId: aluno.id });

  assert.equal(recusa.json<{ estado: string }>().estado, 'RECUSADA');
  assert.equal(insistencia.statusCode, 422);
});

test('prazo: pedido vencido aparece como EXPIRADA, sai da fila do motorista e não pode ser aceito', async () => {
  const { app, fake, motorista, aluno, pedir, comoMotorista, comoResponsavel } = await cenario();
  const { id } = (await pedir({ motoristaId: motorista.id, alunoId: aluno.id })).json<{
    id: string;
  }>();
  fake.vencer(id);

  const status = await app.inject({
    method: 'GET',
    url: `${BASE_R}/solicitacoes/${id}`,
    headers: comoResponsavel(),
  });
  const fila = await app.inject({
    method: 'GET',
    url: `${BASE_M}/solicitacoes`,
    headers: comoMotorista(),
  });
  const aceite = await app.inject({
    method: 'POST',
    url: `${BASE_M}/solicitacoes/${id}/aceitar`,
    headers: comoMotorista(),
  });

  assert.equal(status.json<{ estado: string }>().estado, 'EXPIRADA');
  assert.deepEqual(fila.json(), { itens: [], proximoCursor: null });
  assert.equal(aceite.statusCode, 409);
});

test('aprovação revogada: pedido some da fila e aceitar ou recusar responde 403 sem criar vínculo', async () => {
  const { app, fake, motorista, aluno, pedir, comoMotorista } = await cenario();
  const { id } = (await pedir({ motoristaId: motorista.id, alunoId: aluno.id })).json<{
    id: string;
  }>();
  fake.revogarAprovacao(motorista.id);

  const fila = await app.inject({
    method: 'GET',
    url: `${BASE_M}/solicitacoes`,
    headers: comoMotorista(),
  });
  const aceite = await app.inject({
    method: 'POST',
    url: `${BASE_M}/solicitacoes/${id}/aceitar`,
    headers: comoMotorista(),
  });
  const recusa = await app.inject({
    method: 'POST',
    url: `${BASE_M}/solicitacoes/${id}/recusar`,
    headers: comoMotorista(),
  });

  assert.deepEqual(fila.json(), { itens: [], proximoCursor: null });
  assert.equal(aceite.statusCode, 403);
  assert.equal(recusa.statusCode, 403);
  assert.deepEqual(fake.vinculos, []);
});

test('aluno excluído pela família: pedido some da fila e o aceite responde 409 sem criar vínculo', async () => {
  const { app, fake, motorista, aluno, pedir, comoMotorista } = await cenario();
  const { id } = (await pedir({ motoristaId: motorista.id, alunoId: aluno.id })).json<{
    id: string;
  }>();
  fake.desativarAluno(aluno.id);

  const fila = await app.inject({
    method: 'GET',
    url: `${BASE_M}/solicitacoes`,
    headers: comoMotorista(),
  });
  const aceite = await app.inject({
    method: 'POST',
    url: `${BASE_M}/solicitacoes/${id}/aceitar`,
    headers: comoMotorista(),
  });

  assert.deepEqual(fila.json(), { itens: [], proximoCursor: null });
  assert.equal(aceite.statusCode, 409);
  assert.deepEqual(fake.vinculos, []);
});

test('padraoContem escapa os curingas do LIKE; primeiroNome corta no primeiro espaço', () => {
  assert.equal(padraoContem('100%_a\\b'), '%100\\%\\_a\\\\b%');
  assert.equal(primeiroNome('  Ana   Maria Lima '), 'Ana');
});
