import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../../app.js';
import { criarFakeAuthRepository } from '../../test-utils/fake-auth-repository.js';
import {
  criarFakeEnviadorEmail,
  criarFakeRecuperacaoRepository,
} from '../../test-utils/fake-recuperacao.js';
import { depsDeTeste } from '../../test-utils/deps.js';
import {
  gerarTokenRecuperacao,
  hashTokenRecuperacao,
  MAX_PEDIDOS_POR_HORA,
  montarLinkRedefinicao,
} from './recuperacao.service.js';

const EMAIL = 'maria@exemplo.com';
const SENHA_ANTIGA = 'senha-antiga-123';
const SENHA_NOVA = 'senha-nova-456';

async function novoApp(opts: { emailFalhando?: boolean } = {}) {
  const auth = criarFakeAuthRepository();
  const rec = criarFakeRecuperacaoRepository(auth);
  const email = criarFakeEnviadorEmail({ falhar: opts.emailFalhando ?? false });
  const app = await buildApp(
    depsDeTeste({
      authRepository: auth.repo,
      recuperacaoRepository: rec.repo,
      enviadorEmail: email.enviador,
    }),
  );

  const cadastrar = async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/cadastro',
      payload: {
        nome: 'Maria Souza',
        email: EMAIL,
        senha: SENHA_ANTIGA,
        papel: 'RESPONSAVEL',
        codigoConvite: auth.convite,
      },
    });
    assert.equal(res.statusCode, 201);
    return res.json<{ refreshToken: string }>();
  };
  const pedir = (para = EMAIL) =>
    app.inject({ method: 'POST', url: '/v1/auth/esqueci-senha', payload: { email: para } });
  const redefinir = (token: string, senha = SENHA_NOVA) =>
    app.inject({ method: 'POST', url: '/v1/auth/redefinir-senha', payload: { token, senha } });
  const login = (senha: string) =>
    app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: EMAIL, senha } });

  return { app, auth, rec, email, cadastrar, pedir, redefinir, login };
}

// ── ① Pedido ─────────────────────────────────────────────────────────────────

test('pedido: e-mail cadastrado recebe o link, e a resposta é 202', async () => {
  const t = await novoApp();
  await t.cadastrar();
  const res = await t.pedir();
  assert.equal(res.statusCode, 202);
  assert.equal(t.email.enviados.length, 1);
  assert.equal(t.email.enviados[0]?.para, EMAIL);
  assert.match(t.email.enviados[0]?.texto ?? '', /pitayaescolar:\/\/redefinir-senha\?token=/);
  await t.app.close();
});

test('pedido: e-mail inexistente recebe EXATAMENTE a mesma resposta e nenhum e-mail sai', async () => {
  const t = await novoApp();
  await t.cadastrar();
  const existe = await t.pedir();
  const naoExiste = await t.pedir('ninguem@exemplo.com');
  assert.equal(naoExiste.statusCode, existe.statusCode);
  assert.equal(naoExiste.body, existe.body);
  assert.equal(t.email.enviados.length, 1); // só o do e-mail cadastrado
  await t.app.close();
});

test('pedido: conta desativada não recebe link (e a resposta continua igual)', async () => {
  const t = await novoApp();
  await t.cadastrar();
  const u = t.auth.usuarios[0];
  if (u) u.ativo = false;
  const res = await t.pedir();
  assert.equal(res.statusCode, 202);
  assert.equal(t.email.enviados.length, 0);
  await t.app.close();
});

test('pedido: no banco fica só o hash do token, e a resposta não contém o token', async () => {
  const t = await novoApp();
  await t.cadastrar();
  const res = await t.pedir();
  const token = t.email.tokenDoUltimoEmail(EMAIL) ?? '';
  assert.ok(token.length >= 43);
  assert.equal(t.rec.pedidos[0]?.tokenHash, hashTokenRecuperacao(token));
  assert.ok(!JSON.stringify(t.rec.pedidos).includes(token));
  assert.ok(!res.body.includes(token));
  await t.app.close();
});

