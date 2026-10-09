import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'code';
  themeColor?: ThemeColor;
};

// Escala tipográfica do app (ver docs/DESIGN.md). Os tamanhos crescem com a fonte do
// sistema escolhida pela pessoa; maxFontSizeMultiplier evita quebrar o layout em escalas
// extremas sem desligar o recurso de acessibilidade.
export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const cor = themeColor ?? (type === 'link' ? 'primary' : 'text');

  return (
    <Text
      maxFontSizeMultiplier={2}
      style={[{ color: theme[cor] }, styles[type], style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 32, lineHeight: 40, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 22, lineHeight: 30, fontWeight: '700' },
  default: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  smallBold: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  small: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  link: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: '700', default: '500' }),
    fontSize: 12,
  },
});
