CREATE TABLE "registros_auditoria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid,
	"organizacao_id" uuid,
	"acao" text NOT NULL,
	"entidade" text NOT NULL,
	"entidade_id" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alunos" ALTER COLUMN "organizacao_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "responsaveis_alunos" ALTER COLUMN "autorizado" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "alunos" ADD COLUMN "criado_por" uuid;--> statement-breakpoint
ALTER TABLE "responsaveis_alunos" ADD COLUMN "consentimento_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "responsaveis_alunos" ADD COLUMN "termo_versao" text;--> statement-breakpoint
ALTER TABLE "registros_auditoria" ADD CONSTRAINT "registros_auditoria_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registros_auditoria" ADD CONSTRAINT "registros_auditoria_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "registros_auditoria_entidade_idx" ON "registros_auditoria" USING btree ("entidade","entidade_id");--> statement-breakpoint
CREATE INDEX "registros_auditoria_usuario_idx" ON "registros_auditoria" USING btree ("usuario_id","criado_em");--> statement-breakpoint
ALTER TABLE "alunos" ADD CONSTRAINT "alunos_criado_por_usuarios_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alunos_criado_por_idx" ON "alunos" USING btree ("criado_por");--> statement-breakpoint
ALTER TABLE "responsaveis_alunos" ADD CONSTRAINT "responsaveis_alunos_consentimento_check" CHECK (("responsaveis_alunos"."consentimento_em" IS NULL) = ("responsaveis_alunos"."termo_versao" IS NULL));