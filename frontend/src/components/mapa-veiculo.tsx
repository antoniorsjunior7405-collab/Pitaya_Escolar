import { useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from 'react-native-webview';

import { MapaSemPosicao } from '@/components/mapa-sem-posicao';
import { Radius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { gerarHtmlMapa, MENSAGEM_ERRO_MAPA, scriptAtualizarPosicao } from '@/lib/mapa-html';
import type { Coordenada } from '@/types';

type Props = { posicao: Coordenada; titulo: string };

// O mapa é uma página MapLibre + OpenFreeMap dentro de uma WebView (ver lib/mapa-html.ts):
// sem chave do Google, funciona no Expo Go e nos builds de Android e iOS.
export function MapaVeiculo({ posicao, titulo }: Props) {
  const theme = useTheme();
  const escuro = useColorScheme() === 'dark';
  const webView = useRef<WebView>(null);
  // A página nasce com a primeira posição; as seguintes são injetadas, sem recarregar o mapa.
  const [posicaoInicial] = useState(posicao);
  const [falhou, setFalhou] = useState(false);
  const html = gerarHtmlMapa({ posicao: posicaoInicial, escuro, corMarcador: theme.primary });
  const atualizar = scriptAtualizarPosicao(posicao);

  useEffect(() => {
    webView.current?.injectJavaScript(atualizar);
  }, [atualizar]);

  function aoReceberMensagem(evento: WebViewMessageEvent) {
    if (evento.nativeEvent.data === MENSAGEM_ERRO_MAPA) setFalhou(true);
  }

  if (falhou) {
    return (
      <MapaSemPosicao mensagem="Não foi possível carregar o mapa. Confira sua conexão com a internet." />
    );
  }

  return (
    <View
      style={[styles.container, { borderColor: theme.border }]}
      accessible
      accessibilityLabel={`Mapa com a posição atual do veículo: ${titulo}`}>
      <WebView
        ref={webView}
        style={styles.mapa}
        originWhitelist={['*']}
        source={{ html }}
        // Se uma posição chegou antes de a página terminar de carregar, aplica agora.
        onLoadEnd={() => webView.current?.injectJavaScript(atualizar)}
        onMessage={aoReceberMensagem}
        onError={() => setFalhou(true)}
        onShouldStartLoadWithRequest={abrirLinksFora}
        scrollEnabled={false}
        overScrollMode="never"
        setSupportMultipleWindows={false}
      />
    </View>
  );
}

// A página do mapa não navega: links (ex.: o crédito do OpenStreetMap) abrem no navegador.
function abrirLinksFora({ url }: WebViewNavigation) {
  if (url === 'about:blank') return true;
  void Linking.openURL(url);
  return false;
}

const styles = StyleSheet.create({
  container: { height: 260, borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  mapa: { flex: 1 },
});
