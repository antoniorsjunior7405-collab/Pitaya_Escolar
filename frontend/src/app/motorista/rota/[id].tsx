import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AvisoRastreamento } from '@/components/aviso-rastreamento';
import { CartaoAlunoViagem } from '@/components/cartao-aluno-viagem';
import { MapaSemPosicao } from '@/components/mapa-sem-posicao';
import { MapaVeiculo } from '@/components/mapa-veiculo';
import { StatusBadge } from '@/components/status-badge';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { EstadoCarregando } from '@/components/ui/estado-carregando';
import { EstadoErro } from '@/components/ui/estado-erro';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Spacing } from '@/constants/theme';
import { useRastreamentoViagem } from '@/hooks/use-rastreamento-viagem';
import { useResponsive } from '@/hooks/use-responsive';
import { avisar, confirmar } from '@/lib/dialogo';
import { mensagemDeErro } from '@/lib/http';
import { alunosPendentes, motivoParaNaoFinalizar } from '@/lib/viagem';
import {
  chavesMotorista,
  detalharRota,
  finalizarViagem,
  iniciarViagem,
  registrarEvento,
} from '@/services/motorista';
import type { TipoEventoDoMotorista } from '@/types';

// Tela de uma rota: iniciar a viagem, marcar embarque, entrega ou falta e finalizar.
// As regras (RN-08, finalizar só com todos entregues ou ausentes) são validadas no backend;
// aqui a interface só guia o motorista.
export default function DetalheDaRota() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const responsivo = useResponsive();
  const queryClient = useQueryClient();
  const rota = useQuery({ queryKey: chavesMotorista.rota(id), queryFn: () => detalharRota(id) });

  const viagem = rota.data?.viagemAtual ?? null;
  const emAndamento = viagem?.status === 'EM_ANDAMENTO';
  const rastreamento = useRastreamentoViagem(emAndamento ? viagem.id : null);

  const atualizar = () => queryClient.invalidateQueries({ queryKey: chavesMotorista.rota(id) });
  const avisarErro = (erro: unknown) => avisar('Não foi possível concluir', mensagemDeErro(erro));

  const iniciar = useMutation({
    mutationFn: () => iniciarViagem(id),
    onSuccess: atualizar,
    onError: avisarErro,
  });
  const finalizar = useMutation({
    mutationFn: (viagemId: string) => finalizarViagem(viagemId),
    onSuccess: () => {
      void atualizar();
      void queryClient.invalidateQueries({ queryKey: chavesMotorista.historico });
    },
    onError: avisarErro,
  });
  const evento = useMutation({
    mutationFn: (v: { viagemId: string; alunoId: string; tipo: TipoEventoDoMotorista }) =>
      registrarEvento(v.viagemId, v.alunoId, v.tipo),
    onSuccess: atualizar,
    onError: avisarErro,
  });

  function confirmarFinalizacao(viagemId: string) {
    confirmar(
      'Finalizar viagem?',
      'Depois de finalizada, não é possível registrar mais embarques.',
      'Finalizar',
      () => finalizar.mutate(viagemId),
    );
  }

  if (rota.isPending) return <EstadoCarregando mensagem="Carregando rota…" />;
  if (rota.isError)
    return <EstadoErro erro={rota.error} onTentarNovamente={() => void rota.refetch()} />;

  const { data } = rota;
  const motivoBloqueio = motivoParaNaoFinalizar(alunosPendentes(data.alunos));

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
          <EstadoVazio
            titulo="Sem alunos nesta rota"
            descricao="Peça à escola para incluir os alunos."
          />
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
                  titulo={
                    viagem?.status === 'FINALIZADA' ? 'Iniciar nova viagem' : 'Iniciar viagem'
                  }
                  carregando={iniciar.isPending}
                  onPress={() => iniciar.mutate()}
                />
              )}
              {emAndamento && (
                <PrimaryButton
                  titulo="Finalizar viagem"
                  variante="secundario"
                  carregando={finalizar.isPending}
                  desabilitado={motivoBloqueio !== null}
                  onPress={() => confirmarFinalizacao(viagem.id)}
                />
              )}
              {emAndamento && motivoBloqueio ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {motivoBloqueio}
                </ThemedText>
              ) : null}
              <AvisoRastreamento estado={rastreamento.estado} />
            </Card>
            {/* A posição vem do GPS do aparelho: o mapa aparece mesmo se o envio ao servidor
                falhar. O motivo de ainda não haver posição já está no AvisoRastreamento. */}
            {emAndamento &&
              (rastreamento.posicao ? (
                <MapaVeiculo
                  posicao={rastreamento.posicao}
                  titulo={`${data.veiculo.modelo} (${data.veiculo.placa})`}
                />
              ) : (
                <MapaSemPosicao mensagem="O mapa aparece assim que sua localização for encontrada." />
              ))}
            <ThemedText type="subtitle" style={styles.secao}>
              Alunos
            </ThemedText>
          </>
        }
        ListFooterComponent={
          !emAndamento && data.alunos.length > 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              Inicie a viagem para marcar embarque, entrega e falta.
            </ThemedText>
          ) : undefined
        }
        renderItem={({ item }) => {
          const doAluno = evento.isPending && evento.variables?.alunoId === item.id;
          return (
            <CartaoAlunoViagem
              aluno={item}
              status={emAndamento || viagem ? item.status : 'AGUARDANDO'}
              emAndamento={emAndamento}
              enviando={doAluno ? evento.variables.tipo : null}
              ocupado={evento.isPending && !doAluno}
              onRegistrar={(tipo) => {
                if (viagem) evento.mutate({ viagemId: viagem.id, alunoId: item.id, tipo });
              }}
            />
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
});
