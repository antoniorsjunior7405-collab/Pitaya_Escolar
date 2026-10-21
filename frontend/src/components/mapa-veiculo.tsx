import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Coordenada } from '@/types';

type Props = { posicao: Coordenada; titulo: string };

// No Android o react-native-maps usa o Google Maps, que sem chave própria (caso do Expo Go)
// fica cinza, só com o logo. Por isso desenhamos os blocos do OpenStreetMap, que não pedem
// chave. A política de uso do OSM exige o crédito visível e não aceita uso pesado: para
// volume de produção, trocar por um provedor contratado ou pela chave do Google.
// No iOS o padrão é o Apple Maps, que funciona sem chave.
const USAR_OSM = Platform.OS === 'android';
const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

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
        mapType={USAR_OSM ? 'none' : 'standard'}
        maxZoomLevel={USAR_OSM ? 19 : undefined}
        showsCompass={false}
        toolbarEnabled={false}>
        {USAR_OSM && <UrlTile urlTemplate={OSM_TILES} maximumZ={19} shouldReplaceMapContent />}
        <Marker coordinate={coordenada} title={titulo} pinColor={theme.primary} />
      </MapView>
      {USAR_OSM && <Text style={styles.credito}>© OpenStreetMap</Text>}
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
