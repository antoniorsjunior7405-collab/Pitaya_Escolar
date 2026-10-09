import type { FastifyRequest } from 'fastify';
import type { schema } from '../../db/index.js';
import { ForbiddenError, UnauthorizedError } from '../errors/app-error.js';

export type Papel = (typeof schema.papelEnum.enumValues)[number];

/** Quem está fazendo a requisição, e em nome de qual organização. */
export type Membro = { usuarioId: string; organizacaoId: string; papel: Papel };

/**
 * Conteúdo do token de acesso. `m` = vínculos do usuário (organização + papel), gravados
 * ao emitir o token (login/renovação). Nomes curtos: o token viaja em toda requisição.
 */
export type ClaimsDeAcesso = { sub: string; m: { o: string; p: Papel }[] };

declare module 'fastify' {
  interface FastifyRequest {
    membro?: Membro;
  }
}

/**
 * Hook que exige um papel. Usado no escopo de cada módulo (motorista, responsável, admin):
 * toda rota daquele módulo passa por aqui, então nenhuma rota "esquece" a checagem.
 * Lê os vínculos do token já validado (sem consulta ao banco). Deve rodar depois de
 * app.authenticate.
 */
export function exigirPapel(papel: Papel) {
  return async function verificarPapel(req: FastifyRequest) {
    const vinculos = (req.user as Partial<ClaimsDeAcesso>).m;
    // Token emitido antes desta versão (sem vínculos): 401 faz o app renovar a sessão
    // e receber um token novo, em vez de mostrar "sem permissão".
    if (!Array.isArray(vinculos)) throw new UnauthorizedError('Sessão desatualizada');

    const vinculo = vinculos.find((v) => v.p === papel);
    if (!vinculo) throw new ForbiddenError('Sem permissão para esta área');
    req.membro = { usuarioId: req.user.sub, organizacaoId: vinculo.o, papel };
  };
}

/** Membro da requisição atual (já validado pelo hook exigirPapel). */
export function membroDe(req: FastifyRequest): Membro {
  if (!req.membro) throw new UnauthorizedError('Sessão inválida');
  return req.membro;
}
