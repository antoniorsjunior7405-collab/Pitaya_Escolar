import { sql } from 'drizzle-orm';
import type { StatusViagem } from '../../db/consultas.js';
import type { Db } from '../../db/index.js';
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
}

export function createResponsavelRepository(db: Db): ResponsavelRepository {
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
          AND a.organizacao_id = ${escopo.organizacaoId}
          AND a.ativo
          ${alunoId ? sql`AND a.id = ${alunoId}` : sql``}
        ORDER BY a.nome
      `);
      return resultado.rows.map(converter);
    },
  };
}
