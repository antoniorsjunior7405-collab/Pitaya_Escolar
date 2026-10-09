import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { EstadoCarregando } from '@/components/ui/estado-carregando';
import { EstadoErro } from '@/components/ui/estado-erro';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { PrimaryButton } from '@/components/ui/primary-button';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useResponsive } from '@/hooks/use-responsive';
import { mensagemDeErro } from '@/lib/http';
import { chavesAdmin, criarVeiculo, listarVeiculos } from '@/services/admin';

export default function Veiculos() {
  const responsivo = useResponsive();
  const queryClient = useQueryClient();
  const veiculos = useQuery({ queryKey: chavesAdmin.veiculos, queryFn: listarVeiculos });

  const [placa, setPlaca] = useState('');
  const [modelo, setModelo] = useState('');
  const [capacidade, setCapacidade] = useState('');

  const criar = useMutation({
    mutationFn: () =>
      criarVeiculo({
        placa: placa.trim(),
        modelo: modelo.trim(),
        ...(capacidade.trim() && { capacidade: Number(capacidade) }),
      }),
    onSuccess: () => {
      setPlaca('');
      setModelo('');
      setCapacidade('');
      void queryClient.invalidateQueries({ queryKey: chavesAdmin.veiculos });
    },
  });

  if (veiculos.isPending) return <EstadoCarregando />;
  if (veiculos.isError) {
    return <EstadoErro erro={veiculos.error} onTentarNovamente={() => void veiculos.refetch()} />;
  }

  const capacidadeInvalida = capacidade.trim() !== '' && !/^\d{1,3}$/.test(capacidade.trim());

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <FlatList
        data={veiculos.data}
        keyExtractor={(v) => v.id}
        contentContainerStyle={[styles.lista, responsivo.conteudo]}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <Card>
            <ThemedText type="smallBold" style={styles.titulo}>
              Novo veículo
            </ThemedText>
            <TextField
              rotulo="Placa"
              value={placa}
              onChangeText={setPlaca}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="ABC1D23"
            />
            <TextField rotulo="Modelo" value={modelo} onChangeText={setModelo} placeholder="Van Sprinter" />
            <TextField
              rotulo="Capacidade (opcional)"
              value={capacidade}
              onChangeText={setCapacidade}
              keyboardType="number-pad"
              erro={capacidadeInvalida ? 'Informe um número.' : undefined}
            />
            {criar.isError ? (
              <ThemedText type="small" themeColor="danger" accessibilityRole="alert">
                {mensagemDeErro(criar.error)}
              </ThemedText>
            ) : null}
            <PrimaryButton
              titulo="Cadastrar veículo"
              carregando={criar.isPending}
              desabilitado={placa.trim().length < 7 || !modelo.trim() || capacidadeInvalida}
              onPress={() => criar.mutate()}
            />
          </Card>
        }
        ListEmptyComponent={<EstadoVazio titulo="Nenhum veículo cadastrado" />}
        renderItem={({ item }) => (
          <Card>
            <ThemedText type="smallBold" style={styles.titulo}>
              {item.placa}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {item.modelo}
              {item.capacidade ? ` · ${item.capacidade} lugares` : ''}
            </ThemedText>
          </Card>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  lista: { paddingVertical: Spacing.three, gap: Spacing.three },
  titulo: { fontSize: 16 },
});
