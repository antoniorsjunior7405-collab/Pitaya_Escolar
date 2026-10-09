import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import { ApiError } from '@/lib/http';

// Cache de dados do servidor (TanStack Query, recomendado no guia):
// - só tenta de novo em falha de rede/servidor (5xx), nunca em erro do cliente (4xx);
// - dados ficam "frescos" por 15 s, evitando refazer chamadas ao trocar de tela.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: (tentativas, erro) => erro instanceof ApiError && erro.indisponivel && tentativas < 2,
    },
    mutations: { retry: false },
  },
});

// No celular o React Query não sabe sozinho se o app está em primeiro plano. Sem isto, as
// atualizações periódicas (posição do veículo a cada 10 s) continuariam com o app minimizado,
// gastando bateria e dados. Ao voltar para o app, os dados são atualizados na hora.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (status: AppStateStatus) => {
    focusManager.setFocused(status === 'active');
  });
}
