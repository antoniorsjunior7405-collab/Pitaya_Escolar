import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { criarFontesDoDisco, ehFonteDaAplicacao, type Fontes } from './fontes.js';
import { formatarRelatorio, ordenar, quebrar, resumoEtapa } from './relatorio.js';
import { auditarRecuperacao, semComentarios, type Item, type Status } from './requisitos.js';

// ── Base de código em memória ────────────────────────────────────────────────

function fontesEmMemoria(arquivos: Record<string, string>): Fontes {
  const conteudo = new Map(Object.entries(arquivos));
  return {
    arquivos: [...conteudo.keys()].filter(ehFonteDaAplicacao),
    ler: (a) => conteudo.get(a) ?? '',
    local: (a, l) => `${a}:${l}`,
  };
}

/** O backend de hoje, resumido: sem nenhum fluxo de recuperação. */
const BASE: Record<string, string> = {
  'src/config/index.ts': `const schema = z.object({ JWT_SECRET: z.string().min(32) });`,
  'src/db/schema.ts': `export const usuarios = pgTable('usuarios', {
  email: text().notNull().unique(),
  senhaHash: text('senha_hash').notNull(),
});`,
  'src/modules/auth/auth.schemas.ts': `const senha = z.string().min(8).max(128);
export const loginBody = z.object({ email, senha: z.string().min(1) });`,
  'src/modules/auth/auth.routes.ts': `r.post('/login', { config: limiteRigido }, async () => {});
    r.post('/logout', { config: limiteRigido }, async (req, reply) => reply.status(204).send(null));`,
  'src/modules/admin/admin.routes.ts': `r.get('/alunos', async () => []);`,
  'src/modules/admin/admin.schemas.ts': `export const aluno = z.object({ nome: z.string() });`,
};

/** Fluxo implementado seguindo todos os requisitos verificáveis. */
const FLUXO_BOM: Record<string, string> = {
  ...BASE,
  'src/config/index.ts': `const schema = z.object({ JWT_SECRET: z.string(), EMAIL_API_KEY: z.string() });`,
  'src/db/schema.ts': `export const usuarios = pgTable('usuarios', {
  email: text().notNull().unique(),
  emailConfirmadoEm: timestamp('email_confirmado_em'),
});

export const recuperacoesSenha = pgTable(
  'recuperacoes_senha',
  {
    tokenHash: text('token_hash').notNull().unique(),
    expiraEm: timestamp('expira_em').notNull(),
    usadoEm: timestamp('usado_em'),
  },
  (t) => [index('rec_idx').on(t.tokenHash)],
);`,
  'src/modules/auth/auth.schemas.ts': `const senha = z.string().min(8).max(128);
export const esqueciSenhaBody = z.object({ email });
export const redefinirSenhaBody = z.object({ token: z.string().min(20), senha });`,
  'src/modules/auth/auth.routes.ts': `r.post('/login', { config: limiteRigido }, async () => {});
    r.post('/esqueci-senha', { config: limiteRigido, schema: { body: esqueciSenhaBody } }, async (req, reply) => {
      await service.pedirRecuperacao(req.body.email);
      return reply.status(202).send({ mensagem: 'Se o e-mail estiver cadastrado, você receberá um link' });
    });
    r.post('/redefinir-senha', { config: limiteRigido, schema: { body: redefinirSenhaBody } }, async (req, reply) => {
      await service.redefinirSenha(req.body.token, req.body.senha);
      return reply.status(204).send(null);
    });
    r.post('/logout', { config: limiteRigido }, async (req, reply) => reply.status(204).send(null));`,
  'src/modules/auth/recuperacao.service.ts': `import { randomBytes } from 'node:crypto';
export function criarRecuperacaoService(repo) {
  return {
    async pedirRecuperacao(email) {
      const token = randomBytes(32).toString('base64url');
    },
    async redefinirSenha(token, senha) {
      const [r] = await db.update(recuperacoesSenha).set({ usadoEm: new Date() })
        .where(and(eq(recuperacoesSenha.tokenHash, hash), isNull(recuperacoesSenha.usadoEm)))
        .returning();
      await repo.revogarTodosDoUsuario(r.usuarioId);
    },
    async outraCoisa() {},
  };
}`,
};

