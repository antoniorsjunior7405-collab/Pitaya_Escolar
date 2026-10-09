import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/context/session';
import { mensagemDeErro } from '@/lib/http';
import type { CadastroInput } from '@/types/api';
import { useResponsive } from '@/hooks/use-responsive';

type PapelCadastro = CadastroInput['papel'];

const PAPEIS: { valor: PapelCadastro; rotulo: string }[] = [
  { valor: 'RESPONSAVEL', rotulo: 'Sou responsável' },
  { valor: 'MOTORISTA', rotulo: 'Sou motorista' },
];

export default function Cadastro() {
  const responsivo = useResponsive();
  const { cadastrar } = useSession();
  const [papel, setPapel] = useState<PapelCadastro>('RESPONSAVEL');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  const [codigoConvite, setCodigoConvite] = useState('');
  const [erro, setErro] = useState<string>();
  const [carregando, setCarregando] = useState(false);

  const erroSenha = senha.length > 0 && senha.length < 8 ? 'Use pelo menos 8 caracteres.' : undefined;
  const pronto =
    nome.trim().length >= 2 &&
    email.includes('@') &&
    senha.length >= 8 &&
    codigoConvite.trim().length >= 4;

  async function enviar() {
    setErro(undefined);
    setCarregando(true);
    try {
      await cadastrar({
        nome: nome.trim(),
        email: email.trim(),
        senha,
        papel,
        codigoConvite: codigoConvite.trim(),
        ...(telefone.trim() && { telefone: telefone.trim() }),
      });
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
          <View style={styles.papeis} accessibilityRole="radiogroup">
            {PAPEIS.map((p) => (
              <View key={p.valor} style={styles.papel}>
                <PrimaryButton
                  titulo={p.rotulo}
                  variante={papel === p.valor ? 'primario' : 'secundario'}
                  onPress={() => setPapel(p.valor)}
                />
              </View>
            ))}
          </View>

          <TextField rotulo="Nome completo" value={nome} onChangeText={setNome} autoComplete="name" />
          <TextField
            rotulo="E-mail"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
          />
          <TextField
            rotulo="Telefone (opcional)"
            value={telefone}
            onChangeText={setTelefone}
            keyboardType="phone-pad"
            autoComplete="tel"
          />
          <TextField
            rotulo="Senha"
            value={senha}
            onChangeText={setSenha}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            erro={erroSenha}
          />
          <TextField
            rotulo="Código de convite"
            value={codigoConvite}
            onChangeText={setCodigoConvite}
            autoCapitalize="characters"
            autoCorrect={false}
            erro={erro}
          />
          <ThemedText type="small" themeColor="textSecondary">
            O código é fornecido pela escola ou transportadora.
          </ThemedText>

          <PrimaryButton
            titulo="Criar conta"
            onPress={() => void enviar()}
            carregando={carregando}
            desabilitado={!pronto}
          />
          {carregando ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.centro}>
              Conectando… na primeira vez o servidor pode levar até 1 minuto.
            </ThemedText>
          ) : null}

          <Link href="/login" style={styles.centro}>
            <ThemedText type="link">Já tem conta? Entrar</ThemedText>
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  conteudo: { paddingVertical: Spacing.four, gap: Spacing.three },
  // Lado a lado quando cabe; empilha sozinho em telas estreitas ou com fonte grande.
  papeis: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  papel: { flexGrow: 1, flexBasis: 140 },
  centro: { textAlign: 'center' },
});
