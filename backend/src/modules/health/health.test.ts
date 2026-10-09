import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../../app.js';

test('GET /health responde 200 com status ok', async () => {
  const app = await buildApp();
  const res = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { status: 'ok' });
  await app.close();
});

test('rota inexistente responde 404 no formato padrão', async () => {
  const app = await buildApp();
  const res = await app.inject({ method: 'GET', url: '/nao-existe' });
  assert.equal(res.statusCode, 404);
  assert.equal(res.json().code, 'NOT_FOUND');
  await app.close();
});
