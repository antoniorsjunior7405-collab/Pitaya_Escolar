import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

// Auditoria de "Responsável cadastra o próprio aluno", para ler no terminal.
//
// Mostra a arquitetura recomendada para o cadastro do aluno pela família e confere cada
// requisito de segurança e de proteção de dados no código. Enquanto as rotas de cadastro não
// existem, os requisitos aparecem como PENDENTE (o que a implementação precisa ter). Quando
// surgirem, os mesmos itens passam a ser conferidos: OK se o padrão esperado está no código,
// FALHA se não está, REVISAR se só dá para conferir à mão. Alguns pré-requisitos já são
// conferidos hoje.
//
// É uma checagem ESTÁTICA: lê os arquivos e procura padrões. Não precisa de .env nem de banco.
//
// Uso: npm run audit:aluno-responsavel             (relatório completo)
//      npm run audit:aluno-responsavel -- --curto  (só uma linha por item)
//
// Código de saída: 1 se houver algum item com FALHA, 0 caso contrário.

const { values: opcoes } = parseArgs({
  options: {
    curto: { type: 'boolean', default: false },
    'sem-cor': { type: 'boolean', default: false },
  },
});

// ── Leitura dos arquivos ─────────────────────────────────────────────────────

const RAIZ = path.resolve(import.meta.dirname, '../..');
const cache = new Map<string, string>();

/** Conteúdo de um arquivo do backend (caminho relativo a backend/). '' se não existir. */
function ler(arquivo: string): string {
  const salvo = cache.get(arquivo);
  if (salvo !== undefined) return salvo;
  let texto: string;
  try {
    // Caminhos vêm só das constantes deste script, nunca de entrada externa.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    texto = readFileSync(path.join(RAIZ, arquivo), 'utf8');
  } catch {
    texto = '';
  }
  cache.set(arquivo, texto);
  return texto;
}

