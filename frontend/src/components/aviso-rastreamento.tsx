import { ThemedText } from '@/components/themed-text';
import type { EstadoRastreamento } from '@/hooks/use-rastreamento-viagem';

const AVISO: Record<EstadoRastreamento, string | null> = {
  inativo: null,
  'aguardando-gps': 'Obtendo sua localização…',
  ativo: 'Localização sendo compartilhada com os responsáveis. Mantenha o app aberto.',
  'sem-permissao':
    'Sem permissão de localização: os responsáveis não verão o veículo no mapa. Ative nas configurações do aparelho.',
  erro: 'Falha ao enviar a localização. Tentando novamente…',
};

const FALHAS: readonly EstadoRastreamento[] = ['sem-permissao', 'erro'];

// Situação do GPS para o motorista. Só falhas são anunciadas como alerta (e em vermelho):
// avisos informativos não devem interromper o leitor de tela a cada mudança.
export function AvisoRastreamento({ estado }: { estado: EstadoRastreamento }) {
  const texto = AVISO[estado];
  if (!texto) return null;
  const falha = FALHAS.includes(estado);

  return (
    <ThemedText
      type="small"
      accessibilityRole={falha ? 'alert' : undefined}
      themeColor={falha ? 'danger' : 'textSecondary'}>
      {texto}
    </ThemedText>
  );
}
