import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { EstadoCarregando } from '@/components/ui/estado-carregando';
import { EstadoErro } from '@/components/ui/estado-erro';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Seletor } from '@/components/ui/seletor';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useResponsive } from '@/hooks/use-responsive';
import { mensagemDeErro } from '@/lib/http';
import { chavesAdmin, criarRota, listarMembros, listarRotas, listarVeiculos } from '@/services/admin';
import type { Periodo } from '@/types';

const PERIODOS: { valor: Periodo; rotulo: string }[] = [
  { valor: 'MANHA', rotulo: 'Manhã' },
  { valor: 'TARDE', rotulo: 'Tarde' },
  { valor: 'NOITE', rotulo: 'Noite' },
];

export default function RotasAdmin() {
  const responsivo = useResponsive();
  const router = useRouter();
  const queryClient = useQueryClient();
  const rotas = useQuery({ queryKey: chavesAdmin.rotas, queryFn: listarRotas });
  const motoristas = useQuery({
    queryKey: chavesAdmin.membros('MOTORISTA'),
    queryFn: () => listarMembros('MOTORISTA'),
  });
  const veiculos = useQuery({ queryKey: chavesAdmin.veiculos, queryFn: listarVeiculos });

  const [nome, setNome] = useState('');
  const [periodo, setPeriodo] = useState<Periodo | null>(null);
  const [motoristaId, setMotoristaId] = useState<string | null>(null);
  const [veiculoId, setVeiculoId] = useState<string | null>(null);

  const criar = useMutation({
    mutationFn: (dados: { motoristaId: string; veiculoId: string }) =>
      criarRota({ nome: nome.trim(), ...(periodo && { periodo }), ...dados }),
    onSuccess: ({ id }) => {
      setNome('');
      setPeriodo(null);
      setMotoristaId(null);
      setVeiculoId(null);
      void queryClient.invalidateQueries({ queryKey: chavesAdmin.rotas });
      router.push({ pathname: '/admin/rota/[id]', params: { id } });
    },
  });

  const consultas = [rotas, motoristas, veiculos];
  const comErro = consultas.find((c) => c.isError);
  if (consultas.some((c) => c.isPending)) return <EstadoCarregando />;
  if (comErro) {
    return (
      <EstadoErro
        erro={comErro.error}
        onTentarNovamente={() => consultas.forEach((c) => void c.refetch())}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <FlatList
        data={rotas.data}
        keyExtractor={(r) => r.id}
        contentContainerStyle={[styles.lista, responsivo.conteudo]}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <Card>
            <ThemedText type="smallBold" style={styles.titulo}>
              Nova rota
            </ThemedText>
            <TextField rotulo="Nome" value={nome} onChangeText={setNome} placeholder="Rota Manhã - Centro" />
            <Seletor rotulo="Período" opcoes={PERIODOS} valor={periodo} onChange={setPeriodo} />
            <Seletor
              rotulo="Motorista"
              opcoes={(motoristas.data ?? []).map((m) => ({ valor: m.id, rotulo: m.nome }))}
              valor={motoristaId}
              onChange={setMotoristaId}
              vazio="Nenhum motorista ainda: ele precisa criar a conta com o código de convite."
            />
            <Seletor
              rotulo="Veículo"
              opcoes={(veiculos.data ?? []).map((v) => ({ valor: v.id, rotulo: `${v.placa} · ${v.modelo}` }))}
              valor={veiculoId}
              onChange={setVeiculoId}
              vazio="Nenhum veículo: cadastre em Veículos."
            />
            {criar.isError ? (
              <ThemedText type="small" themeColor="danger" accessibilityRole="alert">
                {mensagemDeErro(criar.error)}
              </ThemedText>
            ) : null}
            <PrimaryButton
              titulo="Criar rota"
              carregando={criar.isPending}
              desabilitado={nome.trim().length < 2 || !motoristaId || !veiculoId}
              onPress={() => motoristaId && veiculoId && criar.mutate({ motoristaId, veiculoId })}
            />
          </Card>
        }
        ListEmptyComponent={<EstadoVazio titulo="Nenhuma rota cadastrada" />}
        renderItem={({ item }) => (
          <Card
            accessibilityLabel={`Abrir rota ${item.nome}`}
            onPress={() => router.push({ pathname: '/admin/rota/[id]', params: { id: item.id } })}>
            <ThemedText type="smallBold" style={styles.titulo}>
              {item.nome}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {item.motoristaNome} · {item.veiculoPlaca}
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
