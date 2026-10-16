import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CartaoMotorista } from '@/components/cartao-motorista';
import { ThemedText } from '@/components/themed-text';
import { EstadoCarregando } from '@/components/ui/estado-carregando';
import { EstadoErro } from '@/components/ui/estado-erro';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Seletor } from '@/components/ui/seletor';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { mensagemDeErro } from '@/lib/http';
import { chavesResponsavel, listarFilhos } from '@/services/responsavel';
import {
  buscarMotoristas,
  chavesVinculos,
  filtroValido,
  MIN_LETRAS_BUSCA,
  pedirTransporte,
  type FiltroBusca,
} from '@/services/vinculos';

// Busca de motoristas: a família procura o motorista com quem já combinou (pelo nome ou pela
// região), escolhe o filho e envia o pedido. Depois do envio, vai para a tela de espera.
export default function BuscarMotorista() {
  const responsivo = useResponsive();
  const router = useRouter();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [termo, setTermo] = useState('');
  const [regiao, setRegiao] = useState('');
  const [filtro, setFiltro] = useState<FiltroBusca | null>(null);
  const [alunoId, setAlunoId] = useState<string | null>(null);
  const [pedindoPara, setPedindoPara] = useState<string | null>(null);

  const filhos = useQuery({ queryKey: chavesResponsavel.filhos, queryFn: listarFilhos });
  const busca = useInfiniteQuery({
    queryKey: chavesVinculos.busca(filtro ?? { termo: '', regiao: '' }),
    queryFn: ({ pageParam }) => buscarMotoristas(filtro ?? { termo: '', regiao: '' }, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (pagina) => pagina.proximoCursor,
    enabled: filtro !== null,
  });
  const pedir = useMutation({
    mutationFn: (motoristaId: string) => pedirTransporte(motoristaId, alunoId ?? ''),
    onMutate: (motoristaId) => setPedindoPara(motoristaId),
    onSettled: () => setPedindoPara(null),
    onSuccess: (pedido) => {
      queryClient.setQueryData(chavesVinculos.pedido(pedido.id), pedido);
      void queryClient.invalidateQueries({ queryKey: chavesVinculos.pedidos });
      router.replace({ pathname: '/responsavel/pedido/[id]', params: { id: pedido.id } });
    },
  });

  if (filhos.isPending) return <EstadoCarregando />;
  if (filhos.isError) {
    return <EstadoErro erro={filhos.error} onTentarNovamente={() => void filhos.refetch()} />;
  }

  const nomeDoFilho = filhos.data.find((f) => f.id === alunoId)?.nome ?? null;
  const pronto = filtroValido({ termo, regiao });
  const motoristas = busca.data?.pages.flatMap((p) => p.itens) ?? [];

  function vazio() {
    if (filtro === null) {
      return (
        <ThemedText themeColor="textSecondary">
          Digite pelo menos {MIN_LETRAS_BUSCA} letras do nome ou da região do motorista.
        </ThemedText>
      );
    }
    if (busca.isPending) return <EstadoCarregando mensagem="Buscando motoristas…" />;
    if (busca.isError) {
      return <EstadoErro erro={busca.error} onTentarNovamente={() => void busca.refetch()} />;
    }
    return (
      <EstadoVazio
        titulo="Nenhum motorista encontrado"
        descricao="Confira o nome ou tente pela região. Só aparecem motoristas aprovados pela plataforma."
      />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          data={motoristas}
          keyExtractor={(m) => m.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.lista, responsivo.conteudo]}
          onEndReached={() => busca.hasNextPage && void busca.fetchNextPage()}
          ListHeaderComponent={
            <View style={styles.formulario}>
              <Seletor
                rotulo="Para qual filho?"
                opcoes={filhos.data.map((f) => ({ valor: f.id, rotulo: f.nome }))}
                valor={alunoId}
                onChange={setAlunoId}
                vazio="Nenhum filho vinculado à sua conta ainda."
              />
              <TextField
                rotulo="Nome do motorista"
                value={termo}
                onChangeText={setTermo}
                autoCapitalize="words"
                returnKeyType="search"
                onSubmitEditing={() => pronto && setFiltro({ termo, regiao })}
              />
              <TextField
                rotulo="Região que ele atende"
                value={regiao}
                onChangeText={setRegiao}
                returnKeyType="search"
                onSubmitEditing={() => pronto && setFiltro({ termo, regiao })}
              />
              <PrimaryButton
                titulo="Buscar"
                desabilitado={!pronto}
                onPress={() => setFiltro({ termo, regiao })}
              />
              {pedir.isError ? (
                <ThemedText accessibilityRole="alert" style={{ color: theme.danger }}>
                  {mensagemDeErro(pedir.error)}
                </ThemedText>
              ) : null}
            </View>
          }
          ListEmptyComponent={vazio()}
          renderItem={({ item }) => (
            <CartaoMotorista
              motorista={item}
              nomeDoFilho={nomeDoFilho}
              carregando={pedindoPara === item.id}
              onPedir={() => pedir.mutate(item.id)}
            />
          )}
          ListFooterComponent={
            busca.isFetchingNextPage ? <EstadoCarregando mensagem="Carregando mais…" /> : null
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  lista: { paddingVertical: Spacing.three, gap: Spacing.three },
  formulario: { gap: Spacing.three },
});
