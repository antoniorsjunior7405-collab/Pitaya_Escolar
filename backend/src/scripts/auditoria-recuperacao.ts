import path from 'node:path';
import { parseArgs } from 'node:util';
import { criarFontesDoDisco } from './recuperacao/fontes.js';
import { formatarRelatorio } from './recuperacao/relatorio.js';
import { auditarRecuperacao } from './recuperacao/requisitos.js';

// Auditoria da recuperação de acesso ("esqueci a senha"), para ler no terminal.
//
// Mostra a arquitetura recomendada para o fluxo (OWASP Forgot Password Cheat Sheet) e confere
// cada requisito RA0–RA13 no código. É uma checagem ESTÁTICA: lê os arquivos de src/modules,
// src/db, src/config e src/shared; não precisa de .env nem de banco e não altera nada.
// A auditoria geral (config, banco e API no ar) é a npm run audit:seguranca.
//
// Uso: npm run audit:recuperacao             (relatório completo)
//      npm run audit:recuperacao -- --curto  (uma linha por item)
//      npm run audit:recuperacao -- --sem-cor
//
// Código de saída: 1 se houver algum item com FALHA, 0 caso contrário.
const { values } = parseArgs({
  options: {
    curto: { type: 'boolean', default: false },
    'sem-cor': { type: 'boolean', default: false },
  },
});

const itens = auditarRecuperacao(criarFontesDoDisco(path.resolve(import.meta.dirname, '../..')));

console.log(
  formatarRelatorio(itens, {
    curto: values.curto,
    // NO_COLOR é convenção do terminal (no-color.org), não configuração da aplicação.
    cor: !values['sem-cor'] && !process.env.NO_COLOR && Boolean(process.stdout.isTTY),
    largura: Math.max(70, Math.min(process.stdout.columns || 100, 110)),
  }),
);
process.exitCode = itens.some((i) => i.status === 'FALHA') ? 1 : 0;
