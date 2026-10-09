import { randomUUID } from 'node:crypto';
import type { EventoRow, ViagemRow } from '../db/consultas.js';
import type {
  AlunoDaRota,
  MotoristaRepository,
  RotaRow,
} from '../modules/motorista/motorista.repository.js';

type RotaFake = RotaRow & { organizacaoId: string; motoristaId: string; alunos: AlunoDaRota[] };
type ViagemFake = ViagemRow & { organizacaoId: string; motoristaId: string; criadaEm: number };

// Repositório do motorista em memória. Reproduz as garantias do banco que importam para as
// regras: uma viagem EM_ANDAMENTO por rota e evento único por (viagem, aluno, tipo).
export function criarFakeMotoristaRepository() {
  const rotas: RotaFake[] = [];
  const viagens: ViagemFake[] = [];
  const eventos: (EventoRow & { viagemId: string })[] = [];
  const posicoes = new Map<string, { latitude: number; longitude: number }>();

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
      return v;
    },
    async salvarPosicao(viagemId, p) {
      posicoes.set(viagemId, p);
    },
    async historico() {
      return [];
    },
  };

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

  return { repo, adicionarRota, posicoes, eventos };
}
