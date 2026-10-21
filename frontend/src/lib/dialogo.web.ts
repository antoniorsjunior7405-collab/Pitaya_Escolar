// Versão web de dialogo.ts: o Alert do React Native é ignorado no navegador,
// então usamos os diálogos do próprio navegador.

export function avisar(titulo: string, mensagem: string) {
  window.alert(`${titulo}\n\n${mensagem}`);
}

/** Pede confirmação; só chama `aoConfirmar` se a pessoa aceitar. */
export function confirmar(
  titulo: string,
  mensagem: string,
  _rotuloConfirmar: string,
  aoConfirmar: () => void,
) {
  if (window.confirm(`${titulo}\n\n${mensagem}`)) aoConfirmar();
}
