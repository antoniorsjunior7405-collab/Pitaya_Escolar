import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Ocupa o lugar do MapaVeiculo enquanto não há posição, explicando por quê.
export function MapaSemPosicao({ mensagem }: { mensagem: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.container, { borderColor: theme.border }]}>
      <ThemedText themeColor="textSecondary" style={styles.centro}>
        {mensagem}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 140,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
  },
  centro: { textAlign: 'center' },
});
