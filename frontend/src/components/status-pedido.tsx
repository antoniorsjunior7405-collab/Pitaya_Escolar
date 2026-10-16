import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { tempoDesde } from '@/lib/formatar';
import type { EstadoPedido, Pedido } from '@/types';

type Tom = 'Neutro' | 'Marca' | 'Sucesso' | 'Atencao';

// Um único lugar define o texto e o tom de cada estado do pedido. O estado nunca é transmitido
// só pela cor: o título diz o que aconteceu e a descrição diz o que fazer.
const ESTADOS: Record<EstadoPedido, { titulo: string; descricao: string; tom: Tom }> = {
  PENDENTE: {
    titulo: 'Aguardando o motorista responder',
    descricao: 'Esta tela atualiza sozinha. Você pode sair e voltar depois em "Meus pedidos".',
    tom: 'Marca',
  },
  ACEITA: {
    titulo: 'Motorista confirmou',
    descricao: 'Combine os detalhes do transporte pelo telefone abaixo.',
    tom: 'Sucesso',
  },
  RECUSADA: {
    titulo: 'O motorista não aceitou',
    descricao: 'Você pode buscar outro motorista.',
    tom: 'Atencao',
  },
  CANCELADA: {
    titulo: 'Você cancelou este pedido',
    descricao: 'O motorista não vai mais receber este pedido.',
    tom: 'Neutro',
  },
  EXPIRADA: {
    titulo: 'O pedido venceu',
    descricao: 'O motorista não respondeu a tempo. Você pode pedir de novo.',
    tom: 'Neutro',
  },
};

/** Rótulo curto para listas ("Meus pedidos"). */
export const ROTULO_DO_PEDIDO: Record<EstadoPedido, string> = {
  PENDENTE: 'Aguardando resposta',
  ACEITA: 'Aceito',
  RECUSADA: 'Recusado',
  CANCELADA: 'Cancelado',
  EXPIRADA: 'Vencido',
};

const DIA_MS = 24 * 60 * 60 * 1000;

/** "vence hoje", "vence em 1 dia", "vence em 6 dias". */
export function textoDoPrazo(expiraEm: string, agora = Date.now()): string {
  const dias = Math.ceil((new Date(expiraEm).getTime() - agora) / DIA_MS);
  if (dias <= 0) return 'vence hoje';
  return dias === 1 ? 'vence em 1 dia' : `vence em ${dias} dias`;
}

type Props = {
  pedido: Pedido;
  /** Referência para "há quanto tempo" e "vence em": quem chama passa (render puro). */
  agora: number;
};

// Cartão da tela de espera: o que aconteceu com o pedido e o próximo passo.
export function StatusPedido({ pedido, agora }: Props) {
  const theme = useTheme();
  const { titulo, descricao, tom } = ESTADOS[pedido.estado];
  const pendente = pedido.estado === 'PENDENTE';
  const etapa = pendente ? 2 : 3;

  return (
    <Card>
      {/* Região "ao vivo": quando o motorista responde, o leitor de tela anuncia sozinho. */}
      <View accessibilityLiveRegion="polite" style={styles.cabecalho}>
        <View style={[styles.selo, { backgroundColor: theme[`status${tom}Bg`] }]}>
          <ThemedText type="smallBold" style={{ color: theme[`status${tom}Text`] }}>
            {pendente ? 'Aguardando' : 'Respondido'}
          </ThemedText>
        </View>
        <ThemedText type="subtitle">{titulo}</ThemedText>
        <ThemedText themeColor="textSecondary">{descricao}</ThemedText>
      </View>

      <ThemedText
        type="small"
        themeColor="textSecondary"
        accessibilityLabel={`Etapa ${etapa} de 3: ${pendente ? 'aguardando resposta' : 'respondido'}`}>
        ● Enviado · {pendente ? '● Aguardando · ○ Resposta' : '● Aguardando · ● Resposta'}
      </ThemedText>

      <View style={styles.detalhes}>
        <ThemedText type="smallBold">{pedido.motorista.nome}</ThemedText>
        {pedido.motorista.regiaoAtendimento ? (
          <ThemedText type="small" themeColor="textSecondary">
            Atende: {pedido.motorista.regiaoAtendimento}
          </ThemedText>
        ) : null}
        <ThemedText type="small" themeColor="textSecondary">
          Para: {pedido.aluno.nome} · enviado {tempoDesde(pedido.criadoEm, agora)}
        </ThemedText>
        {pendente ? (
          <ThemedText type="small" themeColor="textSecondary">
            O pedido {textoDoPrazo(pedido.expiraEm, agora)}
          </ThemedText>
        ) : null}
        {pedido.estado === 'ACEITA' && pedido.motorista.telefone ? (
          <ThemedText type="smallBold">Telefone: {pedido.motorista.telefone}</ThemedText>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  cabecalho: { gap: Spacing.two },
  selo: {
    alignSelf: 'flex-start',
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  detalhes: { gap: Spacing.one },
});
