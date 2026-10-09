import { useRouter } from 'expo-router';
import { Button, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// TELA TEMPORÁRIA: substitui o login até o Dia 4.
// Escolher um papel aqui NÃO é segurança. A autorização real será feita no backend (RN-04).
export default function EscolhaDePapel() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <View style={styles.conteudo}>
        <Text style={styles.titulo}>Pitaya Escolar</Text>
        <Text style={styles.subtitulo}>Como você quer entrar?</Text>

        <View style={styles.botoes}>
          <Button title="Sou Motorista" onPress={() => router.push('/motorista')} />
          <Button title="Sou Responsável" onPress={() => router.push('/responsavel')} />
        </View>

        <Text style={styles.aviso}>
          Tela provisória, sem login. Os dados mostrados são fictícios.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  conteudo: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
  titulo: { fontSize: 28, fontWeight: '700', textAlign: 'center' },
  subtitulo: { fontSize: 16, textAlign: 'center' },
  botoes: { gap: 12 },
  aviso: { fontSize: 12, textAlign: 'center', color: '#6B7280' },
});
