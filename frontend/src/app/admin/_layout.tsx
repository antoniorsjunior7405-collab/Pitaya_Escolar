import { Stack } from 'expo-router';

import { useStackOptions } from '@/hooks/use-stack-options';

// Área administrativa: cadastros da organização. As telas de detalhe definem o próprio título.
export default function AdminLayout() {
  const opcoes = useStackOptions();
  return (
    <Stack screenOptions={opcoes}>
      <Stack.Screen name="index" options={{ title: 'Administração' }} />
      <Stack.Screen name="veiculos" options={{ title: 'Veículos' }} />
      <Stack.Screen name="alunos" options={{ title: 'Alunos' }} />
      <Stack.Screen name="rotas" options={{ title: 'Rotas' }} />
      <Stack.Screen name="pessoas" options={{ title: 'Pessoas' }} />
    </Stack>
  );
}
