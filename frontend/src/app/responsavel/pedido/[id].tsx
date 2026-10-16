import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StatusPedido } from '@/components/status-pedido';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { EstadoCarregando } from '@/components/ui/estado-carregando';
import { EstadoErro } from '@/components/ui/estado-erro';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useResponsive } from '@/hooks/use-responsive';
import { mensagemDeErro } from '@/lib/http';
import {
  cancelarPedido,
  chavesVinculos,
  detalharPedido,
  intervaloDoPedido,
} from '@/services/vinculos';
import type { EstadoPedido } from '@/types';

/** Desfechos em que a família precisa procurar (de novo) um motorista. */
const ESTADOS_PARA_NOVA_BUSCA: readonly EstadoPedido[] = ['RECUSADA', 'EXPIRADA', 'CANCELADA'];

// Tela de espera do pedido de transporte. Enquanto PENDENTE consulta o servidor a cada 15 s
// (ACEITA, RECUSADA, EXPIRADA e CANCELADA são finais: a consulta para). Sem conexão, mantém o
// último status conhecido: falha de rede nunca vira "recusado".
export default function PedidoTransporte() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const responsivo = useResponsive();
  const router = useRouter();
  const theme = useTheme();
  const queryClient = useQueryClient();

  const pedido = useQuery({
    queryKey: chavesVinculos.pedido(id),
    queryFn: () => detalharPedido(id),
    refetchInterval: (query) => intervaloDoPedido(query.state.data?.estado),
  });

  const cancelar = useMutation({
    mutationFn: () => cancelarPedido(id),
    onSuccess: (atualizado) => {
      queryClient.setQueryData(chavesVinculos.pedido(id), atualizado);
      void queryClient.invalidateQueries({ queryKey: chavesVinculos.pedidos });
    },
    // Ex.: o motorista respondeu no mesmo instante (409). Busca o estado real.
    onError: () => void pedido.refetch(),
  });

  if (pedido.isPending) return <EstadoCarregando mensagem="Carregando o pedido…" />;
  if (!pedido.data) {
    return <EstadoErro erro={pedido.error} onTentarNovamente={() => void pedido.refetch()} />;
  }

  const p = pedido.data;

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={[styles.conteudo, responsivo.conteudo]}>
        {/* Momento da última consulta: avança a cada atualização, sem relógio no render. */}
        <StatusPedido pedido={p} agora={pedido.dataUpdatedAt} />

        {pedido.isError ? (
          <Card>
            <ThemedText accessibilityRole="alert">
              {mensagemDeErro(pedido.error)} Mostrando o último status conhecido.
            </ThemedText>
            <PrimaryButton
              titulo="Tentar de novo"
              variante="secundario"
              onPress={() => void pedido.refetch()}
            />
          </Card>
        ) : null}

        {cancelar.isError ? (
          <ThemedText accessibilityRole="alert" style={{ color: theme.danger }}>
            {mensagemDeErro(cancelar.error)}
          </ThemedText>
        ) : null}

        <View style={styles.acoes}>
          {p.estado === 'PENDENTE' ? (
            <PrimaryButton
              titulo="Cancelar pedido"
              variante="secundario"
              carregando={cancelar.isPending}
              onPress={() => cancelar.mutate()}
            />
          ) : null}
          {p.estado === 'ACEITA' ? (
            <PrimaryButton
              titulo="Ver meus filhos"
              onPress={() => router.replace('/responsavel')}
            />
          ) : null}
          {ESTADOS_PARA_NOVA_BUSCA.includes(p.estado) ? (
            <PrimaryButton
              titulo={p.estado === 'RECUSADA' ? 'Buscar outro motorista' : 'Buscar motorista'}
              onPress={() => router.replace('/responsavel/buscar-motorista')}
            />
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  conteudo: { paddingVertical: Spacing.three, gap: Spacing.three },
  acoes: { gap: Spacing.two },
});
