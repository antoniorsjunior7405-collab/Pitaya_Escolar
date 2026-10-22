import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConfirmacaoChegada } from '@/components/confirmacao-chegada';
import { MapaSemPosicao } from '@/components/mapa-sem-posicao';
import { MapaVeiculo } from '@/components/mapa-veiculo';
import { StatusBadge } from '@/components/status-badge';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { EstadoCarregando } from '@/components/ui/estado-carregando';
import { EstadoErro } from '@/components/ui/estado-erro';
import { Spacing } from '@/constants/theme';
import { useResponsive } from '@/hooks/use-responsive';
import { avisar } from '@/lib/dialogo';
import { tempoDesde } from '@/lib/formatar';
import { mensagemDeErro } from '@/lib/http';
import { acompanharFilho, chavesResponsavel, confirmarChegada } from '@/services/responsavel';
import type { FilhoDetalhe } from '@/types';

/** Com a viagem em andamento, a posição é atualizada a cada 10 s (o motorista envia nesse ritmo). */
const ATUALIZACAO_EM_VIAGEM_MS = 10_000;

export default function AcompanharFilho() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const responsivo = useResponsive();
  const queryClient = useQueryClient();
  const filho = useQuery({
    queryKey: chavesResponsavel.filho(id),
    queryFn: () => acompanharFilho(id),
    refetchInterval: (query) =>
      query.state.data?.viagem?.status === 'EM_ANDAMENTO' ? ATUALIZACAO_EM_VIAGEM_MS : 60_000,
  });

  const confirmar = useMutation({
    mutationFn: () => confirmarChegada(id),
    // A resposta já traz a confirmação: a tela muda na hora, sem esperar a próxima atualização.
    onSuccess: (resumo) => {
      queryClient.setQueryData<FilhoDetalhe>(chavesResponsavel.filho(id), (atual) =>
        atual ? { ...atual, ...resumo } : atual,
      );
      void queryClient.invalidateQueries({ queryKey: chavesResponsavel.filhos });
    },
    onError: (erro) => avisar('Não foi possível confirmar', mensagemDeErro(erro)),
  });

  if (filho.isPending) return <EstadoCarregando />;
  if (filho.isError) {
    return <EstadoErro erro={filho.error} onTentarNovamente={() => void filho.refetch()} />;
  }

  const f = filho.data;
  const emViagem = f.viagem?.status === 'EM_ANDAMENTO';

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Stack.Screen options={{ title: f.nome }} />
      <ScrollView contentContainerStyle={[styles.conteudo, responsivo.conteudo]}>
        <Card>
          <ThemedText type="small" themeColor="textSecondary">
            Viagem
          </ThemedText>
          {f.viagem ? (
            <StatusBadge status={f.viagem.status} />
          ) : (
            <ThemedText type="small">Nenhuma viagem hoje</ThemedText>
          )}
          <ThemedText type="small" themeColor="textSecondary">
            Situação do aluno
          </ThemedText>
          <StatusBadge status={f.statusAluno} />
        </Card>

        {f.statusAluno === 'ENTREGUE' ? (
          <ConfirmacaoChegada
            nome={f.nome}
            confirmada={f.chegadaConfirmada}
            carregando={confirmar.isPending}
            onConfirmar={() => confirmar.mutate()}
          />
        ) : null}

        {emViagem && f.posicao ? (
          <View style={styles.mapaBloco}>
            <MapaVeiculo posicao={f.posicao} titulo={f.veiculo ? f.veiculo.modelo : 'Transporte'} />
            <ThemedText type="small" themeColor="textSecondary">
              Posição atualizada {tempoDesde(f.posicao.atualizadaEm)}
            </ThemedText>
          </View>
        ) : (
          <MapaSemPosicao
            mensagem={
              emViagem
                ? 'Aguardando a primeira localização do veículo…'
                : 'A localização do veículo aparece aqui durante a viagem.'
            }
          />
        )}

        <Card>
          <ThemedText type="small" themeColor="textSecondary">
            Motorista
          </ThemedText>
          <ThemedText type="smallBold" style={styles.valor}>
            {f.motorista?.nome ?? '—'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Veículo
          </ThemedText>
          <ThemedText type="smallBold" style={styles.valor}>
            {f.veiculo ? `${f.veiculo.modelo} (${f.veiculo.placa})` : '—'}
          </ThemedText>
          {f.rotaNome ? (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                Rota
              </ThemedText>
              <ThemedText type="smallBold" style={styles.valor}>
                {f.rotaNome}
              </ThemedText>
            </>
          ) : null}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  conteudo: { paddingVertical: Spacing.three, gap: Spacing.three },
  valor: { fontSize: 16 },
  mapaBloco: { gap: Spacing.two },
});
