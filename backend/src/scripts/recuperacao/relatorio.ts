import { ETAPAS, type IdEtapa, type Item, type Severidade, type Status } from './requisitos.js';

export type OpcoesRelatorio = {
  /** Uma linha por item, sem explicações. */
  curto: boolean;
  /** Cores ANSI (desligar fora de terminal ou com NO_COLOR). */
  cor: boolean;
  /** Largura do terminal em colunas. */
  largura: number;
};

const ORDEM_STATUS: Record<Status, number> = { FALHA: 0, AVISO: 1, REVISAR: 2, PENDENTE: 3, OK: 4 };
const ORDEM_SEVERIDADE: Record<Severidade, number> = { alta: 0, média: 1, baixa: 2 };

/** Mais grave primeiro: status, depois severidade. */
export const ordenar = (a: Item, b: Item) =>
  ORDEM_STATUS[a.status] - ORDEM_STATUS[b.status] ||
  ORDEM_SEVERIDADE[a.severidade] - ORDEM_SEVERIDADE[b.severidade];

/** Pior status de uma etapa, para o diagrama. */
export function resumoEtapa(itens: readonly Item[], id: IdEtapa): Status {
  const statuses = new Set(itens.filter((i) => i.etapa === id).map((i) => i.status));
  return (['FALHA', 'AVISO', 'REVISAR', 'PENDENTE'] as const).find((s) => statuses.has(s)) ?? 'OK';
}

/** Quebra o texto em linhas que cabem na largura, com recuo e rótulo opcional. */
export function quebrar(texto: string, largura: number, recuo: number, rotulo = ''): string[] {
  const espaco = largura - recuo;
  const saida: string[] = [];
  // O rótulo é prefixo da 1ª linha; as continuações alinham a palavra logo abaixo dele.
  let atual = rotulo;
  let temPalavra = false;
  for (const palavra of texto.split(/\s+/).filter(Boolean)) {
    if (temPalavra && `${atual} ${palavra}`.length > espaco) {
      saida.push(atual);
      atual = ' '.repeat(rotulo.length) + palavra;
    } else {
      atual = temPalavra ? `${atual} ${palavra}` : `${atual}${palavra}`;
    }
    temPalavra = true;
  }
  if (temPalavra) saida.push(atual);
  return saida.map((l) => ' '.repeat(recuo) + l);
}

