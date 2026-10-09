import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// O refresh token fica no armazenamento seguro do aparelho (Keychain no iOS, Keystore no
// Android). O access token NUNCA é gravado: vive só em memória (session-tokens.ts).
const CHAVE = 'pitaya.refresh-token';

// expo-secure-store não existe na web; lá usamos localStorage (só para desenvolvimento).
const nativo = Platform.OS !== 'web';

export async function lerRefreshToken(): Promise<string | null> {
  try {
    if (!nativo) return globalThis.localStorage?.getItem(CHAVE) ?? null;
    return await SecureStore.getItemAsync(CHAVE);
  } catch {
    return null;
  }
}

export async function salvarRefreshToken(token: string): Promise<void> {
  if (!nativo) {
    globalThis.localStorage?.setItem(CHAVE, token);
    return;
  }
  await SecureStore.setItemAsync(CHAVE, token, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
  });
}

export async function apagarRefreshToken(): Promise<void> {
  try {
    if (!nativo) globalThis.localStorage?.removeItem(CHAVE);
    else await SecureStore.deleteItemAsync(CHAVE);
  } catch {
    // Sem o que apagar: nada a fazer.
  }
}
