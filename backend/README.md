# Backend – Pitaya Escolar

API em Node.js 24 + Fastify 5 + TypeScript. Segue o guia [BOAS_PRATICAS.md](BOAS_PRATICAS.md).

## Rodar

```bash
cp .env.example .env   # ajuste os valores
npm install
npm run dev            # http://localhost:3333/health
```

Scripts: `dev`, `build`, `start`, `typecheck`, `test`.

## Estrutura

`src/app.ts` monta a aplicação, `src/server.ts` sobe o servidor, `src/config/` valida o ambiente, `src/modules/<dominio>/` contém cada componente de negócio e `src/shared/` o código comum.

## Banco de dados

Postgres na nuvem (Neon, plano gratuito) com **Drizzle ORM** (driver `pg`). Use a connection string com pooling em `DATABASE_URL`.

- Schema: `src/db/schema.ts` · Migrações geradas em `drizzle/`
- `npm run db:generate`: gera uma migração após mudar o schema
- `npm run db:migrate`: aplica as migrações no banco (lê o `.env`)
- `npm run db:studio`: abre o navegador de dados
