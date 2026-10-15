import type { Fontes } from './fontes.js';

// Requisitos da recuperação de acesso ("esqueci a senha"), baseados no OWASP Forgot Password
// Cheat Sheet. Enquanto o fluxo não existe, aparecem como PENDENTE (o que a implementação
// precisa ter). Quando surgir uma rota de recuperação, passam a ser conferidos no código:
// OK se o padrão esperado está lá, FALHA se não está, REVISAR se só dá para conferir à mão.
// É uma checagem ESTÁTICA por padrões: não substitui testes nem revisão humana.

/**
 * OK = cumprido · FALHA = descumprido no código · AVISO = risco a resolver
 * · REVISAR = só dá para conferir à mão · PENDENTE = o fluxo ainda não existe.
 */
export type Status = 'OK' | 'FALHA' | 'AVISO' | 'REVISAR' | 'PENDENTE';
export type Severidade = 'alta' | 'média' | 'baixa';

/** Em que parte da arquitetura do fluxo o requisito mora. */
export const ETAPAS = [
  { id: 'pre', nome: 'Pré-requisitos', resumo: 'o que precisa existir antes do fluxo' },
  { id: 'pedido', nome: '① Pedido', resumo: 'POST /v1/auth/esqueci-senha' },
  { id: 'token', nome: '② Token', resumo: 'geração e armazenamento' },
  { id: 'email', nome: '③ E-mail', resumo: 'envio do link' },
  { id: 'redefinicao', nome: '④⑤ Redefinição', resumo: 'POST /v1/auth/redefinir-senha' },
] as const;

export type IdEtapa = (typeof ETAPAS)[number]['id'];

export type Item = {
  id: string;
  etapa: IdEtapa;
  titulo: string;
  status: Status;
  severidade: Severidade;
  locais: string[];
  porque: string;
  corrigir?: string;
};

export const ARQUIVOS = {
  config: 'src/config/index.ts',
  schema: 'src/db/schema.ts',
  authSchemas: 'src/modules/auth/auth.schemas.ts',
  adminRoutes: 'src/modules/admin/admin.routes.ts',
  adminSchemas: 'src/modules/admin/admin.schemas.ts',
} as const;

