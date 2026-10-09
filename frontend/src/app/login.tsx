import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Marca } from '@/components/marca';
import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/context/session';
import { mensagemDeErro } from '@/lib/http';
import { useResponsive } from '@/hooks/use-responsive';

export default function Login() {
  const responsivo = useResponsive();
  const { entrar } = useSession();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string>();
  const [carregando, setCarregando] = useState(false);

  const pronto = email.trim().length > 0 && senha.length > 0;

  async function enviar() {
    setErro(undefined);
    setCarregando(true);
    try {
      await entrar(email.trim(), senha);
      // O redirecionamento é automático: a sessão passa a existir e o layout troca as telas.
    } catch (e) {
      setErro(mensagemDeErro(e));
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
          <Marca subtitulo="Entre para acompanhar o transporte escolar." />

          <View style={styles.formulario}>
            <TextField
              rotulo="E-mail"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              textContentType="emailAddress"
            />
            <TextField
              rotulo="Senha"
              value={senha}
              onChangeText={setSenha}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
              onSubmitEditing={() => pronto && void enviar()}
              erro={erro}
            />
            <PrimaryButton
              titulo="Entrar"
              onPress={() => void enviar()}
              carregando={carregando}
              desabilitado={!pronto}
            />
            {carregando ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.centro}>
                Conectando… na primeira vez o servidor pode levar até 1 minuto.
              </ThemedText>
            ) : null}
          </View>

          <Link href="/cadastro" style={styles.centro}>
            <ThemedText type="link">Não tem conta? Criar conta</ThemedText>
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  conteudo: { flexGrow: 1, justifyContent: 'center', paddingVertical: Spacing.four, gap: Spacing.three },
  formulario: { gap: Spacing.three, marginVertical: Spacing.three },
  centro: { textAlign: 'center' },
});
