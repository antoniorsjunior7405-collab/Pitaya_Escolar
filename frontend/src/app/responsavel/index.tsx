import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StatusBadge } from '@/components/status-badge';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { EstadoCarregando } from '@/components/ui/estado-carregando';
import { EstadoErro } from '@/components/ui/estado-erro';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/context/session';
import { useResponsive } from '@/hooks/use-responsive';
import { chavesResponsavel, listarFilhos } from '@/services/responsavel';

export default function MeusFilhos() {
  const responsivo = useResponsive();
  const router = useRouter();
  const { sair } = useSession();
  const filhos = useQuery({
    queryKey: chavesResponsavel.filhos,
    queryFn: listarFilhos,
    // Status muda durante a viagem (embarcou/entregue): atualiza sozinho a cada 30 s.
    refetchInterval: 30_000,
  });

  if (filhos.isPending) return <EstadoCarregando mensagem="Carregando…" />;
  if (filhos.isError) {
    return <EstadoErro erro={filhos.error} onTentarNovamente={() => void filhos.refetch()} />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <FlatList
        data={filhos.data}
        keyExtractor={(filho) => filho.id}
        contentContainerStyle={[styles.lista, responsivo.conteudo]}
        refreshing={filhos.isRefetching}
        onRefresh={() => void filhos.refetch()}
        ListEmptyComponent={
          <EstadoVazio
            titulo="Nenhum filho vinculado"
            descricao="Peça à escola para vincular seus filhos à sua conta."
          />
        }
        renderItem={({ item }) => (
          <Card
            accessibilityLabel={`Acompanhar ${item.nome}`}
            onPress={() =>
              router.push({ pathname: '/responsavel/acompanhar/[id]', params: { id: item.id } })
            }>
            <ThemedText type="smallBold" style={styles.titulo}>
              {item.nome}
            </ThemedText>
            {item.rotaNome ? (
              <ThemedText type="small" themeColor="textSecondary">
                {item.rotaNome}
              </ThemedText>
            ) : null}
            <View style={styles.badges}>
              {item.viagem ? <StatusBadge status={item.viagem.status} /> : null}
              <StatusBadge status={item.statusAluno} />
            </View>
          </Card>
        )}
        ListFooterComponent={
          <View style={styles.rodape}>
            <PrimaryButton titulo="Sair" variante="secundario" onPress={() => void sair()} />
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
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  rodape: { marginTop: Spacing.three },
});
