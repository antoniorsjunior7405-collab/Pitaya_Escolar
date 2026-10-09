import { useRouter } from 'expo-router';
import { Button, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StatusBadge } from '@/components/status-badge';
import { getFilhos } from '@/services/mockData';

export default function MeusFilhos() {
  const router = useRouter();
  const filhos = getFilhos();

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <FlatList
        data={filhos}
        keyExtractor={(filho) => filho.id}
        contentContainerStyle={styles.lista}
        renderItem={({ item }) => (
          <Pressable
            style={styles.cartao}
            onPress={() =>
              router.push({ pathname: '/responsavel/acompanhar/[id]', params: { id: item.id } })
            }>
            <Text style={styles.cartaoTitulo}>{item.nome}</Text>
            <StatusBadge status={item.statusAluno} />
          </Pressable>
        )}
        ListFooterComponent={
          <View style={styles.rodape}>
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
    gap: 8,
  },
  cartaoTitulo: { fontSize: 16, fontWeight: '600' },
  rodape: { marginTop: 12 },
});
