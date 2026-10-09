import type { Membro, Papel } from '../../shared/acesso/acesso.js';
import { ConflictError, NotFoundError } from '../../shared/errors/app-error.js';
import type { AdminRepository } from './admin.repository.js';
import type { RotaAlunoInput, RotaInput, VeiculoInput, VinculoInput } from './admin.schemas.js';

// Cadastros da organização. Toda referência recebida (motorista, veículo, aluno, rota) é
// conferida contra a organização do admin antes de gravar: um admin nunca liga dados
// da sua organização a registros de outra.
export function criarAdminService(repo: AdminRepository) {
  async function exigir(condicao: Promise<boolean>, mensagem: string) {
    if (!(await condicao)) throw new NotFoundError(mensagem);
  }

  return {
    async organizacao(m: Membro) {
      const org = await repo.buscarOrganizacao(m.organizacaoId);
      if (!org) throw new NotFoundError('Organização não encontrada');
      return org;
    },

    listarMembros: (m: Membro, papel?: Papel) => repo.listarMembros(m.organizacaoId, papel),

    listarVeiculos: (m: Membro) => repo.listarVeiculos(m.organizacaoId),

    async criarVeiculo(m: Membro, input: VeiculoInput) {
      const veiculo = await repo.criarVeiculo({
        organizacaoId: m.organizacaoId,
        placa: input.placa.replace('-', ''),
        modelo: input.modelo,
        capacidade: input.capacidade ?? null,
      });
      if (!veiculo) throw new ConflictError('Já existe um veículo com esta placa');
      return veiculo;
    },

    listarAlunos: (m: Membro) => repo.listarAlunos(m.organizacaoId),
    criarAluno: (m: Membro, nome: string) => repo.criarAluno(m.organizacaoId, nome),

    async vincularResponsavel(m: Membro, alunoId: string, input: VinculoInput) {
      await exigir(repo.alunoDaOrganizacao(m.organizacaoId, alunoId), 'Aluno não encontrado');
      const responsavelId = await repo.buscarMembroPorEmail(
        m.organizacaoId,
        input.email,
        'RESPONSAVEL',
      );
      if (!responsavelId) {
        throw new NotFoundError(
          'Nenhum responsável com este e-mail na organização. Peça para ele criar a conta com o código de convite.',
        );
      }
      await repo.vincularResponsavel({
        alunoId,
        responsavelId,
        parentesco: input.parentesco ?? null,
      });
    },

    listarRotas: (m: Membro) => repo.listarRotas(m.organizacaoId),

    async detalharRota(m: Membro, rotaId: string) {
      const rota = await repo.buscarRota(m.organizacaoId, rotaId);
      if (!rota) throw new NotFoundError('Rota não encontrada');
      return { ...rota, alunos: await repo.listarAlunosDaRota(rota.id) };
    },

    async detalharAluno(m: Membro, alunoId: string) {
      const aluno = await repo.buscarAluno(m.organizacaoId, alunoId);
      if (!aluno) throw new NotFoundError('Aluno não encontrado');
      return { ...aluno, responsaveis: await repo.listarResponsaveisDoAluno(aluno.id) };
    },

    async criarRota(m: Membro, input: RotaInput) {
      await exigir(
        repo.buscarMembroPorId(m.organizacaoId, input.motoristaId, 'MOTORISTA'),
        'Motorista não encontrado nesta organização',
      );
      await exigir(
        repo.veiculoDaOrganizacao(m.organizacaoId, input.veiculoId),
        'Veículo não encontrado',
      );
      return repo.criarRota({
        organizacaoId: m.organizacaoId,
        nome: input.nome,
        periodo: input.periodo ?? null,
        motoristaId: input.motoristaId,
        veiculoId: input.veiculoId,
      });
    },

    async adicionarAlunoNaRota(m: Membro, rotaId: string, input: RotaAlunoInput) {
      await exigir(repo.rotaDaOrganizacao(m.organizacaoId, rotaId), 'Rota não encontrada');
      await exigir(repo.alunoDaOrganizacao(m.organizacaoId, input.alunoId), 'Aluno não encontrado');
      const resultado = await repo.adicionarAlunoNaRota({
        rotaId,
        alunoId: input.alunoId,
        ordem: input.ordem,
        endereco: input.endereco ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
      });
      if (resultado === 'duplicado') {
        throw new ConflictError('O aluno já está nesta rota ou a ordem de embarque já está em uso');
      }
    },
  };
}

export type AdminService = ReturnType<typeof criarAdminService>;
