import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { PropsWithChildren } from 'react';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = PropsWithChildren<{
  /** Se informado, o card vira um botão tocável. */
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}>;

// Um único lugar define a aparência dos cards (cores vêm do tema: claro e escuro).
export function Card({ children, onPress, accessibilityLabel, style }: Props) {
  const theme = useTheme();
  const base = [
    styles.card,
    { backgroundColor: theme.backgroundElement, borderColor: theme.border },
    style,
  ];

  if (!onPress) return <View style={base}>{children}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [base, pressed && styles.pressionado]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  pressionado: { opacity: 0.7 },
});
