/**
 * Design system do Pitaya Escolar: paleta "pitaya" (magenta da fruta + verde da folha).
 * Única fonte de cores do app — telas e componentes NUNCA usam hex soltos.
 * Todos os pares texto/fundo foram validados pelo WCAG 2.2 (≥ 4,5:1; bordas de campo ≥ 3:1).
 * Documentação: docs/DESIGN.md
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    // Base
    text: '#211520',
    textSecondary: '#6B5864',
    background: '#FFFFFF',
    backgroundElement: '#FBF2F6', // superfície de cards e campos
    backgroundSelected: '#F5DCE7',
    border: '#EADBE2', // bordas decorativas (cards)
    borderStrong: '#8E7A86', // bordas de controles (campos): contraste ≥ 3:1
    // Marca
    primary: '#C2185B', // magenta pitaya: ações principais e links
    onPrimary: '#FFFFFF',
    secondary: '#2E7D32', // verde folha: sucesso/confirmações
    onSecondary: '#FFFFFF',
    // Alertas (reservado para erros e emergências, nunca para status de rotina)
    danger: '#B42318',
    // Status (fundo + texto); sempre acompanhados de rótulo em texto
    statusNeutroBg: '#EFE8EC',
    statusNeutroText: '#4A3F47',
    statusMarcaBg: '#FCE4EF',
    statusMarcaText: '#9C1450',
    statusSucessoBg: '#E3F4E4',
    statusSucessoText: '#1B5E20',
    statusAtencaoBg: '#FFF1D1',
    statusAtencaoText: '#7A4B00',
  },
  dark: {
    text: '#F8EEF3',
    textSecondary: '#C7B3BF',
    background: '#140D12',
    backgroundElement: '#22171E',
    backgroundSelected: '#33222D',
    border: '#3D2C37',
    borderStrong: '#8C7385',
    primary: '#FF6FA8',
    onPrimary: '#1A0710',
    secondary: '#7ED685',
    onSecondary: '#0B1F0D',
    danger: '#FF8A80',
    statusNeutroBg: '#2E2429',
    statusNeutroText: '#E2D6DC',
    statusMarcaBg: '#4A1830',
    statusMarcaText: '#FFB3D1',
    statusSucessoBg: '#173A1B',
    statusSucessoText: '#A5E3A9',
    statusAtencaoBg: '#3D2C05',
    statusAtencaoText: '#FFD27A',
  },
} as const;

/** Raios de borda padronizados. */
export const Radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

/** Pontos de quebra (largura em dp) para responsividade. */
export const Breakpoints = { tablet: 600, desktop: 1024 } as const;

/** Larguras máximas de conteúdo: em tablets/web o conteúdo não estica de ponta a ponta. */
export const MaxWidth = { conteudo: 720, formulario: 440 } as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;


