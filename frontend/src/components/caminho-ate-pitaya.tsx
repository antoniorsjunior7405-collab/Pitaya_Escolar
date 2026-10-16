import { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { SeloPitaya } from '@/components/selo-pitaya';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const CARRO_LARGURA = 112;
const CARRO_ALTURA = 64;
const PITAYA_TAMANHO = 64;
const TRACO_LARGURA = 10;
const TRACO_ESPACO = 8;
const DURACAO_VIAGEM_MS = 2600;
const DURACAO_SOLAVANCO_MS = 220;

// Animação decorativa: um carro grande percorre a estrada tracejada até a pitaya e recomeça.
// Fica escondida do leitor de tela (quem anuncia o carregamento é a tela que a usa).
// Roda na thread de UI (Reanimated) e respeita "reduzir movimento" do sistema: nesse caso
// o carro fica parado no meio do caminho.
export function CaminhoAtePitaya() {
  const theme = useTheme();
  const reduzirMovimento = useReducedMotion();
  const [largura, setLargura] = useState(0);
  const progresso = useSharedValue(0);
  const solavanco = useSharedValue(0);
  const distancia = useSharedValue(0);

  useEffect(() => {
    if (reduzirMovimento) {
      progresso.set(0.5);
      solavanco.set(0);
      return;
    }
    progresso.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: DURACAO_VIAGEM_MS, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 0 }),
        ),
        -1,
      ),
    );
    solavanco.set(withRepeat(withTiming(-2, { duration: DURACAO_SOLAVANCO_MS }), -1, true));
    return () => {
      cancelAnimation(progresso);
      cancelAnimation(solavanco);
    };
  }, [reduzirMovimento, progresso, solavanco]);

  const estiloCarro = useAnimatedStyle(() => ({
    // Some ao chegar na pitaya e reaparece no início, para o recomeço não "pular".
    opacity: interpolate(progresso.get(), [0, 0.08, 0.9, 1], [0, 1, 1, 0]),
    transform: [{ translateX: progresso.get() * distancia.get() }, { translateY: solavanco.get() }],
  }));

  function aoMedir(evento: LayoutChangeEvent) {
    const larguraTotal = evento.nativeEvent.layout.width;
    setLargura(larguraTotal);
    distancia.set(Math.max(0, larguraTotal - CARRO_LARGURA - PITAYA_TAMANHO / 2));
  }

  const tracos = Math.max(0, Math.floor(largura / (TRACO_LARGURA + TRACO_ESPACO)));

  return (
    <View
      testID="caminho-ate-pitaya"
      style={styles.container}
      onLayout={aoMedir}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <View testID="estrada" style={styles.estrada}>
        {Array.from({ length: tracos }, (_, i) => (
          <View key={i} style={[styles.traco, { backgroundColor: theme.borderStrong }]} />
        ))}
      </View>

      <View style={styles.pitaya}>
        <SeloPitaya tamanho={PITAYA_TAMANHO} />
      </View>

      <Animated.View testID="carro" style={[styles.carro, estiloCarro]}>
        <View style={[styles.cabine, { backgroundColor: theme.primary }]}>
          <View style={[styles.janela, { backgroundColor: theme.backgroundElement }]} />
          <View style={[styles.janela, { backgroundColor: theme.backgroundElement }]} />
        </View>
        <View style={[styles.carroceria, { backgroundColor: theme.primary }]} />
        <View style={[styles.farol, { backgroundColor: theme.statusAtencaoBg }]} />
        <View style={[styles.roda, styles.rodaTraseira, { backgroundColor: theme.text }]}>
          <View style={[styles.calota, { backgroundColor: theme.borderStrong }]} />
        </View>
        <View style={[styles.roda, styles.rodaDianteira, { backgroundColor: theme.text }]}>
          <View style={[styles.calota, { backgroundColor: theme.borderStrong }]} />
        </View>
      </Animated.View>
    </View>
  );
}

const ALTURA_ESTRADA = 4;
const BASE_ESTRADA = Spacing.two;
const RODA = 24;

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: CARRO_ALTURA + PITAYA_TAMANHO / 2 + Spacing.four,
    justifyContent: 'flex-end',
  },
  estrada: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: BASE_ESTRADA,
    height: ALTURA_ESTRADA,
    flexDirection: 'row',
    gap: TRACO_ESPACO,
    overflow: 'hidden',
  },
  traco: { width: TRACO_LARGURA, height: ALTURA_ESTRADA, borderRadius: Radius.pill },
  pitaya: {
    position: 'absolute',
    right: 0,
    bottom: BASE_ESTRADA + ALTURA_ESTRADA + Spacing.one,
  },
  carro: {
    position: 'absolute',
    left: 0,
    bottom: BASE_ESTRADA + ALTURA_ESTRADA + Spacing.half,
    width: CARRO_LARGURA,
    height: CARRO_ALTURA,
  },
  cabine: {
    position: 'absolute',
    top: 0,
    left: 14,
    width: 70,
    height: 30,
    borderTopLeftRadius: Radius.md,
    borderTopRightRadius: 20,
    flexDirection: 'row',
    gap: Spacing.one,
    padding: 6,
  },
  janela: { flex: 1, height: 14, borderRadius: Radius.sm / 2 },
  carroceria: {
    position: 'absolute',
    top: 24,
    left: 0,
    width: CARRO_LARGURA,
    height: 28,
    borderRadius: Radius.md,
  },
  farol: {
    position: 'absolute',
    top: 30,
    right: 3,
    width: 8,
    height: 6,
    borderRadius: Radius.pill,
  },
  roda: {
    position: 'absolute',
    top: CARRO_ALTURA - RODA,
    width: RODA,
    height: RODA,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rodaTraseira: { left: 16 },
  rodaDianteira: { right: 16 },
  calota: { width: RODA / 2.5, height: RODA / 2.5, borderRadius: Radius.pill },
});
