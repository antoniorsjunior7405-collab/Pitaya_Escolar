import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { textoDoPrazo } from '@/components/status-pedido';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { EstadoCarregando } from '@/components/ui/estado-carregando';
import { EstadoErro } from '@/components/ui/estado-erro';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Spacing } from '@/constants/theme';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { tempoDesde } from '@/lib/formatar';
import { mensagemDeErro } from '@/lib/http';
import { chavesVinculos, listarPedidosRecebidos, responderPedido } from '@/services/vinculos';

type Resposta = { id: string; decisao: 'aceitar' | 'recusar' };

// Pedidos de transporte recebidos. Antes de aceitar, o motorista vê só os primeiros nomes;
// ao aceitar, a família recebe o telefone dele para combinar os detalhes.
export default function PedidosRecebidos() {
  const responsivo = useResponsive();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [respondendo, setRespondendo] = useState<Resposta | null>(null);

  const pedidos = useQuery({
    queryKey: chavesVinculos.recebidos,
    queryFn: listarPedidosRecebidos,
    refetchInterval: 60_000,
  });
  const responder = useMutation({
    mutationFn: ({ id, decisao }: Resposta) => responderPedido(id, decisao),
    onMutate: (resposta) => setRespondendo(resposta),
    onSettled: () => {
      setRespondendo(null);
      // Respondido (ou já respondido/cancelado pela família): a fila muda nos dois casos.
      void queryClient.invalidateQueries({ queryKey: chavesVinculos.recebidos });
    },
  });

  if (pedidos.isPending) return <EstadoCarregando />;
  if (pedidos.isError) {
    return <EstadoErro erro={pedidos.error} onTentarNovamente={() => void pedidos.refetch()} />;
  }

  const ocupado = (id: string, decisao: Resposta['decisao']) =>
    respondendo?.id === id && respondendo.decisao === decisao;

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <FlatList
        data={pedidos.data}
        keyExtractor={(p) => p.id}
        contentContainerStyle={[styles.lista, responsivo.conteudo]}
        refreshing={pedidos.isRefetching}
        onRefresh={() => void pedidos.refetch()}
        ListHeaderComponent={
          responder.isError ? (
            <ThemedText accessibilityRole="alert" style={{ color: theme.danger }}>
              {mensagemDeErro(responder.error)}
            </ThemedText>
          ) : null
        }
        ListEmptyComponent={
          <EstadoVazio
            titulo="Nenhum pedido aguardando"
            descricao="Quando uma família pedir transporte com você, o pedido aparece aqui."
          />
        }
        renderItem={({ item }) => (
          <Card>
            <ThemedText type="smallBold" style={styles.titulo}>
              {item.alunoPrimeiroNome}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Responsável: {item.responsavelPrimeiroNome} · recebido {tempoDesde(item.criadoEm)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              O pedido {textoDoPrazo(item.expiraEm)}
            </ThemedText>
            <View style={styles.acoes}>
              <PrimaryButton
                titulo={`Aceitar ${item.alunoPrimeiroNome}`}
                carregando={ocupado(item.id, 'aceitar')}
                desabilitado={respondendo !== null}
                onPress={() => responder.mutate({ id: item.id, decisao: 'aceitar' })}
              />
              <PrimaryButton
                titulo="Recusar"
                variante="secundario"
                carregando={ocupado(item.id, 'recusar')}
                desabilitado={respondendo !== null}
                onPress={() => responder.mutate({ id: item.id, decisao: 'recusar' })}
              />
            </View>
          </Card>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  lista: { paddingVertical: Spacing.three, gap: Spacing.three },
  titulo: { fontSize: 16 },
  acoes: { gap: Spacing.two },
});
