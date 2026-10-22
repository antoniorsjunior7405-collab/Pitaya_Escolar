import { StyleSheet } from 'react-native';

import { StatusBadge } from '@/components/status-badge';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { PrimaryButton } from '@/components/ui/primary-button';
import { acoesDoAluno, rotuloDaAcao } from '@/lib/viagem';
import type { AlunoDaRota, StatusAluno, TipoEventoDoMotorista } from '@/types';

type Props = {
  aluno: AlunoDaRota;
  /** Situação exibida (fora de uma viagem do dia, todos aparecem como aguardando). */
  status: StatusAluno;
  /** Com a viagem em andamento, mostra os botões de embarque, entrega e falta. */
  emAndamento: boolean;
  /** Evento deste aluno sendo enviado agora (mostra o indicador no botão certo). */
  enviando: TipoEventoDoMotorista | null;
  /** Outro aluno está sendo registrado: os botões ficam inativos até terminar. */
  ocupado: boolean;
  onRegistrar: (tipo: TipoEventoDoMotorista) => void;
};

// Um aluno na tela da rota do motorista.
export function CartaoAlunoViagem({
  aluno,
  status,
  emAndamento,
  enviando,
  ocupado,
  onRegistrar,
}: Props) {
  const acoes = emAndamento ? acoesDoAluno(status) : [];

  return (
    <Card>
      <ThemedText type="smallBold" style={styles.nome}>
        {aluno.ordem}. {aluno.nome}
      </ThemedText>
      {aluno.endereco ? (
        <ThemedText type="small" themeColor="textSecondary">
          {aluno.endereco}
        </ThemedText>
      ) : null}
      <StatusBadge status={status} />
      {status === 'ENTREGUE' && aluno.chegadaConfirmada ? (
        <ThemedText type="small" themeColor="textSecondary">
          O responsável confirmou a chegada.
        </ThemedText>
      ) : null}
      {acoes.map((acao) => (
        <PrimaryButton
          key={acao.tipo}
          titulo={rotuloDaAcao(acao.tipo, aluno.nome)}
          variante={acao.variante}
          carregando={enviando === acao.tipo}
          desabilitado={ocupado || (enviando !== null && enviando !== acao.tipo)}
          onPress={() => onRegistrar(acao.tipo)}
        />
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  nome: { fontSize: 16 },
});
