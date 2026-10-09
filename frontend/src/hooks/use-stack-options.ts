import { useTheme } from '@/hooks/use-theme';

// Aparência padrão dos cabeçalhos de navegação: mesma paleta em todas as áreas do app.
export function useStackOptions() {
  const theme = useTheme();
  return {
    headerStyle: { backgroundColor: theme.background },
    headerTintColor: theme.primary,
    headerTitleStyle: { color: theme.text, fontWeight: '700' as const },
    headerShadowVisible: false,
    contentStyle: { backgroundColor: theme.background },
  };
}