const PALAVRAS_DO_FLUXO = /esqueci|recupera|redefin|reset|forgot/i;
const ROTA_DO_FLUXO = /\.(?:post|put|get)\(\s*'[^']*(?:esqueci|recuper|redefin|reset|forgot)/i;
const ROTA_PEDIDO = /\.post\(\s*'[^']*(?:esqueci|recuper|forgot)[^']*'/i;
const ROTA_REDEFINIR = /\.post\(\s*'[^']*(?:redefin|reset)[^']*'/i;
/** Início da próxima rota: fecha o bloco da rota anterior. */
const PROXIMA_ROTA = /\n\s*\w+\.(?:post|put|get|patch|delete)\(/;
const COM_RATE_LIMIT = /config:\s*(?:limiteRigido|\{\s*rateLimit)/;

/**
 * Troca comentários por espaços do mesmo tamanho (mantém as quebras de linha, então os
 * números de linha não mudam). Assim um comentário que cita "senha" ou "reset" não conta
 * como código.
 */
export function semComentarios(texto: string): string {
  return texto.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (c) => c.replace(/[^\n]/g, ' '));
}

const linhaDoIndice = (texto: string, indice: number) => texto.slice(0, indice).split('\n').length;

/** Métodos `async nome(...)` de um objeto/serviço, cada um com o corpo até o próximo. */
export function metodosDe(texto: string): { nome: string; corpo: string }[] {
  const inicios = [...texto.matchAll(/\n {2,}async (\w+)\(/g)];
  return inicios.map((m, i) => ({
    nome: m[1] ?? '',
    corpo: texto.slice(m.index, inicios[i + 1]?.index ?? texto.length),
  }));
}

type Trecho = { corpo: string; arquivo: string; linha: number };

/** Lê o código sem comentários e localiza padrões com "arquivo:linha". */
function criarBusca(f: Fontes) {
  const codigo = (arquivo: string) => semComentarios(f.ler(arquivo));

  function achar(arquivo: string, padrao: RegExp): string | undefined {
    const texto = codigo(arquivo);
    const m = padrao.exec(texto);
    return m ? f.local(arquivo, linhaDoIndice(texto, m.index)) : undefined;
  }

  /** Trecho entre `inicio` e o próximo `fim` (ex.: o bloco de uma rota ou função). */
  function trecho(arquivo: string, inicio: RegExp, fim: RegExp): Trecho | undefined {
    const texto = codigo(arquivo);
    const a = inicio.exec(texto);
    if (!a) return undefined;
    const resto = texto.slice(a.index);
    const b = fim.exec(resto.slice(a[0].length));
    const corpo = b ? resto.slice(0, a[0].length + b.index) : resto;
    return { corpo, arquivo, linha: linhaDoIndice(texto, a.index) };
  }

  return { codigo, achar, trecho };
}

/** Audita a recuperação de acesso no código recebido. Função pura (sem disco, sem console). */
export function auditarRecuperacao(f: Fontes): Item[] {
  const { codigo, achar, trecho } = criarBusca(f);
  const itens: Item[] = [];
  const registrar = (item: Omit<Item, 'locais'> & { locais?: (string | undefined)[] }) =>
    itens.push({ ...item, locais: (item.locais ?? []).filter((l): l is string => !!l) });

  // ── O fluxo já existe? ─────────────────────────────────────────────────────
  const rotas = f.arquivos.flatMap((a) => achar(a, ROTA_DO_FLUXO) ?? []);
  const existe = rotas.length > 0;
  const arquivosDoFluxo = f.arquivos.filter((a) => PALAVRAS_DO_FLUXO.test(codigo(a)));
  const textoDoFluxo = arquivosDoFluxo.map(codigo).join('\n');
  const acharNoFluxo = (p: RegExp) =>
    arquivosDoFluxo.map((a) => achar(a, p)).find((l) => l !== undefined);
  const trechoNoFluxo = (inicio: RegExp, fim: RegExp) =>
    arquivosDoFluxo.map((a) => trecho(a, inicio, fim)).find((t) => t !== undefined);
  const localDe = (t: Trecho) => f.local(t.arquivo, t.linha);

  const rotaPedido = trechoNoFluxo(ROTA_PEDIDO, PROXIMA_ROTA);
  const rotaRedefinir = trechoNoFluxo(ROTA_REDEFINIR, PROXIMA_ROTA);
  /** Corpo da função que redefine a senha (não confunde com outras funções do service). */
  const funcaoRedefinir = trechoNoFluxo(/async \w*[Rr]edefin\w*\(/, /\n {2,}async \w+\(/);

  /** Requisito que só dá para conferir depois que o fluxo existir. */
  function requisito(
    item: Omit<Item, 'status' | 'locais'>,
    conferir?: () => { ok: boolean; onde?: string | undefined } | undefined,
  ) {
    const r = existe ? conferir?.() : undefined;
    registrar({
      ...item,
      status: !existe ? 'PENDENTE' : !r ? 'REVISAR' : r.ok ? 'OK' : 'FALHA',
      locais: [r?.onde],
      porque:
        existe && !r
          ? `${item.porque} (Conferir à mão: não dá para checar por padrão.)`
          : item.porque,
    });
  }

  // ── Pré-requisitos ─────────────────────────────────────────────────────────

  registrar({
    id: 'RA0',
    etapa: 'pre',
    titulo: 'Fluxo "esqueci a senha" implementado',
    status: existe ? 'OK' : 'AVISO',
    severidade: 'média',
    locais: rotas,
    porque:
      'Não existe rota de recuperação. Sem ela, quem esquece a senha depende de alguém alterar o banco à mão ou de uma senha nova enviada por mensagem, e essas saídas manuais são menos seguras do que o fluxo automático.',
    corrigir:
      'Implementar o fluxo desenhado acima, cumprindo os requisitos RA1–RA13, com testes para cada um.',
  });

  const confirmado = /email_?(verificado|confirmado)|emailConfirmadoEm|emailVerificadoEm/i.test(
    codigo(ARQUIVOS.schema),
  );
  registrar({
    id: 'RA1',
    etapa: 'pre',
    titulo: 'E-mail confirmado no cadastro',
    status: confirmado ? 'OK' : 'AVISO',
    severidade: 'alta',
    locais: [achar(ARQUIVOS.schema, /email: text\(\)/)],
    porque: confirmado
      ? 'O schema registra a confirmação do e-mail.'
      : 'Hoje qualquer e-mail é aceito no cadastro sem confirmação. Se alguém digitar um e-mail errado (ou de outra pessoa), o link de recuperação vai para esse dono do e-mail, que assume a conta e passa a ver o status e a localização das crianças vinculadas.',
    corrigir:
      'Coluna `email_confirmado_em` em `usuarios`, e-mail de confirmação no cadastro e recuperação só para e-mails confirmados.',
  });

  // Só código (sem comentários): um comentário citando "senha" não é manipulação de senha.
  const senhaNoAdmin =
    achar(ARQUIVOS.adminRoutes, /senha/i) ?? achar(ARQUIVOS.adminSchemas, /senha/i);
  registrar({
    id: 'RA2',
    etapa: 'pre',
    titulo: 'Admin não define nem vê a senha de outra pessoa',
    status: senhaNoAdmin ? 'FALHA' : 'OK',
    severidade: 'alta',
    locais: [senhaNoAdmin ?? ARQUIVOS.adminRoutes],
    porque: senhaNoAdmin
      ? 'A área do admin manipula senha. Se o admin "reseta" a senha de um responsável e repassa por mensagem, a senha fica exposta e a escola passa a ter acesso à conta da família.'
      : 'Nenhuma rota do admin recebe ou devolve senha. Se for preciso ajudar alguém que perdeu o acesso, o admin só deve DISPARAR o e-mail de recuperação, nunca definir a senha.',
    corrigir: 'Rota do admin que apenas dispara o e-mail de recuperação para o usuário.',
  });

  // ── ① Pedido ───────────────────────────────────────────────────────────────

  requisito(
    {
      id: 'RA3',
      etapa: 'pedido',
      titulo: 'Mesma resposta para e-mail cadastrado ou não',
      severidade: 'alta',
      porque:
        'Se o pedido responder "e-mail não encontrado", a tela de recuperação vira um jeito de descobrir quem tem conta (enumeração de contas, que o login já evita respondendo igual para e-mail inexistente e senha errada).',
      corrigir:
        'Sempre 202 com a mesma mensagem ("se o e-mail estiver cadastrado, você receberá um link"), e gastar um tempo parecido nos dois casos.',
    },
    () =>
      rotaPedido && {
        // O 202 tem de estar NA rota do pedido (o 204 do logout no mesmo arquivo não conta).
        ok:
          /status\(202\)/.test(rotaPedido.corpo) &&
          !/NotFoundError\([^)]*e-?mail/i.test(textoDoFluxo),
        onde: localDe(rotaPedido),
      },
  );
  requisito(
    {
      id: 'RA4',
      etapa: 'pedido',
      titulo: 'Rate limit próprio no pedido e na redefinição',
      severidade: 'média',
      porque:
        'Sem limite, o pedido vira um jeito de mandar spam de e-mail para qualquer endereço, e a redefinição vira alvo de força bruta no token.',
      corrigir:
        'Usar o `limiteRigido` das rotas de auth (10/min por IP) nas DUAS rotas e também limitar pedidos por e-mail (ex.: 3 por hora).',
    },
    () => {
      if (!rotaPedido || !rotaRedefinir) return undefined;
      const semLimite = [rotaPedido, rotaRedefinir].find((r) => !COM_RATE_LIMIT.test(r.corpo));
      return { ok: !semLimite, onde: localDe(semLimite ?? rotaPedido) };
    },
  );
  requisito({
    id: 'RA5',
    etapa: 'pedido',
    titulo: 'Um novo pedido invalida os pedidos anteriores',
    severidade: 'baixa',
    porque:
      'Vários links válidos ao mesmo tempo aumentam a chance de um deles vazar (e-mail encaminhado, caixa compartilhada).',
    corrigir: 'Ao criar um pedido novo, marcar os anteriores do mesmo usuário como usados.',
  });

  // ── ② Token ────────────────────────────────────────────────────────────────

  requisito(
    {
      id: 'RA6',
      etapa: 'token',
      titulo: 'Token aleatório e longo (32+ bytes)',
      severidade: 'alta',
      porque:
        'Um token curto ou previsível (ex.: código de 4 dígitos sem limite de tentativas) pode ser adivinhado.',
      corrigir:
        'randomBytes(32).toString("base64url"), igual ao refresh token. Se usar código numérico de 6 dígitos, limitar a 5 tentativas por pedido.',
    },
    () => {
      const m = /randomBytes\((\d+)\)/.exec(textoDoFluxo);
      if (!m?.[1]) return undefined;
      return { ok: Number(m[1]) >= 32, onde: acharNoFluxo(/randomBytes\(/) };
    },
  );
  requisito(
    {
      id: 'RA7',
      etapa: 'token',
      titulo: 'No banco fica só o hash do token, com validade curta',
      severidade: 'alta',
      porque:
        'Quem ler a tabela (backup vazado, acesso indevido) não pode usar os tokens. Um token que vale dias fica tempo demais esperando numa caixa de e-mail.',
      corrigir:
        'Tabela própria (ex.: `recuperacoes_senha`) com token_hash (SHA-256), expira_em (≤ 30 min), usado_em e criado_em.',
    },
    () => {
      // Fim da definição: `});` (tabela simples) ou `);` (tabela com índices em callback).
      const tabela = trecho(ARQUIVOS.schema, /(?:recupera|reset)\w*\s*=\s*pgTable\(/i, /\n\}?\);/);
      if (!tabela) return undefined;
      return {
        ok: /tokenHash/.test(tabela.corpo) && /expira/i.test(tabela.corpo),
        onde: localDe(tabela),
      };
    },
  );

  // ── ③ E-mail ───────────────────────────────────────────────────────────────

  requisito(
    {
      id: 'RA8',
      etapa: 'email',
      titulo: 'Credenciais do provedor de e-mail só em variável de ambiente',
      severidade: 'média',
      porque:
        'A chave do provedor de e-mail (SMTP, Resend etc.) dá poder de mandar e-mail em nome do Pitaya: não pode ficar no código nem no repositório.',
      corrigir:
        'Validar EMAIL_* no config/index.ts (como o JWT_SECRET) e cadastrar o valor só no painel do Render.',
    },
    () => {
      const onde = achar(ARQUIVOS.config, /SMTP_|EMAIL_|RESEND_|SENDGRID_|POSTMARK_/);
      return { ok: onde !== undefined, onde };
    },
  );
  requisito(
    {
      id: 'RA9',
      etapa: 'email',
      titulo: 'Token só no corpo do POST, nunca em query string da API',
      severidade: 'média',
      porque:
        'Token em URL de API (GET /redefinir?token=...) aparece em logs de proxy e no histórico. No app, o link do e-mail abre a tela, e a tela manda o token no corpo.',
      corrigir:
        'Deep link do app (pitayaescolar://redefinir#token=...) e POST /v1/auth/redefinir-senha com { token, novaSenha }.',
    },
    () => {
      const naUrl = acharNoFluxo(
        /querystring:[\s\S]{0,120}token|\.get\(\s*'[^']*(?:redefin|reset)/i,
      );
      return { ok: !naUrl, onde: naUrl ?? rotas[0] };
    },
  );

  // ── ④⑤ Redefinição ─────────────────────────────────────────────────────────

  requisito(
    {
      id: 'RA10',
      etapa: 'redefinicao',
      titulo: 'Token de uso único, consumido de forma atômica',
      severidade: 'alta',
      porque:
        'Se o código conferir "ainda não foi usado" e só depois marcar como usado, duas requisições simultâneas usam o mesmo token (a mesma corrida que a rotação do refresh token já trata).',
      corrigir:
        'UPDATE recuperacoes_senha SET usado_em = now() WHERE token_hash = $1 AND usado_em IS NULL AND expira_em > now() RETURNING usuario_id. Se voltar 0 linhas, o token é inválido.',
    },
    () => {
      const onde = acharNoFluxo(/isNull\(\w+\.usadoEm\)|usado_em IS NULL/i);
      return { ok: onde !== undefined && /\.returning\(|RETURNING/i.test(textoDoFluxo), onde };
    },
  );
  requisito(
    {
      id: 'RA11',
      etapa: 'redefinicao',
      titulo: 'Redefinir a senha derruba todas as sessões',
      severidade: 'alta',
      porque:
        'Se a conta foi invadida, o invasor continua logado com o refresh token dele (que vale 30 dias) mesmo depois da troca de senha.',
      corrigir:
        'Na mesma transação da troca de senha: revogarTodosDoUsuario(usuarioId) e limparFalhasLogin(usuarioId).',
    },
    () => {
      if (!funcaoRedefinir) return undefined;
      // Vale chamar revogarTodosDoUsuario() direto OU um método do repositório que revoga as
      // sessões por dentro (o recomendado: na mesma transação da troca de senha).
      const chamados = new Set(
        [...funcaoRedefinir.corpo.matchAll(/repo\.(\w+)\(/g)].map((m) => m[1]),
      );
      const revogaPorDentro = arquivosDoFluxo.some((a) =>
        metodosDe(codigo(a)).some(
          (m) => chamados.has(m.nome) && /refreshTokens[\s\S]*revogadoEm/.test(m.corpo),
        ),
      );
      return {
        ok: /revogarTodosDoUsuario\(/.test(funcaoRedefinir.corpo) || revogaPorDentro,
        onde: localDe(funcaoRedefinir),
      };
    },
  );
  requisito(
    {
      id: 'RA12',
      etapa: 'redefinicao',
      titulo: 'Nova senha segue a mesma regra do cadastro',
      severidade: 'média',
      porque:
        'Sem isso, o fluxo de recuperação aceita senhas que o cadastro recusaria (ex.: com menos de 8 caracteres).',
      corrigir: 'Reaproveitar a constante `senha` de auth.schemas.ts no corpo da redefinição.',
    },
    () => {
      const corpo = trecho(ARQUIVOS.authSchemas, /\w*[Rr]edefin\w*\s*=\s*z\.object\(\{/, /\}\)/);
      if (!corpo) return undefined;
      // Aceita `novaSenha: senha` e a forma abreviada `{ token, senha }` (estilo do cadastroBody).
      return {
        ok: /:\s*senha\b|[{,]\s*senha\s*[,}]/.test(`${corpo.corpo}})`),
        onde: localDe(corpo),
      };
    },
  );
  requisito({
    id: 'RA13',
    etapa: 'redefinicao',
    titulo: 'Aviso por e-mail quando a senha é alterada',
    severidade: 'média',
    porque: 'Se outra pessoa redefinir a senha, o dono da conta precisa saber na hora para reagir.',
    corrigir:
      'Depois de redefinir, enviar "sua senha foi alterada; se não foi você, fale com o suporte".',
  });

  return itens;
}
