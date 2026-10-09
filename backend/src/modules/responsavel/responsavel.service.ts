import type { Membro } from '../../shared/acesso/acesso.js';
import { hojeNoFusoDoNegocio } from '../../shared/datas.js';
import { NotFoundError } from '../../shared/errors/app-error.js';
import type { AcompanhamentoRow, Escopo, ResponsavelRepository } from './responsavel.repository.js';

const escopoDe = (m: Membro): Escopo => ({
  organizacaoId: m.organizacaoId,
  responsavelId: m.usuarioId,
});

function resumo(r: AcompanhamentoRow) {
  return {
    id: r.id,
    nome: r.nome,
    statusAluno: r.statusAluno,
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
      if (!filho) throw new NotFoundError('Aluno não encontrado');

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
  };
}

export type ResponsavelService = ReturnType<typeof criarResponsavelService>;
