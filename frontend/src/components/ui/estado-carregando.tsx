import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function EstadoCarregando({ mensagem = 'Carregando…' }: { mensagem?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.container} accessibilityRole="progressbar" accessibilityLabel={mensagem}>
      <ActivityIndicator size="large" color={theme.primary} />
      <ThemedText type="small" themeColor="textSecondary">
        {mensagem}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.five, gap: Spacing.three, alignItems: 'center' },
});
