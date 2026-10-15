import { createHash, randomBytes } from 'node:crypto';
import type { EnviadorEmail, MensagemEmail } from '../../shared/email/email.js';
import { AppError } from '../../shared/errors/app-error.js';
import { hashSenha } from './password.js';
import type { RecuperacaoRepository } from './recuperacao.repository.js';

// Recuperação de acesso ("esqueci a senha"), seguindo o OWASP Forgot Password Cheat Sheet.
// Requisitos conferidos por `npm run audit:recuperacao` (RA1–RA13).

/** Validade do link: curta, para não ficar esperando numa caixa de e-mail. */
export const VALIDADE_LINK_MS = 30 * 60 * 1000;
/** Limite de pedidos por conta (o rate limit por IP fica na rota). Evita spam de e-mail. */
export const MAX_PEDIDOS_POR_HORA = 3;

export const LINK_INVALIDO = 'Link inválido ou expirado. Peça um novo em "Esqueci a senha".';

/** Token de 32 bytes aleatórios (256 bits), como o refresh token. */
export function gerarTokenRecuperacao(): string {
  return randomBytes(32).toString('base64url');
}

/** No banco vai só o hash: vazar a tabela não vaza links válidos. */
export function hashTokenRecuperacao(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Link que o e-mail leva. O token vai na URL do APP; para a API ele sempre vai no corpo. */
export function montarLinkRedefinicao(base: string, token: string): string {
  const url = new URL(base);
  url.searchParams.set('token', token);
  return url.toString();
}

export type OpcoesRecuperacao = {
  urlRedefinirSenha: string;
  /** Falha no envio não pode virar erro para quem pediu (revelaria que o e-mail existe). */
  aoFalharEnvio: (erro: unknown) => void;
  agora?: () => number;
};

export function criarRecuperacaoService(
  repo: RecuperacaoRepository,
  email: EnviadorEmail,
  opcoes: OpcoesRecuperacao,
) {
  const agora = opcoes.agora ?? Date.now;

  /** Envia fora do ciclo da requisição: o tempo de resposta não depende do provedor. */
  function enviarSemEsperar(mensagem: MensagemEmail) {
    email.enviar(mensagem).catch(opcoes.aoFalharEnvio);
  }

  return {
    /**
     * Pede o link. NUNCA revela se o e-mail existe: não lança erro em nenhum caso e a rota
     * sempre responde 202 com a mesma mensagem.
     */
    async pedirRecuperacao(emailInformado: string): Promise<void> {
      const usuario = await repo.findUsuarioPorEmail(emailInformado);
      if (!usuario?.ativo) return;

      const umaHoraAtras = new Date(agora() - 60 * 60 * 1000);
      if ((await repo.contarPedidosDesde(usuario.id, umaHoraAtras)) >= MAX_PEDIDOS_POR_HORA) {
        return;
      }

      const token = gerarTokenRecuperacao();
      await repo.criarPedido({
        usuarioId: usuario.id,
        tokenHash: hashTokenRecuperacao(token),
        expiraEm: new Date(agora() + VALIDADE_LINK_MS),
      });

      enviarSemEsperar({
        para: usuario.email,
        assunto: 'Redefinir sua senha · Pitaya Escolar',
        texto: [
          `Olá, ${usuario.nome}.`,
          '',
          'Recebemos um pedido para redefinir a senha da sua conta no Pitaya Escolar.',
          'Abra o link abaixo no celular onde o app está instalado (vale por 30 minutos):',
          '',
          montarLinkRedefinicao(opcoes.urlRedefinirSenha, token),
          '',
          'Se não foi você, ignore este e-mail: sua senha continua a mesma.',
        ].join('\n'),
      });
    },

    /**
     * Redefine a senha com o token do link. O token é consumido de forma atômica (uso único)
     * e a troca derruba todas as sessões abertas, inclusive a de um possível invasor.
     */
    async redefinirSenha(token: string, novaSenha: string): Promise<void> {
      const usuarioId = await repo.consumirToken(hashTokenRecuperacao(token));
      if (!usuarioId) throw new AppError('LINK_INVALIDO', LINK_INVALIDO, 400);

      const usuario = await repo.findUsuarioPorId(usuarioId);
      if (!usuario?.ativo) throw new AppError('LINK_INVALIDO', LINK_INVALIDO, 400);

      await repo.trocarSenhaERevogarSessoes(usuario.id, await hashSenha(novaSenha));

      enviarSemEsperar({
        para: usuario.email,
        assunto: 'Sua senha foi alterada · Pitaya Escolar',
        texto: [
          `Olá, ${usuario.nome}.`,
          '',
          'A senha da sua conta no Pitaya Escolar acabou de ser alterada, e todas as sessões',
          'abertas foram encerradas.',
          '',
          'Se não foi você, peça um novo link em "Esqueci a senha" agora e avise a escola.',
        ].join('\n'),
      });
    },
  };
}

export type RecuperacaoService = ReturnType<typeof criarRecuperacaoService>;
