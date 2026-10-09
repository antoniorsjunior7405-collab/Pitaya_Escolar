import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../../app.js';
import { criarFakeAuthRepository } from '../../test-utils/fake-auth-repository.js';
import { depsDeTeste } from '../../test-utils/deps.js';

const novoApp = () => buildApp(depsDeTeste({ authRepository: criarFakeAuthRepository().repo }));

test('rate limit estourado responde 429 (e não 500) no formato padrão', async () => {
  const app = await novoApp();
  let ultimo = await app.inject({ method: 'GET', url: '/health' });
  for (let i = 0; i < 12; i++) {
    ultimo = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'a@b.com', senha: 'qualquer-senha-1' },
    });
  }
  assert.equal(ultimo.statusCode, 429);
  assert.equal(ultimo.json().code, 'TOO_MANY_REQUESTS');
  assert.ok(ultimo.json().requestId);
  await app.close();
});

test('JSON malformado responde 400 sem vazar detalhes internos', async () => {
  const app = await novoApp();
  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    headers: { 'content-type': 'application/json' },
    payload: '{ isto não é json',
  });
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().code, 'BAD_REQUEST');
  assert.equal(res.body.includes('Unexpected'), false);
  assert.equal(res.body.includes('at '), false);
  await app.close();
});

test('corpo acima do limite responde 413', async () => {
  const app = await novoApp();
  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ email: 'a@b.com', senha: 'x'.repeat(1_100_000) }),
  });
  assert.equal(res.statusCode, 413);
  assert.equal(res.json().code, 'PAYLOAD_TOO_LARGE');
  await app.close();
});

test('erro inesperado vira 500 genérico, sem mensagem interna', async () => {
  const app = await novoApp();
  app.get('/boom', async () => {
    throw new Error('senha do banco = hunter2');
  });
  const res = await app.inject({ method: 'GET', url: '/boom' });
  assert.equal(res.statusCode, 500);
  assert.equal(res.json().message, 'Erro interno');
  assert.equal(res.body.includes('hunter2'), false);
  await app.close();
});
