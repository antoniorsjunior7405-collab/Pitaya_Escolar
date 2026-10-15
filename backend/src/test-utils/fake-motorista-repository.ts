import { randomUUID } from 'node:crypto';
import type { EventoRow, ViagemRow } from '../db/consultas.js';
import type {
  AlunoDaRota,
  Escopo,
  MotoristaRepository,
  PerfilRow,
  RotaRow,
  VeiculoRow,
} from '../modules/motorista/motorista.repository.js';

type RotaFake = RotaRow & { organizacaoId: string; motoristaId: string; alunos: AlunoDaRota[] };
type ViagemFake = ViagemRow & { organizacaoId: string; motoristaId: string; criadaEm: number };
type VeiculoFake = VeiculoRow & { organizacaoId: string; motoristaId: string | null };

// Repositório do motorista em memória. Reproduz as garantias do banco que importam para as
// regras: uma viagem EM_ANDAMENTO por rota, evento único por (viagem, aluno, tipo) e placa
// única em todo o sistema.
export function criarFakeMotoristaRepository() {
  const rotas: RotaFake[] = [];
  const viagens: ViagemFake[] = [];
  const eventos: (EventoRow & { viagemId: string })[] = [];
  const posicoes = new Map<string, { latitude: number; longitude: number }>();
  const perfis = new Map<string, PerfilRow>();
  const veiculos: VeiculoFake[] = [];

  const publico = ({ id, placa, modelo, capacidade }: VeiculoFake): VeiculoRow => ({
    id,
    placa,
    modelo,
    capacidade,
  });
  const doMotorista = (e: Escopo) => (v: VeiculoFake) =>
    v.organizacaoId === e.organizacaoId && v.motoristaId === e.motoristaId;
  const placaEmUso = (placa: string, excetoId?: string) =>
    veiculos.some((v) => v.placa === placa && v.id !== excetoId);

  const repo: MotoristaRepository = {
    async listarRotas(e) {
      return rotas
        .filter((r) => r.organizacaoId === e.organizacaoId && r.motoristaId === e.motoristaId)
        .map((r) => ({
          id: r.id,
          nome: r.nome,
          periodo: r.periodo,
          veiculo: r.veiculo,
          totalAlunos: r.alunos.length,
        }));
    },
    async buscarRota(e, rotaId) {
      return rotas.find(
        (r) =>
          r.id === rotaId && r.organizacaoId === e.organizacaoId && r.motoristaId === e.motoristaId,
      );
    },
    async listarAlunosDaRota(rotaId) {
      return rotas.find((r) => r.id === rotaId)?.alunos ?? [];
    },
    async alunoEstaNaRota(rotaId, alunoId) {
      return rotas.some((r) => r.id === rotaId && r.alunos.some((a) => a.id === alunoId));
    },
    async buscarViagemAtual(rotaId, hoje) {
      return viagens
        .filter((v) => v.rotaId === rotaId && (v.status === 'EM_ANDAMENTO' || v.data === hoje))
        .sort(
          (a, b) =>
            Number(b.status === 'EM_ANDAMENTO') - Number(a.status === 'EM_ANDAMENTO') ||
            b.criadaEm - a.criadaEm,
        )[0];
    },
    async buscarViagem(e, viagemId) {
      return viagens.find(
        (v) =>
          v.id === viagemId &&
          v.organizacaoId === e.organizacaoId &&
          v.motoristaId === e.motoristaId,
      );
    },
    async listarEventos(viagemId) {
      return eventos.filter((ev) => ev.viagemId === viagemId);
    },
    async criarViagemEmAndamento({ escopo, rotaId, data }) {
      if (viagens.some((v) => v.rotaId === rotaId && v.status === 'EM_ANDAMENTO')) return undefined;
      const v: ViagemFake = {
        id: randomUUID(),
        rotaId,
        status: 'EM_ANDAMENTO',
        data,
        iniciadaEm: new Date(),
        finalizadaEm: null,
        organizacaoId: escopo.organizacaoId,
        motoristaId: escopo.motoristaId,
        criadaEm: viagens.length,
      };
      viagens.push(v);
      return v;
    },
    async registrarEvento({ viagemId, alunoId, tipo }) {
      if (
        eventos.some((e) => e.viagemId === viagemId && e.alunoId === alunoId && e.tipo === tipo)
      ) {
        return undefined;
      }
      const ev = { viagemId, alunoId, tipo, registradoEm: new Date() };
      eventos.push(ev);
      return ev;
    },
    async finalizarViagem(viagemId) {
      const v = viagens.find((x) => x.id === viagemId && x.status === 'EM_ANDAMENTO');
      if (!v) return undefined;
      v.status = 'FINALIZADA';
      v.finalizadaEm = new Date();
      posicoes.delete(viagemId);
      return v;
    },
    async salvarPosicao(viagemId, p) {
      posicoes.set(viagemId, p);
    },
    async historico() {
      return [];
    },
    async buscarPerfil(usuarioId) {
      return perfis.get(usuarioId);
    },
    async salvarPerfil(usuarioId, dados) {
      const atual = perfis.get(usuarioId);
      if (atual) perfis.set(usuarioId, { ...atual, ...dados });
    },
    async listarVeiculos(e) {
      return veiculos
        .filter(doMotorista(e))
        .map(publico)
        .sort((a, b) => a.placa.localeCompare(b.placa));
    },
    async criarVeiculo(e, dados) {
      if (placaEmUso(dados.placa)) return undefined;
      const v: VeiculoFake = {
        id: randomUUID(),
        organizacaoId: e.organizacaoId,
        motoristaId: e.motoristaId,
        ...dados,
      };
      veiculos.push(v);
      return publico(v);
    },
    async atualizarVeiculo(e, veiculoId, dados) {
      const v = veiculos.find((x) => x.id === veiculoId && doMotorista(e)(x));
      if (!v) return 'nao-encontrado';
      if (placaEmUso(dados.placa, v.id)) return 'placa-duplicada';
      Object.assign(v, dados);
      return publico(v);
    },
  };

  /** Conta de motorista recém-criada: sem perfil preenchido ainda. */
  function adicionarUsuario(usuarioId: string, nome = 'Motorista Teste') {
    perfis.set(usuarioId, {
      nome,
      email: `${usuarioId}@teste.dev`,
      telefone: null,
      apresentacao: null,
      regiaoAtendimento: null,
    });
  }

  function adicionarRota(input: { organizacaoId: string; motoristaId: string; alunos?: number }) {
    const rota: RotaFake = {
      id: randomUUID(),
      nome: 'Rota Teste',
      periodo: 'MANHA',
      veiculoId: randomUUID(),
      veiculo: { placa: 'ABC1D23', modelo: 'Van' },
      organizacaoId: input.organizacaoId,
      motoristaId: input.motoristaId,
      alunos: Array.from({ length: input.alunos ?? 2 }, (_, i) => ({
        id: randomUUID(),
        nome: `Aluno ${i + 1}`,
        ordem: i + 1,
        endereco: null,
      })),
    };
    rotas.push(rota);
    return rota;
  }

  return { repo, adicionarRota, adicionarUsuario, posicoes, eventos, veiculos };
}
