import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { PrimaryButton } from '@/components/ui/primary-button';

type Props = {
  nome: string;
  confirmada: boolean;
  carregando: boolean;
  onConfirmar: () => void;
};

// Na tela do responsável, depois que o motorista registra a entrega: a família confirma que a
// criança chegou. Confirmar de novo não tem efeito (o backend aceita o reenvio).
export function ConfirmacaoChegada({ nome, confirmada, carregando, onConfirmar }: Props) {
  if (confirmada) {
    return (
      <Card>
        <ThemedText type="smallBold">Chegada confirmada</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Você confirmou que {nome} chegou. O motorista também vê essa confirmação.
        </ThemedText>
      </Card>
    );
  }

  return (
    <Card>
      <ThemedText type="smallBold">{nome} foi entregue pelo motorista</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Confirme assim que a criança estiver com você.
      </ThemedText>
      <PrimaryButton
        titulo={`Confirmar chegada de ${nome}`}
        carregando={carregando}
        onPress={onConfirmar}
      />
    </Card>
  );
}
