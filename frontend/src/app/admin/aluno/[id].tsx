import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { EstadoCarregando } from '@/components/ui/estado-carregando';
import { EstadoErro } from '@/components/ui/estado-erro';
import { PrimaryButton } from '@/components/ui/primary-button';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useResponsive } from '@/hooks/use-responsive';
import { mensagemDeErro } from '@/lib/http';
import { chavesAdmin, detalharAluno, vincularResponsavel } from '@/services/admin';

export default function AlunoAdmin() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const responsivo = useResponsive();
  const queryClient = useQueryClient();
  const aluno = useQuery({ queryKey: chavesAdmin.aluno(id), queryFn: () => detalharAluno(id) });
  const [email, setEmail] = useState('');
  const [parentesco, setParentesco] = useState('');

  const vincular = useMutation({
    mutationFn: () =>
      vincularResponsavel(id, {
        email: email.trim(),
        ...(parentesco.trim() && { parentesco: parentesco.trim() }),
      }),
    onSuccess: () => {
      setEmail('');
      setParentesco('');
      void queryClient.invalidateQueries({ queryKey: chavesAdmin.aluno(id) });
    },
  });

  if (aluno.isPending) return <EstadoCarregando />;
  if (aluno.isError) return <EstadoErro erro={aluno.error} onTentarNovamente={() => void aluno.refetch()} />;

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Stack.Screen options={{ title: aluno.data.nome }} />
      <ScrollView
        contentContainerStyle={[styles.conteudo, responsivo.conteudo]}
        keyboardShouldPersistTaps="handled">
        <Card>
          <ThemedText type="smallBold" style={styles.titulo}>
            Responsáveis vinculados
          </ThemedText>
          {aluno.data.responsaveis.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              Nenhum ainda. Sem responsável vinculado, ninguém acompanha este aluno no app.
            </ThemedText>
          ) : (
            aluno.data.responsaveis.map((r) => (
              <ThemedText key={r.id} type="small">
                {r.nome} · {r.email}
                {r.parentesco ? ` · ${r.parentesco}` : ''}
              </ThemedText>
            ))
          )}
        </Card>

        <Card>
          <ThemedText type="smallBold" style={styles.titulo}>
            Vincular responsável
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            O responsável precisa ter criado a conta no app com o código de convite.
          </ThemedText>
          <TextField
            rotulo="E-mail do responsável"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextField
            rotulo="Parentesco (opcional)"
            value={parentesco}
            onChangeText={setParentesco}
            placeholder="Mãe, pai, avó…"
          />
          {vincular.isError ? (
            <ThemedText type="small" themeColor="danger" accessibilityRole="alert">
              {mensagemDeErro(vincular.error)}
            </ThemedText>
          ) : null}
          {vincular.isSuccess ? (
            <ThemedText type="small" themeColor="secondary" accessibilityRole="alert">
              Responsável vinculado.
            </ThemedText>
          ) : null}
          <PrimaryButton
            titulo="Vincular"
            carregando={vincular.isPending}
            desabilitado={!email.includes('@')}
            onPress={() => vincular.mutate()}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  conteudo: { paddingVertical: Spacing.three, gap: Spacing.three },
  titulo: { fontSize: 16 },
});
