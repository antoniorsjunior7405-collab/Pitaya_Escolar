# Boas práticas – Backend Pitaya Escolar (Node.js)

Guia a ser seguido por todo o código de `backend/`. Base: [goldbergyoni/nodebestpractices](https://github.com/goldbergyoni/nodebestpractices), [Node.js Security Best Practices](https://nodejs.org/en/learn/getting-started/security-best-practices), calendário oficial de versões do Node e a documentação do Fastify.

> **Decisões ainda abertas** (marcadas com 🔶 ao longo do texto): framework, banco/ORM e relação com o Supabase. As recomendações abaixo são o padrão sugerido; confirme antes de implementar.

---

## 1. Versão do Node.js

- Use sempre uma versão **LTS** em produção. Em out/2026: **Node 24 (Krypton)** é a LTS recomendada para novo projeto; Node 22 (Jod) está em manutenção; Node 26 é "Current" (não usar em produção); Node 20 e anteriores estão **EOL**.
- Fixe a mesma versão em dev, CI e produção: `"engines": { "node": ">=24" }` no `package.json`, arquivo `.nvmrc` com `24` e a mesma tag na imagem Docker.
- Módulos nativos sempre com prefixo: `import fs from 'node:fs'`.
- Evite recursos marcados como experimentais em produção.

## 2. Estrutura do projeto

Princípio central: **organizar por componente de negócio (domínio), não por tipo técnico**, e dentro de cada componente separar em **camadas**. Evite pastas globais `controllers/`, `models/`, `services/` com tudo misturado.

```
backend/
  src/
    server.ts              # só inicia o servidor e o shutdown (ponto de entrada)
    app.ts                 # monta a aplicação (plugins, rotas, handler de erro) — sem listen(), facilita testes
    config/                # configuração validada (env) — única porta de entrada de variáveis
    modules/               # componentes de negócio
      auth/
      usuarios/
      alunos/
      veiculos/
      rotas/
      viagens/             # iniciar/finalizar trajeto, embarque/entrega (RN-08)
      localizacao/
      notificacoes/
      admin/
        index.ts           # ponto de entrada explícito do módulo (API pública)
        admin.routes.ts    # camada WEB: rotas, schemas, status HTTP
        admin.service.ts   # camada DOMÍNIO: regras de negócio, sem req/res
        admin.repository.ts# camada DADOS: acesso ao banco
        admin.schemas.ts   # validação de entrada/saída
        admin.types.ts
        admin.test.ts
    shared/                # código realmente comum: erros, logger, middlewares, utils
      errors/
      logger.ts
      plugins/
    db/                    # conexão, migrations, seeds
  test/                    # testes de API/integração e helpers
  docs/                    # (opcional) decisões do backend, OpenAPI
  package.json
  tsconfig.json
  .env.example
  Dockerfile
```

Regras:
- **Camadas por módulo:** `routes` (web) → `service` (domínio) → `repository` (dados). Objetos de web (`req`, `res`, `reply`) **nunca** entram no service/repository.
- Um módulo só importa de outro pelo seu `index.ts` (API pública). Proibido importar arquivos internos de outro módulo.
- Dependência só desce: routes → service → repository. Nunca o contrário.
- `shared/` só recebe o que é usado por 2+ módulos. Não vire "lixeira".
- Sem efeitos colaterais no topo de módulo (conexão de banco, chamada de rede ao importar). Inicialize em funções chamadas pelo `server.ts`.
- Separe `app.ts` de `server.ts`: os testes importam `app.ts` e usam `inject`/supertest sem abrir porta.
- Imports de relativo curtos; use alias (`#modules/*`, `#shared/*` via `imports` no `package.json`) em vez de `../../../`.

## 3. Framework 🔶

Recomendação: **Fastify 5** — validação por JSON Schema nativa (entrada e saída), serialização rápida, logger Pino embutido, boa tipagem TypeScript e modelo de plugins com encapsulamento que combina com a estrutura por módulos (cada módulo vira um plugin registrado com prefixo, ex.: `/v1/viagens`).

Alternativas: Express (mais conhecido, mas sem validação/logger/async-erros nativos de forma equivalente) e NestJS (mais estrutura e opinião, mais curva e peso). Escolha uma e não misture.

Se Fastify:
- Cada módulo exporta um plugin `async function (app) {...}`; registre com `app.register(modulo, { prefix: '/v1/...' })`.
- Use `fastify-plugin` apenas para o que deve ser compartilhado com o escopo pai (ex.: autenticação, conexão de banco).
- Defina schema de `body`, `querystring`, `params`, `headers` **e `response`** em toda rota (o schema de resposta também evita vazar campos).

## 4. TypeScript

- `strict: true`; sem `any` (use `unknown` + validação); sem `@ts-ignore` injustificado.
- Use tipos simples e legíveis; evite tipagem avançada que ninguém do time entende.
- Tipos derivados dos schemas (ex.: Zod/TypeBox + `Static`/`infer`) para ter **uma única fonte de verdade** entre validação e tipo.
- Execução: Node 24 consegue rodar TypeScript removendo tipos (type stripping), mas confirme na doc da versão e mantenha `tsc --noEmit` no CI para checagem de tipos. Para build de produção, compile para `dist/` e rode `node dist/server.js`.
- ESM (`"type": "module"`) como padrão.

## 5. Configuração e segredos

- Toda configuração vem de variáveis de ambiente, lidas **em um único lugar** (`src/config/`) e **validadas na inicialização** (ex.: Zod/`env-schema`). Variável faltando ou inválida → o processo falha ao subir, com mensagem clara.
- Nunca use `process.env` espalhado pelo código; importe o objeto `config` tipado.
- `.env` **nunca** é versionado. Versione `.env.example` com nomes e valores fictícios.
- Segredos (chave de serviço do Supabase, JWT secret, chaves de push/mapas) só existem no servidor/secret manager. Nunca em log, resposta de erro ou repositório.
- Configuração por ambiente (`development`, `test`, `production`) via variáveis, não via `if (NODE_ENV)` espalhado. Em produção, `NODE_ENV=production`.

## 6. Design da API

- REST com versionamento no prefixo (`/v1/...`) e recursos no plural, em português coerente com o domínio (`/v1/alunos`, `/v1/viagens/:id/embarques`).
- Verbos HTTP corretos e códigos de status corretos (201 criação, 204 sem corpo, 400 validação, 401 não autenticado, 403 sem permissão, 404, 409 conflito, 422 regra de negócio).
- Respostas e erros com formato **consistente**; paginação em toda listagem (`limit`/`cursor`), com teto máximo.
- Documente com **OpenAPI** (gerado dos schemas). Isso documenta também os erros possíveis.
- Idempotência em operações críticas: registrar embarque/entrega duas vezes (ex.: reenvio por falha de rede) não pode duplicar nem quebrar. Use chave de idempotência ou restrições únicas no banco.
- Regras de negócio sobre viagem (**RN-08**: `PLANEJADA → EM_ANDAMENTO → FINALIZADA`, sem volta) ficam no **service**, com testes, e são reforçadas no banco quando possível.

## 7. Validação

- **Valide toda entrada** na borda (body, query, params, headers) por schema, antes de chegar ao service. Rejeite campos desconhecidos.
- Limite o tamanho do corpo da requisição (`bodyLimit`).
- Valide argumentos de funções públicas dos módulos quando vierem de fora da camada web (ex.: jobs, filas).
- Valide redirecionamentos e URLs recebidas (evite SSRF e redirect aberto).

## 8. Tratamento de erros

- Use `async/await`; nunca callbacks novos. **Sempre** `await` promessas (ou retorne com `return await` dentro de `try`) para manter stack trace completo.
- Crie uma hierarquia de erros própria estendendo `Error` (`AppError` com `code`, `statusHttp`, `isOperational`) — `NotFoundError`, `ForbiddenError`, `ConflictError`, `ValidationError`.
- Diferencie **erro operacional** (esperado: validação, não encontrado, permissão) de **erro de programador** (bug). Operacionais viram resposta HTTP; bugs são logados e retornam 500 genérico.
- **Um único handler de erro central** (`setErrorHandler`). Services lançam; o handler traduz. Sem `try/catch` espalhado só para montar resposta.
- **Nunca** vaze stack trace, SQL ou detalhes internos ao cliente. Resposta de erro: `{ code, message, requestId }`.
- Trate `unhandledRejection` e `uncaughtException`: logue e **encerre o processo de forma graciosa** (o orquestrador reinicia). Não continue rodando em estado incerto.
- Assine o evento `error` de streams, sockets e emitters.
- Teste os fluxos de erro, não só o caminho feliz.

## 9. Autenticação e autorização

- Autenticação por token (JWT de curta duração + refresh) ou delegada ao Supabase Auth 🔶. Em qualquer caso, **valide o token no servidor em toda rota protegida**.
- Senhas (se geridas aqui): `argon2`/`bcrypt`/`scrypt` — nunca SHA simples; nunca em log.
- Compare segredos com `crypto.timingSafeEqual`.
- **Autorização por papel e por recurso**, sempre no servidor:
  - responsável só acessa **seus filhos** e a viagem em que eles estão;
  - motorista só acessa **suas rotas/alunos/viagens**;
  - localização do veículo só para responsáveis vinculados e só com viagem `EM_ANDAMENTO`;
  - admin tem papel próprio, nunca flag enviada pelo cliente.
- Nunca confie em IDs ou papéis vindos do corpo/params sem checar a posse do recurso (evita IDOR).
- Rate limit por IP e por usuário, com limite mais rígido em login e recuperação de senha; bloqueio/atraso após tentativas falhas.
- Suporte a revogação de sessão/token (lista de bloqueio ou rotação de refresh).

## 10. Banco de dados 🔶

- Acesso a dados **somente** na camada `repository`, com ORM/query builder (Prisma, Drizzle, Kysely…) ou SQL parametrizado. **Nunca** concatene strings em SQL.
- Migrações versionadas e revisadas; nunca alterar o banco "na mão" em produção. Seeds só para dev/teste.
- Índices nas colunas de busca/junção; chaves estrangeiras e restrições (`UNIQUE`, `CHECK`) para garantir integridade, não só código.
- Transações para operações que alteram mais de uma tabela.
- Se usar **Supabase/PostgreSQL**: decidir se o app acessa o Supabase direto (com RLS) e o Node cobre apenas o que precisa de servidor (envio de push, regras sensíveis, admin), ou se **todo** acesso passa pelo Node. Em ambos os casos, **RLS ativado** nas tabelas e a chave `service_role` **só no servidor**.
- Pool de conexões configurado com limite; timeouts em consultas.
- Dados pessoais de menores (**LGPD**): minimização, controle de acesso, sem dados pessoais em logs, política de retenção e exclusão.

## 11. Logs, observabilidade e saúde

- Use um logger estruturado (**Pino**; já embutido no Fastify). Nunca `console.log` em código de produção.
- Log em **stdout**, em JSON; quem coleta é o ambiente.
- Atribua um **`requestId`** a cada requisição e inclua em todos os logs e nas respostas de erro.
- **Redija dados sensíveis** (tokens, senhas, localização exata quando não necessário, dados de menores).
- Níveis coerentes (`debug`/`info`/`warn`/`error`); `info` em produção.
- Endpoints `GET /health` (processo vivo) e `GET /ready` (dependências OK, ex.: banco), sem dados sensíveis.
- Métricas e rastreamento (APM/OpenTelemetry) e captura de erros (ex.: Sentry) antes de ir a produção.

## 12. Segurança

Do guia oficial do Node e do nodebestpractices:
- **Headers seguros** (helmet), **CORS** com lista explícita de origens, nunca `*` em produção com credenciais.
- **Limites e timeouts:** `bodyLimit`, `headersTimeout`, `requestTimeout`, `keepAliveTimeout`, `maxRequestsPerSocket`; rate limit global. Atrás de **reverse proxy** (TLS, gzip, cache) — não termine TLS no Node.
- **Não bloqueie o event loop:** nada de CPU pesado, `*Sync` ou regex catastrófica (ReDoS) em requisição; delegue a worker/fila.
- **Injeção:** consultas parametrizadas; sem `eval`/`new Function`; `child_process` só com `execFile` e argumentos fixos; nunca carregar módulos de caminho vindo do usuário.
- **Prototype pollution:** valide JSON por schema, sem merge recursivo inseguro de entrada externa; use `Object.hasOwn`.
- **SSRF:** se o servidor chamar URLs externas, use allowlist de hosts e bloqueie faixas privadas/link-local.
- **Cadeia de suprimentos:** commitar `package-lock.json`; `npm ci` no CI e deploy; `npm audit` no CI; revisar dependências novas (nome, mantenedor, tamanho); considerar `ignore-scripts` e `min-release-age`; 2FA na conta npm.
- Rodar como **usuário não-root**. Considerar o **Permission Model** do Node (`--permission`) para limitar acesso a arquivos/rede/processos.
- Erros sem detalhes internos; sem informações da stack em headers (`X-Powered-By`).
- Anexe `requestId` e **auditoria** para ações sensíveis (login, alteração de vínculo responsável–aluno, ações de admin).

## 13. Notificações e tempo real

- O **servidor envia** os pushes (serviço de push do Expo), disparado por eventos de domínio: rota iniciada, transporte próximo, aluno embarcou, aluno entregue, rota finalizada.
- Guarde o token de push por dispositivo/usuário; remova tokens inválidos devolvidos pelo serviço de push; remova no logout.
- Envie por **fila/job** com retentativa e backoff, fora do ciclo da requisição. Sem duplicar notificações (idempotência por evento).
- "Transporte próximo": calcule por distância/tempo no servidor e dispare **uma vez** por parada.
- Localização: aceite atualizações do motorista com **limite de frequência**, valide posse da viagem `EM_ANDAMENTO`, descarte pontos antigos/inválidos e não guarde histórico além do necessário.
- Para tempo real use WebSocket/SSE (ou Supabase Realtime 🔶) com autenticação e autorização por viagem.

## 14. Código e estilo

- **ESLint** (+ plugins `eslint-plugin-n` e `eslint-plugin-security`) e **Prettier**; lint e typecheck no CI.
- Nomes: `camelCase` (variáveis/funções), `PascalCase` (classes/tipos), `UPPER_SNAKE_CASE` (constantes), arquivos em `kebab-case` com sufixo de papel (`viagem.service.ts`). Domínio em português; infra em inglês.
- `const` por padrão, nunca `var`; `===`; `import` no topo; nomeie todas as funções (ajuda em stack traces e profiling).
- Funções pequenas, retorno antecipado, sem aninhamento profundo. Comentários explicam o **porquê** e citam regras (RN-xx).
- Sem utilitários pesados para o que o JS nativo já faz (ex.: Lodash para `map`/`filter`).
- Não existe código morto, `TODO` sem contexto nem arquivos duplicados.

## 15. Testes

- Comece por **testes de API/componente** (rota → service → banco de teste): maior cobertura por esforço que só unitários.
- Unitários para regras de negócio puras (ex.: transições de status da viagem, cálculo de "transporte próximo").
- Runner nativo `node:test` ou Vitest; `inject()` do Fastify/supertest para HTTP.
- Nome do teste: *unidade + circunstância + resultado esperado*. Estrutura **Arrange–Act–Assert**.
- Dados criados **por teste** (sem fixtures globais compartilhadas); banco de teste isolado e limpo.
- Porta aleatória nos testes; porta fixa em produção.
- **Mocke serviços externos** (push, mapas), inclusive erro, lentidão e timeout.
- Teste as cinco saídas: resposta, mudança de estado, chamadas externas, mensagens em fila e logs/métricas.
- **Teste obrigatório de autorização:** para cada rota, um caso "usuário sem permissão recebe 403/404" (responsável tentando ver filho de outro, motorista acessando rota alheia).
- Cobertura monitorada para achar caminhos não testados (blocos `catch`).
- Bug corrigido = teste que o reproduz.

## 16. Produção e deploy

- **Stateless:** nenhum estado de sessão/arquivo/cache só na memória do processo; use banco/Redis.
- `NODE_ENV=production`; dependências de dev fora da imagem final.
- **Shutdown gracioso:** em `SIGTERM`/`SIGINT`, pare de aceitar conexões, termine as em andamento, feche banco/filas e saia.
- Escalar por réplicas do orquestrador/container, não por gerenciador de processo dentro do container. Limite de memória no container e no V8.
- **Docker** (se usado): build multi-stage, imagem base pequena e com tag fixa (nunca `latest`), `.dockerignore` (sem `.env`), usuário não-root, `CMD ["node", "dist/server.js"]` (não `npm start`), `npm ci --omit=dev`, scan de vulnerabilidades da imagem.
- Deploy atômico e sem downtime; migrações aplicadas como etapa separada e compatíveis com a versão anterior.
- Backups do banco testados periodicamente.

## 17. Git e fluxo

- Branch principal `master`; branches curtas `feat/`, `fix/`, `chore/`; PRs pequenos; *Conventional Commits* em português.
- Nunca commitar `.env`, chaves, dumps de banco ou `node_modules`.
- CI mínimo: instalar com `npm ci` → lint → typecheck → testes → `npm audit`.
- Dependências: instale com versão exata/lockfile, justifique cada pacote novo, prefira módulos nativos do Node (`node:` ) quando suficientes.

## 18. Checklist de PR (backend)

- [ ] Código no módulo/camada certos (web ≠ domínio ≠ dados)
- [ ] Entrada validada por schema; resposta com schema
- [ ] Autorização por papel **e** por posse do recurso, com teste de acesso negado
- [ ] Erros usam a hierarquia própria; nada de stack trace ao cliente
- [ ] Sem `console.log`, sem segredo, sem dado pessoal em log
- [ ] Consultas parametrizadas; migração incluída e reversível quando possível
- [ ] Operação crítica é idempotente
- [ ] Lint, typecheck e testes passando; `npm audit` sem alta/crítica

---

## Fontes

- [Node.js Best Practices (goldbergyoni)](https://github.com/goldbergyoni/nodebestpractices)
- [Node.js Security Best Practices](https://nodejs.org/en/learn/getting-started/security-best-practices)
- [Node.js – Previous releases / calendário de LTS](https://nodejs.org/en/about/previous-releases)
- [Fastify – Getting Started](https://fastify.dev/docs/latest/Guides/Getting-Started/)