/** Monta o relatório como texto. Função pura: quem imprime é o script. */
export function formatarRelatorio(itens: readonly Item[], opcoes: OpcoesRelatorio): string {
  const pintar = (codigo: string) => (texto: string) =>
    opcoes.cor ? `\x1b[${codigo}m${texto}\x1b[0m` : texto;
  const negrito = pintar('1');
  const fraco = pintar('2');
  const verde = pintar('32');
  const vermelho = pintar('31');
  const amarelo = pintar('33');
  const ciano = pintar('36');
  const magenta = pintar('35');

  const ESTILO: Record<Status, { icone: string; cor: (t: string) => string }> = {
    OK: { icone: '✔', cor: verde },
    FALHA: { icone: '✖', cor: vermelho },
    AVISO: { icone: '▲', cor: amarelo },
    REVISAR: { icone: '?', cor: magenta },
    PENDENTE: { icone: '○', cor: ciano },
  };
  const { largura } = opcoes;
  const linha = (char = '─') => fraco(char.repeat(largura));
  const marca = (id: IdEtapa) => {
    const e = ESTILO[resumoEtapa(itens, id)];
    return e.cor(e.icone);
  };
  const existe = itens.some((i) => i.id === 'RA0' && i.status === 'OK');
  const contar = (s: Status) => itens.filter((i) => i.status === s).length;

  const out: string[] = [
    '',
    linha('═'),
    negrito('  AUDITORIA DA RECUPERAÇÃO DE ACESSO ("esqueci a senha") · Pitaya Escolar · backend'),
    fraco('  Checagem estática do código · referência: OWASP Forgot Password Cheat Sheet'),
    linha('═'),
    '',
    negrito('  Arquitetura recomendada do fluxo'),
    '',
    `   ${marca('pre')} ${negrito('Pré-requisitos')}  e-mail confirmado no cadastro · admin nunca define senha`,
    '',
    `   ${marca('pedido')} ${negrito('①')} App ── POST /v1/auth/esqueci-senha { email } ──▶ API`,
    fraco('          └ resposta SEMPRE igual (202), exista o e-mail ou não · rate limit'),
    `   ${marca('token')} ${negrito('②')} API ── token aleatório (32 bytes) ──▶ Postgres: só o HASH + expira_em (≤ 30 min)`,
    `   ${marca('email')} ${negrito('③')} API ── e-mail com link ──▶ provedor de e-mail ──▶ dono do e-mail`,
    fraco('          └ chave do provedor só em variável de ambiente · token nunca em query string'),
    `   ${marca('redefinicao')} ${negrito('④')} App ── POST /v1/auth/redefinir-senha { token, novaSenha } ──▶ API`,
    `     ${negrito('⑤')} API ── consome o token (UPDATE ... WHERE usado_em IS NULL RETURNING)`,
    fraco('          ├ troca o hash da senha e zera o bloqueio de login'),
    fraco('          ├ revoga TODAS as sessões (refresh tokens) do usuário'),
    fraco('          └ avisa por e-mail: "sua senha foi alterada"'),
    '',
    `  Situação: ${
      existe
        ? verde('o fluxo existe no código: os requisitos foram conferidos.')
        : ciano(
            'o fluxo ainda NÃO existe: os requisitos abaixo são o que a implementação precisa ter.',
          )
    }`,
    '',
    fraco(
      `  Legenda: ${verde('✔ OK')}  ${vermelho('✖ FALHA')}  ${amarelo('▲ AVISO')}  ${magenta('? REVISAR')}  ${ciano('○ PENDENTE')}`,
    ),
  ];

  for (const etapa of ETAPAS) {
    out.push(
      '',
      linha('━'),
      negrito(`  ${etapa.nome}`) + fraco(`  ·  ${etapa.resumo}`),
      linha('━'),
    );
    for (const item of itens.filter((i) => i.etapa === etapa.id).sort(ordenar)) {
      const { icone, cor } = ESTILO[item.status];
      const sev = item.status !== 'OK' ? fraco(` [${item.severidade}]`) : '';
      out.push(
        `  ${cor(`${icone} ${item.status.padEnd(8)}`)} ${negrito(item.id.padEnd(5))} ${item.titulo}${sev}`,
      );
      if (opcoes.curto) continue;
      for (const l of item.locais) out.push(ciano(`              ${l}`));
      if (item.status === 'OK') {
        out.push(...quebrar(item.porque, largura, 14).map(fraco));
        continue;
      }
      out.push(...quebrar(item.porque, largura, 14, 'Por quê:  '));
      if (item.corrigir) out.push(...quebrar(item.corrigir, largura, 14, 'Corrigir: ').map(verde));
      out.push('');
    }
  }

  const prioridades = itens
    .filter((i) => i.status === 'FALHA' || i.status === 'AVISO')
    .sort(ordenar);
  out.push(
    '',
    linha('═'),
    negrito('  RESUMO'),
    `  ${verde(`✔ ${contar('OK')} OK`)}   ${vermelho(`✖ ${contar('FALHA')} falhas`)}   ${amarelo(`▲ ${contar('AVISO')} avisos`)}   ${magenta(`? ${contar('REVISAR')} a revisar`)}   ${ciano(`○ ${contar('PENDENTE')} pendentes`)}`,
  );
  if (prioridades.length) {
    out.push('', negrito('  Resolver primeiro'));
    prioridades.forEach((item, n) => {
      out.push(
        `  ${String(n + 1).padStart(2)}. ${ESTILO[item.status].cor(item.id.padEnd(5))} ${item.titulo} ${fraco(`[${item.severidade}]`)}`,
      );
    });
  }
  out.push(
    '',
    fraco(
      '  Esta é uma checagem por padrões no código: ela não substitui testes nem revisão humana.',
    ),
    fraco('  Quando implementar o fluxo, rode de novo para ver os requisitos serem conferidos.'),
    linha('═'),
    '',
  );
  return out.join('\n');
}
