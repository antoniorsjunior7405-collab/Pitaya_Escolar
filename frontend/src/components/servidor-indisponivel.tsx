import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Marca } from '@/components/marca';
import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/context/session';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';

/** Intervalo entre tentativas automáticas de reconexão. */
const RECONECTAR_A_CADA_MS = 15_000;

// Mostrada quando existe uma sessão salva, mas o servidor não respondeu (sem internet ou
// servidor gratuito "acordando"). Não desconecta a pessoa: a sessão pode estar válida.
// Tenta reconectar sozinha a cada 15 s e também pelo botão.
export function ServidorIndisponivel() {
  const responsivo = useResponsive();
  const theme = useTheme();
  const { tentarNovamente, sair, motivoIndisponivel, reconectando } = useSession();

  useEffect(() => {
    if (reconectando) return;
    const timer = setTimeout(() => void tentarNovamente(), RECONECTAR_A_CADA_MS);
    return () => clearTimeout(timer);
  }, [reconectando, tentarNovamente]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.conteudo, responsivo.formulario]}>
        <Marca />
        <ThemedText type="subtitle" style={styles.centro}>
          Não conseguimos conectar
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.centro} accessibilityRole="alert">
          {motivoIndisponivel ?? 'Verifique sua internet.'}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centro}>
          Se o servidor estava parado, ele leva cerca de 1 minuto para iniciar. Vamos tentar de
          novo automaticamente.
        </ThemedText>

        {reconectando ? (
          <View style={styles.linha} accessibilityRole="progressbar" accessibilityLabel="Reconectando">
            <ActivityIndicator color={theme.primary} />
            <ThemedText type="small" themeColor="textSecondary">
              Reconectando…
            </ThemedText>
          </View>
        ) : null}

        <PrimaryButton
          titulo="Tentar novamente"
          carregando={reconectando}
          onPress={() => void tentarNovamente()}
        />
        <PrimaryButton titulo="Sair" variante="secundario" onPress={() => void sair()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  conteudo: { flex: 1, justifyContent: 'center', gap: Spacing.three },
  centro: { textAlign: 'center' },
  linha: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: Spacing.two },
});
