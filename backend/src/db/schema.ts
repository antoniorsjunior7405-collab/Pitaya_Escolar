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
// FINALIZADA (RN-08). Eventos do aluno na viagem: EMBARCADO, ENTREGUE e AUSENTE (faltou),
// registrados pelo motorista, e CHEGADA_CONFIRMADA, registrado pelo responsável depois da
// entrega. "Aguardando" é só estado de tela (nenhum evento ainda).
// ─────────────────────────────────────────────────────────────────────────────

export const papelEnum = pgEnum('papel', ['ADMIN', 'MOTORISTA', 'RESPONSAVEL']);
export const statusViagemEnum = pgEnum('status_viagem', [
  'PLANEJADA',
  'EM_ANDAMENTO',
  'FINALIZADA',
]);
export const tipoEventoEnum = pgEnum('tipo_evento', [
  'EMBARCADO',
  'ENTREGUE',
  'AUSENTE',
  'CHEGADA_CONFIRMADA',
]);
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
  // Código que motoristas e responsáveis informam no cadastro para entrar na organização.
  codigoConvite: text('codigo_convite').notNull().unique(),
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
  // Proteção contra força bruta POR CONTA (complementa o limite por IP).
  tentativasFalhas: integer('tentativas_falhas').notNull().default(0),
  bloqueadoAte: timestamp('bloqueado_ate', { withTimezone: true }),
  criadoEm: criadoEm(),
});

// Refresh tokens: guardamos só o hash (SHA-256). O token em si só existe no app.
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid().primaryKey().defaultRandom(),
    usuarioId: uuid('usuario_id')
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiraEm: timestamp('expira_em', { withTimezone: true }).notNull(),
    revogadoEm: timestamp('revogado_em', { withTimezone: true }),
    criadoEm: criadoEm(),
  },
  (t) => [index('refresh_tokens_usuario_idx').on(t.usuarioId)],
);

// Pedidos de "esqueci a senha". Como no refresh token, guardamos só o hash (SHA-256): quem
// ler a tabela não consegue usar os links. Uso único (usado_em) e validade curta (expira_em).
export const recuperacoesSenha = pgTable(
  'recuperacoes_senha',
  {
    id: uuid().primaryKey().defaultRandom(),
    usuarioId: uuid('usuario_id')
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiraEm: timestamp('expira_em', { withTimezone: true }).notNull(),
    usadoEm: timestamp('usado_em', { withTimezone: true }),
    criadoEm: criadoEm(),
  },
  (t) => [index('recuperacoes_senha_usuario_idx').on(t.usuarioId, t.criadoEm)],
);

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

// Perfil do motorista: dados que o próprio motorista mantém e que não são de login.
// Fica por USUÁRIO (como nome e telefone em `usuarios`), não por organização: é a mesma
// pessoa em todas as organizações de que participa. Nome e telefone continuam em `usuarios`.
export const perfisMotorista = pgTable('perfis_motorista', {
  usuarioId: uuid('usuario_id')
    .primaryKey()
    .references(() => usuarios.id, { onDelete: 'cascade' }),
  apresentacao: text(),
  regiaoAtendimento: text('regiao_atendimento'),
  // Aprovação pelo admin de uma organização de que o motorista é membro (área admin, com
  // auditoria) ou pelo script aprovar:motorista. Só motorista aprovado aparece na busca das
  // famílias: num transporte de crianças, a conta não nasce visível.
  aprovadoEm: timestamp('aprovado_em', { withTimezone: true }),
  criadoEm: criadoEm(),
  atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
});

// ── Frota, alunos e rotas ────────────────────────────────────────────────────

export const veiculos = pgTable(
  'veiculos',
  {
    id: uuid().primaryKey().defaultRandom(),
    organizacaoId: uuid('organizacao_id')
      .notNull()
      .references(() => organizacoes.id),
    // Dono do veículo. NULL = frota da organização (cadastrado pelo admin, gestão pela
    // escola). Preenchido = veículo do próprio motorista (gestão direta família–motorista).
    motoristaId: uuid('motorista_id').references(() => usuarios.id),
    placa: text().notNull(),
    modelo: text().notNull(),
    capacidade: integer(),
    ativo: boolean().notNull().default(true),
    criadoEm: criadoEm(),
  },
  (t) => [
    unique('veiculos_placa_unique').on(t.placa),
    index('veiculos_organizacao_idx').on(t.organizacaoId),
    index('veiculos_motorista_idx').on(t.motoristaId),
    check('veiculos_capacidade_check', sql`${t.capacidade} IS NULL OR ${t.capacidade} > 0`),
  ],
);

