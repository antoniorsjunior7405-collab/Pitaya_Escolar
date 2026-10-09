import { config } from '../../config/index.js';
import type { ClaimsDeAcesso } from '../../shared/acesso/acesso.js';
import {
  ConflictError,
  ForbiddenError,
  MuitasTentativasError,
  NotFoundError,
  UnauthorizedError,
} from '../../shared/errors/app-error.js';
import type { AuthRepository, UsuarioRow } from './auth.repository.js';
import type { CadastroInput } from './auth.schemas.js';
import { hashSenha, verificarSenha } from './password.js';
import { gerarRefreshToken, hashRefreshToken } from './refresh-token.js';

export type Tokens = { accessToken: string; refreshToken: string };
export type AssinarAccessToken = (claims: ClaimsDeAcesso) => string;

const CREDENCIAIS_INVALIDAS = 'E-mail ou senha inválidos';
/** Bloqueio por conta: 5 senhas erradas seguidas travam o login dessa conta por 15 min. */
const LIMITE_TENTATIVAS = 5;
const BLOQUEIO_MS = 15 * 60 * 1000;

// Hash fictício: quando o e-mail não existe, ainda gastamos o mesmo tempo de CPU,
// para não revelar (por tempo de resposta) quais e-mails estão cadastrados.
let hashFalso: Promise<string> | undefined;

export function criarAuthService(repo: AuthRepository, assinar: AssinarAccessToken) {
  /**
   * Emite o par de tokens. Os vínculos (organização + papel) vão DENTRO do token de acesso:
   * assim a autorização não consulta o banco a cada requisição. Como o token dura 15 min,
   * uma mudança de papel passa a valer em até 15 min (na próxima renovação).
   */
  async function emitirTokens(usuarioId: string): Promise<Tokens> {
    const refreshToken = gerarRefreshToken();
    const [membros] = await Promise.all([
      repo.listarMembros(usuarioId),
      repo.salvarRefreshToken({
        usuarioId,
        tokenHash: hashRefreshToken(refreshToken),
        expiraEm: new Date(Date.now() + config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
      }),
      repo.removerTokensVencidos(usuarioId),
    ]);
    const accessToken = assinar({
      sub: usuarioId,
      m: membros.map((v) => ({ o: v.organizacaoId, p: v.papel })),
    });
    return { accessToken, refreshToken };
  }

  const publico = (u: UsuarioRow) => ({
    id: u.id,
    nome: u.nome,
    email: u.email,
    telefone: u.telefone,
  });

  return {
    async cadastrar(input: CadastroInput) {
      const org = await repo.findOrganizacaoPorConvite(input.codigoConvite);
      if (!org?.ativa) throw new NotFoundError('Código de convite inválido');

      const usuario = await repo.criarUsuarioComMembro({
        nome: input.nome,
        email: input.email,
        senhaHash: await hashSenha(input.senha),
        telefone: input.telefone,
        organizacaoId: org.id,
        papel: input.papel,
      });
      if (!usuario) throw new ConflictError('E-mail já cadastrado');

      return { usuario: publico(usuario), ...(await emitirTokens(usuario.id)) };
    },

    async login(email: string, senha: string) {
      const usuario = await repo.findUsuarioPorEmail(email);

      // Conta bloqueada: recusa ANTES de conferir a senha, senão o bloqueio não impediria
      // continuar adivinhando.
      if (usuario?.bloqueadoAte && usuario.bloqueadoAte.getTime() > Date.now()) {
        throw new MuitasTentativasError(
          'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.',
        );
      }

      hashFalso ??= hashSenha('senha-falsa-para-igualar-tempo');
      const ok = await verificarSenha(senha, usuario?.senhaHash ?? (await hashFalso));
      if (!usuario || !ok) {
        if (usuario) await repo.registrarFalhaLogin(usuario.id, LIMITE_TENTATIVAS, BLOQUEIO_MS);
        throw new UnauthorizedError(CREDENCIAIS_INVALIDAS);
      }
      if (!usuario.ativo) throw new ForbiddenError('Conta desativada');
      if (usuario.tentativasFalhas > 0 || usuario.bloqueadoAte) {
        await repo.limparFalhasLogin(usuario.id);
      }

      return { usuario: publico(usuario), ...(await emitirTokens(usuario.id)) };
    },

    // Rotação: cada refresh token vale uma vez. Reusar um já revogado indica roubo,
    // então derrubamos todas as sessões daquele usuário.
    async renovar(refreshToken: string): Promise<Tokens> {
      const registro = await repo.findRefreshToken(hashRefreshToken(refreshToken));
      if (!registro) throw new UnauthorizedError('Sessão inválida');
      if (registro.revogadoEm) {
        await repo.revogarTodosDoUsuario(registro.usuarioId);
        throw new UnauthorizedError('Sessão inválida');
      }
      if (registro.expiraEm.getTime() <= Date.now()) throw new UnauthorizedError('Sessão expirada');

      const usuario = await repo.findUsuarioPorId(registro.usuarioId);
      if (!usuario?.ativo) throw new UnauthorizedError('Sessão inválida');

      await repo.revogarRefreshToken(registro.id);
      return emitirTokens(usuario.id);
    },

    async sair(refreshToken: string) {
      const registro = await repo.findRefreshToken(hashRefreshToken(refreshToken));
      if (registro) await repo.revogarRefreshToken(registro.id);
    },

    async me(usuarioId: string) {
      const usuario = await repo.findUsuarioPorId(usuarioId);
      if (!usuario?.ativo) throw new UnauthorizedError('Sessão inválida');
      return { usuario: publico(usuario), organizacoes: await repo.listarMembros(usuarioId) };
    },
  };
}

export type AuthService = ReturnType<typeof criarAuthService>;
