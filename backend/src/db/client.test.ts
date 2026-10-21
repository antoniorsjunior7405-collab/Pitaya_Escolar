import assert from 'node:assert/strict';
import { test } from 'node:test';
import { criarPool } from './client.js';

// Nenhum teste aqui abre conexão: o pool só conecta no primeiro pedido.
const novoPool = () => criarPool('postgresql://u:s@localhost:5432/banco');

test('regressão: conexão ociosa derrubada pelo banco não vira uncaughtException', async () => {
  const pool = novoPool();
  // Sem listener, emit('error') lança, e no processo real isso derrubava a API.
  assert.doesNotThrow(() => pool.emit('error', new Error('Connection terminated unexpectedly')));
  await pool.end();
});

test('quem escuta o pool continua recebendo o erro (para registrar no log)', async () => {
  const pool = novoPool();
  const recebidos: Error[] = [];
  pool.on('error', (err) => recebidos.push(err));
  pool.emit('error', new Error('Connection terminated unexpectedly'));
  assert.equal(recebidos.length, 1);
  assert.equal(recebidos[0]?.message, 'Connection terminated unexpectedly');
  await pool.end();
});
