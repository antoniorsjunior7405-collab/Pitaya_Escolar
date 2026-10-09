CREATE TYPE "public"."papel" AS ENUM('ADMIN', 'MOTORISTA', 'RESPONSAVEL');--> statement-breakpoint
CREATE TYPE "public"."periodo" AS ENUM('MANHA', 'TARDE', 'NOITE');--> statement-breakpoint
CREATE TYPE "public"."plataforma" AS ENUM('IOS', 'ANDROID');--> statement-breakpoint
CREATE TYPE "public"."status_viagem" AS ENUM('PLANEJADA', 'EM_ANDAMENTO', 'FINALIZADA');--> statement-breakpoint
CREATE TYPE "public"."tipo_evento" AS ENUM('EMBARCADO', 'ENTREGUE');--> statement-breakpoint
CREATE TYPE "public"."tipo_notificacao" AS ENUM('VIAGEM_INICIADA', 'TRANSPORTE_PROXIMO', 'ALUNO_EMBARCADO', 'ALUNO_ENTREGUE', 'VIAGEM_FINALIZADA');--> statement-breakpoint
CREATE TABLE "alunos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispositivos_push" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"token" text NOT NULL,
	"plataforma" "plataforma" NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"ultimo_uso_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dispositivos_push_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "eventos_viagem" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"viagem_id" uuid NOT NULL,
	"aluno_id" uuid NOT NULL,
	"tipo" "tipo_evento" NOT NULL,
	"registrado_por" uuid NOT NULL,
	"registrado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "eventos_viagem_unique" UNIQUE("viagem_id","aluno_id","tipo")
);
--> statement-breakpoint
CREATE TABLE "membros" (
	"organizacao_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"papel" "papel" NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "membros_organizacao_id_usuario_id_papel_pk" PRIMARY KEY("organizacao_id","usuario_id","papel")
);
--> statement-breakpoint
CREATE TABLE "notificacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"tipo" "tipo_notificacao" NOT NULL,
	"titulo" text NOT NULL,
	"corpo" text NOT NULL,
	"viagem_id" uuid,
	"aluno_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"enviada_em" timestamp with time zone,
	"lida_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "organizacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"ativa" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posicoes_viagem" (
	"viagem_id" uuid PRIMARY KEY NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"velocidade" double precision,
	"atualizada_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "responsaveis_alunos" (
	"aluno_id" uuid NOT NULL,
	"responsavel_id" uuid NOT NULL,
	"parentesco" text,
	"autorizado" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "responsaveis_alunos_aluno_id_responsavel_id_pk" PRIMARY KEY("aluno_id","responsavel_id")
);
--> statement-breakpoint
CREATE TABLE "rota_alunos" (
	"rota_id" uuid NOT NULL,
	"aluno_id" uuid NOT NULL,
	"ordem" integer NOT NULL,
	"endereco" text,
	"latitude" double precision,
	"longitude" double precision,
	CONSTRAINT "rota_alunos_rota_id_aluno_id_pk" PRIMARY KEY("rota_id","aluno_id"),
	CONSTRAINT "rota_alunos_ordem_unique" UNIQUE("rota_id","ordem")
);
--> statement-breakpoint
CREATE TABLE "rotas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"periodo" "periodo",
	"motorista_id" uuid NOT NULL,
	"veiculo_id" uuid NOT NULL,
	"ativa" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"email" text NOT NULL,
	"senha_hash" text NOT NULL,
	"telefone" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"super_admin" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "veiculos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"placa" text NOT NULL,
	"modelo" text NOT NULL,
	"capacidade" integer,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "veiculos_placa_unique" UNIQUE("placa"),
	CONSTRAINT "veiculos_capacidade_check" CHECK ("veiculos"."capacidade" IS NULL OR "veiculos"."capacidade" > 0)
);
--> statement-breakpoint
CREATE TABLE "viagens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"rota_id" uuid NOT NULL,
	"motorista_id" uuid NOT NULL,
	"veiculo_id" uuid NOT NULL,
	"status" "status_viagem" DEFAULT 'PLANEJADA' NOT NULL,
	"data" date NOT NULL,
	"iniciada_em" timestamp with time zone,
	"finalizada_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "viagens_periodo_check" CHECK ("viagens"."finalizada_em" IS NULL OR ("viagens"."iniciada_em" IS NOT NULL AND "viagens"."finalizada_em" >= "viagens"."iniciada_em"))
);
--> statement-breakpoint
ALTER TABLE "alunos" ADD CONSTRAINT "alunos_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispositivos_push" ADD CONSTRAINT "dispositivos_push_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos_viagem" ADD CONSTRAINT "eventos_viagem_viagem_id_viagens_id_fk" FOREIGN KEY ("viagem_id") REFERENCES "public"."viagens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos_viagem" ADD CONSTRAINT "eventos_viagem_aluno_id_alunos_id_fk" FOREIGN KEY ("aluno_id") REFERENCES "public"."alunos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos_viagem" ADD CONSTRAINT "eventos_viagem_registrado_por_usuarios_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membros" ADD CONSTRAINT "membros_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membros" ADD CONSTRAINT "membros_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_viagem_id_viagens_id_fk" FOREIGN KEY ("viagem_id") REFERENCES "public"."viagens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_aluno_id_alunos_id_fk" FOREIGN KEY ("aluno_id") REFERENCES "public"."alunos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posicoes_viagem" ADD CONSTRAINT "posicoes_viagem_viagem_id_viagens_id_fk" FOREIGN KEY ("viagem_id") REFERENCES "public"."viagens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responsaveis_alunos" ADD CONSTRAINT "responsaveis_alunos_aluno_id_alunos_id_fk" FOREIGN KEY ("aluno_id") REFERENCES "public"."alunos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responsaveis_alunos" ADD CONSTRAINT "responsaveis_alunos_responsavel_id_usuarios_id_fk" FOREIGN KEY ("responsavel_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rota_alunos" ADD CONSTRAINT "rota_alunos_rota_id_rotas_id_fk" FOREIGN KEY ("rota_id") REFERENCES "public"."rotas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rota_alunos" ADD CONSTRAINT "rota_alunos_aluno_id_alunos_id_fk" FOREIGN KEY ("aluno_id") REFERENCES "public"."alunos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotas" ADD CONSTRAINT "rotas_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotas" ADD CONSTRAINT "rotas_motorista_id_usuarios_id_fk" FOREIGN KEY ("motorista_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotas" ADD CONSTRAINT "rotas_veiculo_id_veiculos_id_fk" FOREIGN KEY ("veiculo_id") REFERENCES "public"."veiculos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "veiculos" ADD CONSTRAINT "veiculos_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viagens" ADD CONSTRAINT "viagens_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viagens" ADD CONSTRAINT "viagens_rota_id_rotas_id_fk" FOREIGN KEY ("rota_id") REFERENCES "public"."rotas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viagens" ADD CONSTRAINT "viagens_motorista_id_usuarios_id_fk" FOREIGN KEY ("motorista_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viagens" ADD CONSTRAINT "viagens_veiculo_id_veiculos_id_fk" FOREIGN KEY ("veiculo_id") REFERENCES "public"."veiculos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alunos_organizacao_idx" ON "alunos" USING btree ("organizacao_id");--> statement-breakpoint
CREATE INDEX "dispositivos_push_usuario_idx" ON "dispositivos_push" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "eventos_viagem_aluno_idx" ON "eventos_viagem" USING btree ("aluno_id","registrado_em");--> statement-breakpoint
CREATE INDEX "eventos_viagem_registrado_por_idx" ON "eventos_viagem" USING btree ("registrado_por");--> statement-breakpoint
CREATE INDEX "membros_usuario_idx" ON "membros" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "notificacoes_usuario_idx" ON "notificacoes" USING btree ("usuario_id","criado_em");--> statement-breakpoint
CREATE INDEX "notificacoes_viagem_idx" ON "notificacoes" USING btree ("viagem_id");--> statement-breakpoint
CREATE INDEX "notificacoes_aluno_idx" ON "notificacoes" USING btree ("aluno_id");--> statement-breakpoint
CREATE INDEX "responsaveis_alunos_responsavel_idx" ON "responsaveis_alunos" USING btree ("responsavel_id");--> statement-breakpoint
CREATE INDEX "rota_alunos_aluno_idx" ON "rota_alunos" USING btree ("aluno_id");--> statement-breakpoint
CREATE INDEX "rotas_organizacao_idx" ON "rotas" USING btree ("organizacao_id");--> statement-breakpoint
CREATE INDEX "rotas_motorista_idx" ON "rotas" USING btree ("motorista_id");--> statement-breakpoint
CREATE INDEX "rotas_veiculo_idx" ON "rotas" USING btree ("veiculo_id");--> statement-breakpoint
CREATE INDEX "veiculos_organizacao_idx" ON "veiculos" USING btree ("organizacao_id");--> statement-breakpoint
CREATE UNIQUE INDEX "viagens_rota_em_andamento_unique" ON "viagens" USING btree ("rota_id") WHERE "viagens"."status" = 'EM_ANDAMENTO';--> statement-breakpoint
CREATE INDEX "viagens_organizacao_data_idx" ON "viagens" USING btree ("organizacao_id","data");--> statement-breakpoint
CREATE INDEX "viagens_rota_data_idx" ON "viagens" USING btree ("rota_id","data");--> statement-breakpoint
CREATE INDEX "viagens_motorista_idx" ON "viagens" USING btree ("motorista_id");--> statement-breakpoint
CREATE INDEX "viagens_veiculo_idx" ON "viagens" USING btree ("veiculo_id");