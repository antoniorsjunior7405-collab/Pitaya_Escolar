CREATE TABLE "perfis_motorista" (
	"usuario_id" uuid PRIMARY KEY NOT NULL,
	"apresentacao" text,
	"regiao_atendimento" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "veiculos" ADD COLUMN "motorista_id" uuid;--> statement-breakpoint
ALTER TABLE "perfis_motorista" ADD CONSTRAINT "perfis_motorista_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "veiculos" ADD CONSTRAINT "veiculos_motorista_id_usuarios_id_fk" FOREIGN KEY ("motorista_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "veiculos_motorista_idx" ON "veiculos" USING btree ("motorista_id");