CREATE TYPE "public"."estado_solicitacao" AS ENUM('PENDENTE', 'ACEITA', 'RECUSADA', 'CANCELADA', 'EXPIRADA');--> statement-breakpoint
CREATE TABLE "solicitacoes_vinculo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aluno_id" uuid NOT NULL,
	"responsavel_id" uuid NOT NULL,
	"motorista_id" uuid NOT NULL,
	"estado" "estado_solicitacao" DEFAULT 'PENDENTE' NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"respondida_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "solicitacoes_vinculo_resposta_check" CHECK (("solicitacoes_vinculo"."estado" = 'PENDENTE') = ("solicitacoes_vinculo"."respondida_em" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "vinculos_motorista_aluno" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aluno_id" uuid NOT NULL,
	"motorista_id" uuid NOT NULL,
	"solicitacao_id" uuid,
	"inicio_em" timestamp with time zone DEFAULT now() NOT NULL,
	"fim_em" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "perfis_motorista" ADD COLUMN "aprovado_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "solicitacoes_vinculo" ADD CONSTRAINT "solicitacoes_vinculo_aluno_id_alunos_id_fk" FOREIGN KEY ("aluno_id") REFERENCES "public"."alunos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitacoes_vinculo" ADD CONSTRAINT "solicitacoes_vinculo_responsavel_id_usuarios_id_fk" FOREIGN KEY ("responsavel_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitacoes_vinculo" ADD CONSTRAINT "solicitacoes_vinculo_motorista_id_usuarios_id_fk" FOREIGN KEY ("motorista_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vinculos_motorista_aluno" ADD CONSTRAINT "vinculos_motorista_aluno_aluno_id_alunos_id_fk" FOREIGN KEY ("aluno_id") REFERENCES "public"."alunos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vinculos_motorista_aluno" ADD CONSTRAINT "vinculos_motorista_aluno_motorista_id_usuarios_id_fk" FOREIGN KEY ("motorista_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vinculos_motorista_aluno" ADD CONSTRAINT "vinculos_motorista_aluno_solicitacao_id_solicitacoes_vinculo_id_fk" FOREIGN KEY ("solicitacao_id") REFERENCES "public"."solicitacoes_vinculo"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "solicitacoes_vinculo_pendente_unique" ON "solicitacoes_vinculo" USING btree ("aluno_id","motorista_id") WHERE "solicitacoes_vinculo"."estado" = 'PENDENTE';--> statement-breakpoint
CREATE INDEX "solicitacoes_vinculo_responsavel_idx" ON "solicitacoes_vinculo" USING btree ("responsavel_id","criado_em");--> statement-breakpoint
CREATE INDEX "solicitacoes_vinculo_motorista_idx" ON "solicitacoes_vinculo" USING btree ("motorista_id","estado");--> statement-breakpoint
CREATE UNIQUE INDEX "vinculos_motorista_aluno_ativo_unique" ON "vinculos_motorista_aluno" USING btree ("aluno_id","motorista_id") WHERE "vinculos_motorista_aluno"."fim_em" IS NULL;--> statement-breakpoint
CREATE INDEX "vinculos_motorista_aluno_motorista_idx" ON "vinculos_motorista_aluno" USING btree ("motorista_id");