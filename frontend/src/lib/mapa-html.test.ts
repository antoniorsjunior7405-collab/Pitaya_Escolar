import { gerarHtmlMapa, scriptAtualizarPosicao } from '@/lib/mapa-html';

const posicao = { latitude: -23.55052, longitude: -46.633308 };

test('a página centraliza o mapa na posição recebida, na ordem [longitude, latitude] do MapLibre', () => {
  const html = gerarHtmlMapa({ posicao, escuro: false, corMarcador: '#C2185B' });
  expect(html).toContain('var posicao = [-46.633308,-23.55052];');
  expect(html).toContain('{ color: "#C2185B" }');
});

test('não depende do Google: usa os mapas do OpenFreeMap, com o estilo escuro no tema escuro', () => {
  const claro = gerarHtmlMapa({ posicao, escuro: false, corMarcador: '#C2185B' });
  const escuro = gerarHtmlMapa({ posicao, escuro: true, corMarcador: '#FF6FA8' });
  expect(claro).toContain('https://tiles.openfreemap.org/styles/liberty');
  expect(escuro).toContain('https://tiles.openfreemap.org/styles/dark');
  expect(claro).not.toMatch(/google/i);
});

test('o MapLibre vem da CDN com versão fixa e hash de integridade', () => {
  const html = gerarHtmlMapa({ posicao, escuro: false, corMarcador: '#C2185B' });
  expect(html).toMatch(/maplibre-gl@\d+\.\d+\.\d+\/dist\/maplibre-gl\.js" integrity="sha384-/);
  expect(html).toMatch(/maplibre-gl\.css" integrity="sha384-/);
});

test('o script de atualização move o marcador e só leva números', () => {
  expect(scriptAtualizarPosicao(posicao)).toBe(
    'window.atualizarPosicao && window.atualizarPosicao(-46.633308, -23.55052); true;',
  );
  const malicioso = { latitude: '1);alert(1' as unknown as number, longitude: 2 };
  expect(scriptAtualizarPosicao(malicioso)).toContain('window.atualizarPosicao(2, NaN)');
});
