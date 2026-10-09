import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

// Hash de senha com scrypt (nativo do Node, sem dependências).
// Formato: scrypt$N$r$p$salt(base64)$hash(base64)
const N = 16384;
const R = 8;
const P = 1;
const KEY_LEN = 64;

function derive(senha: string, salt: Buffer, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(senha, salt, KEY_LEN, opts, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export async function hashSenha(senha: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(senha, salt, { N, r: R, p: P });
  return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verificarSenha(senha: string, armazenado: string): Promise<boolean> {
  const [alg, n, r, p, salt, hash] = armazenado.split('$');
  if (alg !== 'scrypt' || !n || !r || !p || !salt || !hash) return false;
  const esperado = Buffer.from(hash, 'base64');
  const key = await derive(senha, Buffer.from(salt, 'base64'), {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return key.length === esperado.length && timingSafeEqual(key, esperado);
}
