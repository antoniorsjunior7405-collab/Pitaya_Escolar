import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { EstadoCarregando } from '@/components/ui/estado-carregando';
import { EstadoErro } from '@/components/ui/estado-erro';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Seletor } from '@/components/ui/seletor';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useResponsive } from '@/hooks/use-responsive';
import { mensagemDeErro } from '@/lib/http';
import { adicionarAlunoNaRota, chavesAdmin, detalharRota, listarAlunos } from '@/services/admin';

export default function RotaAdmin() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const responsivo = useResponsive();
  const queryClient = useQueryClient();
  const rota = useQuery({ queryKey: chavesAdmin.rota(id), queryFn: () => detalharRota(id) });
  const alunos = useQuery({ queryKey: chavesAdmin.alunos, queryFn: listarAlunos });

  const [alunoId, setAlunoId] = useState<string | null>(null);
  const [endereco, setEndereco] = useState('');

  const adicionar = useMutation({
    mutationFn: (dados: { alunoId: string; ordem: number }) =>
      adicionarAlunoNaRota(id, { ...dados, ...(endereco.trim() && { endereco: endereco.trim() }) }),
    onSuccess: () => {
      setAlunoId(null);
      setEndereco('');
      void queryClient.invalidateQueries({ queryKey: chavesAdmin.rota(id) });
    },
  });

  if (rota.isPending || alunos.isPending) return <EstadoCarregando />;
  if (rota.isError) return <EstadoErro erro={rota.error} onTentarNovamente={() => void rota.refetch()} />;
  if (alunos.isError) {
    return <EstadoErro erro={alunos.error} onTentarNovamente={() => void alunos.refetch()} />;
  }

  const naRota = new Set(rota.data.alunos.map((a) => a.id));
  const disponiveis = alunos.data.filter((a) => !naRota.has(a.id));
  // Próxima posição na ordem de embarque.
  const proximaOrdem = Math.max(0, ...rota.data.alunos.map((a) => a.ordem)) + 1;

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Stack.Screen options={{ title: rota.data.nome }} />
      <FlatList
        data={rota.data.alunos}
        keyExtractor={(a) => a.id}
        contentContainerStyle={[styles.lista, responsivo.conteudo]}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            <Card>
              <ThemedText type="small" themeColor="textSecondary">
                Motorista: {rota.data.motoristaNome} · Veículo: {rota.data.veiculoPlaca}
              </ThemedText>
            </Card>
            <Card style={styles.espaco}>
              <ThemedText type="smallBold" style={styles.titulo}>
                Adicionar aluno (posição {proximaOrdem} na ordem de embarque)
              </ThemedText>
              <Seletor
                rotulo="Aluno"
                opcoes={disponiveis.map((a) => ({ valor: a.id, rotulo: a.nome }))}
                valor={alunoId}
                onChange={setAlunoId}
                vazio="Todos os alunos já estão nesta rota (ou não há alunos cadastrados)."
              />
              <TextField
                rotulo="Endereço de embarque (opcional)"
                value={endereco}
                onChangeText={setEndereco}
                placeholder="Rua, número"
              />
              {adicionar.isError ? (
                <ThemedText type="small" themeColor="danger" accessibilityRole="alert">
                  {mensagemDeErro(adicionar.error)}
                </ThemedText>
              ) : null}
              <PrimaryButton
                titulo="Adicionar à rota"
                carregando={adicionar.isPending}
                desabilitado={!alunoId}
                onPress={() => alunoId && adicionar.mutate({ alunoId, ordem: proximaOrdem })}
              />
            </Card>
            <ThemedText type="subtitle" style={styles.espaco}>
              Ordem de embarque
            </ThemedText>
          </>
        }
        ListEmptyComponent={<EstadoVazio titulo="Nenhum aluno nesta rota ainda" />}
        renderItem={({ item }) => (
          <Card>
            <ThemedText type="smallBold" style={styles.titulo}>
              {item.ordem}. {item.nome}
            </ThemedText>
            {item.endereco ? (
              <ThemedText type="small" themeColor="textSecondary">
                {item.endereco}
              </ThemedText>
            ) : null}
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
  espaco: { marginTop: Spacing.three },
});
