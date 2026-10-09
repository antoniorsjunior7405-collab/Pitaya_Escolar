import { Stack } from 'expo-router';

import { useStackOptions } from '@/hooks/use-stack-options';

// Área do Motorista. As telas "rota/[id]" definem o próprio título dentro do arquivo
// (o título depende da rota aberta).
export default function MotoristaLayout() {
  const opcoes = useStackOptions();
  return (
    <Stack screenOptions={opcoes}>
      <Stack.Screen name="index" options={{ title: 'Minhas rotas' }} />
      <Stack.Screen name="historico" options={{ title: 'Histórico' }} />
    </Stack>
  );
}
