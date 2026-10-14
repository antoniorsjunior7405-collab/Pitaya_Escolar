import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../../app.js';
import { criarFakeAuthRepository } from '../../test-utils/fake-auth-repository.js';
import { depsDeTeste } from '../../test-utils/deps.js';
import { ttlEmSegundos, verificarConfig, type ConfigAuditavel } from './verificar-config.js';
import { verificarHttp, type Requisitar } from './verificar-http.js';

const configBoa: ConfigAuditavel = {
  NODE_ENV: 'production',
  LOG_LEVEL: 'info',
  CORS_ORIGINS: ['https://app.pitaya.example'],
  DATABASE_URL: 'postgresql://u:s@db.neon.tech/banco?sslmode=require',
  JWT_SECRET: 'Kq3vZ8pX1mN7rT4wY9bC2dF6gH0jL5sA-uE_iO8kQzVxWcRtYbNmP3', // 54 chars
  ACCESS_TOKEN_TTL: '15m',
  REFRESH_TOKEN_TTL_DAYS: 30,
};

const niveis = (c: ConfigAuditavel) =>
  Object.fromEntries(verificarConfig(c).map((r) => [r.item, r.nivel]));

test('auditoria de config: configuração de produção correta não gera falhas nem avisos', () => {
  assert.ok(verificarConfig(configBoa).every((r) => r.nivel === 'OK'));
});

test('auditoria de config: segredo de exemplo, CORS "*" e TTL longo são falhas', () => {
  const n = niveis({
    ...configBoa,
    JWT_SECRET: 'troque-por-um-segredo-longo-e-aleatorio-com-32-ou-mais-caracteres',
    CORS_ORIGINS: ['*'],
    ACCESS_TOKEN_TTL: '2h',
  });
  assert.equal(n.JWT_SECRET, 'FALHA');
  assert.equal(n.CORS_ORIGINS, 'FALHA');
  assert.equal(n.ACCESS_TOKEN_TTL, 'FALHA');
});

test('auditoria de config: segredo repetitivo é falha mesmo com 32+ caracteres', () => {
  assert.equal(niveis({ ...configBoa, JWT_SECRET: 'a'.repeat(64) }).JWT_SECRET, 'FALHA');
});

test('auditoria de config: banco remoto sem sslmode=require é falha', () => {
  const n = niveis({ ...configBoa, DATABASE_URL: 'postgresql://u:s@db.neon.tech/banco' });
  assert.equal(n.DATABASE_URL, 'FALHA');
});

test('auditoria de config: sslmode=disable é falha; banco local não exige TLS', () => {
  assert.equal(
    niveis({ ...configBoa, DATABASE_URL: 'postgresql://u:s@db.neon.tech/b?sslmode=disable' })
      .DATABASE_URL,
    'FALHA',
  );
  const local = verificarConfig({ ...configBoa, DATABASE_URL: 'postgresql://u:s@localhost/b' });
  assert.equal(
    local.find((r) => r.item === 'DATABASE_URL'),
    undefined,
  );
});

test('auditoria de config: avisos de produção (segredo curto, localhost no CORS, log debug)', () => {
  const n = niveis({
    ...configBoa,
    JWT_SECRET: 'Kq3vZ8pX1mN7rT4wY9bC2dF6gH0jL5sA-uE', // 35 chars, variado
    CORS_ORIGINS: ['http://localhost:8081'],
    LOG_LEVEL: 'debug',
  });
  assert.equal(n.JWT_SECRET, 'AVISO');
  assert.equal(n.CORS_ORIGINS, 'AVISO');
  assert.equal(n.LOG_LEVEL, 'AVISO');
});

test('auditoria de config: as mesmas escolhas em desenvolvimento não geram aviso', () => {
  const n = niveis({
    ...configBoa,
    NODE_ENV: 'development',
    JWT_SECRET: 'Kq3vZ8pX1mN7rT4wY9bC2dF6gH0jL5sA-uE',
    CORS_ORIGINS: ['http://localhost:8081'],
    LOG_LEVEL: 'debug',
  });
  assert.equal(n.JWT_SECRET, 'OK');
  assert.equal(n.CORS_ORIGINS, 'OK');
  assert.equal(n.LOG_LEVEL, 'OK');
});

test('auditoria de config: refresh de mais de 90 dias e TTL ilegível são avisos', () => {
  const n = niveis({ ...configBoa, REFRESH_TOKEN_TTL_DAYS: 365, ACCESS_TOKEN_TTL: 'quinze' });
  assert.equal(n.REFRESH_TOKEN_TTL_DAYS, 'AVISO');
  assert.equal(n.ACCESS_TOKEN_TTL, 'AVISO');
});

test('auditoria de config: TTL de exatamente 1 h ainda é aceito (limite)', () => {
  assert.equal(niveis({ ...configBoa, ACCESS_TOKEN_TTL: '1h' }).ACCESS_TOKEN_TTL, 'OK');
  assert.equal(niveis({ ...configBoa, ACCESS_TOKEN_TTL: '61m' }).ACCESS_TOKEN_TTL, 'FALHA');
});

