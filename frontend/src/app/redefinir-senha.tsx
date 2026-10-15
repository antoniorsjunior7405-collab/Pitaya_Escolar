import { Link, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { PrimaryButton } from '@/components/ui/primary-button';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/context/session';
import { useResponsive } from '@/hooks/use-responsive';
import { mensagemDeErro } from '@/lib/http';
import { redefinirSenha } from '@/services/auth';

/** Mesma regra do cadastro (o servidor valida de novo). */
const MIN_SENHA = 8;

// Aberta pelo link do e-mail (pitayaescolar://redefinir-senha?token=...). O token sai da URL do
// app e vai para a API no corpo do POST. Funciona logado ou não: depois da troca, o servidor
// derruba todas as sessões, então saímos também aqui.
export default function RedefinirSenha() {
  const responsivo = useResponsive();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { status, sair } = useSession();
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState<string>();
  const [carregando, setCarregando] = useState(false);
  const [concluido, setConcluido] = useState(false);

  const erroSenha =
    senha.length > 0 && senha.length < MIN_SENHA
      ? `Use pelo menos ${MIN_SENHA} caracteres.`
      : undefined;
  const erroConfirmacao =
    confirmacao.length > 0 && confirmacao !== senha ? 'As senhas não são iguais.' : undefined;
  const pronto = senha.length >= MIN_SENHA && confirmacao === senha;

  async function enviar() {
    if (!token) return;
    setErro(undefined);
    setCarregando(true);
    try {
      await redefinirSenha(token, senha);
      if (status === 'autenticado') await sair();
      setConcluido(true);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setCarregando(false);
    }
  }

  let conteudo;
  if (!token) {
    conteudo = (
      <Card>
        <ThemedText type="subtitle">Link incompleto</ThemedText>
        <ThemedText themeColor="textSecondary">
          Abra o link direto do e-mail, sem copiar só uma parte. Se não funcionar, peça um novo.
        </ThemedText>
        <Link href="/esqueci-senha">
          <ThemedText type="link">Pedir um novo link</ThemedText>
        </Link>
      </Card>
    );
  } else if (concluido) {
    conteudo = (
      <Card>
        <ThemedText type="subtitle">Senha alterada</ThemedText>
        <ThemedText themeColor="textSecondary">
          Por segurança, todas as sessões foram encerradas. Entre com a nova senha.
        </ThemedText>
        <PrimaryButton titulo="Entrar" onPress={() => router.replace('/login')} />
      </Card>
    );
  } else {
    conteudo = (
      <View style={styles.formulario}>
        <ThemedText themeColor="textSecondary">Crie uma nova senha para a sua conta.</ThemedText>
        <TextField
          rotulo="Nova senha"
          value={senha}
          onChangeText={setSenha}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          erro={erroSenha}
        />
        <TextField
          rotulo="Repita a nova senha"
          value={confirmacao}
          onChangeText={setConfirmacao}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          onSubmitEditing={() => pronto && void enviar()}
          erro={erroConfirmacao}
        />
        {erro ? (
          <ThemedText type="small" themeColor="danger" accessibilityRole="alert">
            {erro}
          </ThemedText>
        ) : null}
        <PrimaryButton
          titulo="Salvar nova senha"
          onPress={() => void enviar()}
          carregando={carregando}
          desabilitado={!pronto}
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.conteudo, responsivo.formulario]}
          keyboardShouldPersistTaps="handled">
          {conteudo}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  conteudo: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: Spacing.four,
    gap: Spacing.three,
  },
  formulario: { gap: Spacing.three },
});
