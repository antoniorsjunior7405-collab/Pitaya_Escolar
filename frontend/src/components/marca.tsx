import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Identidade visual: "Pitaya" no magenta da fruta e "Escolar" no verde da folha,
// com um selo que lembra a fruta (miolo claro com sementes).
export function Marca({ subtitulo }: { subtitulo?: string }) {
  const theme = useTheme();

  return (
    <View style={styles.container} accessibilityRole="header" accessibilityLabel="Pitaya Escolar">
      <View style={[styles.selo, { backgroundColor: theme.primary }]}>
        <View style={[styles.miolo, { backgroundColor: theme.background }]}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.semente, { backgroundColor: theme.text }]} />
          ))}
        </View>
        <View style={[styles.folha, { backgroundColor: theme.secondary }]} />
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
  selo: {
    width: 72,
    height: 72,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  miolo: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  semente: { width: 4, height: 4, borderRadius: Radius.pill },
  folha: {
    position: 'absolute',
    top: -6,
    right: 8,
    width: 18,
    height: 10,
    borderRadius: Radius.pill,
    transform: [{ rotate: '-35deg' }],
  },
  centro: { textAlign: 'center' },
});
