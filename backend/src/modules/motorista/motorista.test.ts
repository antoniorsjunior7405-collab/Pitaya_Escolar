import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { buildApp } from '../../app.js';
import { autorizacao, depsDeTeste } from '../../test-utils/deps.js';
import type { Membro } from '../../shared/acesso/acesso.js';
import { criarFakeMotoristaRepository } from '../../test-utils/fake-motorista-repository.js';
import { garantirOrdemDoEvento, podeFinalizar } from './regras-viagem.js';

// Cenário: organização com um motorista dono da rota, outro motorista e um responsável.
async function cenario() {
  const org = randomUUID();
  const motorista = randomUUID();
  const outroMotorista = randomUUID();
  const responsavel = randomUUID();
  const fake = criarFakeMotoristaRepository();
  const rota = fake.adicionarRota({ organizacaoId: org, motoristaId: motorista });

  const membros: Membro[] = [
    { usuarioId: motorista, organizacaoId: org, papel: 'MOTORISTA' },
    { usuarioId: outroMotorista, organizacaoId: org, papel: 'MOTORISTA' },
    { usuarioId: responsavel, organizacaoId: org, papel: 'RESPONSAVEL' },
  ];
  const app = await buildApp(depsDeTeste({ motoristaRepository: fake.repo }));
  const auth = (sub: string) => autorizacao(app, sub, membros);
  const [a1, a2] = rota.alunos;
  if (!a1 || !a2) throw new Error('cenário sem alunos');
  return { app, fake, rota, a1, a2, auth, motorista, outroMotorista, responsavel };
}

test('regras: entregar exige embarque; finalizar só de EM_ANDAMENTO (e é idempotente)', () => {
  assert.throws(() => garantirOrdemDoEvento('ENTREGUE', false), /embarcar antes/);
  assert.doesNotThrow(() => garantirOrdemDoEvento('ENTREGUE', true));
  assert.equal(podeFinalizar('EM_ANDAMENTO'), 'finalizar');
  assert.equal(podeFinalizar('FINALIZADA'), 'ja-finalizada');
  assert.throws(() => podeFinalizar('PLANEJADA'), /em andamento/);
});

test('sem token → 401; outro papel → 403; outro motorista não vê a rota → 404', async () => {
  const { app, rota, auth, responsavel, outroMotorista } = await cenario();
  const sem = await app.inject({ method: 'GET', url: '/v1/motorista/rotas' });
  assert.equal(sem.statusCode, 401);

  const resp = await app.inject({
    method: 'GET',
    url: '/v1/motorista/rotas',
    headers: auth(responsavel),
  });
  assert.equal(resp.statusCode, 403);

  const alheia = await app.inject({
    method: 'GET',
    url: `/v1/motorista/rotas/${rota.id}`,
    headers: auth(outroMotorista),
  });
  assert.equal(alheia.statusCode, 404);
  await app.close();
});

test('fluxo completo: iniciar, embarcar, entregar, finalizar', async () => {
  const { app, rota, a1, auth, motorista } = await cenario();
  const h = auth(motorista);

  const inicio = await app.inject({
    method: 'POST',
    url: `/v1/motorista/rotas/${rota.id}/viagens`,
    headers: h,
  });
  assert.equal(inicio.statusCode, 201);
  const viagemId: string = inicio.json().id;

  // Iniciar de novo devolve a mesma viagem (idempotente), não cria outra.
  const deNovo = await app.inject({
    method: 'POST',
    url: `/v1/motorista/rotas/${rota.id}/viagens`,
    headers: h,
  });
  assert.equal(deNovo.statusCode, 200);
  assert.equal(deNovo.json().id, viagemId);

  const evento = (tipo: string, alunoId = a1.id) =>
    app.inject({
      method: 'POST',
      url: `/v1/motorista/viagens/${viagemId}/eventos`,
      headers: h,
      payload: { alunoId, tipo },
    });

  assert.equal((await evento('ENTREGUE')).statusCode, 422); // não embarcou ainda
  assert.equal((await evento('EMBARCADO')).statusCode, 201);
  assert.equal((await evento('EMBARCADO')).statusCode, 200); // reenvio não duplica
  assert.equal((await evento('ENTREGUE')).statusCode, 201);

  const detalhe = await app.inject({
    method: 'GET',
    url: `/v1/motorista/rotas/${rota.id}`,
    headers: h,
  });
  const { alunos } = detalhe.json<{ alunos: { id: string; status: string }[] }>();
  assert.equal(alunos.find((x) => x.id === a1.id)?.status, 'ENTREGUE');

  const fim = await app.inject({
    method: 'POST',
    url: `/v1/motorista/viagens/${viagemId}/finalizar`,
    headers: h,
  });
  assert.equal(fim.statusCode, 200);
  assert.equal(fim.json().status, 'FINALIZADA');

  // Depois de finalizada: sem eventos novos (RN-08, sem volta).
  assert.equal((await evento('EMBARCADO', rota.alunos[1]?.id)).statusCode, 422);
  await app.close();
});

