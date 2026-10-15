import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ROTULO_DO_PEDIDO } from '@/components/status-pedido';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { EstadoCarregando } from '@/components/ui/estado-carregando';
import { EstadoErro } from '@/components/ui/estado-erro';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Spacing } from '@/constants/theme';
import { useResponsive } from '@/hooks/use-responsive';
import { tempoDesde } from '@/lib/formatar';
import { chavesVinculos, listarPedidos } from '@/services/vinculos';

// Pedidos de transporte da família. Tocar num pedido abre a tela de espera dele.
export default function MeusPedidos() {
  const responsivo = useResponsive();
  const router = useRouter();
  const pedidos = useQuery({
    queryKey: chavesVinculos.pedidos,
    queryFn: listarPedidos,
    refetchInterval: 60_000,
  });

  if (pedidos.isPending) return <EstadoCarregando />;
  if (pedidos.isError) {
    return <EstadoErro erro={pedidos.error} onTentarNovamente={() => void pedidos.refetch()} />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <FlatList
        data={pedidos.data}
        keyExtractor={(p) => p.id}
        contentContainerStyle={[styles.lista, responsivo.conteudo]}
        refreshing={pedidos.isRefetching}
        onRefresh={() => void pedidos.refetch()}
        ListEmptyComponent={
          <EstadoVazio
            titulo="Nenhum pedido ainda"
            descricao="Busque o motorista com quem você combinou o transporte e envie um pedido."
          />
        }
        renderItem={({ item }) => (
          <Card
            accessibilityLabel={`Pedido para ${item.motorista.nome}: ${ROTULO_DO_PEDIDO[item.estado]}`}
            onPress={() =>
              router.push({ pathname: '/responsavel/pedido/[id]', params: { id: item.id } })
            }>
            <ThemedText type="smallBold" style={styles.titulo}>
              {item.motorista.nome}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Para {item.aluno.nome} · {tempoDesde(item.criadoEm)}
            </ThemedText>
            <ThemedText type="smallBold">{ROTULO_DO_PEDIDO[item.estado]}</ThemedText>
          </Card>
        )}
        ListFooterComponent={
          <View style={styles.rodape}>
            <PrimaryButton
              titulo="Buscar motorista"
              onPress={() => router.push('/responsavel/buscar-motorista')}
            />
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  lista: { paddingVertical: Spacing.three, gap: Spacing.three },
  titulo: { fontSize: 16 },
  rodape: { marginTop: Spacing.three },
});
