import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Posicao } from '@/types';

// react-native-maps não roda na web: mostramos as coordenadas em texto.
export function MapaVeiculo({ posicao, titulo }: { posicao: Posicao; titulo: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.container, { borderColor: theme.border }]}>
      <ThemedText type="smallBold">{titulo}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {posicao.latitude.toFixed(5)}, {posicao.longitude.toFixed(5)}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        O mapa está disponível no aplicativo para celular.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.three, gap: Spacing.one },
});
