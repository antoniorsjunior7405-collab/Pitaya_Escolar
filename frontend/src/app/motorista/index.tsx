import { useRouter } from 'expo-router';
import { Button, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getRotas } from '@/services/mockData';

export default function MinhasRotas() {
  const router = useRouter();
  const rotas = getRotas();

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <FlatList
        data={rotas}
        keyExtractor={(rota) => rota.id}
        contentContainerStyle={styles.lista}
        renderItem={({ item }) => (
          <Pressable
            style={styles.cartao}
            onPress={() =>
              router.push({ pathname: '/motorista/rota/[id]', params: { id: item.id } })
            }>
            <Text style={styles.cartaoTitulo}>{item.nome}</Text>
            <Text style={styles.cartaoTexto}>
              {item.alunos.length} alunos · {item.veiculo.modelo} ({item.veiculo.placa})
            </Text>
          </Pressable>
        )}
        ListFooterComponent={
          <View style={styles.rodape}>
            <Button title="Ver histórico" onPress={() => router.push('/motorista/historico')} />
            <Button title="Trocar de papel" onPress={() => router.replace('/')} />
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  lista: { padding: 16, gap: 12 },
  cartao: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D1D5DB',
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    gap: 4,
  },
  cartaoTitulo: { fontSize: 16, fontWeight: '600' },
  cartaoTexto: { fontSize: 14, color: '#4B5563' },
  rodape: { marginTop: 12, gap: 12 },
});
