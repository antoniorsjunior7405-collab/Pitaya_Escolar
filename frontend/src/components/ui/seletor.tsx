import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Opcao<T extends string> = { valor: T; rotulo: string };

type Props<T extends string> = {
  rotulo: string;
  opcoes: Opcao<T>[];
  valor: T | null;
  onChange: (valor: T) => void;
  vazio?: string;
};

// Escolha única em "chips": quebra linha sozinho em telas estreitas ou com fonte grande.
// Acessível como grupo de opções (radio), com o estado selecionado anunciado.
export function Seletor<T extends string>({ rotulo, opcoes, valor, onChange, vazio }: Props<T>) {
  const theme = useTheme();

  return (
    <View style={styles.campo}>
      <ThemedText type="smallBold">{rotulo}</ThemedText>
      {opcoes.length === 0 && vazio ? (
        <ThemedText type="small" themeColor="textSecondary">
          {vazio}
        </ThemedText>
      ) : null}
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={rotulo}>
        {opcoes.map((opcao) => {
          const selecionado = opcao.valor === valor;
          return (
            <Pressable
              key={opcao.valor}
              accessibilityRole="radio"
              accessibilityState={{ checked: selecionado }}
              accessibilityLabel={opcao.rotulo}
              onPress={() => onChange(opcao.valor)}
              style={[
                styles.chip,
                selecionado
                  ? { backgroundColor: theme.primary, borderColor: theme.primary }
                  : { backgroundColor: theme.backgroundElement, borderColor: theme.borderStrong },
              ]}>
              <ThemedText
                type="smallBold"
                style={{ color: selecionado ? theme.onPrimary : theme.text }}>
                {opcao.rotulo}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  campo: { gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
});
