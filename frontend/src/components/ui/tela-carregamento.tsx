import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CaminhoAtePitaya } from '@/components/caminho-ate-pitaya';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  /** Texto principal, também anunciado pelo leitor de tela. */
  mensagem?: string;
  /** Explicação curta abaixo da mensagem (ex.: "O servidor pode levar alguns segundos"). */
  descricao?: string;
  /** Espaço para ações da tela que reaproveita o modelo (ex.: botão "Cancelar pedido"). */
  children?: ReactNode;
};

// Modelo de tela de carregamento de página inteira: o carro indo até a pitaya.
// As telas que precisam dele o reaproveitam por composição (mensagem, descrição e
// `children` como espaço para ações), em vez de copiar o layout.
// Para carregamentos dentro de listas ou cards, continue usando `EstadoCarregando`.
export function TelaCarregamento({ mensagem = 'Carregando…', descricao, children }: Props) {
  const theme = useTheme();
  const responsivo = useResponsive();
  const rotulo = descricao ? `${mensagem} ${descricao}` : mensagem;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.conteudo, responsivo.formulario]}>
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={rotulo}
          style={styles.status}>
          <CaminhoAtePitaya />
          <ThemedText type="subtitle" style={styles.centro}>
            {mensagem}
          </ThemedText>
          {descricao ? (
            <ThemedText themeColor="textSecondary" style={styles.centro}>
              {descricao}
            </ThemedText>
          ) : null}
        </View>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  conteudo: { flex: 1, justifyContent: 'center', gap: Spacing.four },
  status: { alignItems: 'center', gap: Spacing.three },
  centro: { textAlign: 'center' },
});
