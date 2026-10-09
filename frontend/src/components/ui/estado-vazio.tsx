import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

// Estado "vazio" padrão das telas: explica o que aconteceu em vez de mostrar uma tela em branco.
export function EstadoVazio({ titulo, descricao }: { titulo: string; descricao?: string }) {
  return (
    <View style={styles.container} accessibilityRole="text">
      <ThemedText type="subtitle" style={styles.centro}>
        {titulo}
      </ThemedText>
      {descricao ? (
        <ThemedText themeColor="textSecondary" style={styles.centro}>
          {descricao}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.four, gap: Spacing.two, alignItems: 'center' },
  centro: { textAlign: 'center' },
});