/** Fluxo implementado com os erros clássicos. */
const FLUXO_RUIM: Record<string, string> = {
  ...FLUXO_BOM,
  'src/config/index.ts': BASE['src/config/index.ts'] ?? '', // sem EMAIL_*
  'src/db/schema.ts': `export const resetSenha = pgTable('reset_senha', {
  token: text().notNull(),
});`,
  'src/modules/auth/auth.schemas.ts': `export const redefinirSenhaBody = z.object({ token: z.string(), novaSenha: z.string().min(4) });`,
  'src/modules/auth/auth.routes.ts': `r.post('/esqueci-senha', async (req, reply) => {
      return reply.status(200).send(await service.pedirRecuperacao(req.body.email));
    });
    r.get('/redefinir-senha', { schema: { querystring: z.object({ token: z.string() }) } }, async () => {});
    r.post('/redefinir-senha', async (req, reply) => reply.status(204).send(null));
    r.post('/logout', { config: limiteRigido }, async (req, reply) => reply.status(204).send(null));`,
  'src/modules/auth/recuperacao.service.ts': `import { randomBytes } from 'node:crypto';
export function criarRecuperacaoService(repo) {
  return {
    async pedirRecuperacao(email) {
      const u = await repo.findByEmail(email);
      if (!u) throw new NotFoundError('E-mail não cadastrado');
      const token = randomBytes(16).toString('hex');
    },
    async redefinirSenha(token, senha) {
      const r = await repo.buscarRecuperacao(token);
      await repo.trocarSenha(r.usuarioId, senha);
    },
    async outraCoisa() {
      await repo.revogarTodosDoUsuario('x');
    },
  };
}`,
};

const statusDe = (itens: Item[]) =>
  Object.fromEntries(itens.map((i) => [i.id, i.status])) as Record<string, Status>;
const auditar = (arquivos: Record<string, string>) =>
  statusDe(auditarRecuperacao(fontesEmMemoria(arquivos)));

// ── Requisitos ───────────────────────────────────────────────────────────────

test('recuperação: sem o fluxo, RA0/RA1 são aviso, RA2 ok e RA3–RA13 pendentes (sem FALHA)', () => {
  const s = auditar(BASE);
  assert.equal(s.RA0, 'AVISO');
  assert.equal(s.RA1, 'AVISO');
  assert.equal(s.RA2, 'OK');
  const pendentes = Object.entries(s).filter(([id]) => Number(id.slice(2)) >= 3);
  assert.equal(pendentes.length, 11);
  for (const [id, status] of pendentes) assert.equal(status, 'PENDENTE', id);
  assert.ok(!Object.values(s).includes('FALHA'));
});

test('recuperação: produz os 14 requisitos RA0–RA13, cada um uma vez', () => {
  const ids = auditarRecuperacao(fontesEmMemoria(BASE)).map((i) => i.id);
  assert.deepEqual(
    ids,
    Array.from({ length: 14 }, (_, n) => `RA${n}`),
  );
});

test('recuperação: fluxo bem implementado → tudo OK, só RA5/RA13 ficam para revisão manual', () => {
  const s = auditar(FLUXO_BOM);
  for (const [id, status] of Object.entries(s)) {
    assert.equal(status, ['RA5', 'RA13'].includes(id) ? 'REVISAR' : 'OK', id);
  }
});

test('recuperação: fluxo com os erros clássicos → FALHA em cada requisito descumprido', () => {
  const s = new Map(Object.entries(auditar(FLUXO_RUIM)));
  for (const id of ['RA3', 'RA4', 'RA6', 'RA7', 'RA8', 'RA9', 'RA10', 'RA11', 'RA12']) {
    assert.equal(s.get(id), 'FALHA', id);
  }
});

test('recuperação: RA11 só aceita a revogação DENTRO da função que redefine a senha', () => {
  // No FLUXO_RUIM, revogarTodosDoUsuario existe, mas em outra função do service.
  assert.equal(auditar(FLUXO_RUIM).RA11, 'FALHA');
});

const serviceChamandoRepo = `export function criarRecuperacaoService(repo) {
  return {
    async redefinirSenha(token, senha) {
      const id = await repo.consumirToken(token);
      await repo.trocarSenhaERevogarSessoes(id, senha);
    },
    async outraCoisa() {},
  };
}`;

