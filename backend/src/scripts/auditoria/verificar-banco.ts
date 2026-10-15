import type pg from 'pg';
import { aviso, falha, ok, type Nivel, type Resultado } from './resultado.js';

// Cada verificação é uma consulta que CONTA problemas: o relatório nunca mostra nomes,
// e-mails ou localizações (LGPD). As consultas são fixas, sem entrada externa.
type Verificacao = { item: string; nivel: Exclude<Nivel, 'OK'>; problema: string; sql: string };

const VERIFICACOES: Verificacao[] = [
  // ── Isolamento entre organizações (vazamento de dados de menores) ─────────
  {
    item: 'Responsável vinculado a aluno de outra organização',
    nivel: 'FALHA',
    problema: 'vínculos em que o responsável não é RESPONSAVEL na organização do aluno',
    // Aluno da família (sem organização) não entra aqui: tem as verificações próprias abaixo.
    sql: `SELECT count(*) FROM responsaveis_alunos ra
          JOIN alunos a ON a.id = ra.aluno_id
          WHERE a.organizacao_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM membros m
            WHERE m.usuario_id = ra.responsavel_id
              AND m.organizacao_id = a.organizacao_id AND m.papel = 'RESPONSAVEL')`,
  },
  {
    item: 'Rota com motorista de fora da organização',
    nivel: 'FALHA',
    problema: 'rotas cujo motorista não é MOTORISTA na organização da rota',
    sql: `SELECT count(*) FROM rotas r
          WHERE NOT EXISTS (
            SELECT 1 FROM membros m
            WHERE m.usuario_id = r.motorista_id
              AND m.organizacao_id = r.organizacao_id AND m.papel = 'MOTORISTA')`,
  },
  {
    item: 'Rota com veículo de outra organização',
    nivel: 'FALHA',
    problema: 'rotas usando veículo de outra organização',
    sql: `SELECT count(*) FROM rotas r JOIN veiculos v ON v.id = r.veiculo_id
          WHERE v.organizacao_id <> r.organizacao_id`,
  },
  {
    item: 'Veículo particular de quem não é motorista da organização',
    nivel: 'FALHA',
    problema: 'veículos cujo dono (motorista_id) não é MOTORISTA na organização do veículo',
    sql: `SELECT count(*) FROM veiculos v
          WHERE v.motorista_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM membros m
            WHERE m.usuario_id = v.motorista_id
              AND m.organizacao_id = v.organizacao_id AND m.papel = 'MOTORISTA')`,
  },
  {
    item: 'Rota com veículo particular de outro motorista',
    nivel: 'FALHA',
    problema: 'rotas usando o veículo particular de um motorista que não é o da rota',
    sql: `SELECT count(*) FROM rotas r JOIN veiculos v ON v.id = r.veiculo_id
          WHERE v.motorista_id IS NOT NULL AND v.motorista_id <> r.motorista_id`,
  },
  {
    item: 'Rota com aluno de outra organização',
    nivel: 'FALHA',
    problema: 'alunos em rota de outra organização',
    sql: `SELECT count(*) FROM rota_alunos ra
          JOIN rotas r ON r.id = ra.rota_id JOIN alunos a ON a.id = ra.aluno_id
          WHERE a.organizacao_id <> r.organizacao_id`,
  },
  // ── Aluno cadastrado pela família (sem organização) ───────────────────────
  {
    item: 'Aluno da família em rota',
    nivel: 'FALHA',
    problema:
      'alunos cadastrados pela família em alguma rota (só podem entrar com vínculo aceito com o motorista)',
    sql: `SELECT count(*) FROM rota_alunos ra JOIN alunos a ON a.id = ra.aluno_id
          WHERE a.organizacao_id IS NULL`,
  },
  {
    item: 'Vínculo da família sem consentimento',
    nivel: 'FALHA',
    problema:
      'vínculos autorizados com aluno da família sem consentimento registrado (LGPD art. 14)',
    sql: `SELECT count(*) FROM responsaveis_alunos ra JOIN alunos a ON a.id = ra.aluno_id
          WHERE a.organizacao_id IS NULL AND ra.autorizado AND ra.consentimento_em IS NULL`,
  },
  {
    item: 'Aluno da família sem responsável',
    nivel: 'AVISO',
    problema: 'alunos ativos da família sem nenhum responsável autorizado (ninguém vê nem apaga)',
    sql: `SELECT count(*) FROM alunos a
          WHERE a.organizacao_id IS NULL AND a.ativo AND NOT EXISTS (
            SELECT 1 FROM responsaveis_alunos ra WHERE ra.aluno_id = a.id AND ra.autorizado)`,
  },
  {
    item: 'Viagem com organização diferente da rota',
    nivel: 'FALHA',
    problema: 'viagens cuja organização não é a da rota',
    sql: `SELECT count(*) FROM viagens vi JOIN rotas r ON r.id = vi.rota_id
          WHERE vi.organizacao_id <> r.organizacao_id`,
  },
  // ── Localização (LGPD: só durante a viagem) ───────────────────────────────
  {
    item: 'Posição guardada fora de viagem em andamento',
    nivel: 'FALHA',
    problema: 'posições de viagens que não estão EM_ANDAMENTO (deviam ter sido apagadas)',
    sql: `SELECT count(*) FROM posicoes_viagem p JOIN viagens v ON v.id = p.viagem_id
          WHERE v.status <> 'EM_ANDAMENTO'`,
  },
  {
    item: 'Viagem esquecida em andamento',
    nivel: 'AVISO',
    problema: 'viagens EM_ANDAMENTO há mais de 12 h: a localização continua visível',
    sql: `SELECT count(*) FROM viagens
          WHERE status = 'EM_ANDAMENTO' AND iniciada_em < now() - interval '12 hours'`,
  },
  // ── Contas e sessões ──────────────────────────────────────────────────────
  {
    item: 'Hash de senha fora do padrão scrypt',
    nivel: 'FALHA',
    problema: 'usuários com senha_hash que não segue o formato scrypt$N$r$p$salt$hash',
    sql: `SELECT count(*) FROM usuarios
          WHERE senha_hash !~ '^scrypt\\$[0-9]+\\$[0-9]+\\$[0-9]+\\$[A-Za-z0-9+/=]+\\$[A-Za-z0-9+/=]+$'`,
  },
  {
    item: 'Super admin',
    nivel: 'AVISO',
    problema:
      'usuários com super_admin = true (o campo não é usado pelo código; confirme se é intencional)',
    sql: `SELECT count(*) FROM usuarios WHERE super_admin`,
  },
  {
    item: 'Organização ativa sem ADMIN',
    nivel: 'AVISO',
    problema: 'organizações ativas sem nenhum ADMIN para gerenciar acessos',
    sql: `SELECT count(*) FROM organizacoes o
          WHERE o.ativa AND NOT EXISTS (
            SELECT 1 FROM membros m WHERE m.organizacao_id = o.id AND m.papel = 'ADMIN')`,
  },
  {
    item: 'Sessão ativa de conta desativada',
    nivel: 'AVISO',
    problema: 'refresh tokens válidos de usuários desativados (são recusados, mas convém revogar)',
    sql: `SELECT count(*) FROM refresh_tokens t JOIN usuarios u ON u.id = t.usuario_id
          WHERE NOT u.ativo AND t.revogado_em IS NULL AND t.expira_em > now()`,
  },
  {
    item: 'Refresh tokens vencidos acumulados',
    nivel: 'AVISO',
    problema: 'tokens expirados há mais de 30 dias ainda no banco (retenção desnecessária)',
    sql: `SELECT count(*) FROM refresh_tokens WHERE expira_em < now() - interval '30 days'`,
  },
];

/**
 * Roda as verificações numa transação READ ONLY: o próprio Postgres garante que a
 * auditoria não altera nada, e o ROLLBACK no fim descarta a transação.
 */
export async function verificarBanco(pool: pg.Pool): Promise<Resultado[]> {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN TRANSACTION READ ONLY');
    const resultados: Resultado[] = [];
    for (const v of VERIFICACOES) {
      const { rows } = await cliente.query<{ count: string }>(v.sql);
      const total = Number(rows[0]?.count ?? 0);
      if (total === 0) resultados.push(ok(v.item));
      else {
        const detalhe = `${total} ${v.problema}`;
        resultados.push(v.nivel === 'FALHA' ? falha(v.item, detalhe) : aviso(v.item, detalhe));
      }
    }
    return resultados;
  } finally {
    await cliente.query('ROLLBACK').catch(() => undefined);
    cliente.release();
  }
}
