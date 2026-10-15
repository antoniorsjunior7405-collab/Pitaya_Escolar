CREATE TABLE "recuperacoes_senha" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"usado_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recuperacoes_senha_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "recuperacoes_senha" ADD CONSTRAINT "recuperacoes_senha_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recuperacoes_senha_usuario_idx" ON "recuperacoes_senha" USING btree ("usuario_id","criado_em");