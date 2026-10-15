# Backend – Pitaya Escolar

API em Node.js 24 + Fastify 5 + TypeScript. Segue o guia [BOAS_PRATICAS.md](BOAS_PRATICAS.md).

## Rodar

```bash
cp .env.example .env   # ajuste os valores
npm install
npm run dev            # http://localhost:3333/health
```

Scripts: `dev`, `build`, `start`, `typecheck`, `test`.

## Auditoria de segurança

Somente leitura: confere a configuração, a integridade do banco (isolamento entre organizações, LGPD, contas) e, com `--url`, a API no ar (headers, CORS, autenticação, formato dos erros). Mostra só contagens, nunca dados pessoais, e sai com código 1 se houver falha.

```bash
npm run audit:seguranca                                                 # config + banco
npm run audit:seguranca -- --url https://pitaya-escolar.onrender.com   # + API em produção
npm run audit:seguranca -- --sem-banco --url http://localhost:3333     # só config + API local
```

### Recuperação de acesso ("esqueci a senha")

`npm run audit:recuperacao` mostra a arquitetura recomendada do fluxo (OWASP Forgot Password) e confere os requisitos RA0–RA13 no código. Enquanto o fluxo não existe, eles aparecem como pendentes; quando surgir uma rota de recuperação, passam a ser conferidos. Checagem estática: não precisa de `.env` nem de banco. Use `-- --curto` para uma linha por item. Os caminhos `arquivo:linha` são clicáveis no terminal do VS Code.

### Responsável cadastra o próprio aluno

`npm run audit:aluno-responsavel` mostra a arquitetura recomendada do cadastro do aluno pela família e confere os requisitos PA0–PA16 no código (dados mínimos, mass assignment, aluno e vínculo na mesma transação, IDOR na edição, exclusão de verdade, aluno invisível à escola e ao motorista). Checagem estática, como a anterior; use `-- --curto` para uma linha por item.

### Busca de motoristas e tela de espera

`npm run audit:busca-motorista` mostra a arquitetura do vínculo família–motorista (busca → pedido → tela de espera → resposta do motorista), com um rascunho da tela de espera, e confere os requisitos BM0–BM22 no backend e no app (só motorista aprovado e só dados públicos na busca, filtro obrigatório, paginação e rate limit, pedido com estado explícito, único enquanto pendente e com prazo, tela que consulta o status e para nos estados finais, erro de rede que não vira "recusado", aceite atômico, auditoria). Checagem estática; use `-- --curto` para uma linha por item.

## Vínculo família–motorista

Módulo `src/modules/vinculos/`. O responsável busca o motorista (`GET /v1/responsavel/motoristas`), pede o transporte de um filho (`POST /v1/responsavel/solicitacoes`) e acompanha o pedido (`GET /v1/responsavel/solicitacoes/:id`, que o app consulta na tela de espera). O motorista vê os pedidos recebidos (`GET /v1/motorista/solicitacoes`) e aceita ou recusa; o aceite cria o vínculo e libera o telefone dele para a família. Pedido pendente vence em 7 dias.

Só motorista **aprovado** aparece na busca. Aprove depois de conferir os documentos do condutor escolar:

```bash
npm run aprovar:motorista -- --email motorista@exemplo.com
npm run aprovar:motorista -- --email motorista@exemplo.com --revogar
```

## Estrutura

`src/app.ts` monta a aplicação, `src/server.ts` sobe o servidor, `src/config/` valida o ambiente, `src/modules/<dominio>/` contém cada componente de negócio e `src/shared/` o código comum.

## Banco de dados

Postgres na nuvem (Neon, plano gratuito) com **Drizzle ORM** (driver `pg`). Use a connection string com pooling em `DATABASE_URL`.

- Schema: `src/db/schema.ts` · Migrações geradas em `drizzle/`
- `npm run db:generate`: gera uma migração após mudar o schema
- `npm run db:migrate`: aplica as migrações no banco (lê o `.env`)
- `npm run db:studio`: abre o navegador de dados