test('ttlEmSegundos entende s/m/h/d e número puro', () => {
  assert.equal(ttlEmSegundos('15m'), 900);
  assert.equal(ttlEmSegundos('1h'), 3600);
  assert.equal(ttlEmSegundos('900'), 900);
  assert.equal(ttlEmSegundos('quinze'), null);
});

test('auditoria HTTP: a API real (buildApp) passa em todas as verificações', async () => {
  const app = await buildApp(depsDeTeste({ authRepository: criarFakeAuthRepository().repo }));
  const requisitar: Requisitar = async (url, headers) => {
    const res = await app.inject({ method: 'GET', url, headers });
    return {
      status: res.statusCode,
      headers: Object.fromEntries(
        Object.entries(res.headers).map(([k, v]) => [k, v === undefined ? undefined : String(v)]),
      ),
      body: res.body,
    };
  };

  const resultados = await verificarHttp(requisitar, true);
  const problemas = resultados.filter((r) => r.nivel !== 'OK');
  assert.deepEqual(problemas, []);
  await app.close();
});

test('auditoria HTTP: servidor indisponível (502) não gera falsos positivos de headers', async () => {
  const requisitar: Requisitar = async () => ({ status: 502, headers: {}, body: 'Bad Gateway' });
  const resultados = await verificarHttp(requisitar, true);
  assert.equal(resultados.length, 1);
  assert.equal(resultados[0]?.item, 'API indisponível');
});

test('auditoria HTTP: detecta X-Powered-By, CORS aberto e erro com stack', async () => {
  const requisitar: Requisitar = async (url) => ({
    status: url === '/health' ? 200 : 500,
    headers: { 'x-powered-by': 'Express', 'access-control-allow-origin': '*' },
    body: '{"message":"Error\\n    at Object.<anonymous> (/app/node_modules/x.js:1:1)"}',
  });

  const n = Object.fromEntries(
    (await verificarHttp(requisitar, false)).map((r) => [r.item, r.nivel]),
  );
  assert.equal(n['X-Powered-By'], 'FALHA');
  assert.equal(n.CORS, 'FALHA');
  assert.equal(n['Rota protegida sem token'], 'FALHA');
  assert.equal(n['Formato do erro 401'], 'FALHA');
});

/** API falsa "correta"; cada teste estraga só o que quer verificar. */
function apiFalsa(
  estragar: (url: string, headers?: Record<string, string>) => object = () => ({}),
) {
  const erro = (code: string) => JSON.stringify({ code, message: 'x', requestId: 'req-1' });
  const requisitar: Requisitar = async (url, headers) => ({
    status: url === '/health' ? 200 : url === '/rota-inexistente-auditoria' ? 404 : 401,
    headers: {
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'SAMEORIGIN',
      'strict-transport-security': 'max-age=15552000',
    },
    body: url === '/health' ? '{"status":"ok"}' : erro('ERRO'),
    ...estragar(url, headers),
  });
  return requisitar;
}
const niveisHttp = async (req: Requisitar, https = true) =>
  Object.fromEntries((await verificarHttp(req, https)).map((r) => [r.item, r.nivel]));

test('auditoria HTTP: API falsa correta passa (sanidade do helper)', async () => {
  const resultados = await verificarHttp(apiFalsa(), true);
  assert.deepEqual(
    resultados.filter((r) => r.nivel !== 'OK'),
    [],
  );
});

test('auditoria HTTP: token forjado (alg none) aceito pela API é FALHA', async () => {
  const req = apiFalsa((_url, headers) =>
    headers?.Authorization ? { status: 200, body: '[]' } : {},
  );
  assert.equal((await niveisHttp(req))['Token forjado (alg none, ADMIN)'], 'FALHA');
});

test('auditoria HTTP: HSTS só é exigido quando a API é HTTPS', async () => {
  const semHsts = apiFalsa(() => ({
    headers: { 'x-content-type-options': 'nosniff', 'x-frame-options': 'SAMEORIGIN' },
  }));
  assert.equal((await niveisHttp(semHsts, true))['Strict-Transport-Security'], 'FALHA');
  assert.equal((await niveisHttp(semHsts, false))['Strict-Transport-Security'], undefined);
});

test('auditoria HTTP: CSP frame-ancestors também protege contra clickjacking', async () => {
  const req = apiFalsa(() => ({
    headers: {
      'x-content-type-options': 'nosniff',
      'content-security-policy': "frame-ancestors 'self'",
    },
  }));
  assert.equal((await niveisHttp(req, false))['Proteção contra clickjacking'], 'OK');
});

test('auditoria HTTP: 404 que vaza SQL é FALHA', async () => {
  const req = apiFalsa((url) =>
    url === '/rota-inexistente-auditoria' ? { body: 'erro em SELECT * FROM usuarios' } : {},
  );
  assert.equal((await niveisHttp(req))['Rota inexistente → 404'], 'FALHA');
});
