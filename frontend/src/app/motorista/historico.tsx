import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StatusBadge } from '@/components/status-badge';
import { getHistorico } from '@/services/mockData';

export default function Historico() {
  const viagens = getHistorico();

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <FlatList
        data={viagens}
        keyExtractor={(viagem) => viagem.id}
        contentContainerStyle={styles.lista}
        renderItem={({ item }) => (
          <View style={styles.cartao}>
            <Text style={styles.cartaoTitulo}>{item.rotaNome}</Text>
            <Text style={styles.cartaoTexto}>
              {item.data} · {item.totalAlunos} alunos
            </Text>
            <StatusBadge status="FINALIZADA" />
          </View>
        )}
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
    gap: 6,
  },
  cartaoTitulo: { fontSize: 16, fontWeight: '600' },
  cartaoTexto: { fontSize: 14, color: '#4B5563' },
});
