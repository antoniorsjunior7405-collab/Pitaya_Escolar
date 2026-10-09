import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  titulo: string;
  onPress: () => void;
  carregando?: boolean;
  desabilitado?: boolean;
  variante?: 'primario' | 'secundario';
};

// Alvo de toque com no mínimo 48 pt de altura (guia: mínimo recomendado 44 pt).
export function PrimaryButton({
  titulo,
  onPress,
  carregando = false,
  desabilitado = false,
  variante = 'primario',
}: Props) {
  const theme = useTheme();
  const inativo = desabilitado || carregando;
  const primario = variante === 'primario';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityState={{ disabled: inativo, busy: carregando }}
      disabled={inativo}
      onPress={onPress}
      style={({ pressed }) => [
        styles.botao,
        primario
          ? { backgroundColor: theme.primary }
          : { backgroundColor: 'transparent', borderColor: theme.primary, borderWidth: 1.5 },
        (pressed || inativo) && styles.apagado,
      ]}>
      {carregando ? (
        <ActivityIndicator color={primario ? theme.onPrimary : theme.primary} />
      ) : (
        <ThemedText
          type="smallBold"
          style={{ color: primario ? theme.onPrimary : theme.primary, fontSize: 16 }}>
          {titulo}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  botao: {
    minHeight: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  apagado: { opacity: 0.6 },
});
