import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/context/session';
import { useResponsive } from '@/hooks/use-responsive';

// Mostrada quando existe uma sessão salva, mas o servidor não respondeu (offline ou dormindo).
// Não desconectamos o usuário: a sessão pode estar perfeitamente válida.
export function ServidorIndisponivel() {
  const responsivo = useResponsive();
  const { tentarNovamente, sair } = useSession();

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.conteudo, responsivo.formulario]}>
        <ThemedText type="subtitle" style={styles.centro}>
          Não conseguimos conectar
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.centro}>
          Verifique sua internet. Se o problema continuar, o servidor pode estar iniciando: tente
          novamente em instantes.
        </ThemedText>
        <PrimaryButton titulo="Tentar novamente" onPress={() => void tentarNovamente()} />
        <PrimaryButton titulo="Sair" variante="secundario" onPress={() => void sair()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  conteudo: { flex: 1, justifyContent: 'center', gap: Spacing.three },
  centro: { textAlign: 'center' },
});