test('recuperação: RA11 aceita a revogação feita DENTRO do método do repositório (transação)', () => {
  const s = auditar({
    ...FLUXO_BOM,
    'src/modules/auth/recuperacao.service.ts': serviceChamandoRepo,
    'src/modules/auth/recuperacao.repository.ts': `export function createRecuperacaoRepository(db) {
  return {
    async consumirToken(h) {},
    async trocarSenhaERevogarSessoes(usuarioId, senhaHash) {
      await db.transaction(async (tx) => {
        await tx.update(usuarios).set({ senhaHash });
        await tx.update(refreshTokens).set({ revogadoEm: new Date() });
      });
    },
  };
}`,
  });
  assert.equal(s.RA11, 'OK');
});

test('recuperação: RA11 continua FALHA se o método do repositório chamado não revoga', () => {
  const s = auditar({
    ...FLUXO_BOM,
    'src/modules/auth/recuperacao.service.ts': serviceChamandoRepo,
    'src/modules/auth/recuperacao.repository.ts': `export function createRecuperacaoRepository(db) {
  return {
    async consumirToken(h) {},
    async trocarSenhaERevogarSessoes(usuarioId, senhaHash) {
      await db.update(usuarios).set({ senhaHash });
    },
  };
}`,
  });
  assert.equal(s.RA11, 'FALHA');
});

test('recuperação: RA4 exige rate limit nas DUAS rotas (pedido e redefinição)', () => {
  const rotas = FLUXO_BOM['src/modules/auth/auth.routes.ts'] ?? '';
  const semLimiteNaRedefinicao = rotas.replace(
    "r.post('/redefinir-senha', { config: limiteRigido,",
    "r.post('/redefinir-senha', {",
  );
  assert.equal(
    auditar({ ...FLUXO_BOM, 'src/modules/auth/auth.routes.ts': semLimiteNaRedefinicao }).RA4,
    'FALHA',
  );
});

test('recuperação: RA12 aceita `novaSenha: senha` além da forma abreviada', () => {
  const schemas = `const senha = z.string().min(8);
export const redefinirSenhaBody = z.object({ token: z.string(), novaSenha: senha });`;
  assert.equal(auditar({ ...FLUXO_BOM, 'src/modules/auth/auth.schemas.ts': schemas }).RA12, 'OK');
});

// ── Regressões dos bugs do patch original ────────────────────────────────────

test('regressão: arquivos de src/scripts (ex.: "Viagem esquecida") não entram na auditoria', () => {
  assert.equal(ehFonteDaAplicacao('src/scripts/auditoria/verificar-banco.ts'), false);
  assert.equal(ehFonteDaAplicacao('src/modules/auth/auth.test.ts'), false);
  assert.equal(ehFonteDaAplicacao('src/modules/auth/auth.service.ts'), true);

  const comScript = {
    ...BASE,
    'src/scripts/auditoria/verificar-banco.ts': `item: 'Viagem esquecida em andamento', r.post('/reset-x')`,
  };
  assert.equal(auditar(comScript).RA0, 'AVISO');
});

test('regressão: comentário citando "senha" no admin NÃO é falha; campo de senha é', () => {
  const comComentario = {
    ...BASE,
    'src/modules/admin/admin.routes.ts': `// O responsável define a própria senha no app.\nr.get('/alunos', async () => []);`,
  };
  assert.equal(auditar(comComentario).RA2, 'OK');

  const comCampo = {
    ...BASE,
    'src/modules/admin/admin.schemas.ts': `export const definirAcesso = z.object({ novaSenha: z.string() });`,
  };
  assert.equal(auditar(comCampo).RA2, 'FALHA');
});

test('regressão: RA3 não é satisfeito pelo 204 do logout no mesmo arquivo', () => {
  // FLUXO_RUIM: o pedido responde 200, e o logout (mesmo arquivo) responde 204.
  assert.equal(auditar(FLUXO_RUIM).RA3, 'FALHA');
});

test('regressão: RA12 aceita a forma abreviada `{ token, senha }` (estilo do cadastroBody)', () => {
  assert.equal(auditar(FLUXO_BOM).RA12, 'OK');
});

test('regressão: RA7 reconhece tabela com índices (termina em `);` e não em `});`)', () => {
  assert.equal(auditar(FLUXO_BOM).RA7, 'OK');
});

test('semComentarios mantém as linhas no lugar (os locais arquivo:linha continuam certos)', () => {
  const texto = 'a\n// comentário com senha\n/* bloco\n reset */\nb';
  const limpo = semComentarios(texto);
  assert.equal(limpo.split('\n').length, texto.split('\n').length);
  assert.equal(limpo.length, texto.length);
  assert.doesNotMatch(limpo, /senha|reset/);
});

