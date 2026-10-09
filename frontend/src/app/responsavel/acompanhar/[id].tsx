import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StatusBadge } from '@/components/status-badge';
import { getFilho } from '@/services/mockData';

export default function AcompanharFilho() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const filho = getFilho(id);

  if (!filho) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
        <Text style={styles.vazio}>Filho não encontrado.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Stack.Screen options={{ title: filho.nome }} />
      <ScrollView contentContainerStyle={styles.conteudo}>
        <View style={styles.cartao}>
          <Text style={styles.rotulo}>Viagem</Text>
          <StatusBadge status={filho.statusViagem} />
          <Text style={styles.rotulo}>Situação do aluno</Text>
          <StatusBadge status={filho.statusAluno} />
        </View>

        <View style={styles.cartao}>
          <Text style={styles.rotulo}>Motorista</Text>
          <Text style={styles.valor}>{filho.motoristaNome}</Text>
          <Text style={styles.rotulo}>Veículo</Text>
          <Text style={styles.valor}>
            {filho.veiculo.modelo} ({filho.veiculo.placa})
          </Text>
        </View>

        {/* Espaço reservado: o mapa depende de decisões pendentes (Dia 16). */}
        <View style={styles.mapa}>
          <Text style={styles.mapaTexto}>O mapa do veículo aparecerá aqui.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  conteudo: { padding: 16, gap: 12 },
  vazio: { padding: 16, fontSize: 16 },
  cartao: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D1D5DB',
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    gap: 6,
  },
  rotulo: { fontSize: 12, color: '#6B7280' },
  valor: { fontSize: 16, fontWeight: '600' },
  mapa: {
    height: 160,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#9CA3AF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapaTexto: { color: '#6B7280' },
});
