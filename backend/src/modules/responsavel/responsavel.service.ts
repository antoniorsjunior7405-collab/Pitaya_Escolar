import type { Membro } from '../../shared/acesso/acesso.js';
import { hojeNoFusoDoNegocio } from '../../shared/datas.js';
import { NotFoundError, RegraDeNegocioError } from '../../shared/errors/app-error.js';
import type { AcompanhamentoRow, Escopo, ResponsavelRepository } from './responsavel.repository.js';
import type { FilhoEdicaoInput, FilhoInput } from './responsavel.schemas.js';

/** Filhos que um responsável pode cadastrar (contra contas que criam alunos falsos em massa). */
export const MAX_FILHOS_POR_RESPONSAVEL = 10;

/**
 * Versão do termo de uso dos dados da criança que o app mostra no cadastro. Ao mudar o texto
 * do termo, mude a versão: o banco guarda qual versão cada família aceitou.
 */
export const TERMO_CADASTRO_ALUNO_VERSAO = '2026-10';

const ALUNO_NAO_ENCONTRADO = 'Aluno não encontrado';

const escopoDe = (m: Membro): Escopo => ({
  organizacaoId: m.organizacaoId,
  responsavelId: m.usuarioId,
});

function resumo(r: AcompanhamentoRow) {
  return {
    id: r.id,
    nome: r.nome,
    statusAluno: r.statusAluno,
    chegadaConfirmada: r.chegadaConfirmada,
    viagem: r.viagemId && r.viagemStatus ? { id: r.viagemId, status: r.viagemStatus } : null,
    rotaNome: r.rotaNome,
    motorista: r.motoristaNome ? { nome: r.motoristaNome, telefone: r.motoristaTelefone } : null,
    veiculo:
      r.veiculoPlaca && r.veiculoModelo ? { placa: r.veiculoPlaca, modelo: r.veiculoModelo } : null,
  };
}

export function criarResponsavelService(repo: ResponsavelRepository, hoje = hojeNoFusoDoNegocio) {
  return {
    async listarFilhos(m: Membro) {
      return (await repo.listarAcompanhamento(escopoDe(m), hoje())).map(resumo);
    },

    async acompanharFilho(m: Membro, alunoId: string) {
      const [filho] = await repo.listarAcompanhamento(escopoDe(m), hoje(), alunoId);
      // 404 (e não 403) para não revelar se o aluno existe em outra família.
      if (!filho) throw new NotFoundError(ALUNO_NAO_ENCONTRADO);

      // O banco só traz posição durante a viagem em andamento.
      const posicao =
        filho.latitude !== null && filho.longitude !== null && filho.posicaoAtualizadaEm
          ? {
              latitude: filho.latitude,
              longitude: filho.longitude,
              velocidade: filho.velocidade,
              atualizadaEm: filho.posicaoAtualizadaEm,
            }
          : null;
      return { ...resumo(filho), posicao };
    },

    /**
     * O responsável confirma que o filho chegou. Só depois de o motorista registrar a entrega,
     * e na viagem atual do filho (a mesma que a tela mostra). Confirmar de novo é aceito.
     */
    async confirmarChegada(m: Membro, alunoId: string) {
      const [filho] = await repo.listarAcompanhamento(escopoDe(m), hoje(), alunoId);
      if (!filho) throw new NotFoundError(ALUNO_NAO_ENCONTRADO);
      if (!filho.viagemId || filho.statusAluno !== 'ENTREGUE') {
        throw new RegraDeNegocioError(
          'A chegada pode ser confirmada depois que o motorista registrar a entrega',
        );
      }
      await repo.confirmarChegada({
        viagemId: filho.viagemId,
        alunoId: filho.id,
        responsavelId: m.usuarioId,
      });
      return { ...resumo(filho), chegadaConfirmada: true };
    },

    // ── Filho cadastrado pela própria família ────────────────────────────────
    // O responsável vem sempre do token (membro), nunca do corpo ou da URL. O aluno nasce
    // sem organização: nenhuma escola nem motorista o vê até um vínculo aceito.

    async cadastrarFilho(m: Membro, input: FilhoInput) {
      const resultado = await repo.cadastrarFilho({
        responsavelId: m.usuarioId,
        nome: input.nome,
        termoVersao: TERMO_CADASTRO_ALUNO_VERSAO,
        limite: MAX_FILHOS_POR_RESPONSAVEL,
      });
      if (resultado === 'limite') {
        throw new RegraDeNegocioError(
          `Limite de ${MAX_FILHOS_POR_RESPONSAVEL} alunos cadastrados por responsável`,
        );
      }
      return resultado;
    },

    /** Aluno de outra família, ou cadastrado pela escola, responde 404. */
    async editarFilho(m: Membro, alunoId: string, input: FilhoEdicaoInput) {
      const filho = await repo.atualizarFilho(m.usuarioId, alunoId, { nome: input.nome });
      if (!filho) throw new NotFoundError(ALUNO_NAO_ENCONTRADO);
      return filho;
    },

    async excluirFilho(m: Membro, alunoId: string) {
      const resultado = await repo.excluirFilho(m.usuarioId, alunoId);
      if (!resultado) throw new NotFoundError(ALUNO_NAO_ENCONTRADO);
    },
  };
}

export type ResponsavelService = ReturnType<typeof criarResponsavelService>;
