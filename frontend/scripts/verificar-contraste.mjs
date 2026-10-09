// Verifica o contraste WCAG 2.2 dos pares de cores do tema (claro e escuro).
// Lê as cores direto de src/constants/theme.ts (fonte única), então qualquer mudança na
// paleta é checada aqui. Uso: npm run design:contraste  (sai com código 1 se algo falhar)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const arquivo = fileURLToPath(new URL('../src/constants/theme.ts', import.meta.url));
const fonte = readFileSync(arquivo, 'utf8');

function lerTema(nome) {
  const bloco = fonte.match(new RegExp(`${nome}: \\{([\\s\\S]*?)\\n  \\}`))?.[1];
  if (!bloco) throw new Error(`Tema "${nome}" não encontrado em theme.ts`);
  return Object.fromEntries([...bloco.matchAll(/(\w+): '(#[0-9A-Fa-f]{6})'/g)].map((m) => [m[1], m[2]]));
}

const luminancia = (hex) => {
  const [r, g, b] = hex
    .slice(1)
    .match(/../g)
    .map((h) => parseInt(h, 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const razao = (a, b) => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// [texto/primeiro plano, fundo, mínimo]. 4,5:1 para texto; 3:1 para bordas de controles.
const PARES = [
  ['text', 'background', 4.5],
  ['text', 'backgroundElement', 4.5],
  ['textSecondary', 'background', 4.5],
  ['textSecondary', 'backgroundElement', 4.5],
  ['onPrimary', 'primary', 4.5],
  ['onSecondary', 'secondary', 4.5],
  ['primary', 'background', 4.5],
  ['primary', 'backgroundElement', 4.5],
  ['secondary', 'background', 4.5],
  ['danger', 'background', 4.5],
  ['danger', 'backgroundElement', 4.5],
  ['borderStrong', 'background', 3],
  ['borderStrong', 'backgroundElement', 3],
  ['statusNeutroText', 'statusNeutroBg', 4.5],
  ['statusMarcaText', 'statusMarcaBg', 4.5],
  ['statusSucessoText', 'statusSucessoBg', 4.5],
  ['statusAtencaoText', 'statusAtencaoBg', 4.5],
];

let falhas = 0;
for (const nome of ['light', 'dark']) {
  const tema = lerTema(nome);
  for (const [frente, fundo, minimo] of PARES) {
    if (!tema[frente] || !tema[fundo]) throw new Error(`Token ausente no tema ${nome}: ${frente}/${fundo}`);
    const r = razao(tema[frente], tema[fundo]);
    const ok = r >= minimo;
    if (!ok) falhas++;
    console.log(`${ok ? 'OK   ' : 'FALHA'} ${nome.padEnd(5)} ${`${frente} / ${fundo}`.padEnd(40)} ${r.toFixed(2)}:1 (mín ${minimo})`);
  }
}
console.log(falhas ? `\n${falhas} par(es) abaixo do mínimo.` : '\nTodos os pares atendem ao WCAG 2.2.');
process.exitCode = falhas ? 1 : 0;
