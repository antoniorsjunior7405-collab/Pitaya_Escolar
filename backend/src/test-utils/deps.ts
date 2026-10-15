import type { FastifyInstance } from 'fastify';
import type { AppDeps } from '../app.js';
import type { Membro } from '../shared/acesso/acesso.js';
import { criarFakeAuthRepository } from './fake-auth-repository.js';

/**
 * Repositório com só alguns métodos implementados; qualquer outro falha alto se for chamado.
 * Garante que o teste não depende, sem querer, de algo que ele não preparou.
 */
export function parcial<T extends object>(nome: string, implementados: Partial<T> = {}): T {
  return new Proxy(implementados as T, {
    get: (alvo, prop) =>
      (Reflect.get(alvo, prop) as unknown) ??
      (() => {
        throw new Error(`${nome}.${String(prop)} não deveria ser chamado neste teste`);
      }),
  });
}

const naoUsado = <T extends object>(nome: string) => parcial<T>(nome);

export function depsDeTeste(overrides: Partial<AppDeps> = {}): AppDeps {
  return {
    authRepository: criarFakeAuthRepository().repo,
    recuperacaoRepository: naoUsado('recuperacaoRepository'),
    motoristaRepository: naoUsado('motoristaRepository'),
    responsavelRepository: naoUsado('responsavelRepository'),
    adminRepository: naoUsado('adminRepository'),
    ...overrides,
  };
}

/**
 * Cabeçalho Authorization com um token de acesso válido para o usuário e os vínculos dados
 * (como o login emitiria).
 */
export function autorizacao(app: FastifyInstance, usuarioId: string, vinculos: Membro[] = []) {
  const m = vinculos
    .filter((v) => v.usuarioId === usuarioId)
    .map((v) => ({ o: v.organizacaoId, p: v.papel }));
  return { authorization: `Bearer ${app.jwt.sign({ sub: usuarioId, m })}` };
}