/** Todos os .ts de src/ (sem testes e sem os scripts de auditoria, que citam os padrões). */
function arquivosFonte(dir = 'src'): string[] {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const entradas = readdirSync(path.join(RAIZ, dir), { withFileTypes: true });
  return entradas.flatMap((e) => {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) return arquivosFonte(rel);
    const ignorar = e.name.endsWith('.test.ts') || e.name.startsWith('auditoria-');
    return e.name.endsWith('.ts') && !ignorar ? [rel] : [];
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
  schema: 'src/db/schema.ts',
  responsavelRoutes: 'src/modules/responsavel/responsavel.routes.ts',
  responsavelRepo: 'src/modules/responsavel/responsavel.repository.ts',
  responsavelSchemas: 'src/modules/responsavel/responsavel.schemas.ts',
} as const;

const fontes = arquivosFonte();
const DO_MODULO = 'modules/responsavel/';
const textoDoModulo = fontes
  .filter((a) => a.includes(DO_MODULO))
  .map(ler)
  .join('\n');

// ── Modelo do relatório ──────────────────────────────────────────────────────

/**
 * OK = requisito cumprido · FALHA = requisito descumprido no código · AVISO = risco a resolver
 * · REVISAR = só dá para conferir à mão · PENDENTE = o cadastro ainda não existe.
 */
type Status = 'OK' | 'FALHA' | 'AVISO' | 'REVISAR' | 'PENDENTE';
type Severidade = 'alta' | 'média' | 'baixa';

/** Em que parte da arquitetura do fluxo o requisito mora. */
const ETAPAS = [
  { id: 'pre', nome: 'Pré-requisitos e modelagem', resumo: 'o que precisa estar decidido antes' },
  { id: 'cadastro', nome: '① Cadastro', resumo: 'POST /v1/responsavel/alunos' },
  { id: 'acesso', nome: '② Ver, editar e excluir', resumo: 'só o responsável vinculado' },
  { id: 'familia', nome: '③ Outros responsáveis', resumo: 'segundo pai, mãe, avó...' },
  { id: 'terceiros', nome: '④ Motorista e escola', resumo: 'quando o aluno sai da família' },
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

// ── O cadastro já existe? ────────────────────────────────────────────────────

type Rota = { arquivo: string; metodo: string; caminho: string; onde: string; declaracao: string };

/** Rotas de escrita (POST/PUT/PATCH/DELETE) do módulo responsável cujo caminho casa. */
function rotasDeEscrita(caminho: RegExp): Rota[] {
  return fontes
    .filter((a) => a.includes(DO_MODULO))
    .flatMap((arquivo) => {
      const texto = ler(arquivo);
      const achadas: Rota[] = [];
      const busca = /\.(post|put|patch|delete)\(\s*'([^']*)'/g;
      for (let m = busca.exec(texto); m; m = busca.exec(texto)) {
        if (!m[1] || !m[2] || !caminho.test(m[2])) continue;
        achadas.push({
          arquivo,
          metodo: m[1],
          caminho: m[2],
          onde: local(arquivo, linhaDoIndice(texto, m.index)),
          declaracao: texto.slice(m.index, m.index + 400),
        });
      }
      return achadas;
    });
}

const rotasAluno = rotasDeEscrita(/^\/(?:alunos|filhos)\b/);
const rotaCadastro = rotasAluno.find((r) => r.metodo === 'post' && !r.caminho.includes(':'));
const rotasComId = rotasAluno.filter((r) => r.caminho.includes(':'));
const existeCadastro = rotaCadastro !== undefined;
const existeEdicao = rotasComId.length > 0;

/** Schema Zod (z.object ou z.strictObject) que começa no padrão dado, para checar os campos. */
function schemaZod(padrao: RegExp) {
  for (const arquivo of fontes.filter((a) => a.includes(DO_MODULO))) {
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

const schemaAluno = schemaZod(
  /export const (?:aluno|filho)\w*Body\s*=\s*z\.(?:object|strictObject)\(\{/,
);

/** Requisito que só dá para conferir depois que a funcionalidade existir. */
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

// ── Pré-requisitos e modelagem ───────────────────────────────────────────────

registrar({
  id: 'PA0',
  etapa: 'pre',
  titulo: 'Responsável consegue cadastrar o próprio aluno',
  status: existeCadastro ? 'OK' : 'AVISO',
  severidade: 'média',
  locais: rotasAluno.map((r) => r.onde),
  porque:
    'Hoje só o admin cadastra alunos. O documento de atualização (seções 3, 4 e 5.1) pede que o responsável crie a conta e cadastre o filho, sem depender da escola (Modelo A).',
  corrigir:
    'Implementar no módulo responsável (para herdar o hook exigirPapel), cumprindo os requisitos PA1–PA16, com testes de acesso indevido.',
});

{
  const hook = achar(F.responsavelRoutes, /addHook\('preHandler', exigirPapel\('RESPONSAVEL'\)\)/);
  registrar({
    id: 'PA1',
    etapa: 'pre',
    titulo: 'Rotas do módulo responsável exigem login e papel RESPONSAVEL',
    status: hook ? 'OK' : 'FALHA',
    severidade: 'alta',
    locais: [hook ?? F.responsavelRoutes],
    porque: hook
      ? 'O hook vale para todas as rotas do módulo. Criando o cadastro AQUI, ele já nasce protegido: motorista e admin recebem 403.'
      : 'O módulo responsável não tem o hook exigirPapel: qualquer usuário logado acessaria o cadastro de alunos.',
    corrigir: "app.addHook('preHandler', exigirPapel('RESPONSAVEL')) no escopo do módulo.",
  });
}

{
  const tabela = trecho(F.schema, /export const alunos = /, /\nexport const /);
  const orgObrigatoria = tabela
    ? /organizacaoId: uuid\('organizacao_id'\)\s*\.notNull\(\)/.test(tabela.corpo)
    : false;
  registrar({
    id: 'PA2',
    etapa: 'pre',
    titulo: 'Aluno pode existir sem uma escola/organização (Modelo A)',
    status: !tabela ? 'REVISAR' : orgObrigatoria ? 'AVISO' : 'OK',
    severidade: 'alta',
    locais: [tabela && local(tabela.arquivo, tabela.linhaInicial)],
    porque:
      'Hoje todo aluno PRECISA de organizacao_id. Um responsável do Modelo A (sem escola) não teria onde cadastrar o filho, e a tentação seria jogar o aluno numa organização qualquer, onde o admin dela passaria a enxergá-lo.',
    corrigir:
      'Decidir na Etapa 1: o aluno pertence à família (coluna `criado_por` e organizacao_id opcional) e cada organização só o vê por um vínculo aceito.',
  });
}

{
  const consentimento = /consentimento/i.test(ler(F.schema));
  registrar({
    id: 'PA3',
    etapa: 'pre',
    titulo: 'Consentimento do responsável é registrado',
    status: consentimento ? 'OK' : 'AVISO',
    severidade: 'alta',
    locais: [achar(F.schema, /export const responsaveisAlunos/)],
    porque:
      'Dados de criança pedem consentimento específico de um dos pais ou responsável (LGPD, art. 14). Quando a própria família cadastra o filho, esse é o momento de registrar o aceite (é o mesmo item #L2 da auditoria de segurança).',
    corrigir:
      'Coluna `consentimento_em` e a versão do termo aceito no vínculo responsável↔aluno, gravadas no mesmo cadastro.',
  });
}

// ── ① Cadastro ───────────────────────────────────────────────────────────────

requisito(
  existeCadastro,
  {
    id: 'PA4',
    etapa: 'cadastro',
    titulo: 'Só os dados mínimos do aluno (minimização)',
    severidade: 'alta',
    porque:
      'O documento (seção 5.1) pede "somente os dados necessários". CPF, RG, foto e dados de saúde de criança são muito sensíveis (saúde é dado sensível, LGPD art. 11) e não são necessários para o transporte.',
    corrigir:
      'Começar com nome (e, se o negócio precisar, série/turno). Qualquer campo a mais precisa de uma finalidade escrita. Informação de saúde, se entrar, fica separada e com acesso restrito.',
  },
  () =>
    schemaAluno && {
      ok: !/\b(cpf|rg|foto|saude|alergia|laudo|medicamento)\w*\s*:/i.test(schemaAluno.corpo),
      onde: schemaAluno.onde,
    },
);
requisito(
  existeCadastro,
  {
    id: 'PA5',
    etapa: 'cadastro',
    titulo: 'Só campos permitidos são aceitos (sem "mass assignment")',
    severidade: 'alta',
    porque:
      'Se o corpo aceitar organizacaoId, responsavelId ou autorizado, a família escolhe em que escola o aluno cai ou se vincula a quem quiser.',
    corrigir:
      'Schema Zod com lista fechada e o service montando o insert campo a campo; organização e responsável sempre vêm do token.',
  },
  () =>
    schemaAluno && {
      ok: !/\b(organizacaoId|responsavelId|autorizado|ativo|id)\s*:/.test(schemaAluno.corpo),
      onde: schemaAluno.onde,
    },
);
requisito(
  existeCadastro,
  {
    id: 'PA6',
    etapa: 'cadastro',
    titulo: 'Aluno e vínculo com quem cadastrou são gravados juntos',
    severidade: 'alta',
    porque:
      'Se o aluno for gravado e o vínculo falhar, sobra uma criança "órfã" no banco que ninguém vê nem apaga. Se o vínculo vier de um id do corpo, a família vincula o aluno a outra pessoa.',
    corrigir:
      'db.transaction: insert em `alunos` e em `responsaveis_alunos` com responsavelId = membroDe(req).usuarioId.',
  },
  () => {
    const transacao = /transaction\(/.test(textoDoModulo);
    const vinculo = /insert\(\s*(?:schema\.)?responsaveisAlunos\s*\)/.test(textoDoModulo);
    return {
      ok: transacao && vinculo,
      onde: fontes
        .filter((a) => a.includes(DO_MODULO))
        .map((a) => achar(a, /insert\(\s*(?:schema\.)?alunos\s*\)/))
        .find((l) => l !== undefined),
    };
  },
);
requisito(
  existeCadastro,
  {
    id: 'PA7',
    etapa: 'cadastro',
    titulo: 'Campos validados (tamanho, formato)',
    severidade: 'média',
    porque:
      'O nome do aluno aparece na lista do motorista e nas notificações. Sem limite, vira espaço para abuso e quebra a tela.',
    corrigir: 'Nome com trim e 2–120 caracteres, como no cadastro do admin.',
  },
  () =>
    schemaAluno && {
      ok: /\.trim\(\)/.test(schemaAluno.corpo) && /\.max\(/.test(schemaAluno.corpo),
      onde: schemaAluno.onde,
    },
);
requisito(
  existeCadastro,
  {
    id: 'PA8',
    etapa: 'cadastro',
    titulo: 'Limite de alunos por responsável',
    severidade: 'baixa',
    porque:
      'Sem limite, uma conta cria milhares de "alunos" falsos para poluir buscas e pedidos de vínculo ou encher o banco.',
    corrigir:
      'Limite razoável por responsável (ex.: 10 alunos ativos) e rate limit próprio na rota de cadastro.',
  },
  () => ({
    // Limite de quantidade no módulo E rate limit na própria declaração da rota de cadastro.
    ok:
      /MAX_\w*(?:FILHOS|ALUNOS)\w*\s*=\s*\d+/.test(textoDoModulo) &&
      /rateLimit|config:\s*limite/.test(rotaCadastro?.declaracao ?? ''),
    onde: rotaCadastro?.onde,
  }),
);

// ── ② Ver, editar e excluir ──────────────────────────────────────────────────

{
  const filtro = achar(F.responsavelRepo, /WHERE ra\.responsavel_id = \$\{escopo\.responsavelId\}/);
  const autorizado = /AND ra\.autorizado/.test(ler(F.responsavelRepo));
  registrar({
    id: 'PA9',
    etapa: 'acesso',
    titulo: 'Leitura dos filhos filtrada pelo responsável do token',
    status: filtro && autorizado ? 'OK' : filtro ? 'AVISO' : 'REVISAR',
    severidade: 'alta',
    locais: [filtro],
    porque:
      filtro && autorizado
        ? 'A consulta de hoje só traz alunos com vínculo AUTORIZADO ao responsável logado, e um aluno de outra família responde 404. As rotas novas (editar, excluir) devem usar o mesmo filtro.'
        : 'A consulta dos filhos não confere o vínculo autorizado do responsável logado.',
    corrigir:
      'Toda rota com :alunoId confere `responsaveis_alunos` (responsável do token + autorizado) antes de agir, e responde 404 se não for dele.',
  });
}
requisito(
  existeEdicao,
  {
    id: 'PA10',
    etapa: 'acesso',
    titulo: 'Editar ou excluir só o aluno com vínculo próprio (sem IDOR)',
    severidade: 'alta',
    porque:
      'Com PUT /alunos/:alunoId, basta trocar o id para alterar ou apagar o filho de outra família.',
    corrigir:
      'UPDATE/DELETE ... WHERE id = :alunoId AND EXISTS (vínculo autorizado com o responsável do token); 404 se não for dele.',
  },
  () => {
    // O UPDATE/DELETE do aluno precisa conferir o vínculo logo ali, não só em outra consulta.
    const escrita = /(?:update|delete)\(\s*(?:schema\.)?alunos\s*\)[\s\S]{0,600}/.exec(
      textoDoModulo,
    );
    if (!escrita) return undefined;
    return {
      ok: /responsaveisAlunos|responsavel_?[Ii]d/.test(escrita[0]),
      onde: rotasComId[0]?.onde,
    };
  },
);
requisito(
  existeEdicao,
  {
    id: 'PA11',
    etapa: 'acesso',
    titulo: 'Excluir o aluno apaga os dados de verdade',
    severidade: 'média',
    porque:
      'A família tem direito de pedir a exclusão (LGPD, art. 18). Só marcar `ativo = false` deixa nome e histórico guardados para sempre.',
    corrigir:
      'Definir o que acontece com o histórico de viagens (apagar ou anonimizar) e, depois do prazo, apagar o aluno e o endereço de embarque.',
  },
  () => {
    const remove = rotasComId.find((r) => r.metodo === 'delete');
    return remove ? { ok: true, onde: remove.onde } : undefined;
  },
);

// ── ③ Outros responsáveis ────────────────────────────────────────────────────

{
  const tabela = trecho(F.schema, /export const responsaveisAlunos = /, /\nexport const /);
  const padraoTrue = tabela
    ? /autorizado: boolean\(\)\.notNull\(\)\.default\(true\)/.test(tabela.corpo)
    : false;
  registrar({
    id: 'PA12',
    etapa: 'familia',
    titulo: 'Novo vínculo com o aluno não nasce autorizado',
    status: !tabela ? 'REVISAR' : padraoTrue ? 'AVISO' : 'OK',
    severidade: 'alta',
    locais: [achar(F.schema, /autorizado: boolean\(\)/)],
    porque:
      'Hoje o vínculo responsável↔aluno nasce com `autorizado = true`. No cadastro feito pela própria família isso faz sentido para quem cadastrou, mas qualquer OUTRO vínculo criado depois (segundo responsável, avó) já sairia vendo a localização da criança sem ninguém aprovar.',
    corrigir:
      'Padrão `false` no banco. O service põe `true` só para quem cadastrou o aluno; os outros entram por convite aceito pelo responsável atual.',
  });
}
requisito(existeCadastro, {
  id: 'PA13',
  etapa: 'familia',
  titulo: 'Segundo responsável só entra por convite aceito',
  severidade: 'alta',
  porque:
    'Se bastasse digitar o nome do aluno para se vincular, um pai com restrição judicial (ou um estranho) passaria a acompanhar a criança. É o risco N6 da auditoria de segurança.',
  corrigir:
    'O responsável atual convida (e-mail ou código), o convidado aceita, e os dois são avisados. Nada de busca de alunos por nome.',
});

// ── ④ Motorista e escola ─────────────────────────────────────────────────────

requisito(existeCadastro, {
  id: 'PA14',
  etapa: 'terceiros',
  titulo: 'Aluno cadastrado pela família fica invisível até um vínculo aceito',
  severidade: 'alta',
  porque:
    'O documento (seção 8) proíbe lista pública de alunos e pede confirmação do vínculo antes de liberar dados. Hoje o motorista vê os alunos pela tabela rota_alunos: o aluno criado pela família só pode entrar numa rota depois que a família aceitar o motorista.',
  corrigir:
    'Nenhuma consulta de motorista ou admin lista alunos sem vínculo aceito; o endereço de embarque só é liberado ao motorista depois do aceite.',
});
requisito(existeCadastro, {
  id: 'PA15',
  etapa: 'terceiros',
  titulo: 'Mesmo aluno cadastrado pela família e pela escola',
  severidade: 'média',
  porque:
    'No Modelo B a escola cadastra o aluno; no Modelo A a família também. Sem regra, a mesma criança vira dois registros, cada um com responsáveis diferentes, e fica fácil vincular o errado.',
  corrigir:
    'Decidir na Etapa 1 quem é o "dono" do cadastro e como juntar: por exemplo, a escola convida a família, e a família aceita vincular o aluno que já cadastrou.',
});
requisito(
  existeCadastro,
  {
    id: 'PA16',
    etapa: 'terceiros',
    titulo: 'Criação, edição e exclusão ficam registradas',
    severidade: 'média',
    porque:
      'Em caso de disputa (quem cadastrou, quem vinculou, quem apagou), é preciso saber quem fez o quê e quando. O documento (seção 5.3) pede auditoria.',
    corrigir:
      'Usar a mesma tabela de auditoria do item #4 da auditoria de segurança e do PM14 da auditoria do perfil do motorista.',
  },
  () => {
    // As três ações (criar, editar, excluir) precisam gravar o registro.
    const acoes = ['ALUNO_CRIADO', 'ALUNO_EDITADO', 'ALUNO_EXCLUIDO'];
    const registra = /registrarAuditoria\(/.test(textoDoModulo);
    return {
      ok: registra && acoes.every((a) => textoDoModulo.includes(`'${a}'`)),
      onde: fontes
        .filter((a) => a.includes(DO_MODULO))
        .map((a) => achar(a, /registrarAuditoria\(/))
        .find((l) => l !== undefined),
    };
  },
);

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
  existe ? verde(`${nome}: existe (requisitos conferidos)`) : ciano(`${nome}: ainda NÃO existe`);

const out: string[] = [];
const print = (...l: string[]) => out.push(...l);

print(
  '',
  linha('═'),
  negrito('  AUDITORIA: RESPONSÁVEL CADASTRA O PRÓPRIO ALUNO · Pitaya Escolar · backend'),
  fraco('  Checagem estática do código · base: documento de atualização, seções 3, 4, 5.1 e 8'),
  linha('═'),
  '',
  negrito('  Arquitetura recomendada'),
  '',
  `   ${marca('pre')} ${negrito('Pré-requisitos')}  aluno pode existir sem escola · consentimento registrado`,
  '',
  `   ${marca('cadastro')} ${negrito('①')} App (responsável) ── POST /v1/responsavel/alunos { nome } ──▶ API`,
  fraco('          └ authenticate (JWT) → exigirPapel(RESPONSAVEL) → Zod: só os dados mínimos'),
  fraco('          └ transação: INSERT aluno + INSERT vínculo (responsável do token, autorizado,'),
  fraco('            consentimento_em) ──▶ Postgres'),
  `   ${marca('acesso')} ${negrito('②')} GET/PUT/DELETE /v1/responsavel/alunos/:alunoId`,
  fraco('          └ WHERE vínculo autorizado com o responsável do token   (senão 404)'),
  `   ${marca('familia')} ${negrito('③')} Outro responsável ──▶ só por CONVITE do responsável atual + aceite`,
  `   ${marca('terceiros')} ${negrito('④')} Motorista e escola ──▶ não veem o aluno até um vínculo ACEITO pela família`,
  fraco('          └ endereço de embarque só é liberado ao motorista depois do aceite'),
  '',
  `  Situação: ${situacao('cadastro pelo responsável', existeCadastro)} · ${situacao('edição/exclusão', existeEdicao)}`,
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
  fraco('  Quando implementar o cadastro, rode de novo para ver os requisitos serem conferidos.'),
  linha('═'),
  '',
);

console.log(out.join('\n'));
process.exitCode = contar('FALHA') > 0 ? 1 : 0;
