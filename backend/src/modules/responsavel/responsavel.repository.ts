import { and, count, eq, exists, isNull, sql } from 'drizzle-orm';
import { registrarAuditoria } from '../../db/auditoria.js';
import type { StatusViagem } from '../../db/consultas.js';
import type { Db } from '../../db/index.js';
import { schema } from '../../db/index.js';
import type { StatusAluno } from '../../shared/status-aluno.js';

export type Escopo = { organizacaoId: string; responsavelId: string };

/** Uma linha por filho: o transporte dele agora, já resolvido pelo banco. */
export type AcompanhamentoRow = {
  id: string;
  nome: string;
  statusAluno: StatusAluno;
  viagemId: string | null;
  viagemStatus: StatusViagem | null;
  rotaNome: string | null;
  motoristaNome: string | null;
  motoristaTelefone: string | null;
  veiculoPlaca: string | null;
  veiculoModelo: string | null;
  latitude: number | null;
  longitude: number | null;
  velocidade: number | null;
  posicaoAtualizadaEm: Date | null;
};

/**
 * Em SQL escrito à mão (db.execute) o driver devolve timestamp como TEXTO e números de ponto
 * flutuante podem vir como texto; convertemos aqui para o tipo que o resto do código espera.
 */
export type LinhaBruta = Omit<
  AcompanhamentoRow,
  'latitude' | 'longitude' | 'velocidade' | 'posicaoAtualizadaEm'
> & {
  latitude: number | string | null;
  longitude: number | string | null;
  velocidade: number | string | null;
  posicaoAtualizadaEm: Date | string | null;
};

const numero = (v: number | string | null) => (v === null ? null : Number(v));

export function converter(r: LinhaBruta): AcompanhamentoRow {
  return {
    ...r,
    latitude: numero(r.latitude),
    longitude: numero(r.longitude),
    velocidade: numero(r.velocidade),
    posicaoAtualizadaEm: r.posicaoAtualizadaEm === null ? null : new Date(r.posicaoAtualizadaEm),
  };
}

export interface ResponsavelRepository {
  /**
   * Filhos do responsável (só vínculos autorizados) com o transporte atual de cada um.
   * Com alunoId, devolve só esse filho (ou nada, se não for dele).
   */
  listarAcompanhamento(
    escopo: Escopo,
    hoje: string,
    alunoId?: string,
  ): Promise<AcompanhamentoRow[]>;

  // ── Filho cadastrado pela própria família ──────────────────────────────────
  // "Da família" = aluno sem organização, ativo, com vínculo AUTORIZADO do responsável do
  // token. Aluno da escola (cadastrado pelo admin) nunca é editado ou excluído por aqui.

  /**
   * Na mesma transação: confere o limite, cria o aluno (sem organização), o vínculo
   * autorizado com o consentimento e o registro de auditoria. 'limite' se o responsável já
   * tem `limite` filhos cadastrados por ele (a conferência trava a conta, sem corrida).
   */
  cadastrarFilho(input: {
    responsavelId: string;
    nome: string;
    termoVersao: string;
    limite: number;
  }): Promise<FilhoRow | 'limite'>;
  /** undefined se o aluno não é da família do responsável. */
  atualizarFilho(
    responsavelId: string,
    alunoId: string,
    dados: { nome: string },
  ): Promise<FilhoRow | undefined>;
  /**
   * Sem histórico de viagem: apaga de verdade. Com histórico: anonimiza (o histórico fica,
   * sem nome) e remove vínculos e paradas. Em ambos, apaga as notificações do aluno (o texto
   * delas pode ter o nome). undefined se o aluno não é da família do responsável.
   */
  excluirFilho(
    responsavelId: string,
    alunoId: string,
  ): Promise<'excluido' | 'anonimizado' | undefined>;
}

export type FilhoRow = { id: string; nome: string };

/** Nome que fica no histórico de viagens quando a família exclui um aluno que já viajou. */
export const NOME_ANONIMIZADO = 'Aluno removido';

