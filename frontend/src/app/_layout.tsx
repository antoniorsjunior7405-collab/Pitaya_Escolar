import { QueryClientProvider } from '@tanstack/react-query';
import { SplashScreen, Stack } from 'expo-router';
import { useEffect } from 'react';

import { ServidorIndisponivel } from '@/components/servidor-indisponivel';
import { SessionProvider, useSession } from '@/context/session';
import { useStackOptions } from '@/hooks/use-stack-options';
import { queryClient } from '@/lib/query-client';

// Mantém a splash visível até sabermos se existe uma sessão salva (evita piscar o login).
void SplashScreen.preventAutoHideAsync();

function Navegador() {
  const { status, papel } = useSession();
  const opcoes = useStackOptions();

  // Esconder a splash é efeito colateral: fica fora do render (componentes puros).
  useEffect(() => {
    if (status !== 'carregando') SplashScreen.hide();
  }, [status]);

  if (status === 'carregando') return null;
  if (status === 'indisponivel') return <ServidorIndisponivel />;

  const autenticado = status === 'autenticado';

  // Stack.Protected só controla a navegação no app (UX). A segurança de verdade é do
  // backend, que valida o token e as permissões em toda requisição.
  return (
    <Stack screenOptions={opcoes}>
      <Stack.Protected guard={!autenticado}>
        <Stack.Screen name="login" options={{ title: 'Entrar' }} />
        <Stack.Screen name="cadastro" options={{ title: 'Criar conta' }} />
        <Stack.Screen name="esqueci-senha" options={{ title: 'Esqueci a senha' }} />
      </Stack.Protected>

      {/* Aberta pelo link do e-mail: precisa funcionar logado ou não. */}
      <Stack.Screen name="redefinir-senha" options={{ title: 'Nova senha' }} />

      <Stack.Protected guard={autenticado}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Protected guard={papel === 'MOTORISTA'}>
          <Stack.Screen name="motorista" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={papel === 'RESPONSAVEL'}>
          <Stack.Screen name="responsavel" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={papel === 'ADMIN'}>
          <Stack.Screen name="admin" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <Navegador />
      </SessionProvider>
    </QueryClientProvider>
  );
}
