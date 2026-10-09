import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { buildApp } from '../../app.js';
import type { Membro } from '../../shared/acesso/acesso.js';
import { autorizacao, depsDeTeste, parcial } from '../../test-utils/deps.js';
import {
  converter,
  type AcompanhamentoRow,
  type ResponsavelRepository,
} from './responsavel.repository.js';

const linha = (extra: Partial<AcompanhamentoRow> = {}): AcompanhamentoRow => ({
  id: randomUUID(),
  nome: 'Ana',
  statusAluno: 'EMBARCADO',
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
  const responsavelRepository = parcial<ResponsavelRepository>('responsavelRepository', {
    listarAcompanhamento: async (_escopo, _hoje, alunoId) =>
      alunoId ? linhas.filter((l) => l.id === alunoId) : linhas,
  });
  const app = await buildApp(depsDeTeste({ responsavelRepository }));
  return { app, h: autorizacao(app, responsavel, membros) };
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

test('conversão da linha crua: driver devolve data e números como texto', () => {
  const r = converter({
    ...linha(),
    latitude: '-23.5615',
    longitude: '-46.656',
    velocidade: null,
    posicaoAtualizadaEm: '2026-10-09 18:21:56.925+00',
  });
  assert.equal(r.latitude, -23.5615);
  assert.ok(r.posicaoAtualizadaEm instanceof Date);
  assert.equal(r.posicaoAtualizadaEm.toISOString(), '2026-10-09T18:21:56.925Z');
});
