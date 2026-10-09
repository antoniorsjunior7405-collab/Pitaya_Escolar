import { useQuery } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { EstadoCarregando } from '@/components/ui/estado-carregando';
import { EstadoErro } from '@/components/ui/estado-erro';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/context/session';
import { useResponsive } from '@/hooks/use-responsive';
import { buscarOrganizacao, chavesAdmin } from '@/services/admin';

const SECOES: { href: Href; titulo: string; descricao: string }[] = [
  { href: '/admin/rotas', titulo: 'Rotas', descricao: 'Crie rotas e defina os alunos e a ordem de embarque.' },
  { href: '/admin/alunos', titulo: 'Alunos', descricao: 'Cadastre alunos e vincule os responsáveis.' },
  { href: '/admin/veiculos', titulo: 'Veículos', descricao: 'Placas e modelos da frota.' },
  { href: '/admin/pessoas', titulo: 'Pessoas', descricao: 'Motoristas e responsáveis da organização.' },
];

export default function PainelAdmin() {
  const responsivo = useResponsive();
  const router = useRouter();
  const { sair } = useSession();
  const org = useQuery({ queryKey: chavesAdmin.organizacao, queryFn: buscarOrganizacao });

  if (org.isPending) return <EstadoCarregando />;
  if (org.isError) return <EstadoErro erro={org.error} onTentarNovamente={() => void org.refetch()} />;

  const { nome, codigoConvite } = org.data;
  const compartilhar = () =>
    void Share.share({
      message: `Crie sua conta no app Pitaya Escolar e use o código de convite ${codigoConvite} (${nome}).`,
    });

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={[styles.conteudo, responsivo.conteudo]}>
        <Card>
          <ThemedText type="small" themeColor="textSecondary">
            Organização
          </ThemedText>
          <ThemedText type="subtitle">{nome}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Código de convite (motoristas e responsáveis usam ao criar a conta)
          </ThemedText>
          <ThemedText
            type="title"
            themeColor="primary"
            selectable
            accessibilityLabel={`Código de convite: ${codigoConvite.split('').join(' ')}`}>
            {codigoConvite}
          </ThemedText>
          <PrimaryButton titulo="Compartilhar código" onPress={compartilhar} />
        </Card>

        {SECOES.map((secao) => (
          <Card
            key={secao.titulo}
            accessibilityLabel={`Abrir ${secao.titulo}`}
            onPress={() => router.push(secao.href)}>
            <ThemedText type="smallBold" style={styles.titulo}>
              {secao.titulo}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {secao.descricao}
            </ThemedText>
          </Card>
        ))}

        <View style={styles.rodape}>
          <PrimaryButton titulo="Sair" variante="secundario" onPress={() => void sair()} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  conteudo: { paddingVertical: Spacing.three, gap: Spacing.three },
  titulo: { fontSize: 16 },
  rodape: { marginTop: Spacing.two },
});
