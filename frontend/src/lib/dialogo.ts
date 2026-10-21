import { Alert } from 'react-native';

// Diálogos simples. No navegador o Alert do React Native não faz nada, por isso
// existe dialogo.web.ts; as telas importam daqui e o bundler escolhe a versão.

export function avisar(titulo: string, mensagem: string) {
  Alert.alert(titulo, mensagem);
}

/** Pede confirmação; só chama `aoConfirmar` se a pessoa aceitar. */
export function confirmar(
  titulo: string,
  mensagem: string,
  rotuloConfirmar: string,
  aoConfirmar: () => void,
) {
  Alert.alert(titulo, mensagem, [
    { text: 'Cancelar', style: 'cancel' },
    { text: rotuloConfirmar, style: 'destructive', onPress: aoConfirmar },
  ]);
}
