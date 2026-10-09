import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StatusBadge } from '@/components/status-badge';
import { getRota } from '@/services/mockData';
import type { Aluno, Rota, StatusAluno, StatusViagem } from '@/types';

// Tela de uma rota. O "[id]" no nome do arquivo vira um parâmetro: /motorista/rota/rota-1.
export default function DetalheDaRota() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const rota = getRota(id);

  if (!rota) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
        <Text style={styles.vazio}>Rota não encontrada.</Text>
      </SafeAreaView>
    );
  }

  return <RotaDetalhe rota={rota} />;
}

function estadoInicial(alunos: Aluno[]): Record<string, StatusAluno> {
  const estado: Record<string, StatusAluno> = {};
  for (const aluno of alunos) {
    estado[aluno.id] = 'AGUARDANDO';
  }
  return estado;
}

function RotaDetalhe({ rota }: { rota: Rota }) {
  // Estado LOCAL da tela: some ao sair dela. Não é salvo em lugar nenhum (mock).
  const [statusViagem, setStatusViagem] = useState<StatusViagem>('PLANEJADA');
  const [statusAlunos, setStatusAlunos] = useState<Record<string, StatusAluno>>(() =>
    estadoInicial(rota.alunos),
  );

  const emAndamento = statusViagem === 'EM_ANDAMENTO';

  function marcarAluno(alunoId: string, novoStatus: StatusAluno) {
    setStatusAlunos((atual) => ({ ...atual, [alunoId]: novoStatus }));
  }

  // ATENÇÃO: as regras abaixo (RN-07, RN-08, RN-10, RN-11) estão aplicadas só na
  // interface, para guiar o usuário (UX). A validação de verdade será no backend (RN-04).
  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Stack.Screen options={{ title: rota.nome }} />
      <ScrollView contentContainerStyle={styles.conteudo}>
        <View style={styles.cartao}>
          <Text style={styles.cartaoTexto}>
            Veículo: {rota.veiculo.modelo} ({rota.veiculo.placa})
          </Text>
          <StatusBadge status={statusViagem} />

          {statusViagem === 'PLANEJADA' && (
            <Button title="Iniciar viagem" onPress={() => setStatusViagem('EM_ANDAMENTO')} />
          )}
          {statusViagem === 'EM_ANDAMENTO' && (
            <Button title="Finalizar viagem" onPress={() => setStatusViagem('FINALIZADA')} />
          )}
          {statusViagem === 'FINALIZADA' && (
            <Text style={styles.cartaoTexto}>Viagem finalizada. Não há mais ações possíveis.</Text>
          )}
        </View>

        <Text style={styles.secao}>Alunos</Text>
        {rota.alunos.map((aluno) => {
          const status = statusAlunos[aluno.id];
          return (
            <View key={aluno.id} style={styles.cartao}>
              <Text style={styles.cartaoTitulo}>{aluno.nome}</Text>
              <StatusBadge status={status} />
              {status === 'AGUARDANDO' && (
                <Button
                  title="Embarcou"
                  disabled={!emAndamento}
                  onPress={() => marcarAluno(aluno.id, 'EMBARCADO')}
                />
              )}
              {status === 'EMBARCADO' && (
                <Button
                  title="Entregue"
                  disabled={!emAndamento}
                  onPress={() => marcarAluno(aluno.id, 'ENTREGUE')}
                />
              )}
            </View>
          );
        })}
        {!emAndamento && statusViagem === 'PLANEJADA' && (
          <Text style={styles.dica}>Inicie a viagem para marcar embarque e entrega.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  conteudo: { padding: 16, gap: 12 },
  vazio: { padding: 16, fontSize: 16 },
  secao: { fontSize: 18, fontWeight: '700', marginTop: 8 },
  cartao: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D1D5DB',
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    gap: 8,
  },
  cartaoTitulo: { fontSize: 16, fontWeight: '600' },
  cartaoTexto: { fontSize: 14, color: '#4B5563' },
  dica: { fontSize: 12, color: '#6B7280' },
});
