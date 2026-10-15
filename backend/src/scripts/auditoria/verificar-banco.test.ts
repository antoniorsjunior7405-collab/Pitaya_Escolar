import assert from 'node:assert/strict';
import { test } from 'node:test';
import type pg from 'pg';
import { verificarBanco } from './verificar-banco.js';

/**
 * Pool falso: registra cada SQL e responde a contagem que `contar` devolver.
 * Sem banco real; o objetivo é testar o protocolo (READ ONLY, ROLLBACK, release)
 * e a tradução de contagem em OK/AVISO/FALHA.
 */
function poolFalso(contar: (sql: string) => number | Error) {
  const consultas: string[] = [];
  let liberado = false;
  const cliente = {
    query: async (sql: string) => {
      consultas.push(sql);
      if (/^(BEGIN|ROLLBACK)/.test(sql)) return { rows: [] };
      const r = contar(sql);
      if (r instanceof Error) throw r;
      return { rows: [{ count: String(r) }] };
    },
    release: () => {
      liberado = true;
    },
  };
  const pool = { connect: async () => cliente } as unknown as pg.Pool;
  return { pool, consultas, foiLiberado: () => liberado };
}

test('banco: abre transação READ ONLY primeiro e termina com ROLLBACK', async () => {
  const { pool, consultas, foiLiberado } = poolFalso(() => 0);
  await verificarBanco(pool);
  assert.equal(consultas[0], 'BEGIN TRANSACTION READ ONLY');
  assert.equal(consultas.at(-1), 'ROLLBACK');
  assert.ok(foiLiberado());
});

test('banco: nenhuma consulta de verificação escreve dados', async () => {
  const { pool, consultas } = poolFalso(() => 0);
  await verificarBanco(pool);
  const verificacoes = consultas.slice(1, -1);
  assert.ok(verificacoes.length > 0);
  for (const sql of verificacoes) {
    assert.match(sql.trim(), /^SELECT count\(\*\)/);
    assert.doesNotMatch(sql, /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE)\b/i);
  }
});

test('banco: tudo zerado → todas as verificações OK', async () => {
  const { pool } = poolFalso(() => 0);
  const resultados = await verificarBanco(pool);
  assert.ok(resultados.every((r) => r.nivel === 'OK'));
});

test('banco: vazamento entre organizações vira FALHA com a contagem, sem dados pessoais', async () => {
  const { pool } = poolFalso((sql) => (sql.includes("m.papel = 'RESPONSAVEL'") ? 3 : 0));
  const resultados = await verificarBanco(pool);
  const r = resultados.find((x) => x.item === 'Responsável vinculado a aluno de outra organização');
  assert.equal(r?.nivel, 'FALHA');
  assert.match(r?.detalhe ?? '', /^3 /);
  assert.equal(resultados.filter((x) => x.nivel !== 'OK').length, 1);
});

test('banco: aluno da família fora das regras (rota, consentimento, órfão) é detectado', async () => {
  const { pool, consultas } = poolFalso((sql) => {
    if (sql.includes('FROM rota_alunos ra JOIN alunos a') && sql.includes('IS NULL')) return 1;
    if (sql.includes('consentimento_em IS NULL')) return 2;
    if (sql.includes('a.ativo AND NOT EXISTS')) return 4;
    return 0;
  });
  const resultados = await verificarBanco(pool);
  const nivel = (item: string) => resultados.find((x) => x.item === item)?.nivel;
  assert.equal(nivel('Aluno da família em rota'), 'FALHA');
  assert.equal(nivel('Vínculo da família sem consentimento'), 'FALHA');
  assert.equal(nivel('Aluno da família sem responsável'), 'AVISO');
  assert.equal(resultados.filter((x) => x.nivel !== 'OK').length, 3);
  // O vínculo de aluno da família não é confundido com vazamento entre organizações.
  const isolamento = consultas.find((sql) => sql.includes("m.papel = 'RESPONSAVEL'"));
  assert.match(isolamento ?? '', /a\.organizacao_id IS NOT NULL/);
});

test('banco: veículo particular fora do dono ou da organização vira FALHA', async () => {
  const { pool } = poolFalso((sql) => {
    if (sql.includes('FROM veiculos v') && sql.includes('NOT EXISTS')) return 2;
    if (sql.includes('v.motorista_id <> r.motorista_id')) return 1;
    return 0;
  });
  const resultados = await verificarBanco(pool);
  const dono = resultados.find(
    (x) => x.item === 'Veículo particular de quem não é motorista da organização',
  );
  const rota = resultados.find((x) => x.item === 'Rota com veículo particular de outro motorista');
  assert.equal(dono?.nivel, 'FALHA');
  assert.match(dono?.detalhe ?? '', /^2 /);
  assert.equal(rota?.nivel, 'FALHA');
  assert.match(rota?.detalhe ?? '', /^1 /);
  assert.equal(resultados.filter((x) => x.nivel !== 'OK').length, 2);
});

test('banco: viagem esquecida em andamento é só AVISO (não derruba o CI)', async () => {
  const { pool } = poolFalso((sql) => (sql.includes("interval '12 hours'") ? 1 : 0));
  const r = (await verificarBanco(pool)).find((x) => x.item === 'Viagem esquecida em andamento');
  assert.equal(r?.nivel, 'AVISO');
});

test('banco: erro numa consulta sobe, mas a conexão é devolvida ao pool', async () => {
  const { pool, consultas, foiLiberado } = poolFalso(() => new Error('relation does not exist'));
  await assert.rejects(verificarBanco(pool), /relation does not exist/);
  assert.equal(consultas.at(-1), 'ROLLBACK');
  assert.ok(foiLiberado());
});
