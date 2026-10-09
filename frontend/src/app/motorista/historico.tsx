import { useQuery } from '@tanstack/react-query';
import { FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StatusBadge } from '@/components/status-badge';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { EstadoCarregando } from '@/components/ui/estado-carregando';
import { EstadoErro } from '@/components/ui/estado-erro';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { Spacing } from '@/constants/theme';
import { useResponsive } from '@/hooks/use-responsive';
import { formatarData, formatarHora } from '@/lib/formatar';
import { chavesMotorista, listarHistorico } from '@/services/motorista';

export default function Historico() {
  const responsivo = useResponsive();
  const viagens = useQuery({ queryKey: chavesMotorista.historico, queryFn: listarHistorico });

  if (viagens.isPending) return <EstadoCarregando mensagem="Carregando histórico…" />;
  if (viagens.isError) {
    return <EstadoErro erro={viagens.error} onTentarNovamente={() => void viagens.refetch()} />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <FlatList
        data={viagens.data}
        keyExtractor={(viagem) => viagem.id}
        contentContainerStyle={[styles.lista, responsivo.conteudo]}
        refreshing={viagens.isRefetching}
        onRefresh={() => void viagens.refetch()}
        ListEmptyComponent={
          <EstadoVazio titulo="Sem viagens ainda" descricao="As viagens finalizadas aparecem aqui." />
        }
        renderItem={({ item }) => (
          <Card>
            <ThemedText type="smallBold" style={styles.titulo}>
              {item.rotaNome}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatarData(item.data)} · {formatarHora(item.iniciadaEm)} às{' '}
              {formatarHora(item.finalizadaEm)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {item.alunosAtendidos} {item.alunosAtendidos === 1 ? 'aluno atendido' : 'alunos atendidos'}
            </ThemedText>
            <StatusBadge status="FINALIZADA" />
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
});
