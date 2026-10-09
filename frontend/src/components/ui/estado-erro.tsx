import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Spacing } from '@/constants/theme';
import { mensagemDeErro } from '@/lib/http';

// Estado de erro padrão: mensagem clara + "tentar novamente" (offline é comum no trânsito).
export function EstadoErro({ erro, onTentarNovamente }: { erro: unknown; onTentarNovamente: () => void }) {
  const mensagem = mensagemDeErro(erro);

  return (
    <View style={styles.container}>
      <ThemedText type="subtitle" style={styles.centro}>
        Algo deu errado
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.centro} accessibilityRole="alert">
        {mensagem}
      </ThemedText>
      <PrimaryButton titulo="Tentar novamente" onPress={onTentarNovamente} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.four, gap: Spacing.three },
  centro: { textAlign: 'center' },
});
