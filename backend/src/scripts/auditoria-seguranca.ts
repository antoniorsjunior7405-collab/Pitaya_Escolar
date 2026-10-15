import { parseArgs } from 'node:util';
import { config } from '../config/index.js';
import { createDb } from '../db/index.js';
import type { Resultado } from './auditoria/resultado.js';
import { verificarBanco } from './auditoria/verificar-banco.js';
import { verificarConfig } from './auditoria/verificar-config.js';
import { verificarHttp, type Requisitar } from './auditoria/verificar-http.js';

// Auditoria de segurança SOMENTE LEITURA (backend/BOAS_PRATICAS.md). Confere:
//   1. configuração do ambiente (.env);
//   2. integridade do banco: isolamento entre organizações, LGPD, contas (transação READ ONLY);
//   3. (opcional) a API no ar: headers, CORS, autenticação e formato dos erros (só GETs).
// O relatório mostra apenas contagens, nunca dados pessoais. Sai com código 1 se houver FALHA.
//
// Uso: npm run audit:seguranca
//      npm run audit:seguranca -- --url https://pitaya-escolar.onrender.com
//      npm run audit:seguranca -- --sem-banco --url http://localhost:3333
const { values } = parseArgs({
  options: {
    url: { type: 'string' },
    'sem-banco': { type: 'boolean', default: false },
  },
});

/** Requisição real com timeout longo: o servidor gratuito do Render leva ~1 min para acordar. */
function requisitarVia(base: string): Requisitar {
  return async (caminho, headers) => {
    const res = await fetch(new URL(caminho, base), {
      headers,
      signal: AbortSignal.timeout(90_000),
    });
    return {
      status: res.status,
      headers: Object.fromEntries(res.headers),
      body: await res.text(),
    };
  };
}

async function secao(titulo: string, executar: () => Promise<Resultado[]> | Resultado[]) {
  console.log(`\n== ${titulo}`);
  try {
    return await executar();
  } catch (erro) {
    // Mensagem curta: o erro completo pode conter a connection string.
    const motivo = erro instanceof Error ? erro.message.split('\n')[0] : 'erro desconhecido';
    return [
      { nivel: 'FALHA', item: titulo, detalhe: `não foi possível verificar: ${motivo}` },
    ] as const;
  }
}

const relatorio: Resultado[] = [];
function imprimir(resultados: readonly Resultado[]) {
  for (const r of resultados) {
    console.log(`${r.nivel.padEnd(5)} ${r.item}${r.detalhe ? ` — ${r.detalhe}` : ''}`);
    relatorio.push(r);
  }
}

console.log(`Auditoria de segurança · NODE_ENV=${config.NODE_ENV}`);

imprimir(await secao('Configuração', () => verificarConfig(config)));

if (values['sem-banco']) {
  console.log('\n== Banco (pulado: --sem-banco)');
} else if (!config.DATABASE_URL) {
  console.log('\n== Banco (pulado: DATABASE_URL não configurada)');
} else {
  const { pool } = createDb();
  imprimir(await secao('Banco', () => verificarBanco(pool)));
  await pool.end();
}

if (values.url) {
  const base = values.url;
  const { protocol, hostname } = new URL(base);
  const https = protocol === 'https:';
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
  imprimir(
    await secao(`API (${base})`, async () => [
      ...(https || local
        ? []
        : [{ nivel: 'FALHA', item: 'HTTPS', detalhe: 'API remota sem HTTPS' } as const]),
      ...(await verificarHttp(requisitarVia(base), https)),
    ]),
  );
} else {
  console.log('\n== API (pulado: informe --url para testar a API no ar)');
}

const falhas = relatorio.filter((r) => r.nivel === 'FALHA').length;
const avisos = relatorio.filter((r) => r.nivel === 'AVISO').length;
console.log(`\n${falhas} falha(s), ${avisos} aviso(s), ${relatorio.length - falhas - avisos} ok.`);
console.log('Dependências: rode também `npm audit` (backend e frontend).');
process.exitCode = falhas ? 1 : 0;