test('evento de aluno de fora da rota → 404', async () => {
  const { app, rota, auth, motorista } = await cenario();
  const h = auth(motorista);
  const inicio = await app.inject({
    method: 'POST',
    url: `/v1/motorista/rotas/${rota.id}/viagens`,
    headers: h,
  });
  const res = await app.inject({
    method: 'POST',
    url: `/v1/motorista/viagens/${inicio.json().id}/eventos`,
    headers: h,
    payload: { alunoId: randomUUID(), tipo: 'EMBARCADO' },
  });
  assert.equal(res.statusCode, 404);
  await app.close();
});

test('posição: aceita durante a viagem, valida coordenadas e recusa após finalizar', async () => {
  const { app, fake, rota, auth, motorista } = await cenario();
  const h = auth(motorista);
  const inicio = await app.inject({
    method: 'POST',
    url: `/v1/motorista/rotas/${rota.id}/viagens`,
    headers: h,
  });
  const viagemId: string = inicio.json().id;
  const enviar = (payload: object) =>
    app.inject({
      method: 'PUT',
      url: `/v1/motorista/viagens/${viagemId}/posicao`,
      headers: h,
      payload,
    });

  assert.equal(
    (await enviar({ latitude: -23.55, longitude: -46.63, velocidade: 8 })).statusCode,
    204,
  );
  assert.deepEqual(fake.posicoes.get(viagemId)?.latitude, -23.55);
  assert.equal((await enviar({ latitude: 123, longitude: 0 })).statusCode, 400);

  await app.inject({
    method: 'POST',
    url: `/v1/motorista/viagens/${viagemId}/finalizar`,
    headers: h,
  });
  // LGPD: a última posição é apagada quando a viagem termina.
  assert.equal(fake.posicoes.has(viagemId), false);
  assert.equal((await enviar({ latitude: -23.55, longitude: -46.63 })).statusCode, 422);
  await app.close();
});

// ── Perfil e veículos do próprio motorista ───────────────────────────────────

// Cenário: dois motoristas na mesma organização e um motorista de outra organização.
async function cenarioCadastro() {
  const org = randomUUID();
  const outraOrg = randomUUID();
  const motorista = randomUUID();
  const outroMotorista = randomUUID();
  const motoristaDeFora = randomUUID();
  const responsavel = randomUUID();
  const fake = criarFakeMotoristaRepository();
  for (const id of [motorista, outroMotorista, motoristaDeFora]) fake.adicionarUsuario(id);

  const membros: Membro[] = [
    { usuarioId: motorista, organizacaoId: org, papel: 'MOTORISTA' },
    { usuarioId: outroMotorista, organizacaoId: org, papel: 'MOTORISTA' },
    { usuarioId: motoristaDeFora, organizacaoId: outraOrg, papel: 'MOTORISTA' },
    { usuarioId: responsavel, organizacaoId: org, papel: 'RESPONSAVEL' },
  ];
  const app = await buildApp(depsDeTeste({ motoristaRepository: fake.repo }));
  const auth = (sub: string) => autorizacao(app, sub, membros);
  return { app, fake, auth, motorista, outroMotorista, motoristaDeFora, responsavel };
}

const perfilValido = {
  nome: 'João Transporte',
  telefone: '(19) 99999-0000',
  apresentacao: 'Van com ar-condicionado, 10 anos de experiência.',
  regiaoAtendimento: 'Centro e Jardim Planalto',
};

test('perfil e veículos: sem token → 401; papel RESPONSAVEL → 403', async () => {
  const { app, auth, responsavel } = await cenarioCadastro();
  for (const url of ['/v1/motorista/perfil', '/v1/motorista/veiculos']) {
    assert.equal((await app.inject({ method: 'GET', url })).statusCode, 401);
    const res = await app.inject({ method: 'GET', url, headers: auth(responsavel) });
    assert.equal(res.statusCode, 403);
  }
  await app.close();
});

test('perfil: motorista novo vê o perfil vazio, atualiza e passa a ver os dados salvos', async () => {
  const { app, auth, motorista } = await cenarioCadastro();
  const h = auth(motorista);

  const vazio = await app.inject({ method: 'GET', url: '/v1/motorista/perfil', headers: h });
  assert.equal(vazio.statusCode, 200);
  assert.equal(vazio.json().apresentacao, null);
  assert.deepEqual(vazio.json().veiculos, []);

  const salvo = await app.inject({
    method: 'PUT',
    url: '/v1/motorista/perfil',
    headers: h,
    payload: perfilValido,
  });
  assert.equal(salvo.statusCode, 200);
  assert.equal(salvo.json().nome, 'João Transporte');
  assert.equal(salvo.json().regiaoAtendimento, 'Centro e Jardim Planalto');

  const lido = await app.inject({ method: 'GET', url: '/v1/motorista/perfil', headers: h });
  assert.equal(lido.json().telefone, '(19) 99999-0000');
  await app.close();
});

