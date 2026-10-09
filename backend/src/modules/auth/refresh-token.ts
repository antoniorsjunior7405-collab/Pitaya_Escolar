import { createHash, randomBytes } from 'node:crypto';

export function gerarRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

// No banco guardamos apenas o hash: vazar a tabela não vaza sessões.
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
