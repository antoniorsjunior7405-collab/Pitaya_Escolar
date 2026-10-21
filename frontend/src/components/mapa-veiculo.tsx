import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Coordenada } from '@/types';

type Props = { posicao: Coordenada; titulo: string };

// No Android o react-native-maps usa o Google Maps, que sem chave própria (caso do Expo Go)
// fica cinza, só com o logo. Por isso desenhamos blocos de outro provedor, sem chave.
// Não dá para usar os servidores do OpenStreetMap: eles bloqueiam (403) o User-Agent
// genérico "Dalvik" que o react-native-maps envia, e a biblioteca não deixa trocá-lo.
// Os blocos do Esri servem para desenvolvimento e teste; para produção os termos do Esri
// pedem conta ArcGIS: trocar por um provedor contratado ou pela chave do Google.
// No iOS o padrão é o Apple Maps, que funciona sem chave.
const USAR_BLOCOS = Platform.OS === 'android';
// Atenção: o Esri usa a ordem {z}/{y}/{x}.
const BLOCOS_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';

export function MapaVeiculo({ posicao, titulo }: Props) {
  const theme = useTheme();
  const coordenada = { latitude: posicao.latitude, longitude: posicao.longitude };

  return (
    <View
      style={[styles.container, { borderColor: theme.border }]}
      accessible
      accessibilityLabel={`Mapa com a posição atual do veículo: ${titulo}`}>
      <MapView
        style={styles.mapa}
        // A região acompanha cada nova posição recebida.
        region={{ ...coordenada, latitudeDelta: 0.012, longitudeDelta: 0.012 }}
        mapType={USAR_BLOCOS ? 'none' : 'standard'}
        maxZoomLevel={USAR_BLOCOS ? 19 : undefined}
        showsCompass={false}
        toolbarEnabled={false}>
        {USAR_BLOCOS && <UrlTile urlTemplate={BLOCOS_URL} maximumZ={19} shouldReplaceMapContent />}
        <Marker coordinate={coordenada} title={titulo} pinColor={theme.primary} />
      </MapView>
      {USAR_BLOCOS && <Text style={styles.credito}>© Esri, © OpenStreetMap</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: 260, borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  mapa: { flex: 1 },
  credito: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    paddingHorizontal: 4,
    fontSize: 10,
    color: '#333',
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
});
