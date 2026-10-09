import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = TextInputProps & {
  rotulo: string;
  erro?: string | undefined;
};

export function TextField({ rotulo, erro, style, ...rest }: Props) {
  const theme = useTheme();

  return (
    <View style={styles.campo}>
      <ThemedText type="smallBold">{rotulo}</ThemedText>
      <TextInput
        accessibilityLabel={rotulo}
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          {
            color: theme.text,
            backgroundColor: theme.backgroundElement,
            borderColor: erro ? theme.danger : theme.borderStrong,
          },
          style,
        ]}
        {...rest}
      />
      {erro ? (
        <ThemedText type="small" accessibilityRole="alert" style={{ color: theme.danger }}>
          {erro}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  campo: { gap: Spacing.one },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
});
