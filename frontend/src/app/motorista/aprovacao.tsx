import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StatusBadge } from '@/components/status-badge';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { EstadoCarregando } from '@/components/ui/estado-carregando';
import { EstadoErro } from '@/components/ui/estado-erro';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Spacing } from '@/constants/theme';
import { useResponsive } from '@/hooks/use-responsive';
import { chavesMotorista, obterPerfil } from '@/services/motorista';

// Situação da conta na plataforma. Enquanto a aprovação não sai, o motorista continua fazendo
// as rotas da escola, mas as famílias não o encontram na busca nem conseguem pedir transporte.
// A aprovação é feita pela equipe depois de conferir os documentos (CTB art. 138).
export default function Aprovacao() {
  const responsivo = useResponsive();
  const router = useRouter();
  const perfil = useQuery({ queryKey: chavesMotorista.perfil, queryFn: obterPerfil });

  if (perfil.isPending) return <EstadoCarregando mensagem="Conferindo sua conta…" />;
  if (perfil.isError) {
    return <EstadoErro erro={perfil.error} onTentarNovamente={() => void perfil.refetch()} />;
  }

  const aprovado = perfil.data.aprovadoEm !== null;
  const semRegiao = !perfil.data.regiaoAtendimento;

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[styles.conteudo, responsivo.conteudo]}
        refreshControl={
          <RefreshControl
            refreshing={perfil.isRefetching}
            onRefresh={() => void perfil.refetch()}
          />
        }>
        <Card>
          {/* Região "ao vivo": ao atualizar e sair a aprovação, o leitor de tela anuncia. */}
          <View accessibilityLiveRegion="polite" style={styles.cabecalho}>
            <StatusBadge status={aprovado ? 'APROVADO' : 'EM_ANALISE'} />
            <ThemedText type="subtitle">
              {aprovado ? 'Sua conta está aprovada' : 'Estamos conferindo seus documentos'}
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              {aprovado
                ? 'As famílias já encontram você na busca e podem pedir transporte.'
                : 'Até a aprovação, as famílias não encontram você na busca nem podem pedir transporte. Suas rotas da escola continuam funcionando normalmente.'}
            </ThemedText>
          </View>

          <ThemedText
            type="small"
            themeColor="textSecondary"
            accessibilityLabel={`Etapa ${aprovado ? 3 : 2} de 3: ${aprovado ? 'aprovado' : 'em análise'}`}>
            ● Cadastro · ● Em análise · {aprovado ? '●' : '○'} Aprovado
          </ThemedText>
        </Card>

        {aprovado ? null : (
          <Card>
            <ThemedText type="smallBold">O que conferimos</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              • Idade mínima de 21 anos{'\n'}• CNH categoria D{'\n'}• Curso especializado de
              transporte escolar
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Puxe a tela para baixo para ver se já foi aprovado.
            </ThemedText>
          </Card>
        )}

        {semRegiao ? (
          <Card>
            <ThemedText type="smallBold">Região de atendimento em branco</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Sem a região, as famílias só encontram você pelo nome.
            </ThemedText>
          </Card>
        ) : null}

        <PrimaryButton
          titulo="Voltar para minhas rotas"
          variante="secundario"
          // Aberta por link direto não há tela anterior: volta para a inicial do motorista.
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/motorista'))}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  conteudo: { paddingVertical: Spacing.three, gap: Spacing.three },
  cabecalho: { gap: Spacing.two },
});
