import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

// Auditoria de "Busca de motoristas" (com a tela de espera pelo status), para ler no terminal.
//
// Mostra a arquitetura recomendada para o responsável encontrar um motorista, pedir o vínculo
// e ESPERAR a resposta numa tela própria, e confere cada requisito de segurança, privacidade e
// experiência no código do backend E do app. Enquanto uma etapa não existe, os requisitos dela
// aparecem como PENDENTE (o que a implementação precisa ter). Quando ela surgir, os mesmos itens
// passam a ser conferidos: OK se o padrão esperado está no código, FALHA se não está, REVISAR se
// só dá para conferir à mão. Alguns pré-requisitos já são conferidos hoje.
//
// É uma checagem ESTÁTICA: lê os arquivos e procura padrões. Não precisa de .env nem de banco.
//
// Uso: npm run audit:busca-motorista             (relatório completo)
//      npm run audit:busca-motorista -- --curto  (só uma linha por item)
//
// Código de saída: 1 se houver algum item com FALHA, 0 caso contrário.

const { values: opcoes } = parseArgs({
  options: {
    curto: { type: 'boolean', default: false },
    'sem-cor': { type: 'boolean', default: false },
  },
});

// ── Leitura dos arquivos ─────────────────────────────────────────────────────

/** Raiz do repositório: os caminhos abaixo começam com backend/ ou frontend/. */
const RAIZ = path.resolve(import.meta.dirname, '../../..');
const cache = new Map<string, string>();

/** Conteúdo de um arquivo do repositório (caminho relativo à raiz). '' se não existir. */
function ler(arquivo: string): string {
  const salvo = cache.get(arquivo);
  if (salvo !== undefined) return salvo;
  let texto: string;
  try {
    // Caminhos vêm só das constantes deste script e da listagem das pastas src/.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    texto = readFileSync(path.join(RAIZ, arquivo), 'utf8');
  } catch {
    texto = '';
  }
  cache.set(arquivo, texto);
  return texto;
}

/** Todos os .ts/.tsx da pasta (sem testes e sem os scripts de auditoria, que citam os padrões). */
function arquivosFonte(dir: string): string[] {
  let entradas;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    entradas = readdirSync(path.join(RAIZ, dir), { withFileTypes: true });
  } catch {
    return [];
  }
  return entradas.flatMap((e) => {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) return arquivosFonte(rel);
    const ignorar = /\.test\.tsx?$/.test(e.name) || e.name.startsWith('auditoria-');
    return /\.tsx?$/.test(e.name) && !ignorar ? [rel] : [];
  });
}

/** "arquivo:linha" relativo à pasta onde o comando rodou: o VS Code transforma em link. */
function local(arquivo: string, linha: number): string {
  return `${path.relative(process.cwd(), path.join(RAIZ, arquivo))}:${linha}`;
}

const linhaDoIndice = (texto: string, indice: number) => texto.slice(0, indice).split('\n').length;

/** Primeira ocorrência do padrão no arquivo, como "arquivo:linha". */
function achar(arquivo: string, padrao: RegExp): string | undefined {
  const texto = ler(arquivo);
  const m = padrao.exec(texto);
  return m ? local(arquivo, linhaDoIndice(texto, m.index)) : undefined;
}

/** Trecho do arquivo entre dois padrões (ex.: uma tabela do schema), com a linha inicial. */
function trecho(arquivo: string, inicio: RegExp, fim: RegExp) {
  const texto = ler(arquivo);
  const a = inicio.exec(texto);
  if (!a) return undefined;
  const resto = texto.slice(a.index);
  const b = fim.exec(resto.slice(a[0].length));
  const corpo = b ? resto.slice(0, a[0].length + b.index) : resto;
  return { corpo, arquivo, linhaInicial: linhaDoIndice(texto, a.index) };
}

const F = {
  schema: 'backend/src/db/schema.ts',
  responsavelRoutes: 'backend/src/modules/responsavel/responsavel.routes.ts',
} as const;

const backend = arquivosFonte('backend/src');
const telas = arquivosFonte('frontend/src/app');
const textoBackend = backend.map(ler).join('\n');

// ── Modelo do relatório ──────────────────────────────────────────────────────

/**
 * OK = requisito cumprido · FALHA = requisito descumprido no código · AVISO = risco a resolver
 * · REVISAR = só dá para conferir à mão · PENDENTE = a etapa ainda não existe.
 */
type Status = 'OK' | 'FALHA' | 'AVISO' | 'REVISAR' | 'PENDENTE';
type Severidade = 'alta' | 'média' | 'baixa';