test('pedido: link vale 30 minutos', async () => {
  const t = await novoApp();
  await t.cadastrar();
  const antes = Date.now();
  await t.pedir();
  const validade = (t.rec.pedidos[0]?.expiraEm.getTime() ?? 0) - antes;
  assert.ok(validade > 29 * 60_000 && validade <= 30 * 60_000 + 1000, `validade ${validade}`);
  await t.app.close();
});

test(`pedido: mais de ${MAX_PEDIDOS_POR_HORA} por hora na mesma conta não manda mais e-mails`, async () => {
  const t = await novoApp();
  await t.cadastrar();
  for (let i = 0; i < MAX_PEDIDOS_POR_HORA + 2; i++) {
    assert.equal((await t.pedir()).statusCode, 202);
  }
  assert.equal(t.email.enviados.length, MAX_PEDIDOS_POR_HORA);
  await t.app.close();
});

test('pedido: um novo pedido invalida o link anterior', async () => {
  const t = await novoApp();
  await t.cadastrar();
  await t.pedir();
  const primeiro = t.email.tokenDoUltimoEmail(EMAIL) ?? '';
  await t.pedir();
  const segundo = t.email.tokenDoUltimoEmail(EMAIL) ?? '';
  assert.notEqual(primeiro, segundo);
  assert.equal((await t.redefinir(primeiro)).statusCode, 400);
  assert.equal((await t.redefinir(segundo)).statusCode, 204);
  await t.app.close();
});

test('pedido: provedor de e-mail fora do ar não muda a resposta (não revela nada)', async () => {
  const t = await novoApp({ emailFalhando: true });
  await t.cadastrar();
  const res = await t.pedir();
  assert.equal(res.statusCode, 202);
  assert.equal(t.email.enviados.length, 1); // tentou enviar
  await t.app.close();
});

test('pedido: rate limit por IP responde 429 depois de 10 pedidos por minuto', async () => {
  const t = await novoApp();
  const status: number[] = [];
  for (let i = 0; i < 11; i++) status.push((await t.pedir(`x${i}@exemplo.com`)).statusCode);
  assert.deepEqual(status.slice(0, 10), Array(10).fill(202));
  assert.equal(status[10], 429);
  await t.app.close();
});

// ── ④⑤ Redefinição ───────────────────────────────────────────────────────────

test('fluxo completo: redefine, derruba as sessões, e só a senha nova entra', async () => {
  const t = await novoApp();
  const { refreshToken: sessaoAntiga } = await t.cadastrar();
  await t.pedir();
  const token = t.email.tokenDoUltimoEmail(EMAIL) ?? '';

  const res = await t.redefinir(token);
  assert.equal(res.statusCode, 204);

  // A sessão aberta antes da troca não renova mais (o invasor cai).
  const renovar = await t.app.inject({
    method: 'POST',
    url: '/v1/auth/refresh',
    payload: { refreshToken: sessaoAntiga },
  });
  assert.equal(renovar.statusCode, 401);

  assert.equal((await t.login(SENHA_ANTIGA)).statusCode, 401);
  assert.equal((await t.login(SENHA_NOVA)).statusCode, 200);
  await t.app.close();
});

test('redefinição: o dono da conta é avisado por e-mail que a senha mudou', async () => {
  const t = await novoApp();
  await t.cadastrar();
  await t.pedir();
  await t.redefinir(t.email.tokenDoUltimoEmail(EMAIL) ?? '');
  const aviso = t.email.enviados.at(-1);
  assert.equal(aviso?.para, EMAIL);
  assert.match(aviso?.assunto ?? '', /senha foi alterada/);
  assert.doesNotMatch(aviso?.texto ?? '', /token=/);
  await t.app.close();
});

test('redefinição: o token é de uso único', async () => {
  const t = await novoApp();
  await t.cadastrar();
  await t.pedir();
  const token = t.email.tokenDoUltimoEmail(EMAIL) ?? '';
  assert.equal((await t.redefinir(token)).statusCode, 204);
  const segunda = await t.redefinir(token, 'outra-senha-789');
  assert.equal(segunda.statusCode, 400);
  assert.equal(segunda.json<{ code: string }>().code, 'LINK_INVALIDO');
  assert.equal((await t.login(SENHA_NOVA)).statusCode, 200);
  await t.app.close();
});

