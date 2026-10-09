import type { ViagemRow } from '../../db/consultas.js';
import type { Membro } from '../../shared/acesso/acesso.js';
import { hojeNoFusoDoNegocio } from '../../shared/datas.js';
import { NotFoundError } from '../../shared/errors/app-error.js';
import { statusDoAluno } from '../../shared/status-aluno.js';
import type { Escopo, ResponsavelRepository, RotaDoAluno } from './responsavel.repository.js';

const escopoDe = (m: Membro): Escopo => ({
  organizacaoId: m.organizacaoId,
  responsavelId: m.usuarioId,
});

export function criarResponsavelService(repo: ResponsavelRepository, hoje = hojeNoFusoDoNegocio) {
  /**
   * Transporte do aluno agora: entre as rotas dele, prioriza a que tem viagem em andamento;
   * senão, a que teve viagem hoje; senão, a primeira rota (sem viagem).
   */
  async function transporteDoAluno(alunoId: string) {
    const rotasDoAluno = await repo.listarRotasDoAluno(alunoId);
    const candidatas: { rota: RotaDoAluno; viagem: ViagemRow | undefined }[] = await Promise.all(
      rotasDoAluno.map(async (rota) => ({
        rota,
        viagem: await repo.buscarViagemAtual(rota.rotaId, hoje()),
      })),
    );
    const escolhida =
      candidatas.find((c) => c.viagem?.status === 'EM_ANDAMENTO') ??
      candidatas.find((c) => c.viagem) ??
      candidatas[0];
    if (!escolhida) return { rota: null, viagem: null, statusAluno: 'AGUARDANDO' as const };

    const eventos = escolhida.viagem ? await repo.listarEventos(escolhida.viagem.id) : [];
    return {
      rota: escolhida.rota,
      viagem: escolhida.viagem ?? null,
      statusAluno: statusDoAluno(eventos, alunoId),
    };
  }

  function resumo(
    filho: { id: string; nome: string },
    t: Awaited<ReturnType<typeof transporteDoAluno>>,
  ) {
    return {
      id: filho.id,
      nome: filho.nome,
      statusAluno: t.statusAluno,
      viagem: t.viagem ? { id: t.viagem.id, status: t.viagem.status } : null,
      rotaNome: t.rota?.rotaNome ?? null,
      motorista: t.rota?.motorista ?? null,
      veiculo: t.rota?.veiculo ?? null,
    };
  }

  return {
    async listarFilhos(m: Membro) {
      const filhos = await repo.listarFilhos(escopoDe(m));
      return Promise.all(
        filhos.map(async (filho) => resumo(filho, await transporteDoAluno(filho.id))),
      );
    },

    async acompanharFilho(m: Membro, alunoId: string) {
      // 404 (e não 403) para não revelar se o aluno existe em outra família.
      const filho = await repo.buscarFilho(escopoDe(m), alunoId);
      if (!filho) throw new NotFoundError('Aluno não encontrado');

      const t = await transporteDoAluno(filho.id);
      // Localização só durante a viagem: fora dela, não expomos onde o veículo está.
      const posicao =
        t.viagem?.status === 'EM_ANDAMENTO'
          ? ((await repo.buscarPosicao(t.viagem.id)) ?? null)
          : null;

      return { ...resumo(filho, t), posicao };
    },
  };
}

export type ResponsavelService = ReturnType<typeof criarResponsavelService>;