test('locais apontam a linha certa da rota encontrada', () => {
  const ra0 = auditarRecuperacao(fontesEmMemoria(FLUXO_BOM)).find((i) => i.id === 'RA0');
  assert.deepEqual(ra0?.locais, ['src/modules/auth/auth.routes.ts:2']);
});

// ── Código real ──────────────────────────────────────────────────────────────

test('código real: o fluxo implementado cumpre todos os requisitos verificáveis', () => {
  const raiz = path.resolve(import.meta.dirname, '../../..');
  const fontes = criarFontesDoDisco(raiz, raiz);
  assert.ok(fontes.arquivos.includes('src/modules/auth/recuperacao.service.ts'));
  assert.ok(fontes.arquivos.every((a) => !a.startsWith('src/scripts/') && !a.endsWith('.test.ts')));

  // RA1 (confirmar e-mail no cadastro) é pré-requisito ainda em aberto; RA5 e RA13 só dá
  // para conferir à mão (cobertos pelos testes de recuperacao.test.ts do módulo auth).
  const esperado = new Map<string, Status>([
    ['RA1', 'AVISO'],
    ['RA5', 'REVISAR'],
    ['RA13', 'REVISAR'],
  ]);
  for (const item of auditarRecuperacao(fontes)) {
    assert.equal(item.status, esperado.get(item.id) ?? 'OK', `${item.id}: ${item.titulo}`);
  }
});

// ── Relatório ────────────────────────────────────────────────────────────────

const itensBase = () => auditarRecuperacao(fontesEmMemoria(BASE));

test('relatório: --curto tem exatamente uma linha por requisito e nenhuma explicação', () => {
  const texto = formatarRelatorio(itensBase(), { curto: true, cor: false, largura: 100 });
  const linhasDeItem = texto.split('\n').filter((l) => /^\s{2}\S+ \S+\s+RA\d+/.test(l));
  assert.equal(linhasDeItem.length, 14);
  assert.doesNotMatch(texto, /Por quê:|Corrigir:/);
});

test('relatório: completo traz Por quê/Corrigir e o resumo com as contagens', () => {
  const texto = formatarRelatorio(itensBase(), { curto: false, cor: false, largura: 100 });
  assert.match(texto, /Por quê:/);
  assert.match(texto, /Corrigir:/);
  assert.match(texto, /✔ 1 OK {3}✖ 0 falhas {3}▲ 2 avisos {3}\? 0 a revisar {3}○ 11 pendentes/);
  assert.match(texto, /o fluxo ainda NÃO existe/);
});

test('relatório: sem cor não emite códigos ANSI; com cor emite', () => {
  const semCor = formatarRelatorio(itensBase(), { curto: true, cor: false, largura: 80 });
  const comCor = formatarRelatorio(itensBase(), { curto: true, cor: true, largura: 80 });
  const ANSI = '\u001b[';
  assert.ok(!semCor.includes(ANSI));
  assert.ok(comCor.includes(ANSI));
});

test('relatório: nenhuma linha passa da largura pedida (sem cor)', () => {
  const largura = 80;
  const texto = formatarRelatorio(itensBase(), { curto: false, cor: false, largura });
  // O diagrama tem linhas fixas mais largas; as explicações quebradas é que precisam caber.
  const explicacoes = texto.split('\n').filter((l) => l.startsWith(' '.repeat(14)));
  for (const l of explicacoes) assert.ok(l.length <= largura, `linha com ${l.length}: ${l}`);
});

test('quebrar: respeita a largura e alinha as continuações sob o rótulo', () => {
  const linhas = quebrar('um dois três quatro cinco seis sete oito', 30, 4, 'Por quê:  ');
  assert.ok(linhas.length > 1);
  assert.ok(linhas.every((l) => l.length <= 30));
  assert.ok(linhas[0]?.startsWith('    Por quê:  um'));
  assert.ok(linhas[1]?.startsWith(' '.repeat(4 + 'Por quê:  '.length)));
});

test('resumoEtapa e ordenar: o pior status vem primeiro', () => {
  const itens = auditarRecuperacao(fontesEmMemoria(FLUXO_RUIM));
  assert.equal(resumoEtapa(itens, 'token'), 'FALHA');
  const ordenados = [...itens].sort(ordenar);
  assert.equal(ordenados[0]?.status, 'FALHA');
  assert.equal(ordenados[0]?.severidade, 'alta');
  assert.equal(ordenados.at(-1)?.status === 'FALHA', false);
});
