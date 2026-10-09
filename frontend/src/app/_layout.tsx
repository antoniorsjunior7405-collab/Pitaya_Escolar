import { Stack } from 'expo-router';

// Layout raiz: um Stack (pilha de telas).
// "motorista" e "responsavel" são pastas com o próprio _layout, que têm o seu Stack.
// Por isso o cabeçalho delas é desligado aqui, para não aparecer dois cabeçalhos.
export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Pitaya Escolar' }} />
      <Stack.Screen name="motorista" options={{ headerShown: false }} />
      <Stack.Screen name="responsavel" options={{ headerShown: false }} />
    </Stack>
  );
}
