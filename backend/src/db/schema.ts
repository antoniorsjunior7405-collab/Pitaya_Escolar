import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// ─────────────────────────────────────────────────────────────────────────────
// Modelo do Pitaya Escolar (MVP, multi-organização).
//
// Organização = transportadora/escola. Todo dado de negócio pertence a uma
// organização (organizacao_id), o que permite escalar para vários clientes sem
// misturar dados e facilita as regras de acesso (RLS/autorização).
//
// Status seguem src/types/index.ts do frontend: viagem PLANEJADA → EM_ANDAMENTO →
// FINALIZADA (RN-08). No banco só existem eventos EMBARCADO e ENTREGUE
// ("aguardando" é só estado de tela).
// ─────────────────────────────────────────────────────────────────────────────

export const papelEnum = pgEnum('papel', ['ADMIN', 'MOTORISTA', 'RESPONSAVEL']);
export const statusViagemEnum = pgEnum('status_viagem', [
  'PLANEJADA',
  'EM_ANDAMENTO',
  'FINALIZADA',
]);
export const tipoEventoEnum = pgEnum('tipo_evento', ['EMBARCADO', 'ENTREGUE']);
export const periodoEnum = pgEnum('periodo', ['MANHA', 'TARDE', 'NOITE']);
export const plataformaEnum = pgEnum('plataforma', ['IOS', 'ANDROID']);
export const tipoNotificacaoEnum = pgEnum('tipo_notificacao', [
  'VIAGEM_INICIADA',
  'TRANSPORTE_PROXIMO',
  'ALUNO_EMBARCADO',
  'ALUNO_ENTREGUE',
  'VIAGEM_FINALIZADA',
]);

const criadoEm = () => timestamp('criado_em', { withTimezone: true }).notNull().defaultNow();

// ── Organização e pessoas ────────────────────────────────────────────────────

export const organizacoes = pgTable('organizacoes', {
  id: uuid().primaryKey().defaultRandom(),
  nome: text().notNull(),
  ativa: boolean().notNull().default(true),
  criadoEm: criadoEm(),
});

// Conta de acesso. Global: a mesma pessoa pode participar de mais de uma organização.
export const usuarios = pgTable('usuarios', {
  id: uuid().primaryKey().defaultRandom(),
  nome: text().notNull(),
  email: text().notNull().unique(),
  senhaHash: text('senha_hash').notNull(),
  telefone: text(),
  ativo: boolean().notNull().default(true),
  superAdmin: boolean('super_admin').notNull().default(false),
  criadoEm: criadoEm(),
});

// Vínculo usuário ↔ organização com o papel naquela organização.
export const membros = pgTable(
  'membros',
  {
    organizacaoId: uuid('organizacao_id')
      .notNull()
      .references(() => organizacoes.id, { onDelete: 'cascade' }),
    usuarioId: uuid('usuario_id')
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    papel: papelEnum().notNull(),
    criadoEm: criadoEm(),
  },
  (t) => [
    primaryKey({ columns: [t.organizacaoId, t.usuarioId, t.papel] }),
    index('membros_usuario_idx').on(t.usuarioId),
  ],
);

// ── Frota, alunos e rotas ────────────────────────────────────────────────────

export const veiculos = pgTable(
  'veiculos',
  {
    id: uuid().primaryKey().defaultRandom(),
    organizacaoId: uuid('organizacao_id')
      .notNull()
      .references(() => organizacoes.id),
    placa: text().notNull(),
    modelo: text().notNull(),
    capacidade: integer(),
    ativo: boolean().notNull().default(true),
    criadoEm: criadoEm(),
  },
  (t) => [
    unique('veiculos_placa_unique').on(t.placa),
    index('veiculos_organizacao_idx').on(t.organizacaoId),
    check('veiculos_capacidade_check', sql`${t.capacidade} IS NULL OR ${t.capacidade} > 0`),
  ],
);

export const alunos = pgTable(
  'alunos',
  {
    id: uuid().primaryKey().defaultRandom(),
    organizacaoId: uuid('organizacao_id')
      .notNull()
      .references(() => organizacoes.id),
    nome: text().notNull(),
    ativo: boolean().notNull().default(true),
    criadoEm: criadoEm(),
  },
  (t) => [index('alunos_organizacao_idx').on(t.organizacaoId)],
);

// Um aluno pode ter vários responsáveis, e um responsável vários filhos.
export const responsaveisAlunos = pgTable(
  'responsaveis_alunos',
  {
    alunoId: uuid('aluno_id')
      .notNull()
      .references(() => alunos.id, { onDelete: 'cascade' }),
    responsavelId: uuid('responsavel_id')
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    parentesco: text(),
    // Só responsáveis autorizados enxergam localização e status (orçamento).
    autorizado: boolean().notNull().default(true),
    criadoEm: criadoEm(),
  },
  (t) => [
    primaryKey({ columns: [t.alunoId, t.responsavelId] }),
    index('responsaveis_alunos_responsavel_idx').on(t.responsavelId),
  ],
);

export const rotas = pgTable(
  'rotas',
  {
    id: uuid().primaryKey().defaultRandom(),
    organizacaoId: uuid('organizacao_id')
      .notNull()
      .references(() => organizacoes.id),
    nome: text().notNull(),
    periodo: periodoEnum(),
    motoristaId: uuid('motorista_id')
      .notNull()
      .references(() => usuarios.id),
    veiculoId: uuid('veiculo_id')
      .notNull()
      .references(() => veiculos.id),
    ativa: boolean().notNull().default(true),
    criadoEm: criadoEm(),
  },
  (t) => [
    index('rotas_organizacao_idx').on(t.organizacaoId),
    index('rotas_motorista_idx').on(t.motoristaId),
    index('rotas_veiculo_idx').on(t.veiculoId),
  ],
);

