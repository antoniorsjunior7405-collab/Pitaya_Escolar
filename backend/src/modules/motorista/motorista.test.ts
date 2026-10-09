import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { buildApp } from '../../app.js';
import { criarFakeAcesso, depsDeTeste } from '../../test-utils/deps.js';
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

  const app = await buildApp(
    depsDeTeste({
      acessoRepository: criarFakeAcesso([
        { usuarioId: motorista, organizacaoId: org, papel: 'MOTORISTA' },
        { usuarioId: outroMotorista, organizacaoId: org, papel: 'MOTORISTA' },
        { usuarioId: responsavel, organizacaoId: org, papel: 'RESPONSAVEL' },
      ]),
      motoristaRepository: fake.repo,
    }),
  );
  const auth = (sub: string) => ({ authorization: `Bearer ${app.jwt.sign({ sub })}` });
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
  assert.equal((await enviar({ latitude: -23.55, longitude: -46.63 })).statusCode, 422);
  await app.close();
});
