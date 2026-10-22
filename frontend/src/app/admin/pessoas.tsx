import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AprovacaoMotorista } from '@/components/aprovacao-motorista';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { EstadoCarregando } from '@/components/ui/estado-carregando';
import { EstadoErro } from '@/components/ui/estado-erro';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { Seletor } from '@/components/ui/seletor';
import { Spacing } from '@/constants/theme';
import { useResponsive } from '@/hooks/use-responsive';
import { avisar, confirmar } from '@/lib/dialogo';
import { mensagemDeErro } from '@/lib/http';
import { aprovarMotorista, chavesAdmin, listarMembros, revogarAprovacao } from '@/services/admin';
import type { Membro } from '@/types/admin';
import type { Papel } from '@/types/api';

const FILTROS: { valor: Papel; rotulo: string }[] = [
  { valor: 'MOTORISTA', rotulo: 'Motoristas' },
  { valor: 'RESPONSAVEL', rotulo: 'Responsáveis' },
  { valor: 'ADMIN', rotulo: 'Administradores' },
];

export default function Pessoas() {
  const responsivo = useResponsive();
  const [papel, setPapel] = useState<Papel>('MOTORISTA');
  const queryClient = useQueryClient();
  const membros = useQuery({
    queryKey: chavesAdmin.membros(papel),
    queryFn: () => listarMembros(papel),
  });
  const aprovacao = useMutation({
    mutationFn: (v: { motoristaId: string; aprovar: boolean }) =>
      v.aprovar ? aprovarMotorista(v.motoristaId) : revogarAprovacao(v.motoristaId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chavesAdmin.membros(papel) }),
    onError: (erro) => avisar('Não foi possível concluir', mensagemDeErro(erro)),
  });

  // Aprovar libera o motorista na busca de todas as famílias: o admin confirma que conferiu
  // os documentos do condutor escolar antes.
  function confirmarAprovacao(m: Membro) {
    confirmar(
      `Aprovar ${m.nome}?`,
      'Confira antes os documentos do condutor escolar: mais de 21 anos, CNH categoria D, curso especializado e nenhuma infração grave ou gravíssima nos últimos 12 meses. Aprovado, o motorista aparece na busca das famílias.',
      'Aprovar',
      () => aprovacao.mutate({ motoristaId: m.id, aprovar: true }),
    );
  }

  function confirmarRevogacao(m: Membro) {
    confirmar(
      `Revogar a aprovação de ${m.nome}?`,
      'O motorista deixa de aparecer na busca das famílias e não recebe novos pedidos. Rotas e vínculos atuais continuam.',
      'Revogar',
      () => aprovacao.mutate({ motoristaId: m.id, aprovar: false }),
    );
  }

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
            {item.papel === 'MOTORISTA' ? (
              <AprovacaoMotorista
                nome={item.nome}
                aprovado={item.aprovadoEm !== null}
                carregando={aprovacao.isPending && aprovacao.variables?.motoristaId === item.id}
                desabilitado={aprovacao.isPending}
                onAprovar={() => confirmarAprovacao(item)}
                onRevogar={() => confirmarRevogacao(item)}
              />
            ) : null}
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
