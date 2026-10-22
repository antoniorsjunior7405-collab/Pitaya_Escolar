import type { Coordenada } from '@/types';

// Página do mapa exibida pela WebView do MapaVeiculo.
//
// Usamos MapLibre GL JS (código aberto) com os mapas do OpenFreeMap: grátis, sem chave e
// liberados para uso comercial. O react-native-maps foi abandonado porque no Android ele
// sempre sobe o SDK do Google, que exige chave paga e fecha o app sem ela.
//
// Fica na 5.x: a 6.x só tem módulos ES e carrega o worker de outro arquivo, o que esbarra na
// regra de mesma origem dentro da WebView. Ao trocar a versão, recalcule os hashes (SRI):
//   curl -sL <url> | openssl dgst -sha384 -binary | openssl base64 -A
const MAPLIBRE_URL = 'https://cdn.jsdelivr.net/npm/maplibre-gl@5.24.0/dist';
const MAPLIBRE_JS_SRI = 'sha384-5+cfbwT0iiub6VsQAdn6yz16nr6sDiQoHx6tm4O8OVYXHYOxcffFmCJBL0dgdvGp';
const MAPLIBRE_CSS_SRI = 'sha384-uTttxo/aOKbdE5RlD/SPzSDoDmNvGlUYPjONi2MN/b7c9HPSvW07OIuyP7uL6jxK';
const ESTILO_CLARO = 'https://tiles.openfreemap.org/styles/liberty';
const ESTILO_ESCURO = 'https://tiles.openfreemap.org/styles/dark';
const ZOOM_INICIAL = 15;

/** Mensagem que a página manda ao app quando o MapLibre não carrega (ex.: sem internet). */
export const MENSAGEM_ERRO_MAPA = 'erro';

type Opcoes = { posicao: Coordenada; escuro: boolean; corMarcador: string };

// Só entram números e cores do tema, serializados com JSON.stringify: nada vindo do
// servidor é interpolado como HTML/JS.
function lngLat({ latitude, longitude }: Coordenada) {
  return JSON.stringify([Number(longitude), Number(latitude)]);
}

export function gerarHtmlMapa({ posicao, escuro, corMarcador }: Opcoes) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="${MAPLIBRE_URL}/maplibre-gl.css" integrity="${MAPLIBRE_CSS_SRI}" crossorigin="anonymous">
<style>html, body, #mapa { margin: 0; height: 100%; background: ${escuro ? '#1b1b1b' : '#eeeeee'}; }</style>
</head>
<body>
<div id="mapa"></div>
<script src="${MAPLIBRE_URL}/maplibre-gl.js" integrity="${MAPLIBRE_JS_SRI}" crossorigin="anonymous"></script>
<script>
(function () {
  var avisar = function (msg) { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(msg); };
  if (typeof maplibregl === 'undefined') { avisar(${JSON.stringify(MENSAGEM_ERRO_MAPA)}); return; }
  var posicao = ${lngLat(posicao)};
  var mapa = new maplibregl.Map({
    container: 'mapa',
    style: ${JSON.stringify(escuro ? ESTILO_ESCURO : ESTILO_CLARO)},
    center: posicao,
    zoom: ${ZOOM_INICIAL},
    attributionControl: { compact: true }
  });
  var marcador = new maplibregl.Marker({ color: ${JSON.stringify(corMarcador)} }).setLngLat(posicao).addTo(mapa);
  // Chamada pelo app a cada nova posição: o mapa acompanha o veículo.
  window.atualizarPosicao = function (lng, lat) {
    marcador.setLngLat([lng, lat]);
    mapa.easeTo({ center: [lng, lat] });
  };
})();
</script>
</body>
</html>`;
}

/** Script injetado na WebView para mover o marcador sem recarregar a página. */
export function scriptAtualizarPosicao({ latitude, longitude }: Coordenada) {
  return `window.atualizarPosicao && window.atualizarPosicao(${Number(longitude)}, ${Number(latitude)}); true;`;
}
