import { Stack } from 'expo-router';

import { useStackOptions } from '@/hooks/use-stack-options';

// Área do Responsável. A tela "acompanhar/[id]" define o próprio título.
export default function ResponsavelLayout() {
  const opcoes = useStackOptions();
  return (
    <Stack screenOptions={opcoes}>
      <Stack.Screen name="index" options={{ title: 'Meus filhos' }} />
      <Stack.Screen name="buscar-motorista" options={{ title: 'Buscar motorista' }} />
      <Stack.Screen name="pedidos" options={{ title: 'Meus pedidos' }} />
      <Stack.Screen name="pedido/[id]" options={{ title: 'Pedido de transporte' }} />
    </Stack>
  );
}
