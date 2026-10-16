import { StyleSheet, View } from 'react-native';

import { SeloPitaya } from '@/components/selo-pitaya';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

// Identidade visual: "Pitaya" no magenta da fruta e "Escolar" no verde da folha,
// com um selo que lembra a fruta (miolo claro com sementes).
export function Marca({ subtitulo }: { subtitulo?: string }) {
  return (
    <View style={styles.container} accessibilityRole="header" accessibilityLabel="Pitaya Escolar">
      <View style={styles.selo}>
        <SeloPitaya />
      </View>
      <ThemedText type="title" style={styles.centro}>
        <ThemedText type="title" themeColor="primary">
          Pitaya
        </ThemedText>{' '}
        <ThemedText type="title" themeColor="secondary">
          Escolar
        </ThemedText>
      </ThemedText>
      {subtitulo ? (
        <ThemedText themeColor="textSecondary" style={styles.centro}>
          {subtitulo}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: Spacing.two },
  selo: { marginBottom: Spacing.two },
  centro: { textAlign: 'center' },
});
