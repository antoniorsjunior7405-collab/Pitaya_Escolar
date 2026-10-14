// Resultado de uma verificação da auditoria de segurança.
// FALHA = brecha a corrigir (o script sai com código 1); AVISO = revisar; OK = conforme.
export type Nivel = 'OK' | 'AVISO' | 'FALHA';

export type Resultado = { nivel: Nivel; item: string; detalhe?: string };

export const ok = (item: string, detalhe?: string): Resultado => ({ nivel: 'OK', item, detalhe });
export const aviso = (item: string, detalhe: string): Resultado => ({
  nivel: 'AVISO',
  item,
  detalhe,
});
export const falha = (item: string, detalhe: string): Resultado => ({
  nivel: 'FALHA',
  item,
  detalhe,
});
