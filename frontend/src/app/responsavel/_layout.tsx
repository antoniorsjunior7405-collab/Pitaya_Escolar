import { Stack } from 'expo-router';

// Área do Responsável. A tela "acompanhar/[id]" define o próprio título.
export default function ResponsavelLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Meus filhos' }} />
    </Stack>
  );
}
