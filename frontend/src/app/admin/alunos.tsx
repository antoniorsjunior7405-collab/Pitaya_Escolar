import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { EstadoCarregando } from '@/components/ui/estado-carregando';
import { EstadoErro } from '@/components/ui/estado-erro';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { PrimaryButton } from '@/components/ui/primary-button';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useResponsive } from '@/hooks/use-responsive';
import { mensagemDeErro } from '@/lib/http';
import { chavesAdmin, criarAluno, listarAlunos } from '@/services/admin';

export default function Alunos() {
  const responsivo = useResponsive();
  const router = useRouter();
  const queryClient = useQueryClient();
  const alunos = useQuery({ queryKey: chavesAdmin.alunos, queryFn: listarAlunos });
  const [nome, setNome] = useState('');

  const criar = useMutation({
    mutationFn: () => criarAluno(nome.trim()),
    onSuccess: () => {
      setNome('');
      void queryClient.invalidateQueries({ queryKey: chavesAdmin.alunos });
    },
  });

  if (alunos.isPending) return <EstadoCarregando />;
  if (alunos.isError) {
    return <EstadoErro erro={alunos.error} onTentarNovamente={() => void alunos.refetch()} />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <FlatList
        data={alunos.data}
        keyExtractor={(a) => a.id}
        contentContainerStyle={[styles.lista, responsivo.conteudo]}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <Card>
            <ThemedText type="smallBold" style={styles.titulo}>
              Novo aluno
            </ThemedText>
            <TextField rotulo="Nome completo" value={nome} onChangeText={setNome} autoComplete="off" />
            {criar.isError ? (
              <ThemedText type="small" themeColor="danger" accessibilityRole="alert">
                {mensagemDeErro(criar.error)}
              </ThemedText>
            ) : null}
            <PrimaryButton
              titulo="Cadastrar aluno"
              carregando={criar.isPending}
              desabilitado={nome.trim().length < 2}
              onPress={() => criar.mutate()}
            />
          </Card>
        }
        ListEmptyComponent={<EstadoVazio titulo="Nenhum aluno cadastrado" />}
        renderItem={({ item }) => (
          <Card
            accessibilityLabel={`Abrir ${item.nome}`}
            onPress={() => router.push({ pathname: '/admin/aluno/[id]', params: { id: item.id } })}>
            <ThemedText type="smallBold" style={styles.titulo}>
              {item.nome}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Toque para vincular responsáveis
            </ThemedText>
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
