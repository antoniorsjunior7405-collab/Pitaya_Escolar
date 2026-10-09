import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../../app.js';
import { criarFakeAuthRepository } from '../../test-utils/fake-auth-repository.js';
import { hashSenha, verificarSenha } from './password.js';

async function novoApp() {
  const fake = criarFakeAuthRepository();
  const app = await buildApp({ authRepository: fake.repo });
  return { app, fake };
}

const cadastroValido = (convite: string) => ({
  nome: 'Maria Souza',
  email: 'Maria@Exemplo.com',
  senha: 'senha-segura-123',
  papel: 'RESPONSAVEL',
  codigoConvite: convite,
});

test('hash de senha: verifica a correta e rejeita a errada', async () => {
  const hash = await hashSenha('abc12345');
  assert.notEqual(hash, 'abc12345');
  assert.equal(await verificarSenha('abc12345', hash), true);
  assert.equal(await verificarSenha('errada123', hash), false);
});

test('cadastro com convite válido retorna tokens e não vaza a senha', async () => {
  const { app, fake } = await novoApp();
  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/cadastro',
    payload: cadastroValido(fake.convite),
  });
  assert.equal(res.statusCode, 201);
  const body = res.json();
  assert.equal(body.usuario.email, 'maria@exemplo.com');
  assert.ok(body.accessToken && body.refreshToken);
  assert.equal(JSON.stringify(body).includes('senha'), false);
  await app.close();
});

test('cadastro com convite inválido responde 404', async () => {
  const { app } = await novoApp();
  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/cadastro',
    payload: cadastroValido('CODIGO-ERRADO'),
  });
  assert.equal(res.statusCode, 404);
  await app.close();
});

test('cadastro não aceita papel ADMIN nem senha curta', async () => {
  const { app, fake } = await novoApp();
  const admin = await app.inject({
    method: 'POST',
    url: '/v1/auth/cadastro',
    payload: { ...cadastroValido(fake.convite), papel: 'ADMIN' },
  });
  assert.equal(admin.statusCode, 400);
  const curta = await app.inject({
    method: 'POST',
    url: '/v1/auth/cadastro',
    payload: { ...cadastroValido(fake.convite), senha: '123' },
  });
  assert.equal(curta.statusCode, 400);
  await app.close();
});

test('e-mail duplicado responde 409', async () => {
  const { app, fake } = await novoApp();
  const payload = cadastroValido(fake.convite);
  await app.inject({ method: 'POST', url: '/v1/auth/cadastro', payload });
  const res = await app.inject({ method: 'POST', url: '/v1/auth/cadastro', payload });
  assert.equal(res.statusCode, 409);
  await app.close();
});

test('login: senha certa entra, senha errada e e-mail inexistente dão a mesma resposta', async () => {
  const { app, fake } = await novoApp();
  await app.inject({
    method: 'POST',
    url: '/v1/auth/cadastro',
    payload: cadastroValido(fake.convite),
  });

  const ok = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email: 'maria@exemplo.com', senha: 'senha-segura-123' },
  });
  assert.equal(ok.statusCode, 200);

  const errada = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email: 'maria@exemplo.com', senha: 'senha-errada-999' },
  });
  const inexistente = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email: 'ninguem@exemplo.com', senha: 'qualquer-coisa-1' },
  });
  assert.equal(errada.statusCode, 401);
  assert.equal(inexistente.statusCode, 401);
  assert.equal(errada.json().message, inexistente.json().message);
  await app.close();
});

test('GET /me exige token e devolve usuário e organizações com o token válido', async () => {
  const { app, fake } = await novoApp();
  const sem = await app.inject({ method: 'GET', url: '/v1/auth/me' });
  assert.equal(sem.statusCode, 401);

  const lixo = await app.inject({
    method: 'GET',
    url: '/v1/auth/me',
    headers: { authorization: 'Bearer token-invalido' },
  });
  assert.equal(lixo.statusCode, 401);

  const cad = await app.inject({
    method: 'POST',
    url: '/v1/auth/cadastro',
    payload: cadastroValido(fake.convite),
  });
  const me = await app.inject({
    method: 'GET',
    url: '/v1/auth/me',
    headers: { authorization: `Bearer ${cad.json().accessToken}` },
  });
  assert.equal(me.statusCode, 200);
  assert.equal(me.json().organizacoes[0].papel, 'RESPONSAVEL');
  await app.close();
});

test('refresh rotaciona: o token antigo deixa de valer e o reuso derruba a sessão', async () => {
  const { app, fake } = await novoApp();
  const cad = await app.inject({
    method: 'POST',
    url: '/v1/auth/cadastro',
    payload: cadastroValido(fake.convite),
  });
  const antigo: string = cad.json().refreshToken;

  const novo = await app.inject({
    method: 'POST',
    url: '/v1/auth/refresh',
    payload: { refreshToken: antigo },
  });
  assert.equal(novo.statusCode, 200);
  const refreshNovo: string = novo.json().refreshToken;
  assert.notEqual(refreshNovo, antigo);

  // Reusar o antigo é suspeito: falha e revoga também o novo.
  const reuso = await app.inject({
    method: 'POST',
    url: '/v1/auth/refresh',
    payload: { refreshToken: antigo },
  });
  assert.equal(reuso.statusCode, 401);
  const novoRevogado = await app.inject({
    method: 'POST',
    url: '/v1/auth/refresh',
    payload: { refreshToken: refreshNovo },
  });
  assert.equal(novoRevogado.statusCode, 401);
  await app.close();
});

test('logout revoga o refresh token', async () => {
  const { app, fake } = await novoApp();
  const cad = await app.inject({
    method: 'POST',
    url: '/v1/auth/cadastro',
    payload: cadastroValido(fake.convite),
  });
  const refreshToken: string = cad.json().refreshToken;

  const out = await app.inject({
    method: 'POST',
    url: '/v1/auth/logout',
    payload: { refreshToken },
  });
  assert.equal(out.statusCode, 204);
  const depois = await app.inject({
    method: 'POST',
    url: '/v1/auth/refresh',
    payload: { refreshToken },
  });
  assert.equal(depois.statusCode, 401);
  await app.close();
});
