import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Alert, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StatusBadge } from '@/components/status-badge';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { EstadoCarregando } from '@/components/ui/estado-carregando';
import { EstadoErro } from '@/components/ui/estado-erro';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Spacing } from '@/constants/theme';
import { useRastreamentoViagem, type EstadoRastreamento } from '@/hooks/use-rastreamento-viagem';
import { useResponsive } from '@/hooks/use-responsive';
import { mensagemDeErro } from '@/lib/http';
import {
  chavesMotorista,
  detalharRota,
  finalizarViagem,
  iniciarViagem,
  registrarEvento,
} from '@/services/motorista';
import type { TipoEvento } from '@/types';

const AVISO_GPS: Record<EstadoRastreamento, string | null> = {
  inativo: null,
  'aguardando-gps': 'Obtendo sua localização…',
  ativo: 'Localização sendo compartilhada com os responsáveis. Mantenha o app aberto.',
  'sem-permissao':
    'Sem permissão de localização: os responsáveis não verão o veículo no mapa. Ative nas configurações do aparelho.',
  erro: 'Falha ao enviar a localização. Tentando novamente…',
};

// Tela de uma rota: iniciar a viagem, marcar embarque/entrega e finalizar.
// As regras (RN-08 etc.) são validadas no backend; aqui a interface só guia o motorista.
export default function DetalheDaRota() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const responsivo = useResponsive();
  const queryClient = useQueryClient();
  const rota = useQuery({ queryKey: chavesMotorista.rota(id), queryFn: () => detalharRota(id) });

  const viagem = rota.data?.viagemAtual ?? null;
  const emAndamento = viagem?.status === 'EM_ANDAMENTO';
  const rastreamento = useRastreamentoViagem(emAndamento ? viagem.id : null);

  const atualizar = () => queryClient.invalidateQueries({ queryKey: chavesMotorista.rota(id) });
  const avisarErro = (erro: unknown) =>
    Alert.alert('Não foi possível concluir', mensagemDeErro(erro));

  const iniciar = useMutation({ mutationFn: () => iniciarViagem(id), onSuccess: atualizar, onError: avisarErro });
  const finalizar = useMutation({
    mutationFn: (viagemId: string) => finalizarViagem(viagemId),
    onSuccess: () => {
      void atualizar();
      void queryClient.invalidateQueries({ queryKey: chavesMotorista.historico });
    },
    onError: avisarErro,
  });
  const evento = useMutation({
    mutationFn: (v: { viagemId: string; alunoId: string; tipo: TipoEvento }) =>
      registrarEvento(v.viagemId, v.alunoId, v.tipo),
    onSuccess: atualizar,
    onError: avisarErro,
  });

  function confirmarFinalizacao(viagemId: string) {
    Alert.alert('Finalizar viagem?', 'Depois de finalizada, não é possível registrar mais embarques.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Finalizar', style: 'destructive', onPress: () => finalizar.mutate(viagemId) },
    ]);
  }

  if (rota.isPending) return <EstadoCarregando mensagem="Carregando rota…" />;
  if (rota.isError) return <EstadoErro erro={rota.error} onTentarNovamente={() => void rota.refetch()} />;

  const { data } = rota;
  const aviso = AVISO_GPS[rastreamento];

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Stack.Screen options={{ title: data.nome }} />
      <FlatList
        data={data.alunos}
        keyExtractor={(aluno) => aluno.id}
        contentContainerStyle={[styles.lista, responsivo.conteudo]}
        refreshing={rota.isRefetching}
        onRefresh={() => void rota.refetch()}
        ListEmptyComponent={
          <EstadoVazio titulo="Sem alunos nesta rota" descricao="Peça à escola para incluir os alunos." />
        }
        ListHeaderComponent={
          <>
            <Card>
              <ThemedText type="small" themeColor="textSecondary">
                Veículo: {data.veiculo.modelo} ({data.veiculo.placa})
              </ThemedText>
              <StatusBadge status={viagem?.status ?? 'PLANEJADA'} />

              {!emAndamento && (
                <PrimaryButton
                  titulo={viagem?.status === 'FINALIZADA' ? 'Iniciar nova viagem' : 'Iniciar viagem'}
                  carregando={iniciar.isPending}
                  onPress={() => iniciar.mutate()}
                />
              )}
              {emAndamento && (
                <PrimaryButton
                  titulo="Finalizar viagem"
                  variante="secundario"
                  carregando={finalizar.isPending}
                  onPress={() => confirmarFinalizacao(viagem.id)}
                />
              )}
              {aviso ? (
                <ThemedText
                  type="small"
                  accessibilityRole="alert"
                  themeColor={rastreamento === 'ativo' ? 'textSecondary' : 'danger'}>
                  {aviso}
                </ThemedText>
              ) : null}
            </Card>
            <ThemedText type="subtitle" style={styles.secao}>
              Alunos
            </ThemedText>
          </>
        }
        ListFooterComponent={
          !emAndamento && data.alunos.length > 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              Inicie a viagem para marcar embarque e entrega.
            </ThemedText>
          ) : null
        }
        renderItem={({ item }) => {
          const proximo: TipoEvento | null =
            item.status === 'AGUARDANDO' ? 'EMBARCADO' : item.status === 'EMBARCADO' ? 'ENTREGUE' : null;
          const enviandoEste = evento.isPending && evento.variables?.alunoId === item.id;
          return (
            <Card>
              <ThemedText type="smallBold" style={styles.nome}>
                {item.ordem}. {item.nome}
              </ThemedText>
              {item.endereco ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {item.endereco}
                </ThemedText>
              ) : null}
              <StatusBadge status={emAndamento || viagem ? item.status : 'AGUARDANDO'} />
              {emAndamento && proximo ? (
                <PrimaryButton
                  titulo={proximo === 'EMBARCADO' ? `Embarcou: ${item.nome}` : `Entregue: ${item.nome}`}
                  carregando={enviandoEste}
                  desabilitado={evento.isPending && !enviandoEste}
                  onPress={() => evento.mutate({ viagemId: viagem.id, alunoId: item.id, tipo: proximo })}
                />
              ) : null}
            </Card>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  lista: { paddingVertical: Spacing.three, gap: Spacing.three },
  secao: { marginTop: Spacing.two },
  nome: { fontSize: 16 },
});
