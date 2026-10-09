import { useWindowDimensions, type ViewStyle } from 'react-native';

import { Breakpoints, MaxWidth, Spacing } from '@/constants/theme';

/**
 * Responsividade: recalcula a cada rotação, dobra de tela ou redimensionamento (web).
 * - Celular: margem lateral de 16.
 * - Tablet/web: margem de 32 e conteúdo centralizado com largura máxima, para não esticar
 *   cards e formulários de ponta a ponta.
 * Tamanho de fonte: o RN já respeita a fonte escolhida pela pessoa no sistema; por isso
 * nenhum componente usa altura fixa em texto (apenas minHeight).
 */
export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= Breakpoints.tablet;
  const margem = isTablet ? Spacing.five : Spacing.three;

  const centralizado = (maxWidth: number): ViewStyle => ({
    width: '100%',
    maxWidth,
    alignSelf: 'center',
    paddingHorizontal: margem,
  });

  return {
    width,
    height,
    isTablet,
    isPaisagem: width > height,
    margem,
    /** Container de listas e telas de conteúdo. */
    conteudo: centralizado(MaxWidth.conteudo),
    /** Container de formulários (login, cadastro). */
    formulario: centralizado(MaxWidth.formulario),
  };
}