test('perfil: campo desconhecido, campo faltando ou nome curto → 400', async () => {
  const { app, auth, motorista } = await cenarioCadastro();
  const enviar = (payload: object) =>
    app.inject({ method: 'PUT', url: '/v1/motorista/perfil', headers: auth(motorista), payload });

  // Tentar trocar e-mail ou papel pelo perfil não passa da validação.
  assert.equal((await enviar({ ...perfilValido, email: 'x@y.com' })).statusCode, 400);
  assert.equal((await enviar({ ...perfilValido, papel: 'ADMIN' })).statusCode, 400);
  const { telefone: _telefone, ...semTelefone } = perfilValido;
  assert.equal((await enviar(semTelefone)).statusCode, 400);
  assert.equal((await enviar({ ...perfilValido, nome: 'J' })).statusCode, 400);
  await app.close();
});

test('veículo: cadastra com placa normalizada e aparece na lista e no perfil', async () => {
  const { app, auth, motorista } = await cenarioCadastro();
  const h = auth(motorista);

  const criado = await app.inject({
    method: 'POST',
    url: '/v1/motorista/veiculos',
    headers: h,
    payload: { placa: ' abc-1234 ', modelo: 'Sprinter', capacidade: 15 },
  });
  assert.equal(criado.statusCode, 201);
  assert.equal(criado.json().placa, 'ABC1234');
  assert.equal(criado.json().capacidade, 15);

  const lista = await app.inject({ method: 'GET', url: '/v1/motorista/veiculos', headers: h });
  assert.equal(lista.json().length, 1);

  const perfil = await app.inject({ method: 'GET', url: '/v1/motorista/perfil', headers: h });
  assert.equal(perfil.json().veiculos[0].placa, 'ABC1234');
  await app.close();
});

test('veículo: placa repetida (em qualquer grafia) → 409; placa inválida ou campo extra → 400', async () => {
  const { app, auth, motorista, outroMotorista } = await cenarioCadastro();
  const cadastrar = (sub: string, payload: object) =>
    app.inject({ method: 'POST', url: '/v1/motorista/veiculos', headers: auth(sub), payload });

  assert.equal((await cadastrar(motorista, { placa: 'ABC1D23', modelo: 'Van' })).statusCode, 201);
  assert.equal(
    (await cadastrar(outroMotorista, { placa: 'abc1d23', modelo: 'Van' })).statusCode,
    409,
  );
  assert.equal((await cadastrar(motorista, { placa: 'E2E1A71', modelo: 'Van' })).statusCode, 400);
  assert.equal(
    (await cadastrar(motorista, { placa: 'XYZ9876', modelo: 'Van', motoristaId: outroMotorista }))
      .statusCode,
    400,
  );
  await app.close();
});

test('veículo: só o dono altera; outro motorista ou outra organização → 404 e não enxerga', async () => {
  const { app, fake, auth, motorista, outroMotorista, motoristaDeFora } = await cenarioCadastro();
  const criado = await app.inject({
    method: 'POST',
    url: '/v1/motorista/veiculos',
    headers: auth(motorista),
    payload: { placa: 'ABC1234', modelo: 'Van' },
  });
  const url = `/v1/motorista/veiculos/${criado.json().id}`;
  const payload = { placa: 'ABC1234', modelo: 'Van Nova', capacidade: 12 };

  for (const intruso of [outroMotorista, motoristaDeFora]) {
    const res = await app.inject({ method: 'PUT', url, headers: auth(intruso), payload });
    assert.equal(res.statusCode, 404);
    const lista = await app.inject({
      method: 'GET',
      url: '/v1/motorista/veiculos',
      headers: auth(intruso),
    });
    assert.deepEqual(lista.json(), []);
  }
  assert.equal(fake.veiculos[0]?.modelo, 'Van');

  const dono = await app.inject({ method: 'PUT', url, headers: auth(motorista), payload });
  assert.equal(dono.statusCode, 200);
  assert.equal(dono.json().modelo, 'Van Nova');
  await app.close();
});

test('veículo: trocar para a placa de outro veículo → 409', async () => {
  const { app, auth, motorista } = await cenarioCadastro();
  const h = auth(motorista);
  const cadastrar = (placa: string) =>
    app.inject({
      method: 'POST',
      url: '/v1/motorista/veiculos',
      headers: h,
      payload: { placa, modelo: 'Van' },
    });
  await cadastrar('AAA1111');
  const segundo = await cadastrar('BBB2222');

  const res = await app.inject({
    method: 'PUT',
    url: `/v1/motorista/veiculos/${segundo.json().id}`,
    headers: h,
    payload: { placa: 'aaa-1111', modelo: 'Van' },
  });
  assert.equal(res.statusCode, 409);
  await app.close();
});
