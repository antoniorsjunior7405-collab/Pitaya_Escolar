import { Stack } from 'expo-router';

// Área do Motorista. As telas "rota/[id]" definem o próprio título dentro do arquivo
// (o título depende da rota aberta).
export default function MotoristaLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Minhas rotas' }} />
      <Stack.Screen name="historico" options={{ title: 'Histórico' }} />
    </Stack>
  );
}
