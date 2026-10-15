import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { PrimaryButton } from '@/components/ui/primary-button';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useResponsive } from '@/hooks/use-responsive';
import { mensagemDeErro } from '@/lib/http';
import { pedirRecuperacao } from '@/services/auth';

// "Esqueci a senha": pede o link por e-mail. A resposta é sempre a mesma, exista a conta ou
// não, então a tela também não diz se o e-mail está cadastrado.
export default function EsqueciSenha() {
  const responsivo = useResponsive();
  const [email, setEmail] = useState('');
  const [erro, setErro] = useState<string>();
  const [confirmacao, setConfirmacao] = useState<string>();
  const [carregando, setCarregando] = useState(false);

  const pronto = email.trim().includes('@');

  async function enviar() {
    setErro(undefined);
    setCarregando(true);
    try {
      setConfirmacao(await pedirRecuperacao(email.trim()));
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.conteudo, responsivo.formulario]}
          keyboardShouldPersistTaps="handled">
          {confirmacao ? (
            <Card>
              <ThemedText type="subtitle">Confira seu e-mail</ThemedText>
              <ThemedText accessibilityRole="text">{confirmacao}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                O link vale por 30 minutos. Abra-o no celular onde o app está instalado. Não chegou?
                Veja a caixa de spam ou peça de novo.
              </ThemedText>
              <PrimaryButton
                titulo="Enviar de novo"
                variante="secundario"
                onPress={() => setConfirmacao(undefined)}
              />
            </Card>
          ) : (
            <View style={styles.formulario}>
              <ThemedText themeColor="textSecondary">
                Informe o e-mail da sua conta. Se ele estiver cadastrado, enviaremos um link para
                você criar uma nova senha.
              </ThemedText>
              <TextField
                rotulo="E-mail"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                textContentType="emailAddress"
                onSubmitEditing={() => pronto && void enviar()}
                erro={erro}
              />
              <PrimaryButton
                titulo="Enviar link"
                onPress={() => void enviar()}
                carregando={carregando}
                desabilitado={!pronto}
              />
            </View>
          )}

          <Link href="/login" style={styles.centro}>
            <ThemedText type="link">Voltar para entrar</ThemedText>
          </Link>
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
  centro: { textAlign: 'center' },
});
