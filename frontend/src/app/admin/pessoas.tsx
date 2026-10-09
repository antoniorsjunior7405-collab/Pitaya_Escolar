import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { EstadoCarregando } from '@/components/ui/estado-carregando';
import { EstadoErro } from '@/components/ui/estado-erro';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { Seletor } from '@/components/ui/seletor';
import { Spacing } from '@/constants/theme';
import { useResponsive } from '@/hooks/use-responsive';
import { chavesAdmin, listarMembros } from '@/services/admin';
import type { Papel } from '@/types/api';

const FILTROS: { valor: Papel; rotulo: string }[] = [
  { valor: 'MOTORISTA', rotulo: 'Motoristas' },
  { valor: 'RESPONSAVEL', rotulo: 'Responsáveis' },
  { valor: 'ADMIN', rotulo: 'Administradores' },
];

export default function Pessoas() {
  const responsivo = useResponsive();
  const [papel, setPapel] = useState<Papel>('MOTORISTA');
  const membros = useQuery({
    queryKey: chavesAdmin.membros(papel),
    queryFn: () => listarMembros(papel),
  });

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <FlatList
        data={membros.data ?? []}
        keyExtractor={(m) => m.id}
        contentContainerStyle={[styles.lista, responsivo.conteudo]}
        refreshing={membros.isRefetching}
        onRefresh={() => void membros.refetch()}
        ListHeaderComponent={
          <Seletor rotulo="Mostrar" opcoes={FILTROS} valor={papel} onChange={setPapel} />
        }
        ListEmptyComponent={
          membros.isPending ? (
            <EstadoCarregando />
          ) : membros.isError ? (
            <EstadoErro erro={membros.error} onTentarNovamente={() => void membros.refetch()} />
          ) : (
            <EstadoVazio
              titulo="Ninguém aqui ainda"
              descricao="As pessoas entram criando a conta no app com o código de convite."
            />
          )
        }
        renderItem={({ item }) => (
          <Card>
            <ThemedText type="smallBold" style={styles.titulo}>
              {item.nome}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {item.email}
              {item.telefone ? ` · ${item.telefone}` : ''}
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