// Aluno da ESCOLA (organizacao_id preenchido, cadastrado pelo admin) ou da FAMÍLIA
// (organizacao_id NULL, cadastrado pelo próprio responsável: gestão direta família–motorista).
// O aluno da família não aparece para nenhuma escola nem motorista até um vínculo aceito.
export const alunos = pgTable(
  'alunos',
  {
    id: uuid().primaryKey().defaultRandom(),
    organizacaoId: uuid('organizacao_id').references(() => organizacoes.id),
    // Quem cadastrou, quando foi a família. NULL no aluno da escola.
    criadoPor: uuid('criado_por').references(() => usuarios.id, { onDelete: 'set null' }),
    nome: text().notNull(),
    ativo: boolean().notNull().default(true),
    criadoEm: criadoEm(),
  },
  (t) => [
    index('alunos_organizacao_idx').on(t.organizacaoId),
    index('alunos_criado_por_idx').on(t.criadoPor),
  ],
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
    // Só responsáveis autorizados enxergam localização e status. Nasce FALSE: quem cria o
    // vínculo (admin, ou a família ao cadastrar o próprio filho) autoriza de forma explícita.
    // Assim um vínculo novo nunca sai vendo a criança sem alguém aprovar.
    autorizado: boolean().notNull().default(false),
    // Consentimento do responsável para o tratamento dos dados da criança (LGPD, art. 14),
    // com a versão do termo aceito. Preenchido quando a família cadastra o filho.
    consentimentoEm: timestamp('consentimento_em', { withTimezone: true }),
    termoVersao: text('termo_versao'),
    criadoEm: criadoEm(),
  },
  (t) => [
    primaryKey({ columns: [t.alunoId, t.responsavelId] }),
    index('responsaveis_alunos_responsavel_idx').on(t.responsavelId),
    // Consentimento sem a versão do termo (ou o contrário) não prova o que foi aceito.
    check(
      'responsaveis_alunos_consentimento_check',
      sql`(${t.consentimentoEm} IS NULL) = (${t.termoVersao} IS NULL)`,
    ),
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

// ── Vínculo família–motorista (gestão direta) ────────────────────────────────

// EXPIRADA é gravada de forma preguiçosa: um pedido PENDENTE vencido já é lido como EXPIRADA,
// e só passa a EXPIRADA no banco quando um novo pedido do mesmo aluno ao mesmo motorista chega.
export const estadoSolicitacaoEnum = pgEnum('estado_solicitacao', [
  'PENDENTE',
  'ACEITA',
  'RECUSADA',
  'CANCELADA',
  'EXPIRADA',
]);

// Pedido do responsável para um motorista transportar um aluno. Enquanto PENDENTE não é
// vínculo: o motorista vê só o primeiro nome do aluno e nada além (documento, seção 8).
export const solicitacoesVinculo = pgTable(
  'solicitacoes_vinculo',
  {
    id: uuid().primaryKey().defaultRandom(),
    alunoId: uuid('aluno_id')
      .notNull()
      .references(() => alunos.id, { onDelete: 'cascade' }),
    responsavelId: uuid('responsavel_id')
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    motoristaId: uuid('motorista_id')
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    estado: estadoSolicitacaoEnum().notNull().default('PENDENTE'),
    expiraEm: timestamp('expira_em', { withTimezone: true }).notNull(),
    respondidaEm: timestamp('respondida_em', { withTimezone: true }),
    criadoEm: criadoEm(),
  },
  (t) => [
    // Um pedido pendente por aluno e motorista: tocar duas vezes em "Pedir" não duplica.
    uniqueIndex('solicitacoes_vinculo_pendente_unique')
      .on(t.alunoId, t.motoristaId)
      .where(sql`${t.estado} = 'PENDENTE'`),
    index('solicitacoes_vinculo_responsavel_idx').on(t.responsavelId, t.criadoEm),
    index('solicitacoes_vinculo_motorista_idx').on(t.motoristaId, t.estado),
    // Pendente nunca tem data de resposta; os outros estados sempre têm.
    check(
      'solicitacoes_vinculo_resposta_check',
      sql`(${t.estado} = 'PENDENTE') = (${t.respondidaEm} IS NULL)`,
    ),
  ],
);

// Vínculo ativo, criado só pelo aceite do motorista. fim_em preenchido = vínculo encerrado
// (a linha fica para o histórico).
export const vinculosMotoristaAluno = pgTable(
  'vinculos_motorista_aluno',
  {
    id: uuid().primaryKey().defaultRandom(),
    alunoId: uuid('aluno_id')
      .notNull()
      .references(() => alunos.id, { onDelete: 'cascade' }),
    motoristaId: uuid('motorista_id')
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    solicitacaoId: uuid('solicitacao_id').references(() => solicitacoesVinculo.id, {
      onDelete: 'set null',
    }),
    inicioEm: timestamp('inicio_em', { withTimezone: true }).notNull().defaultNow(),
    fimEm: timestamp('fim_em', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('vinculos_motorista_aluno_ativo_unique')
      .on(t.alunoId, t.motoristaId)
      .where(sql`${t.fimEm} IS NULL`),
    index('vinculos_motorista_aluno_motorista_idx').on(t.motoristaId),
  ],
);

// ── Auditoria ────────────────────────────────────────────────────────────────

// Quem fez o quê, e quando, nas ações sensíveis (cadastro, edição e exclusão de aluno...).
// Sem dados pessoais: só ids e a ação. entidade_id não tem FK de propósito: o registro
// precisa sobreviver à exclusão do que ele descreve.
export const registrosAuditoria = pgTable(
  'registros_auditoria',
  {
    id: uuid().primaryKey().defaultRandom(),
    usuarioId: uuid('usuario_id').references(() => usuarios.id, { onDelete: 'set null' }),
    organizacaoId: uuid('organizacao_id').references(() => organizacoes.id, {
      onDelete: 'set null',
    }),
    acao: text().notNull(),
    entidade: text().notNull(),
    entidadeId: uuid('entidade_id').notNull(),
    criadoEm: criadoEm(),
  },
  (t) => [
    index('registros_auditoria_entidade_idx').on(t.entidade, t.entidadeId),
    index('registros_auditoria_usuario_idx').on(t.usuarioId, t.criadoEm),
  ],
);