/** Em que parte da arquitetura do fluxo o requisito mora. */
const ETAPAS = [
  { id: 'pre', nome: 'Pré-requisitos', resumo: 'quem pode aparecer na busca e o que se mostra' },
  { id: 'busca', nome: '① Busca', resumo: 'GET /v1/responsavel/motoristas' },
  { id: 'pedido', nome: '② Pedido de vínculo', resumo: 'POST /v1/responsavel/solicitacoes' },
  {
    id: 'espera',
    nome: '③ Tela de espera',
    resumo: '"Aguardando o motorista" · GET /v1/responsavel/solicitacoes/:id',
  },
  { id: 'resposta', nome: '④ Resposta do motorista', resumo: 'aceitar ou recusar' },
] as const;

type IdEtapa = (typeof ETAPAS)[number]['id'];

type Item = {
  id: string;
  etapa: IdEtapa;
  titulo: string;
  status: Status;
  severidade: Severidade;
  locais?: (string | undefined)[];
  porque: string;
  corrigir?: string;
};

const itens: Item[] = [];
const registrar = (item: Item) => itens.push(item);

// ── O que já existe? ─────────────────────────────────────────────────────────

type Rota = { arquivo: string; metodo: string; caminho: string; onde: string; declaracao: string };

/** Rotas do backend (qualquer método) cujo caminho casa com o padrão. */
function rotas(caminho: RegExp): Rota[] {
  return backend.flatMap((arquivo) => {
    const texto = ler(arquivo);
    const achadas: Rota[] = [];
    const busca = /\.(get|post|put|patch|delete)\(\s*'([^']*)'/g;
    for (let m = busca.exec(texto); m; m = busca.exec(texto)) {
      if (!m[1] || !m[2] || !caminho.test(m[2])) continue;
      achadas.push({
        arquivo,
        metodo: m[1],
        caminho: m[2],
        onde: local(arquivo, linhaDoIndice(texto, m.index)),
        // Opções da rota (schema, config) vêm logo depois do caminho.
        declaracao: texto.slice(m.index, m.index + 500),
      });
    }
    return achadas;
  });
}

const rotaBusca = rotas(/^\/motoristas\b/).find((r) => r.metodo === 'get');
const rotasSolicitacao = rotas(/^\/solicitac/);
const rotaPedido = rotasSolicitacao.find((r) => r.metodo === 'post' && !r.caminho.includes(':'));
const rotaStatus = rotasSolicitacao.find((r) => r.metodo === 'get' && r.caminho.includes(':'));
const rotasResposta = rotasSolicitacao.filter((r) => /aceit|recus/.test(r.caminho));
/** Tela do app na área do responsável que acompanha o pedido (a que consulta o status). */
const tela = telas.find(
  (a) =>
    /\/responsavel\/.*(solicita|aguard|espera|pedido)/i.test(a) && /refetchInterval/.test(ler(a)),
);
/** Componentes que a tela importa de @/components entram na conferência (textos, região ao vivo). */
function comComponentes(arquivo: string) {
  const texto = ler(arquivo);
  const importados = [...texto.matchAll(/from '@\/components\/([\w/-]+)'/g)].map((m) =>
    ler(`frontend/src/components/${m[1] ?? ''}.tsx`),
  );
  return [texto, ...importados].join('\n');
}
const textoTela = tela ? comComponentes(tela) : '';
const tabelaSolicitacoes = trecho(F.schema, /export const solicitac\w* = /, /\nexport const /);

const existeBusca = rotaBusca !== undefined;
const existePedido = rotaPedido !== undefined;
const existeTela = tela !== undefined;
const existeResposta = rotasResposta.length > 0;

/** Schema Zod (z.object) que começa no padrão dado, procurado no backend. */
function schemaZod(padrao: RegExp) {
  for (const arquivo of backend) {
    const texto = ler(arquivo);
    const inicio = padrao.exec(texto);
    if (!inicio) continue;
    const fim = texto.indexOf('\n});', inicio.index);
    return {
      corpo: texto.slice(inicio.index, fim === -1 ? undefined : fim),
      onde: local(arquivo, linhaDoIndice(texto, inicio.index)),
    };
  }
  return undefined;
}

