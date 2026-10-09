import type { AppDeps } from '../app.js';
import type { AcessoRepository, Membro, Papel } from '../shared/acesso/acesso.js';
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

/** Acesso em memória: quem é membro de qual organização, com qual papel. */
export function criarFakeAcesso(membros: Membro[] = []): AcessoRepository & { membros: Membro[] } {
  return {
    membros,
    async buscarMembro(usuarioId: string, papel: Papel) {
      return membros.find((m) => m.usuarioId === usuarioId && m.papel === papel);
    },
  };
}

export function depsDeTeste(overrides: Partial<AppDeps> = {}): AppDeps {
  return {
    authRepository: criarFakeAuthRepository().repo,
    acessoRepository: criarFakeAcesso(),
    motoristaRepository: naoUsado('motoristaRepository'),
    responsavelRepository: naoUsado('responsavelRepository'),
    adminRepository: naoUsado('adminRepository'),
    ...overrides,
  };
}
