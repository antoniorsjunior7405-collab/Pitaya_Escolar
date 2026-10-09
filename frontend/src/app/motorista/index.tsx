import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { EstadoCarregando } from '@/components/ui/estado-carregando';
import { EstadoErro } from '@/components/ui/estado-erro';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/context/session';
import { useResponsive } from '@/hooks/use-responsive';
import { chavesMotorista, listarRotas } from '@/services/motorista';
import type { Periodo } from '@/types';

const PERIODO: Record<Periodo, string> = { MANHA: 'Manhã', TARDE: 'Tarde', NOITE: 'Noite' };

export default function MinhasRotas() {
  const responsivo = useResponsive();
  const router = useRouter();
  const { sair } = useSession();
  const rotas = useQuery({ queryKey: chavesMotorista.rotas, queryFn: listarRotas });

  if (rotas.isPending) return <EstadoCarregando mensagem="Carregando suas rotas…" />;
  if (rotas.isError) return <EstadoErro erro={rotas.error} onTentarNovamente={() => void rotas.refetch()} />;

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <FlatList
        data={rotas.data}
        keyExtractor={(rota) => rota.id}
        contentContainerStyle={[styles.lista, responsivo.conteudo]}
        refreshing={rotas.isRefetching}
        onRefresh={() => void rotas.refetch()}
        ListEmptyComponent={
          <EstadoVazio
            titulo="Nenhuma rota ainda"
            descricao="Quando a escola cadastrar uma rota para você, ela aparece aqui."
          />
        }
        renderItem={({ item }) => (
          <Card
            accessibilityLabel={`Abrir rota ${item.nome}`}
            onPress={() =>
              router.push({ pathname: '/motorista/rota/[id]', params: { id: item.id } })
            }>
            <ThemedText type="smallBold" style={styles.titulo}>
              {item.nome}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {[item.periodo && PERIODO[item.periodo], `${item.totalAlunos} alunos`]
                .filter(Boolean)
                .join(' · ')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {item.veiculo.modelo} ({item.veiculo.placa})
            </ThemedText>
          </Card>
        )}
        ListFooterComponent={
          <View style={styles.rodape}>
            <PrimaryButton titulo="Ver histórico" onPress={() => router.push('/motorista/historico')} />
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
  rodape: { marginTop: Spacing.three, gap: Spacing.three },
});
