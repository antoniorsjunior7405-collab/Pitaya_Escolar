import { StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Posicao } from '@/types';

type Props = { posicao: Posicao; titulo: string };

// Mapa com a posição do veículo. No Expo Go funciona sem configuração; para builds de loja
// no Android é preciso uma chave do Google Maps (config plugin "react-native-maps").
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
        showsCompass={false}
        toolbarEnabled={false}>
        <Marker coordinate={coordenada} title={titulo} pinColor={theme.primary} />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: 260, borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  mapa: { flex: 1 },
});