// Alunos de uma rota, na ordem de embarque, com o ponto de parada.
export const rotaAlunos = pgTable(
  'rota_alunos',
  {
    rotaId: uuid('rota_id')
      .notNull()
      .references(() => rotas.id, { onDelete: 'cascade' }),
    alunoId: uuid('aluno_id')
      .notNull()
      .references(() => alunos.id, { onDelete: 'cascade' }),
    ordem: integer().notNull(),
    endereco: text(),
    latitude: doublePrecision(),
    longitude: doublePrecision(),
  },
  (t) => [
    primaryKey({ columns: [t.rotaId, t.alunoId] }),
    unique('rota_alunos_ordem_unique').on(t.rotaId, t.ordem),
    index('rota_alunos_aluno_idx').on(t.alunoId),
  ],
);

// ── Viagens e eventos ────────────────────────────────────────────────────────

export const viagens = pgTable(
  'viagens',
  {
    id: uuid().primaryKey().defaultRandom(),
    organizacaoId: uuid('organizacao_id')
      .notNull()
      .references(() => organizacoes.id),
    rotaId: uuid('rota_id')
      .notNull()
      .references(() => rotas.id),
    // Quem dirigiu e com qual veículo nesta viagem (a rota pode mudar depois).
    motoristaId: uuid('motorista_id')
      .notNull()
      .references(() => usuarios.id),
    veiculoId: uuid('veiculo_id')
      .notNull()
      .references(() => veiculos.id),
    status: statusViagemEnum().notNull().default('PLANEJADA'),
    data: date().notNull(),
    iniciadaEm: timestamp('iniciada_em', { withTimezone: true }),
    finalizadaEm: timestamp('finalizada_em', { withTimezone: true }),
    criadoEm: criadoEm(),
  },
  (t) => [
    // Uma rota não pode ter duas viagens em andamento ao mesmo tempo.
    uniqueIndex('viagens_rota_em_andamento_unique')
      .on(t.rotaId)
      .where(sql`${t.status} = 'EM_ANDAMENTO'`),
    index('viagens_organizacao_data_idx').on(t.organizacaoId, t.data),
    index('viagens_rota_data_idx').on(t.rotaId, t.data),
    index('viagens_motorista_idx').on(t.motoristaId),
    index('viagens_veiculo_idx').on(t.veiculoId),
    check(
      'viagens_periodo_check',
      sql`${t.finalizadaEm} IS NULL OR (${t.iniciadaEm} IS NOT NULL AND ${t.finalizadaEm} >= ${t.iniciadaEm})`,
    ),
  ],
);

// A restrição única torna o registro idempotente: reenviar o mesmo evento não duplica.
export const eventosViagem = pgTable(
  'eventos_viagem',
  {
    id: uuid().primaryKey().defaultRandom(),
    viagemId: uuid('viagem_id')
      .notNull()
      .references(() => viagens.id, { onDelete: 'cascade' }),
    alunoId: uuid('aluno_id')
      .notNull()
      .references(() => alunos.id),
    tipo: tipoEventoEnum().notNull(),
    registradoPor: uuid('registrado_por')
      .notNull()
      .references(() => usuarios.id),
    registradoEm: timestamp('registrado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('eventos_viagem_unique').on(t.viagemId, t.alunoId, t.tipo),
    index('eventos_viagem_aluno_idx').on(t.alunoId, t.registradoEm),
    index('eventos_viagem_registrado_por_idx').on(t.registradoPor),
  ],
);

// Apenas a ÚLTIMA posição de cada viagem (upsert). Não guarda histórico: escala
// melhor e minimiza dados de localização (LGPD). Histórico, se vier, é outra tabela.
export const posicoesViagem = pgTable('posicoes_viagem', {
  viagemId: uuid('viagem_id')
    .primaryKey()
    .references(() => viagens.id, { onDelete: 'cascade' }),
  latitude: doublePrecision().notNull(),
  longitude: doublePrecision().notNull(),
  velocidade: doublePrecision(),
  atualizadaEm: timestamp('atualizada_em', { withTimezone: true }).notNull().defaultNow(),
});

// ── Notificações ─────────────────────────────────────────────────────────────

export const dispositivosPush = pgTable(
  'dispositivos_push',
  {
    id: uuid().primaryKey().defaultRandom(),
    usuarioId: uuid('usuario_id')
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    token: text().notNull(),
    plataforma: plataformaEnum().notNull(),
    criadoEm: criadoEm(),
    ultimoUsoEm: timestamp('ultimo_uso_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('dispositivos_push_token_unique').on(t.token),
    index('dispositivos_push_usuario_idx').on(t.usuarioId),
  ],
);

export const notificacoes = pgTable(
  'notificacoes',
  {
    id: uuid().primaryKey().defaultRandom(),
    usuarioId: uuid('usuario_id')
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    tipo: tipoNotificacaoEnum().notNull(),
    titulo: text().notNull(),
    corpo: text().notNull(),
    viagemId: uuid('viagem_id').references(() => viagens.id, { onDelete: 'set null' }),
    alunoId: uuid('aluno_id').references(() => alunos.id, { onDelete: 'set null' }),
    criadoEm: criadoEm(),
    enviadaEm: timestamp('enviada_em', { withTimezone: true }),
    lidaEm: timestamp('lida_em', { withTimezone: true }),
  },
  (t) => [
    index('notificacoes_usuario_idx').on(t.usuarioId, t.criadoEm),
    index('notificacoes_viagem_idx').on(t.viagemId),
    index('notificacoes_aluno_idx').on(t.alunoId),
  ],
);
