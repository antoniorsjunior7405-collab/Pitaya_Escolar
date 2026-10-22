import { randomUUID } from 'node:crypto';
import type { AcaoAuditada } from '../db/auditoria.js';
import {
  NOME_ANONIMIZADO,
  type AcompanhamentoRow,
  type ResponsavelRepository,
} from '../modules/responsavel/responsavel.repository.js';

type AlunoFake = {
  id: string;
  nome: string;
  organizacaoId: string | null;
  criadoPor: string | null;
  ativo: boolean;
  temHistorico: boolean;
};
type VinculoFake = {
  alunoId: string;
  responsavelId: string;
  autorizado: boolean;
  consentimentoEm: Date | null;
  termoVersao: string | null;
};

// Repositório do responsável em memória. Reproduz as garantias do banco que importam para as
// regras: aluno "da família" = sem organização, ativo e com vínculo autorizado do responsável;
// limite de cadastros; exclusão que apaga ou anonimiza; registro de auditoria.
export function criarFakeResponsavelRepository() {
  const alunos: AlunoFake[] = [];
  const vinculos: VinculoFake[] = [];
  const auditoria: { usuarioId: string; acao: AcaoAuditada; entidadeId: string }[] = [];
  const chegadas = new Set<string>();

  const autorizadoPara = (responsavelId: string, alunoId: string) =>
    vinculos.some(
      (v) => v.alunoId === alunoId && v.responsavelId === responsavelId && v.autorizado,
    );
  const daFamilia = (responsavelId: string, alunoId: string) =>
    alunos.find(
      (a) =>
        a.id === alunoId &&
        a.organizacaoId === null &&
        a.ativo &&
        autorizadoPara(responsavelId, a.id),
    );

  const acompanhamento = (a: AlunoFake): AcompanhamentoRow => ({
    id: a.id,
    nome: a.nome,
    statusAluno: 'AGUARDANDO',
    chegadaConfirmada: false,
    viagemId: null,
    viagemStatus: null,
    rotaNome: null,
    motoristaNome: null,
    motoristaTelefone: null,
    veiculoPlaca: null,
    veiculoModelo: null,
    latitude: null,
    longitude: null,
    velocidade: null,
    posicaoAtualizadaEm: null,
  });

  const repo: ResponsavelRepository = {
    async listarAcompanhamento(escopo, _hoje, alunoId) {
      return alunos
        .filter(
          (a) =>
            a.ativo &&
            (a.organizacaoId === escopo.organizacaoId || a.organizacaoId === null) &&
            autorizadoPara(escopo.responsavelId, a.id) &&
            (!alunoId || a.id === alunoId),
        )
        .map(acompanhamento);
    },
    async confirmarChegada({ viagemId, alunoId }) {
      const chave = `${viagemId}:${alunoId}`;
      if (chegadas.has(chave)) return false;
      chegadas.add(chave);
      return true;
    },
    async cadastrarFilho({ responsavelId, nome, termoVersao, limite }) {
      const cadastrados = alunos.filter(
        (a) => a.criadoPor === responsavelId && a.organizacaoId === null && a.ativo,
      ).length;
      if (cadastrados >= limite) return 'limite';
      const aluno: AlunoFake = {
        id: randomUUID(),
        nome,
        organizacaoId: null,
        criadoPor: responsavelId,
        ativo: true,
        temHistorico: false,
      };
      alunos.push(aluno);
      vinculos.push({
        alunoId: aluno.id,
        responsavelId,
        autorizado: true,
        consentimentoEm: new Date(),
        termoVersao,
      });
      auditoria.push({ usuarioId: responsavelId, acao: 'ALUNO_CRIADO', entidadeId: aluno.id });
      return { id: aluno.id, nome: aluno.nome };
    },
    async atualizarFilho(responsavelId, alunoId, dados) {
      const aluno = daFamilia(responsavelId, alunoId);
      if (!aluno) return undefined;
      aluno.nome = dados.nome;
      auditoria.push({ usuarioId: responsavelId, acao: 'ALUNO_EDITADO', entidadeId: aluno.id });
      return { id: aluno.id, nome: aluno.nome };
    },
    async excluirFilho(responsavelId, alunoId) {
      const aluno = daFamilia(responsavelId, alunoId);
      if (!aluno) return undefined;
      const restantes = vinculos.filter((v) => v.alunoId !== aluno.id);
      vinculos.splice(0, vinculos.length, ...restantes);
      if (aluno.temHistorico) {
        Object.assign(aluno, { nome: NOME_ANONIMIZADO, ativo: false, criadoPor: null });
      } else {
        alunos.splice(alunos.indexOf(aluno), 1);
      }
      const resultado = aluno.temHistorico ? 'anonimizado' : 'excluido';
      auditoria.push({
        usuarioId: responsavelId,
        acao: resultado === 'excluido' ? 'ALUNO_EXCLUIDO' : 'ALUNO_ANONIMIZADO',
        entidadeId: aluno.id,
      });
      return resultado;
    },
  };

  /** Aluno cadastrado pela ESCOLA (admin), com o responsável vinculado e autorizado. */
  function adicionarAlunoDaEscola(organizacaoId: string, responsavelId: string) {
    const aluno: AlunoFake = {
      id: randomUUID(),
      nome: 'Aluno da Escola',
      organizacaoId,
      criadoPor: null,
      ativo: true,
      temHistorico: false,
    };
    alunos.push(aluno);
    vinculos.push({
      alunoId: aluno.id,
      responsavelId,
      autorizado: true,
      consentimentoEm: null,
      termoVersao: null,
    });
    return aluno;
  }

  return { repo, alunos, vinculos, auditoria, chegadas, adicionarAlunoDaEscola };
}
