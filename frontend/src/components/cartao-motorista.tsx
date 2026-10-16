import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { PrimaryButton } from '@/components/ui/primary-button';
import type { MotoristaPublico } from '@/types';

type Props = {
  motorista: MotoristaPublico;
  /** Nome do filho escolhido; sem ele o botão fica desabilitado. */
  nomeDoFilho: string | null;
  onPedir: () => void;
  carregando: boolean;
};

// Resultado da busca: só dados públicos do motorista. Telefone só depois do aceite.
export function CartaoMotorista({ motorista, nomeDoFilho, onPedir, carregando }: Props) {
  return (
    <Card>
      <ThemedText type="smallBold" style={styles.nome}>
        {motorista.nome}
      </ThemedText>
      {motorista.regiaoAtendimento ? (
        <ThemedText type="small" themeColor="textSecondary">
          Atende: {motorista.regiaoAtendimento}
        </ThemedText>
      ) : null}
      {motorista.veiculoModelo ? (
        <ThemedText type="small" themeColor="textSecondary">
          Veículo: {motorista.veiculoModelo}
        </ThemedText>
      ) : null}
      {motorista.apresentacao ? (
        <ThemedText type="small">{motorista.apresentacao}</ThemedText>
      ) : null}
      <PrimaryButton
        titulo={nomeDoFilho ? `Pedir transporte para ${nomeDoFilho}` : 'Escolha o filho acima'}
        onPress={onPedir}
        desabilitado={!nomeDoFilho}
        carregando={carregando}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  nome: { fontSize: 16 },
});