const queryBusca = schemaZod(
  /export const (?:busca|buscar)\w*Query\s*=\s*z\s*\.(?:strictObject|object)\(\{/,
);
const respostaBusca = schemaZod(/export const motorista\w*Publico\w*\s*=\s*z\.object\(\{/);

/** Requisito que só dá para conferir depois que a etapa existir. */
function requisito(
  existe: boolean,
  item: Omit<Item, 'status' | 'locais'>,
  conferir?: () => { ok: boolean; onde?: string | undefined } | undefined,
) {
  const r = existe ? conferir?.() : undefined;
  registrar({
    ...item,
    status: !existe ? 'PENDENTE' : !r ? 'REVISAR' : r.ok ? 'OK' : 'FALHA',
    locais: r?.onde ? [r.onde] : [],
    porque:
      existe && !conferir
        ? `${item.porque} (Conferir à mão: não dá para checar por padrão.)`
        : item.porque,
  });
}

// ── Pré-requisitos ───────────────────────────────────────────────────────────

registrar({
  id: 'BM0',
  etapa: 'pre',
  titulo: 'Responsável consegue buscar motoristas e pedir o vínculo',
  status: existeBusca && existePedido ? 'OK' : 'AVISO',
  severidade: 'média',
  locais: [rotaBusca?.onde, rotaPedido?.onde],
  porque:
    'O documento de atualização (seções 4 e 5.1) pede que o responsável "pesquise a lista de condutores" e "envie uma solicitação de vínculo" ao motorista com quem já combinou o transporte.',
  corrigir:
    'Implementar a busca e o pedido em rotas com o hook exigirPapel(RESPONSAVEL) e a tela de espera no app, cumprindo BM1–BM22, com testes de acesso indevido.',
});

{
  // Onde a busca mora (ou vai morar): o arquivo de rotas dela precisa ter o hook de papel.
  const arquivoRotas = rotaBusca?.arquivo ?? F.responsavelRoutes;
  const hook = achar(arquivoRotas, /addHook\('preHandler', exigirPapel\('RESPONSAVEL'\)\)/);
  registrar({
    id: 'BM1',
    etapa: 'pre',
    titulo: 'Rotas da busca e do pedido exigem login e papel RESPONSAVEL',
    status: hook ? 'OK' : 'FALHA',
    severidade: 'alta',
    locais: [hook ?? arquivoRotas],
    porque: hook
      ? 'Criando a busca e o pedido AQUI, eles já nascem protegidos: sem login responde 401 e outro papel responde 403. A lista de motoristas nunca fica aberta na internet.'
      : 'O arquivo de rotas da busca não tem o hook exigirPapel: a busca ficaria acessível a qualquer usuário logado.',
    corrigir: "app.addHook('preHandler', exigirPapel('RESPONSAVEL')) no escopo do módulo.",
  });
}

{
  const membros = trecho(F.schema, /export const membros = /, /\nexport const /);
  const perfis = trecho(F.schema, /export const perfisMotorista = /, /\nexport const /);
  const aprovacao = /aprovad|validad/i.test((membros?.corpo ?? '') + (perfis?.corpo ?? ''));
  registrar({
    id: 'BM2',
    etapa: 'pre',
    titulo: 'Só motorista APROVADO aparece na busca',
    status: aprovacao ? 'OK' : 'AVISO',
    severidade: 'alta',
    locais: [perfis && local(perfis.arquivo, perfis.linhaInicial)],
    porque:
      'Hoje qualquer pessoa cria uma conta de motorista (item #1 da análise de segurança) e não há campo de aprovação. Sem isso, a busca mostraria às famílias contas que ninguém conferiu, num transporte de crianças.',
    corrigir:
      'Coluna `aprovado_em` (e quem aprovou) no perfil do motorista; a busca filtra `aprovado_em IS NOT NULL`. Validar os requisitos do condutor escolar (CTB art. 138).',
  });
}

{
  const perfis = trecho(F.schema, /export const perfisMotorista = /, /\nexport const /);
  const temPublico = perfis ? /regiaoAtendimento/.test(perfis.corpo) : false;
  registrar({
    id: 'BM3',
    etapa: 'pre',
    titulo: 'Existe um perfil público separado do contato',
    status: !perfis ? 'AVISO' : temPublico ? 'OK' : 'AVISO',
    severidade: 'média',
    locais: [perfis && local(perfis.arquivo, perfis.linhaInicial)],
    porque: temPublico
      ? 'O perfil do motorista já tem `apresentacao` e `regiao_atendimento`: dá para montar o cartão da busca sem usar telefone, e-mail ou placa.'
      : 'Sem um perfil público, a busca acaba devolvendo dados de contato (telefone, e-mail) para qualquer família.',
    corrigir: 'Perfil com nome, região atendida, apresentação e modelo do veículo.',
  });
}

// ── ① Busca ──────────────────────────────────────────────────────────────────

requisito(
  existeBusca,
  {
    id: 'BM4',
    etapa: 'busca',
    titulo: 'Resultado mostra só dados públicos (sem telefone, e-mail ou placa)',
    severidade: 'alta',
    porque:
      'O documento (seção 5.1) pede ver o perfil "sem expor dados privados desnecessários". Se a busca devolver telefone e e-mail, vira uma lista de contatos de motoristas para qualquer conta.',
    corrigir:
      'Schema de resposta próprio (ex.: `motoristaPublico`) com id, nome, região, apresentação e modelo do veículo. Telefone só depois do vínculo aceito.',
  },
  () => {
    if (rotaBusca && !/response:/.test(rotaBusca.declaracao)) {
      return { ok: false, onde: rotaBusca.onde };
    }
    if (!respostaBusca) return undefined;
    return {
      ok: !/\b(telefone|email|placa|cpf|senha\w*)\s*:/.test(respostaBusca.corpo),
      onde: respostaBusca.onde,
    };
  },
);
requisito(
  existeBusca,
  {
    id: 'BM5',
    etapa: 'busca',
    titulo: 'Filtro obrigatório: não existe "listar todos"',
    severidade: 'alta',
    porque:
      'Uma busca vazia que devolve todos os motoristas permite copiar a base inteira página por página. A família procura alguém com quem já combinou: precisa digitar algo.',
    corrigir:
      'Querystring com termo (nome) de pelo menos 3 letras e/ou região; sem filtro, responde 400.',
  },
  () =>
    queryBusca && {
      ok: /\.min\(\s*[3-9]/.test(queryBusca.corpo),
      onde: queryBusca.onde,
    },
);
requisito(
  existeBusca,
  {
    id: 'BM6',
    etapa: 'busca',
    titulo: 'Paginação com limite máximo',
    severidade: 'média',
    porque: 'Sem teto, um pedido com limit=100000 devolve tudo de uma vez.',
    corrigir:
      'limit com .max(20) (ou parecido) e paginação por cursor, como o histórico de viagens.',
  },
  () =>
    queryBusca && {
      // .max(N) direto no campo, ou um helper limit(N) cujo corpo aplica .max (N até 50).
      ok:
        /limit\w*\s*:[^\n]*\.max\(\s*([1-4]?\d|50)\s*\)/.test(queryBusca.corpo) ||
        (/limit\w*\s*:\s*limit\(\s*([1-4]?\d|50)\s*\)/.test(queryBusca.corpo) &&
          /const limit = [^\n]*\.max\(/.test(textoBackend)),
      onde: queryBusca.onde,
    },
);
requisito(
  existeBusca,
  {
    id: 'BM7',
    etapa: 'busca',
    titulo: 'Rate limit próprio na busca',
    severidade: 'média',
    porque:
      'Mesmo com filtro e paginação, alguém pode testar milhares de nomes e regiões para montar a lista. Um limite por usuário deixa isso lento demais para valer a pena.',
    corrigir: "config: { rateLimit: { max: 20, timeWindow: '1 minute' } } na rota da busca.",
  },
  () => {
    if (!rotaBusca) return undefined;
    // Direto na rota, ou numa constante do mesmo arquivo (config: limiteBusca).
    const constante = /config:\s*(\w+)/.exec(rotaBusca.declaracao)?.[1];
    const viaConstante =
      constante !== undefined &&
      ler(rotaBusca.arquivo).includes(`const ${constante} = { rateLimit`);
    return { ok: /rateLimit/.test(rotaBusca.declaracao) || viaConstante, onde: rotaBusca.onde };
  },
);
requisito(
  existeBusca,
  {
    id: 'BM8',
    etapa: 'busca',
    titulo: 'Busca por texto escapa os curingas do LIKE',
    severidade: 'baixa',
    porque:
      'Com ILIKE, o termo "%" ou "_" vira curinga e casa com todos os nomes, furando o filtro obrigatório do BM5. Também deixa consultas pesadas.',
    corrigir:
      'Escapar `\\`, `%` e `_` no termo antes de montar o padrão, sempre com parâmetro (nunca sql.raw).',
  },
  () => {
    if (!/ilike\(|ILIKE/.test(textoBackend)) return undefined;
    return { ok: /replace\([^)]*[%_]/.test(textoBackend), onde: rotaBusca?.onde };
  },
);

// ── ② Pedido de vínculo ──────────────────────────────────────────────────────

requisito(
  existePedido,
  {
    id: 'BM9',
    etapa: 'pedido',
    titulo: 'Pedido em tabela própria, com estado explícito',
    severidade: 'alta',
    porque:
      'O documento (seção 7.3) pede que solicitação e vínculo ativo sejam modelados separadamente: "não representar uma solicitação pendente como se o vínculo já estivesse autorizado".',
    corrigir:
      'Tabela `solicitacoes_vinculo` com estado PENDENTE | ACEITA | RECUSADA | CANCELADA | EXPIRADA, quem pediu, motorista, aluno e as datas de cada mudança.',
  },
  () =>
    tabelaSolicitacoes && {
      ok: /PENDENTE/.test(textBackendEnums()) && /estado|status/i.test(tabelaSolicitacoes.corpo),
      onde: local(tabelaSolicitacoes.arquivo, tabelaSolicitacoes.linhaInicial),
    },
);
requisito(existePedido, {
  id: 'BM10',
  etapa: 'pedido',
  titulo: 'Só pede vínculo para o próprio filho',
  severidade: 'alta',
  porque:
    'Se o alunoId do corpo não for conferido, uma família pede vínculo para a criança de outra e o motorista passa a recebê-la (IDOR).',
  corrigir:
    'Antes de gravar, conferir o vínculo AUTORIZADO do aluno com o responsável do token (como o PA9); senão 404.',
});
requisito(
  existePedido,
  {
    id: 'BM11',
    etapa: 'pedido',
    titulo: 'No máximo um pedido pendente por aluno e motorista',
    severidade: 'média',
    porque:
      'Tocar duas vezes em "Pedir" (ou um script) criaria pedidos repetidos, que viram spam para o motorista (risco N3).',
    corrigir:
      "Índice único parcial: (aluno_id, motorista_id) WHERE estado = 'PENDENTE'; reenviar devolve o pedido que já existe.",
  },
  () =>
    tabelaSolicitacoes && {
      ok: /uniqueIndex\([\s\S]{0,300}PENDENTE/.test(tabelaSolicitacoes.corpo),
      onde: local(tabelaSolicitacoes.arquivo, tabelaSolicitacoes.linhaInicial),
    },
);
requisito(existePedido, {
  id: 'BM12',
  etapa: 'pedido',
  titulo: 'Pedido pendente não libera nenhum dado do aluno',
  severidade: 'alta',
  porque:
    'Enquanto o motorista não aceitar, ele não pode ver endereço de embarque, escola nem nada além do primeiro nome. O documento (seção 8) pede confirmar o vínculo "antes de liberar informações operacionais do aluno".',
  corrigir:
    'O que o motorista vê do pedido: primeiro nome do aluno e região. O resto só depois do aceite (riscos N2 e N3).',
});
requisito(
  existePedido,
  {
    id: 'BM13',
    etapa: 'pedido',
    titulo: 'Pedido expira sozinho',
    severidade: 'média',
    porque:
      'Um pedido esquecido pendente para sempre deixa a família presa na tela de espera e o motorista com uma fila que nunca esvazia.',
    corrigir:
      'Coluna `expira_em` (ex.: 7 dias); a consulta trata vencido como EXPIRADA e a tela mostra isso.',
  },
  () =>
    tabelaSolicitacoes && {
      ok: /expira/i.test(tabelaSolicitacoes.corpo),
      onde: local(tabelaSolicitacoes.arquivo, tabelaSolicitacoes.linhaInicial),
    },
);

// ── ③ Tela de espera ─────────────────────────────────────────────────────────

requisito(
  existeTela,
  {
    id: 'BM14',
    etapa: 'espera',
    titulo: 'Tela de espera consulta o status no servidor e para no fim',
    severidade: 'média',
    porque:
      'A tela precisa refletir a resposta do motorista sem a família ficar puxando para atualizar. Mas consultar para sempre, mesmo depois de ACEITA ou RECUSADA, gasta bateria, dados e o servidor gratuito.',
    corrigir:
      'useQuery com refetchInterval (ex.: 15 s) enquanto PENDENTE e `false` nos estados finais, igual à tela de acompanhamento faz com a viagem.',
  },
  () => ({
    ok: /refetchInterval/.test(textoTela) && /ACEITA|RECUSADA|EXPIRADA/.test(textoTela),
    onde: tela && achar(tela, /refetchInterval/),
  }),
);
requisito(
  existeTela,
  {
    id: 'BM15',
    etapa: 'espera',
    titulo: 'Todos os estados aparecem com texto claro',
    severidade: 'média',
    porque:
      'O documento (seção 7.1) pede "estados visuais claros: pendente, ativo, recusado, encerrado". A família precisa saber se espera, se já pode contar com o motorista ou se deve procurar outro.',
    corrigir:
      'PENDENTE "Aguardando o motorista…", ACEITA "Motorista confirmou", RECUSADA "O motorista não aceitou", EXPIRADA "O pedido venceu", CANCELADA "Você cancelou", cada um com a próxima ação.',
  },
  () => ({
    ok: ['PENDENTE', 'ACEITA', 'RECUSADA', 'EXPIRADA'].every((e) => textoTela.includes(e)),
    onde: tela && local(tela, 1),
  }),
);
requisito(
  existeTela,
  {
    id: 'BM16',
    etapa: 'espera',
    titulo: 'Erro de rede não vira "recusado"',
    severidade: 'média',
    porque:
      'Sem internet, a consulta falha. Se a tela tratar a falha como resposta, a família acha que o motorista recusou. O documento (seção 7.1) pede estados para "falta de conexão".',
    corrigir:
      'Falha de consulta mostra EstadoErro com "Tentar de novo" e mantém o último status conhecido.',
  },
  () => ({ ok: /EstadoErro/.test(textoTela), onde: tela && achar(tela, /EstadoErro/) }),
);
requisito(
  existeTela,
  {
    id: 'BM17',
    etapa: 'espera',
    titulo: 'Botão para cancelar o pedido',
    severidade: 'baixa',
    porque:
      'Se a família combinou com outro motorista, precisa desistir sem esperar a expiração. Cancelar também tira o pedido da fila do motorista.',
    corrigir:
      'Botão "Cancelar pedido" enquanto PENDENTE, chamando POST /solicitacoes/:id/cancelar (atômico, como o BM20).',
  },
  () => ({ ok: /cancelar/i.test(textoTela), onde: tela && achar(tela, /cancelar/i) }),
);
requisito(
  existeTela,
  {
    id: 'BM18',
    etapa: 'espera',
    titulo: 'Mudança de status é anunciada pelo leitor de tela',
    severidade: 'baixa',
    porque:
      'Quem usa leitor de tela não vê o ícone mudar. Sem região "ao vivo", a resposta do motorista passa despercebida.',
    corrigir:
      'Envolver o status com accessibilityLiveRegion="polite" (Android) e accessibilityRole adequado, como os componentes de estado já fazem.',
  },
  () => ({
    ok: /accessibilityLiveRegion/.test(textoTela),
    onde: tela && (achar(tela, /accessibilityLiveRegion/) ?? local(tela, 1)),
  }),
);
requisito(
  existePedido,
  {
    id: 'BM19',
    etapa: 'espera',
    titulo: 'Status do pedido só para quem pediu (sem IDOR)',
    severidade: 'alta',
    porque:
      'Com GET /solicitacoes/:id, trocar o id mostraria pedidos (e filhos) de outras famílias.',
    corrigir:
      'WHERE id = :id AND responsavel_id = <usuário do token>; 404 se não for dele (mesmo padrão do PA9).',
  },
  () => {
    if (!rotaStatus) return { ok: false, onde: rotaPedido?.onde };
    const filtro = /solicitac\w*[\s\S]{0,400}responsavel_?[Ii]d/.test(textoBackend);
    return { ok: filtro, onde: rotaStatus.onde };
  },
);

// ── ④ Resposta do motorista ──────────────────────────────────────────────────

requisito(
  existeResposta,
  {
    id: 'BM20',
    etapa: 'resposta',
    titulo: 'Aceitar e recusar são atômicos (mesma corrida do #3)',
    severidade: 'alta',
    porque:
      'Se o motorista aceitar no mesmo instante em que a família cancela, conferir "ainda está pendente" e gravar em passos separados deixa os dois vencerem. A tela de espera mostraria ACEITA para um pedido cancelado.',
    corrigir:
      "UPDATE solicitacoes SET estado = 'ACEITA' WHERE id = $1 AND estado = 'PENDENTE' AND expira_em > now() RETURNING ...; 0 linhas = já respondido.",
  },
  () => {
    const onde = backend
      .map((a) => achar(a, /update\(\s*(?:schema\.)?(?:solicitac\w*|s)\s*\)/))
      .find((l) => l !== undefined);
    if (!onde) return undefined;
    return {
      // Conferência e mudança no mesmo UPDATE (estado PENDENTE no WHERE) com RETURNING.
      ok: /update\(\s*(?:schema\.)?(?:solicitac\w*|s)\s*\)[\s\S]{0,500}(?:PENDENTE|pendenteValido)[\s\S]{0,300}returning\(/.test(
        textoBackend,
      ),
      onde,
    };
  },
);
requisito(existeResposta, {
  id: 'BM21',
  etapa: 'resposta',
  titulo: 'Recusa não pode ser reenviada em sequência',
  severidade: 'média',
  porque:
    'Se a família puder reenviar logo depois de uma recusa, o pedido vira insistência (risco N3 da análise de segurança).',
  corrigir:
    'Depois de RECUSADA, bloquear novo pedido do mesmo responsável ao mesmo motorista por alguns dias; a tela de espera explica isso.',
});
requisito(
  existeResposta,
  {
    id: 'BM22',
    etapa: 'resposta',
    titulo: 'Pedido, aceite, recusa e cancelamento ficam registrados',
    severidade: 'média',
    porque:
      'Em caso de disputa ("eu nunca aceitei esse aluno"), é preciso saber quem fez o quê e quando. O documento (seção 5.3) pede auditoria.',
    corrigir:
      'Chamar registrarAuditoria (já existe em db/auditoria.ts) em cada mudança de estado, na mesma transação.',
  },
  () => {
    const modulo = backend.filter(
      (a) => /solicitac/i.test(ler(a)) && /registrarAuditoria/.test(ler(a)),
    );
    return modulo.length
      ? { ok: true, onde: achar(modulo[0] ?? '', /registrarAuditoria\(/) }
      : { ok: false, onde: rotasResposta[0]?.onde };
  },
);

/** Texto dos enums do schema, para conferir os estados do pedido. */
function textBackendEnums() {
  return (ler(F.schema).match(/pgEnum\([^)]*\)/g) ?? []).join('\n');
}

// ── Impressão ────────────────────────────────────────────────────────────────

const comCor = !opcoes['sem-cor'] && !process.env.NO_COLOR && process.stdout.isTTY;
const cor = (codigo: string) => (texto: string) =>
  comCor ? `\x1b[${codigo}m${texto}\x1b[0m` : texto;
const negrito = cor('1');
const fraco = cor('2');
const verde = cor('32');
const vermelho = cor('31');
const amarelo = cor('33');
const ciano = cor('36');
const magenta = cor('35');

const ESTILO = new Map<Status, { icone: string; pintar: (t: string) => string }>([
  ['OK', { icone: '✔', pintar: verde }],
  ['FALHA', { icone: '✖', pintar: vermelho }],
  ['AVISO', { icone: '▲', pintar: amarelo }],
  ['REVISAR', { icone: '?', pintar: magenta }],
  ['PENDENTE', { icone: '○', pintar: ciano }],
]);
const estilo = (s: Status) => ESTILO.get(s) ?? { icone: ' ', pintar: (t: string) => t };

const largura = Math.max(70, Math.min(process.stdout.columns || 100, 110));
const linha = (char = '─') => fraco(char.repeat(largura));

/** Quebra o texto em linhas que cabem no terminal, com recuo. */
function quebrar(texto: string, recuo: number, rotulo = ''): string[] {
  const espaco = largura - recuo;
  const saida: string[] = [];
  let atual = rotulo;
  for (const palavra of texto.split(/\s+/)) {
    if (atual && (atual + ' ' + palavra).length > espaco) {
      saida.push(atual);
      atual = ' '.repeat(rotulo.length) + palavra;
    } else {
      atual = atual && atual.trim() ? `${atual} ${palavra}` : `${atual}${palavra}`;
    }
  }
  if (atual.trim()) saida.push(atual);
  return saida.map((l) => ' '.repeat(recuo) + l);
}

/** Pior status de uma etapa, para o diagrama. */
function resumoEtapa(id: IdEtapa): Status {
  const statuses = itens.filter((i) => i.etapa === id).map((i) => i.status);
  for (const s of ['FALHA', 'AVISO', 'REVISAR', 'PENDENTE'] as const) {
    if (statuses.includes(s)) return s;
  }
  return 'OK';
}
const marca = (id: IdEtapa) => {
  const { icone, pintar } = estilo(resumoEtapa(id));
  return pintar(icone);
};

const ORDEM_SEVERIDADE = new Map<Severidade, number>([
  ['alta', 0],
  ['média', 1],
  ['baixa', 2],
]);
const ORDEM_STATUS = new Map<Status, number>([
  ['FALHA', 0],
  ['AVISO', 1],
  ['REVISAR', 2],
  ['PENDENTE', 3],
  ['OK', 4],
]);
const ordenar = (a: Item, b: Item) =>
  (ORDEM_STATUS.get(a.status) ?? 9) - (ORDEM_STATUS.get(b.status) ?? 9) ||
  (ORDEM_SEVERIDADE.get(a.severidade) ?? 9) - (ORDEM_SEVERIDADE.get(b.severidade) ?? 9);

const situacao = (nome: string, existe: boolean) =>
  existe ? verde(`${nome}: existe`) : ciano(`${nome}: ainda NÃO existe`);

const out: string[] = [];
const print = (...l: string[]) => out.push(...l);

print(
  '',
  linha('═'),
  negrito('  AUDITORIA: BUSCA DE MOTORISTAS + TELA DE ESPERA · Pitaya Escolar'),
  fraco(
    '  Checagem estática do backend e do app · base: documento de atualização, seções 4, 5.1, 7 e 8',
  ),
  linha('═'),
  '',
  negrito('  Arquitetura recomendada'),
  '',
  `   ${marca('pre')} ${negrito('Pré-requisitos')}  motorista aprovado · perfil público (nome, região, veículo)`,
  '',
  `   ${marca('busca')} ${negrito('①')} App (responsável) ── GET /v1/responsavel/motoristas?termo=…&regiao=… ──▶ API`,
  fraco('          └ login + papel · filtro obrigatório · até 20 por página · rate limit'),
  fraco('          └ só campos públicos: nome, região, apresentação, modelo do veículo'),
  `   ${marca('pedido')} ${negrito('②')} App ── POST /v1/responsavel/solicitacoes { motoristaId, alunoId } ──▶ API`,
  fraco('          └ aluno do responsável do token · 1 pendente por aluno+motorista · expira_em'),
  `   ${marca('espera')} ${negrito('③')} Tela de espera ── GET /v1/responsavel/solicitacoes/:id (a cada 15 s) ──▶ API`,
  fraco(
    '          └ PENDENTE → ACEITA | RECUSADA | EXPIRADA | CANCELADA · para de consultar no fim',
  ),
  `   ${marca('resposta')} ${negrito('④')} Motorista ── aceitar / recusar ──▶ UPDATE … WHERE estado = 'PENDENTE' RETURNING`,
  fraco(
    '          └ só depois do aceite: telefone para a família, aluno e endereço para o motorista',
  ),
  '',
  negrito('  Tela de espera (rascunho)'),
  '',
  ciano('    ┌──────────────────────────────────────┐'),
  ciano('    │  ←  Pedido de transporte             │'),
  ciano('    │                                      │'),
  ciano('    │                 ( ◷ )                │'),
  ciano('    │   Aguardando o motorista responder   │'),
  ciano('    │                                      │'),
  ciano('    │   Carlos Souza · Zona Sul            │'),
  ciano('    │   Para: Ana  ·  enviado há 2 h       │'),
  ciano('    │   O pedido vence em 6 dias           │'),
  ciano('    │                                      │'),
  ciano('    │   ● Enviado  ● Aguardando  ○ Resposta│'),
  ciano('    │                                      │'),
  ciano('    │   [ Cancelar pedido ]                │'),
  ciano('    └──────────────────────────────────────┘'),
  fraco('    ACEITA ✔ "Motorista confirmou" → ver contato · RECUSADA → "Buscar outro motorista"'),
  fraco(
    '    EXPIRADA → "Pedir de novo" · sem internet → aviso + "Tentar de novo" (status mantido)',
  ),
  '',
  `  Situação: ${situacao('busca', existeBusca)} · ${situacao('pedido', existePedido)} · ${situacao('tela de espera', existeTela)} · ${situacao('resposta', existeResposta)}`,
  '',
  fraco(
    `  Legenda: ${verde('✔ OK')}  ${vermelho('✖ FALHA')}  ${amarelo('▲ AVISO')}  ${magenta('? REVISAR')}  ${ciano('○ PENDENTE')}`,
  ),
);

for (const etapa of ETAPAS) {
  const daEtapa = itens.filter((i) => i.etapa === etapa.id).sort(ordenar);
  print('', linha('━'), negrito(`  ${etapa.nome}`) + fraco(`  ·  ${etapa.resumo}`), linha('━'));

  for (const item of daEtapa) {
    const { icone, pintar } = estilo(item.status);
    const sev = item.status !== 'OK' ? fraco(` [${item.severidade}]`) : '';
    print(
      `  ${pintar(`${icone} ${item.status.padEnd(8)}`)} ${negrito(item.id.padEnd(5))} ${item.titulo}${sev}`,
    );

    if (opcoes.curto) continue;
    for (const l of (item.locais ?? []).filter(Boolean)) print(ciano(`              ${l}`));
    if (item.status === 'OK') {
      print(...quebrar(item.porque, 14).map(fraco));
      continue;
    }
    print(...quebrar(item.porque, 14, 'Por quê:  '));
    if (item.corrigir) print(...quebrar(item.corrigir, 14, 'Corrigir: ').map(verde));
    print('');
  }
}

// ── Resumo ───────────────────────────────────────────────────────────────────

const contar = (s: Status) => itens.filter((i) => i.status === s).length;
const prioridades = itens.filter((i) => i.status === 'FALHA' || i.status === 'AVISO').sort(ordenar);

print(
  '',
  linha('═'),
  negrito('  RESUMO'),
  `  ${verde(`✔ ${contar('OK')} OK`)}   ${vermelho(`✖ ${contar('FALHA')} falhas`)}   ${amarelo(`▲ ${contar('AVISO')} avisos`)}   ${magenta(`? ${contar('REVISAR')} a revisar`)}   ${ciano(`○ ${contar('PENDENTE')} pendentes`)}`,
);
if (prioridades.length) {
  print('', negrito('  Resolver primeiro'));
  for (const [n, item] of prioridades.entries()) {
    const { pintar } = estilo(item.status);
    print(
      `  ${String(n + 1).padStart(2)}. ${pintar(item.id.padEnd(5))} ${item.titulo} ${fraco(`[${item.severidade}]`)}`,
    );
  }
}
print(
  '',
  fraco(
    '  Esta é uma checagem por padrões no código: ela não substitui testes nem revisão humana.',
  ),
  fraco(
    '  Quando implementar a busca e a tela, rode de novo para ver os requisitos serem conferidos.',
  ),
  linha('═'),
  '',
);

console.log(out.join('\n'));
process.exitCode = contar('FALHA') > 0 ? 1 : 0;