export function createResponsavelRepository(db: Db): ResponsavelRepository {
  const { alunos, responsaveisAlunos, rotaAlunos, eventosViagem, notificacoes, usuarios } = schema;

  // Aluno da família do responsável, conferido junto da escrita (evita IDOR).
  const daFamilia = (responsavelId: string, alunoId: string) =>
    and(
      eq(alunos.id, alunoId),
      isNull(alunos.organizacaoId),
      eq(alunos.ativo, true),
      exists(
        db
          .select({ um: sql`1` })
          .from(responsaveisAlunos)
          .where(
            and(
              eq(responsaveisAlunos.alunoId, alunos.id),
              eq(responsaveisAlunos.responsavelId, responsavelId),
              eq(responsaveisAlunos.autorizado, true),
            ),
          ),
      ),
    );

  return {
    // UMA consulta para a tela inteira (antes eram ~2,5 por filho, refeitas a cada 10–30 s).
    // Para cada filho, o LATERAL escolhe a rota "atual": a que tem viagem em andamento;
    // senão a que teve viagem hoje; senão a primeira por nome. A posição só vem com a
    // viagem EM_ANDAMENTO (fora dela não expomos onde o veículo está).
    async listarAcompanhamento(escopo, hoje, alunoId) {
      const resultado = await db.execute<LinhaBruta>(sql`
        SELECT
          a.id,
          a.nome,
          CASE
            WHEN t.viagem_id IS NULL THEN 'AGUARDANDO'
            WHEN EXISTS (SELECT 1 FROM eventos_viagem e
                         WHERE e.viagem_id = t.viagem_id AND e.aluno_id = a.id
                           AND e.tipo = 'ENTREGUE') THEN 'ENTREGUE'
            WHEN EXISTS (SELECT 1 FROM eventos_viagem e
                         WHERE e.viagem_id = t.viagem_id AND e.aluno_id = a.id
                           AND e.tipo = 'EMBARCADO') THEN 'EMBARCADO'
            ELSE 'AGUARDANDO'
          END AS "statusAluno",
          t.viagem_id AS "viagemId",
          t.viagem_status AS "viagemStatus",
          t.rota_nome AS "rotaNome",
          t.motorista_nome AS "motoristaNome",
          t.motorista_telefone AS "motoristaTelefone",
          t.veiculo_placa AS "veiculoPlaca",
          t.veiculo_modelo AS "veiculoModelo",
          p.latitude,
          p.longitude,
          p.velocidade,
          p.atualizada_em AS "posicaoAtualizadaEm"
        FROM responsaveis_alunos ra
        JOIN alunos a ON a.id = ra.aluno_id
        LEFT JOIN LATERAL (
          SELECT r.nome AS rota_nome,
                 u.nome AS motorista_nome,
                 u.telefone AS motorista_telefone,
                 ve.placa AS veiculo_placa,
                 ve.modelo AS veiculo_modelo,
                 v.id AS viagem_id,
                 v.status AS viagem_status
          FROM rota_alunos rta
          JOIN rotas r ON r.id = rta.rota_id AND r.ativa
          JOIN usuarios u ON u.id = r.motorista_id
          JOIN veiculos ve ON ve.id = r.veiculo_id
          LEFT JOIN LATERAL (
            SELECT vi.id, vi.status
            FROM viagens vi
            WHERE vi.rota_id = r.id AND (vi.status = 'EM_ANDAMENTO' OR vi.data = ${hoje})
            ORDER BY (vi.status = 'EM_ANDAMENTO') DESC, vi.criado_em DESC
            LIMIT 1
          ) v ON true
          WHERE rta.aluno_id = a.id
          ORDER BY (v.status = 'EM_ANDAMENTO') DESC NULLS LAST, (v.id IS NOT NULL) DESC, r.nome
          LIMIT 1
        ) t ON true
        LEFT JOIN posicoes_viagem p
          ON p.viagem_id = t.viagem_id AND t.viagem_status = 'EM_ANDAMENTO'
        WHERE ra.responsavel_id = ${escopo.responsavelId}
          AND ra.autorizado
          -- Aluno da escola do token, ou aluno da família (sem organização).
          AND (a.organizacao_id = ${escopo.organizacaoId} OR a.organizacao_id IS NULL)
          AND a.ativo
          ${alunoId ? sql`AND a.id = ${alunoId}` : sql``}
        ORDER BY a.nome
      `);
      return resultado.rows.map(converter);
    },

    cadastrarFilho({ responsavelId, nome, termoVersao, limite }) {
      return db.transaction(async (tx) => {
        // Trava a conta do responsável: dois cadastros simultâneos não furam o limite.
        await tx
          .select({ id: usuarios.id })
          .from(usuarios)
          .where(eq(usuarios.id, responsavelId))
          .for('update');
        const [cadastrados] = await tx
          .select({ total: count() })
          .from(alunos)
          .where(
            and(
              eq(alunos.criadoPor, responsavelId),
              isNull(alunos.organizacaoId),
              eq(alunos.ativo, true),
            ),
          );
        if ((cadastrados?.total ?? 0) >= limite) return 'limite' as const;

        const [aluno] = await tx
          .insert(alunos)
          .values({ nome, criadoPor: responsavelId })
          .returning({ id: alunos.id, nome: alunos.nome });
        if (!aluno) throw new Error('falha ao cadastrar aluno');
        // Quem cadastrou é o responsável autorizado; o consentimento é gravado junto.
        await tx.insert(responsaveisAlunos).values({
          alunoId: aluno.id,
          responsavelId,
          autorizado: true,
          consentimentoEm: new Date(),
          termoVersao,
        });
        await registrarAuditoria(tx, {
          usuarioId: responsavelId,
          organizacaoId: null,
          acao: 'ALUNO_CRIADO',
          entidade: 'aluno',
          entidadeId: aluno.id,
        });
        return aluno;
      });
    },

    atualizarFilho(responsavelId, alunoId, dados) {
      return db.transaction(async (tx) => {
        const [aluno] = await tx
          .update(alunos)
          .set({ nome: dados.nome })
          .where(daFamilia(responsavelId, alunoId))
          .returning({ id: alunos.id, nome: alunos.nome });
        if (!aluno) return undefined;
        await registrarAuditoria(tx, {
          usuarioId: responsavelId,
          organizacaoId: null,
          acao: 'ALUNO_EDITADO',
          entidade: 'aluno',
          entidadeId: aluno.id,
        });
        return aluno;
      });
    },

    excluirFilho(responsavelId, alunoId) {
      return db.transaction(async (tx) => {
        const [aluno] = await tx
          .select({ id: alunos.id })
          .from(alunos)
          .where(daFamilia(responsavelId, alunoId))
          .for('update');
        if (!aluno) return undefined;

        const [historico] = await tx
          .select({ id: eventosViagem.id })
          .from(eventosViagem)
          .where(eq(eventosViagem.alunoId, aluno.id))
          .limit(1);
        await tx.delete(notificacoes).where(eq(notificacoes.alunoId, aluno.id));

        let resultado: 'excluido' | 'anonimizado';
        if (historico) {
          // O histórico de viagens do motorista continua íntegro, mas sem o nome da criança.
          await tx
            .update(alunos)
            .set({ nome: NOME_ANONIMIZADO, ativo: false, criadoPor: null })
            .where(eq(alunos.id, aluno.id));
          await tx.delete(responsaveisAlunos).where(eq(responsaveisAlunos.alunoId, aluno.id));
          await tx.delete(rotaAlunos).where(eq(rotaAlunos.alunoId, aluno.id));
          resultado = 'anonimizado';
        } else {
          // Vínculos e paradas em rota caem junto (ON DELETE CASCADE).
          await tx.delete(alunos).where(eq(alunos.id, aluno.id));
          resultado = 'excluido';
        }
        await registrarAuditoria(tx, {
          usuarioId: responsavelId,
          organizacaoId: null,
          acao: resultado === 'excluido' ? 'ALUNO_EXCLUIDO' : 'ALUNO_ANONIMIZADO',
          entidade: 'aluno',
          entidadeId: aluno.id,
        });
        return resultado;
      });
    },
  };
}
