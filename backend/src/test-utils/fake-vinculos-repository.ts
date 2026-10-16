import { randomUUID } from 'node:crypto';
import type { AcaoAuditada } from '../db/auditoria.js';
import type {
  Pagina,
  PedidoRecebidoRow,
  SolicitacaoRow,
  VinculosRepository,
} from '../modules/vinculos/vinculos.repository.js';
import type { EstadoSolicitacao } from '../modules/vinculos/vinculos.schemas.js';

type MotoristaFake = {
  id: string;
  nome: string;
  telefone: string | null;
  regiaoAtendimento: string | null;
  apresentacao: string | null;
  veiculoModelo: string | null;
  aprovado: boolean;
  ativo: boolean;
};
type AlunoFake = {
  id: string;
  nome: string;
  responsavelId: string;
  responsavelNome: string;
  ativo: boolean;
};
type SolicitacaoFake = {
  id: string;
  alunoId: string;
  responsavelId: string;
  motoristaId: string;
  estado: EstadoSolicitacao;
  expiraEm: Date;
  respondidaEm: Date | null;
  criadoEm: Date;
};

// Repositório de vínculos em memória. Reproduz as garantias do banco que importam para as regras:
// só motorista aprovado e ativo é visível; posse do aluno; um pendente por aluno e motorista;
// pendente vencido lido como EXPIRADA; mudanças de estado só a partir de PENDENTE válido; o
// telefone só depois do aceite; vínculo criado no aceite; motorista que perdeu a aprovação não
// vê nem responde pedidos; pedido de aluno inativo não é aceito; registro de auditoria.
export function criarFakeVinculosRepository() {
  const motoristas: MotoristaFake[] = [];
  const alunos: AlunoFake[] = [];
  const solicitacoes: SolicitacaoFake[] = [];
  const vinculos: { alunoId: string; motoristaId: string }[] = [];
  const auditoria: { usuarioId: string; acao: AcaoAuditada; entidadeId: string }[] = [];

  const agora = () => Date.now();
  const estadoEfetivo = (s: SolicitacaoFake): EstadoSolicitacao =>
    s.estado === 'PENDENTE' && s.expiraEm.getTime() <= agora() ? 'EXPIRADA' : s.estado;
  const pendenteValido = (s: SolicitacaoFake) => estadoEfetivo(s) === 'PENDENTE';
  const visivel = (id: string) => motoristas.find((m) => m.id === id && m.aprovado && m.ativo);
  const alunoAtivo = (id: string) => alunos.some((a) => a.id === id && a.ativo);

  const linha = (s: SolicitacaoFake): SolicitacaoRow => {
    const aluno = alunos.find((a) => a.id === s.alunoId);
    const motorista = motoristas.find((m) => m.id === s.motoristaId);
    if (!aluno || !motorista) throw new Error('fake: pedido sem aluno ou motorista');
    return {
      id: s.id,
      estado: estadoEfetivo(s),
      criadoEm: s.criadoEm,
      expiraEm: s.expiraEm,
      respondidaEm: s.respondidaEm,
      responsavelId: s.responsavelId,
      alunoId: aluno.id,
      alunoNome: aluno.nome,
      motoristaId: motorista.id,
      motoristaNome: motorista.nome,
      motoristaRegiao: motorista.regiaoAtendimento,
      motoristaTelefone: s.estado === 'ACEITA' ? motorista.telefone : null,
    };
  };
  const recebido = (s: SolicitacaoFake): PedidoRecebidoRow => {
    const aluno = alunos.find((a) => a.id === s.alunoId);
    if (!aluno) throw new Error('fake: pedido sem aluno');
    return {
      id: s.id,
      estado: estadoEfetivo(s),
      criadoEm: s.criadoEm,
      expiraEm: s.expiraEm,
      alunoNome: aluno.nome,
      responsavelNome: aluno.responsavelNome,
    };
  };
  // Ordem (criado_em, id), como no banco. O cursor fora da lista (de outra pessoa) dá página vazia.
  const cronologica = (a: SolicitacaoFake, b: SolicitacaoFake) =>
    a.criadoEm.getTime() - b.criadoEm.getTime() || a.id.localeCompare(b.id);
  const paginar = (ordenadas: SolicitacaoFake[], { limit, cursor }: Pagina) => {
    const inicio = cursor ? ordenadas.findIndex((s) => s.id === cursor) + 1 : 0;
    return cursor && inicio === 0 ? [] : ordenadas.slice(inicio, inicio + limit);
  };
  const auditar = (usuarioId: string, acao: AcaoAuditada, entidadeId: string) =>
    auditoria.push({ usuarioId, acao, entidadeId });

  const repo: VinculosRepository = {
    async buscarMotoristas({ termo, regiao, limit, cursor }) {
      const contem = (valor: string | null, busca: string | undefined) =>
        busca === undefined || (valor ?? '').toLowerCase().includes(busca.toLowerCase());
      const ordenados = motoristas
        .filter((m) => m.aprovado && m.ativo)
        .filter((m) => contem(m.nome, termo) && contem(m.regiaoAtendimento, regiao))
        .sort((a, b) => a.nome.localeCompare(b.nome) || a.id.localeCompare(b.id));
      const inicio = cursor ? ordenados.findIndex((m) => m.id === cursor) + 1 : 0;
      return ordenados.slice(inicio, inicio + limit).map((m) => ({
        id: m.id,
        nome: m.nome,
        regiaoAtendimento: m.regiaoAtendimento,
        apresentacao: m.apresentacao,
        veiculoModelo: m.veiculoModelo,
      }));
    },

    async criarSolicitacao({
      responsavelId,
      alunoId,
      motoristaId,
      expiraEm,
      maxPendentes,
      recusadaDesde,
    }) {
      if (!alunos.some((a) => a.id === alunoId && a.responsavelId === responsavelId && a.ativo)) {
        return { tipo: 'aluno-nao-encontrado' };
      }
      if (!visivel(motoristaId)) return { tipo: 'motorista-nao-encontrado' };
      if (vinculos.some((v) => v.alunoId === alunoId && v.motoristaId === motoristaId)) {
        return { tipo: 'ja-vinculado' };
      }
      const existente = solicitacoes.find(
        (s) => s.alunoId === alunoId && s.motoristaId === motoristaId && pendenteValido(s),
      );
      if (existente) {
        return existente.responsavelId === responsavelId
          ? { tipo: 'existente', solicitacao: linha(existente) }
          : { tipo: 'pendente-de-outro-responsavel' };
      }
      const recusa = solicitacoes.some(
        (s) =>
          s.responsavelId === responsavelId &&
          s.motoristaId === motoristaId &&
          s.estado === 'RECUSADA' &&
          (s.respondidaEm?.getTime() ?? 0) >= recusadaDesde.getTime(),
      );
      if (recusa) return { tipo: 'recusada-recentemente' };
      const pendentes = solicitacoes.filter(
        (s) => s.responsavelId === responsavelId && pendenteValido(s),
      ).length;
      if (pendentes >= maxPendentes) return { tipo: 'limite' };

      const nova: SolicitacaoFake = {
        id: randomUUID(),
        alunoId,
        responsavelId,
        motoristaId,
        estado: 'PENDENTE',
        expiraEm,
        respondidaEm: null,
        criadoEm: new Date(),
      };
      solicitacoes.push(nova);
      auditar(responsavelId, 'SOLICITACAO_CRIADA', nova.id);
      return { tipo: 'criada', solicitacao: linha(nova) };
    },

    async listarSolicitacoesDoResponsavel(responsavelId, pagina) {
      const ordenadas = solicitacoes
        .filter((s) => s.responsavelId === responsavelId)
        .sort((a, b) => -cronologica(a, b));
      return paginar(ordenadas, pagina).map(linha);
    },

    async buscarSolicitacaoDoResponsavel(responsavelId, solicitacaoId) {
      const s = solicitacoes.find(
        (x) => x.id === solicitacaoId && x.responsavelId === responsavelId,
      );
      return s && linha(s);
    },

    async cancelarSolicitacao(responsavelId, solicitacaoId) {
      const s = solicitacoes.find(
        (x) => x.id === solicitacaoId && x.responsavelId === responsavelId,
      );
      if (!s) return 'nao-encontrada';
      if (!pendenteValido(s)) return 'ja-respondida';
      s.estado = 'CANCELADA';
      s.respondidaEm = new Date();
      auditar(responsavelId, 'SOLICITACAO_CANCELADA', s.id);
      return 'ok';
    },

    async listarPedidosRecebidos(motoristaId, pagina) {
      const ordenadas = solicitacoes
        .filter(
          (s) =>
            s.motoristaId === motoristaId &&
            pendenteValido(s) &&
            alunoAtivo(s.alunoId) &&
            visivel(motoristaId),
        )
        .sort(cronologica);
      return paginar(ordenadas, pagina).map(recebido);
    },

    async buscarPedidoRecebido(motoristaId, solicitacaoId) {
      const s = solicitacoes.find((x) => x.id === solicitacaoId && x.motoristaId === motoristaId);
      return s && recebido(s);
    },

    async responderSolicitacao(motoristaId, solicitacaoId, decisao) {
      if (!visivel(motoristaId)) return 'motorista-nao-habilitado';
      const s = solicitacoes.find((x) => x.id === solicitacaoId && x.motoristaId === motoristaId);
      if (!s) return 'nao-encontrada';
      if (!pendenteValido(s) || !alunoAtivo(s.alunoId)) return 'ja-respondida';
      s.estado = decisao;
      s.respondidaEm = new Date();
      if (decisao === 'ACEITA') vinculos.push({ alunoId: s.alunoId, motoristaId });
      auditar(
        motoristaId,
        decisao === 'ACEITA' ? 'SOLICITACAO_ACEITA' : 'SOLICITACAO_RECUSADA',
        s.id,
      );
      return 'ok';
    },
  };

  return {
    repo,
    auditoria,
    vinculos,
    /** Motorista aprovado e ativo, a não ser que o teste diga o contrário. */
    adicionarMotorista(dados: Partial<MotoristaFake> = {}): MotoristaFake {
      const m: MotoristaFake = {
        id: randomUUID(),
        nome: 'Carlos Souza',
        telefone: '11999990000',
        regiaoAtendimento: 'Zona Sul',
        apresentacao: 'Transporte escolar há 10 anos',
        veiculoModelo: 'Van Sprinter',
        aprovado: true,
        ativo: true,
        ...dados,
      };
      motoristas.push(m);
      return m;
    },
    /** Aluno com vínculo autorizado do responsável. */
    adicionarAluno(responsavelId: string, nome = 'Ana Lima', responsavelNome = 'Maria Lima') {
      const a: AlunoFake = { id: randomUUID(), nome, responsavelId, responsavelNome, ativo: true };
      alunos.push(a);
      return a;
    },
    /** Revoga a aprovação do motorista (script aprovar:motorista --revogar). */
    revogarAprovacao(motoristaId: string) {
      const m = motoristas.find((x) => x.id === motoristaId);
      if (m) m.aprovado = false;
    },
    /** Aluno excluído pela família e anonimizado (fica inativo). */
    desativarAluno(alunoId: string) {
      const a = alunos.find((x) => x.id === alunoId);
      if (a) a.ativo = false;
    },
    /** Faz o prazo do pedido vencer. */
    vencer(solicitacaoId: string) {
      const s = solicitacoes.find((x) => x.id === solicitacaoId);
      if (s) s.expiraEm = new Date(agora() - 1000);
    },
  };
}
