import type { ViagemRow } from '../../db/consultas.js';
import type { Membro } from '../../shared/acesso/acesso.js';
import { hojeNoFusoDoNegocio } from '../../shared/datas.js';
import {
  ConflictError,
  NotFoundError,
  RegraDeNegocioError,
} from '../../shared/errors/app-error.js';
import { statusDoAluno } from '../../shared/status-aluno.js';
import type { DadosVeiculo, Escopo, MotoristaRepository } from './motorista.repository.js';
import type {
  PerfilInput,
  PosicaoInput,
  TipoEventoInput,
  VeiculoInput,
} from './motorista.schemas.js';
import { garantirEmAndamento, garantirOrdemDoEvento, podeFinalizar } from './regras-viagem.js';

const escopoDe = (m: Membro): Escopo => ({
  organizacaoId: m.organizacaoId,
  motoristaId: m.usuarioId,
});

const PLACA_EM_USO = 'Já existe um veículo com esta placa';

// A placa já chega normalizada pelo schema; aqui só fixamos "não informada" como null.
const dadosDoVeiculo = (input: VeiculoInput): DadosVeiculo => ({
  placa: input.placa,
  modelo: input.modelo,
  capacidade: input.capacidade ?? null,
});

export function criarMotoristaService(repo: MotoristaRepository, hoje = hojeNoFusoDoNegocio) {
  async function comEventos(viagem: ViagemRow) {
    return { ...viagem, eventos: await repo.listarEventos(viagem.id) };
  }

  async function viagemDoMotorista(m: Membro, viagemId: string) {
    const viagem = await repo.buscarViagem(escopoDe(m), viagemId);
    if (!viagem) throw new NotFoundError('Viagem não encontrada');
    return viagem;
  }

  async function perfilDoMotorista(m: Membro) {
    const [perfil, veiculos] = await Promise.all([
      repo.buscarPerfil(m.usuarioId),
      repo.listarVeiculos(escopoDe(m)),
    ]);
    if (!perfil) throw new NotFoundError('Perfil não encontrado');
    return { ...perfil, veiculos };
  }

  return {
    listarRotas: (m: Membro) => repo.listarRotas(escopoDe(m)),

    async detalharRota(m: Membro, rotaId: string) {
      const rota = await repo.buscarRota(escopoDe(m), rotaId);
      if (!rota) throw new NotFoundError('Rota não encontrada');

      const [alunos, viagem] = await Promise.all([
        repo.listarAlunosDaRota(rota.id),
        repo.buscarViagemAtual(rota.id, hoje()),
      ]);
      const viagemAtual = viagem ? await comEventos(viagem) : null;
      const eventos = viagemAtual?.eventos ?? [];

      return {
        id: rota.id,
        nome: rota.nome,
        periodo: rota.periodo,
        veiculo: rota.veiculo,
        alunos: alunos.map((a) => ({ ...a, status: statusDoAluno(eventos, a.id) })),
        viagemAtual,
      };
    },

    /** Inicia a viagem da rota. Se já houver uma em andamento, devolve essa (idempotente). */
    async iniciarViagem(m: Membro, rotaId: string) {
      const escopo = escopoDe(m);
      const rota = await repo.buscarRota(escopo, rotaId);
      if (!rota) throw new NotFoundError('Rota não encontrada');

      const criada = await repo.criarViagemEmAndamento({
        escopo,
        rotaId: rota.id,
        veiculoId: rota.veiculoId,
        data: hoje(),
      });
      if (criada) return { viagem: await comEventos(criada), criada: true };

      const atual = await repo.buscarViagemAtual(rota.id, hoje());
      if (atual?.status !== 'EM_ANDAMENTO') {
        throw new RegraDeNegocioError('Não foi possível iniciar a viagem. Tente novamente.');
      }
      return { viagem: await comEventos(atual), criada: false };
    },

    /** Registra embarque/entrega. Reenviar o mesmo evento não duplica (idempotente). */
    async registrarEvento(m: Membro, viagemId: string, alunoId: string, tipo: TipoEventoInput) {
      const viagem = await viagemDoMotorista(m, viagemId);
      garantirEmAndamento(viagem.status);

      if (!(await repo.alunoEstaNaRota(viagem.rotaId, alunoId))) {
        throw new NotFoundError('Aluno não pertence a esta rota');
      }

      const eventos = await repo.listarEventos(viagem.id);
      const jaEmbarcou = eventos.some((e) => e.alunoId === alunoId && e.tipo === 'EMBARCADO');
      garantirOrdemDoEvento(tipo, jaEmbarcou);

      const novo = await repo.registrarEvento({
        viagemId: viagem.id,
        alunoId,
        tipo,
        registradoPor: m.usuarioId,
      });
      const evento = novo ?? eventos.find((e) => e.alunoId === alunoId && e.tipo === tipo);
      if (!evento) throw new RegraDeNegocioError('Não foi possível registrar. Tente novamente.');
      return { evento, criado: novo !== undefined };
    },

    async finalizarViagem(m: Membro, viagemId: string) {
      const viagem = await viagemDoMotorista(m, viagemId);
      if (podeFinalizar(viagem.status) === 'ja-finalizada') return comEventos(viagem);

      const finalizada = await repo.finalizarViagem(viagem.id);
      // Outro toque pode ter finalizado no meio do caminho: devolvemos o estado atual.
      return comEventos(finalizada ?? (await viagemDoMotorista(m, viagemId)));
    },

    async atualizarPosicao(m: Membro, viagemId: string, posicao: PosicaoInput) {
      const viagem = await viagemDoMotorista(m, viagemId);
      garantirEmAndamento(viagem.status);
      await repo.salvarPosicao(viagem.id, {
        latitude: posicao.latitude,
        longitude: posicao.longitude,
        velocidade: posicao.velocidade ?? null,
      });
    },

    historico: (m: Membro, limite: number, antesDe?: Date) =>
      repo.historico(escopoDe(m), limite, antesDe),

    // ── Perfil e veículos do próprio motorista ──────────────────────────────
    // O motorista só lê e altera os PRÓPRIOS dados: o id vem sempre do token (membro),
    // nunca do corpo ou da URL.

    perfil: perfilDoMotorista,

    async atualizarPerfil(m: Membro, input: PerfilInput) {
      await repo.salvarPerfil(m.usuarioId, input);
      return perfilDoMotorista(m);
    },

    listarVeiculos: (m: Membro) => repo.listarVeiculos(escopoDe(m)),

    async cadastrarVeiculo(m: Membro, input: VeiculoInput) {
      const veiculo = await repo.criarVeiculo(escopoDe(m), dadosDoVeiculo(input));
      if (!veiculo) throw new ConflictError(PLACA_EM_USO);
      return veiculo;
    },

    /** Veículo de outro motorista (ou de outra organização) responde 404, não 403. */
    async atualizarVeiculo(m: Membro, veiculoId: string, input: VeiculoInput) {
      const resultado = await repo.atualizarVeiculo(escopoDe(m), veiculoId, dadosDoVeiculo(input));
      if (resultado === 'nao-encontrado') throw new NotFoundError('Veículo não encontrado');
      if (resultado === 'placa-duplicada') throw new ConflictError(PLACA_EM_USO);
      return resultado;
    },
  };
}

export type MotoristaService = ReturnType<typeof criarMotoristaService>;
