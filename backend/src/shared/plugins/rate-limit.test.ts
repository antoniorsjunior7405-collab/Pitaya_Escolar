import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { buildApp } from '../../app.js';
import { criarFakeAcesso, depsDeTeste } from '../../test-utils/deps.js';
import { criarFakeMotoristaRepository } from '../../test-utils/fake-motorista-repository.js';

// Dois motoristas no MESMO IP (CGNAT da operadora) não podem dividir o limite.
test('rate limit de rotas logadas conta por usuário, não por IP', async () => {
  const org = randomUUID();
  const [m1, m2] = [randomUUID(), randomUUID()];
  const fake = criarFakeMotoristaRepository();
  const app = await buildApp(
    depsDeTeste({
      acessoRepository: criarFakeAcesso([
        { usuarioId: m1, organizacaoId: org, papel: 'MOTORISTA' },
        { usuarioId: m2, organizacaoId: org, papel: 'MOTORISTA' },
      ]),
      motoristaRepository: fake.repo,
    }),
  );
  const listar = (sub: string) =>
    app.inject({
      method: 'GET',
      url: '/v1/motorista/rotas',
      headers: { authorization: `Bearer ${app.jwt.sign({ sub })}` },
    });

  let ultimo = await listar(m1);
  for (let i = 0; i < 100; i++) ultimo = await listar(m1);
  assert.equal(ultimo.statusCode, 429); // m1 estourou o próprio limite (100/min)
  assert.equal((await listar(m2)).statusCode, 200); // m2, mesmo IP, segue livre
  await app.close();
});