test('redefinição: duas requisições simultâneas com o mesmo token → só uma vence', async () => {
  const t = await novoApp();
  await t.cadastrar();
  await t.pedir();
  const token = t.email.tokenDoUltimoEmail(EMAIL) ?? '';
  const [a, b] = await Promise.all([
    t.redefinir(token, 'senha-da-a-111'),
    t.redefinir(token, 'senha-da-b-222'),
  ]);
  assert.deepEqual([a.statusCode, b.statusCode].sort(), [204, 400]);
  await t.app.close();
});

test('redefinição: link expirado é recusado', async () => {
  const t = await novoApp();
  await t.cadastrar();
  await t.pedir();
  const pedido = t.rec.pedidos[0];
  if (pedido) pedido.expiraEm = new Date(Date.now() - 1000);
  assert.equal((await t.redefinir(t.email.tokenDoUltimoEmail(EMAIL) ?? '')).statusCode, 400);
  assert.equal((await t.login(SENHA_ANTIGA)).statusCode, 200);
  await t.app.close();
});

test('redefinição: token inventado é recusado sem dizer por quê', async () => {
  const t = await novoApp();
  await t.cadastrar();
  const res = await t.redefinir(gerarTokenRecuperacao());
  assert.equal(res.statusCode, 400);
  assert.equal(res.json<{ code: string }>().code, 'LINK_INVALIDO');
  await t.app.close();
});

test('redefinição: nova senha segue a regra do cadastro (mínimo de 8)', async () => {
  const t = await novoApp();
  await t.cadastrar();
  await t.pedir();
  const res = await t.redefinir(t.email.tokenDoUltimoEmail(EMAIL) ?? '', '123');
  assert.equal(res.statusCode, 400);
  assert.equal(res.json<{ code: string }>().code, 'VALIDATION_ERROR');
  // Validação falhou antes de consumir: o link continua valendo.
  assert.equal(t.rec.pedidos[0]?.usadoEm, null);
  await t.app.close();
});

test('redefinição: zera o bloqueio de login por senhas erradas', async () => {
  const t = await novoApp();
  await t.cadastrar();
  for (let i = 0; i < 5; i++) await t.login('senha-errada-000');
  assert.equal((await t.login(SENHA_ANTIGA)).statusCode, 429); // conta bloqueada

  await t.pedir();
  await t.redefinir(t.email.tokenDoUltimoEmail(EMAIL) ?? '');
  assert.equal((await t.login(SENHA_NOVA)).statusCode, 200);
  await t.app.close();
});

test('redefinição: token na query string da API não é aceito (só no corpo do POST)', async () => {
  const t = await novoApp();
  const res = await t.app.inject({
    method: 'GET',
    url: `/v1/auth/redefinir-senha?token=${gerarTokenRecuperacao()}`,
  });
  assert.equal(res.statusCode, 404);
  await t.app.close();
});

// ── Funções puras ────────────────────────────────────────────────────────────

test('gerarTokenRecuperacao: 32 bytes em base64url, diferente a cada chamada', () => {
  const a = gerarTokenRecuperacao();
  assert.match(a, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(a, gerarTokenRecuperacao());
});

test('hashTokenRecuperacao: SHA-256 determinístico em hex', () => {
  assert.equal(hashTokenRecuperacao('abc'), hashTokenRecuperacao('abc'));
  assert.match(hashTokenRecuperacao('abc'), /^[0-9a-f]{64}$/);
});

test('montarLinkRedefinicao: funciona com deep link e com https, preservando a base', () => {
  assert.equal(
    montarLinkRedefinicao('pitayaescolar://redefinir-senha', 'abc_-1'),
    'pitayaescolar://redefinir-senha?token=abc_-1',
  );
  assert.equal(
    montarLinkRedefinicao('https://pitaya.example/r?x=1', 'abc'),
    'https://pitaya.example/r?x=1&token=abc',
  );
});
