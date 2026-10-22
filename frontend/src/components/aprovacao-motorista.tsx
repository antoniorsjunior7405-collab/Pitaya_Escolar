import { StatusBadge } from '@/components/status-badge';
import { PrimaryButton } from '@/components/ui/primary-button';

type Props = {
  nome: string;
  aprovado: boolean;
  carregando: boolean;
  /** Outra aprovação está em andamento: o botão fica inativo até terminar. */
  desabilitado: boolean;
  onAprovar: () => void;
  onRevogar: () => void;
};

// Situação do motorista na área do admin e o botão para aprovar ou revogar. Só motorista
// aprovado aparece na busca das famílias. A tela pede confirmação antes de chamar a ação.
export function AprovacaoMotorista({
  nome,
  aprovado,
  carregando,
  desabilitado,
  onAprovar,
  onRevogar,
}: Props) {
  return (
    <>
      <StatusBadge status={aprovado ? 'APROVADO' : 'EM_ANALISE'} />
      <PrimaryButton
        titulo={aprovado ? `Revogar aprovação de ${nome}` : `Aprovar ${nome}`}
        variante={aprovado ? 'secundario' : 'primario'}
        carregando={carregando}
        desabilitado={desabilitado && !carregando}
        onPress={aprovado ? onRevogar : onAprovar}
      />
    </>
  );
}
