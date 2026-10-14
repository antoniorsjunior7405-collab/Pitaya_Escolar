# Boas práticas – Pitaya Escolar (React Native + Expo)

Guia a ser seguido por todo o código do app (`frontend/`). Base: documentação oficial do Expo e do React Native, ajustada à stack real do projeto:

- **App:** Expo SDK 57, React Native 0.86, React 19.2, Expo Router, TypeScript estrito, React Compiler ativo, TanStack Query.
- **Servidor:** API própria em `backend/` (Node 24 + Fastify 5 + Drizzle + PostgreSQL), hospedada no Render. O app **não** acessa o banco direto. Regras do servidor: [`backend/BOAS_PRATICAS.md`](../backend/BOAS_PRATICAS.md).

> **Regra de ouro:** o Expo muda a cada SDK. Antes de usar qualquer API de Expo/EAS/RN, confira a doc da versão em `https://docs.expo.dev/versions/v57.0.0/` (índice: `https://docs.expo.dev/llms.txt`). Nunca confie na memória.

Legenda: ⏳ = **planejado, ainda não implementado**. A regra vale quando o recurso for construído.

---

## 1. Estrutura de pastas

O repositório é dividido em `frontend/` (app Expo), `backend/` (API Node.js) e `docs/`. Todos os comandos Expo/npm deste guia rodam **dentro de `frontend/`**. Os caminhos abaixo são relativos a `frontend/`.

```
src/
  app/            # SÓ rotas (cada arquivo = uma tela). Sem lógica reutilizável aqui.
  components/     # Componentes reutilizáveis (ui/ para os genéricos)
  context/        # Providers globais (hoje: sessão)
  hooks/          # Hooks customizados
  services/       # Uma função por endpoint da API + chaves de query. As telas nunca chamam fetch/api direto.
  lib/            # Infra: http.ts (fetch + timeout + erros), api.ts (token + renovação), tokens, query client
  constants/      # theme.ts (cores, espaçamentos, raios, breakpoints)
  types/          # Tipos do domínio e do contrato com a API
scripts/          # Scripts de desenvolvimento (ex.: verificação de contraste)
```

Regras:
- Rotas ficam em `src/app/`; todo o resto fica **fora** dela. Não mude a raiz de rotas.
- Arquivos de configuração (`app.json`, `package.json`, `tsconfig.json`, `eslint.config.js`) ficam na raiz de `frontend/`.
- Use o alias `@/` (→ `src/`). Proibido `../../../`.
- Nada de pastas duplicadas (ex.: `components` dentro de `constants`).
- `ios/` e `android/` **nunca** são criados ou editados à mão (Continuous Native Generation). Configure o nativo em `app.json`/config plugins.

## 2. Nomes e convenções

| Item | Convenção | Exemplo |
|---|---|---|
| Arquivos de componente/hook/util | `kebab-case` | `status-badge.tsx`, `use-theme.ts` |
| Componentes | `PascalCase` | `StatusBadge` |
| Hooks | prefixo `use` | `useRastreamentoViagem` |
| Tipos/Interfaces | `PascalCase`, sem prefixo `I` | `Aluno`, `StatusViagem` |
| Constantes globais | `UPPER_SNAKE_CASE` | `INTERVALO_ENVIO_MS` |
| Arquivos de rota | `kebab-case`; layouts `_layout.tsx`; dinâmicas `[id].tsx` | |
| Testes | `nome.test.ts(x)` ao lado do arquivo testado | `http.test.ts` |

- Domínio em português (`Aluno`, `Rota`, `Viagem`); código técnico/infra em inglês quando é o nome da ferramenta (`useColorScheme`, `queryClient`). Seja consistente.
- Um componente por arquivo. `export default` apenas para telas (exigência do router); demais usam export nomeado.

## 3. Componentes

- **Somente function components + hooks.** Nada de classes.
- **Pequenos e com uma responsabilidade.** Passou de ~150 linhas ou mistura UI com regra de negócio → quebre.
- **Separe apresentação de dados:** componente de UI recebe props; quem busca dados é a tela (via `useQuery` + `services/`).
- **Props tipadas** com `type Props = {...}`; sem `any`; sem `React.FC`.
- **Composição > configuração:** prefira `children`/slots a dezenas de props booleanas.
- **Reutilize antes de criar.** Antes de um novo botão/card/badge, veja `src/components/` e [DESIGN.md](DESIGN.md).
- **Sem estilos duplicados:** cores, espaçamentos e raios vêm de `constants/theme.ts` (nada de hex solto nas telas).
- **React Compiler está ativo** (`experiments.reactCompiler`): não espalhe `useMemo`/`useCallback`/`memo` por reflexo. Escreva código simples e só otimize à mão com medição. Respeite as Regras do React: sem mutar props/estado, hooks no topo, **render sem efeitos colaterais** (ex.: esconder a splash vai em `useEffect`, não no corpo do componente).
- **Estados de tela obrigatórios:** toda tela que busca dados trata **carregando, erro e vazio** (`EstadoCarregando`, `EstadoErro`, `EstadoVazio`).
- **Efeitos (`useEffect`) são último recurso.** Não use para derivar estado nem para buscar dados (isso é do TanStack Query). Sempre faça cleanup (listeners, timers, assinatura de GPS) e ignore respostas que chegam depois da tela sair.

## 4. Navegação (Expo Router)

- Navegação 100% via Expo Router: `Link`, `router`, `useLocalSearchParams` de `expo-router`.
- `typedRoutes` está ligado — use rotas tipadas, não strings soltas.
- Cada pasta de navegador tem `_layout.tsx`.
- Organização atual: `login` e `cadastro` na raiz; uma pasta por papel: `motorista/`, `responsavel/`, `admin/`. `index.tsx` redireciona conforme o papel.
- Áreas protegidas com `Stack.Protected guard={...}` no `app/_layout.tsx`, usando `status` e `papel` da sessão (`useSession`).
  - **Isso é só UX.** A segurança real é do backend, que valida o token e o papel em toda requisição. Esconder uma tela não protege dado.
- A sessão vive em `context/session.tsx`. A splash (`SplashScreen.preventAutoHideAsync`) fica visível até a sessão salva ser verificada, para não piscar a tela de login.
- Passe **IDs** nos parâmetros de rota, nunca objetos inteiros; a tela busca o dado.

## 5. TypeScript

- `strict: true` sempre. Proibido `any` (use `unknown` + checagem) e `// @ts-ignore` sem justificativa.
- Tipos do domínio em `src/types/`. O contrato com a API fica em `types/api.ts` e `types/index.ts`, espelhando os schemas Zod do backend (`backend/src/modules/*/*.schemas.ts`). **Mudou um schema no backend → atualize o tipo no mesmo PR.** ⏳ Quando o backend publicar OpenAPI, esses tipos passam a ser gerados.
- O backend já valida a entrada **e a saída** (schema de resposta). No app:
  - erros da API sempre passam por `ApiError`/`mensagemDeErro` (`lib/http.ts`), nunca por `any`;
  - parâmetros de rota e deep links são texto não confiável: use-os só como ID e sempre com `encodeURIComponent` ao montar URLs;
  - formulários validam o mínimo no app (campos obrigatórios) para dar retorno rápido; a validação que vale é a do servidor.
- Use *union types* para status (`'PLANEJADA' | 'EM_ANDAMENTO' | 'FINALIZADA'`) em vez de strings livres ou enums.
- Rode `npm run typecheck` antes de concluir qualquer tarefa.

## 6. Estilização e UI

- `StyleSheet.create` no fim do arquivo ou componentes temáticos (`ThemedText`, `ThemedView`). Evite estilos inline em listas.
- Suporte **claro/escuro** (`userInterfaceStyle: automatic`) via `useTheme`.
- **Mobile-first e responsivo:** `useResponsive()` para margens e largura máxima; sem larguras fixas para a tela inteira; teste telas pequenas e fontes grandes.
- Use `react-native-safe-area-context` (`SafeAreaView`) em todas as telas; formulários com `KeyboardAvoidingView` + `keyboardShouldPersistTaps="handled"`.
- Alvos de toque com no mínimo **44×44 pt** (botões e campos têm 48).
- **Acessibilidade:** `accessibilityLabel`, `accessibilityRole` e `accessibilityState` em botões/ícones; contraste verificado (`npm run design:contraste`); nunca transmitir status só por cor. `accessibilityRole="alert"` **só para erros**: avisos informativos não devem interromper o leitor de tela.
- Todo texto respeita a fonte do sistema com `maxFontSizeMultiplier={2}` (já embutido em `ThemedText`; quem usa `Text` direto deve repetir).
- Ícones com `expo-symbols`/vetores, não PNGs pesados. Se o app passar a exibir imagens remotas, use `expo-image` (cache e placeholder).
- Textos visíveis ao usuário em português simples, dizendo o que fazer.

## 7. Estado e dados

- **Estado local** com `useState`/`useReducer`; **estado global** só para a sessão (`SessionProvider`). Não introduza biblioteca de estado sem necessidade real.
- **Dados do servidor** (rotas, alunos, viagens) ficam no **TanStack Query** (`lib/query-client.ts`), nunca em `useEffect` + `useState` manual.
  - Chaves de query definidas em cada service (`chavesMotorista`, `chavesResponsavel`, `chavesAdmin`). Não escreva chaves soltas nas telas.
  - Depois de uma mutação, invalide as chaves afetadas.
  - Retentativa automática só em falha de rede/5xx (já configurado); 4xx nunca é repetido.
- **Fluxo de uma chamada:** tela → `services/*` → `lib/api.ts` (anexa o token, renova uma vez em 401) → `lib/http.ts` (URL, timeout, `ApiError`). As telas **não** conhecem URLs, tokens nem `fetch`.
- Trate erros de rede explicitamente (offline é comum no trânsito e o servidor gratuito "dorme"): mensagem clara e botão de tentar de novo (`EstadoErro`, `ServidorIndisponivel`). Sem rede **não** deslogue a pessoa.
- **"Tempo real" hoje é polling:** `refetchInterval` (10 s com viagem em andamento, mais espaçado fora dela). O `focusManager` pausa as atualizações com o app em segundo plano. ⏳ Se migrar para WebSocket/SSE, a assinatura deve ser criada e **removida** no ciclo de vida da tela.

## 8. API, sessão e segurança

- **Endereço da API:** `EXPO_PUBLIC_API_URL` (em `frontend/.env`). Leia sempre com acesso estático (`process.env.EXPO_PUBLIC_API_URL`); destructuring e `process.env[nome]` **não** são substituídos no bundle.
- **Tudo que tem `EXPO_PUBLIC_` vai em texto puro dentro do app.** Nunca coloque no app o `JWT_SECRET`, a `DATABASE_URL`, chave de push ou qualquer segredo. Segredos existem só no servidor.
- `.env` só com valores públicos pode ser versionado; `.env*.local` fica no `.gitignore`. Não use `NODE_ENV` para escolher ambiente.
- **Sessão (já implementada, mantenha o desenho):**
  - access token (JWT curto, 15 min) **só em memória** (`lib/session-tokens.ts`);
  - refresh token no `expo-secure-store` (Keychain/Keystore) via `lib/token-storage.ts`, nunca em `AsyncStorage`/arquivo; na web, `localStorage` apenas para desenvolvimento;
  - o backend **rotaciona** o refresh token a cada uso: a renovação é *single-flight* (chamadas simultâneas compartilham a mesma requisição). Não crie outro caminho de renovação;
  - no logout: revoga no servidor (best effort), apaga os tokens e limpa o cache do Query (`queryClient.clear()`), para a próxima pessoa no aparelho não ver dados da anterior.
- **Autorização é do backend.** Ele checa o papel (gravado no token na emissão) e a **posse do recurso** em toda rota:
  - responsável só vê os **próprios filhos** e a viagem em que eles estão;
  - motorista só vê/edita **suas rotas** e os alunos delas;
  - localização do veículo só para responsáveis vinculados e só com viagem `EM_ANDAMENTO`;
  - admin tem papel próprio, nunca uma flag enviada pelo cliente.
- O **papel do usuário** vem da sessão (`/v1/auth/me`), nunca de uma escolha na tela. No cadastro a pessoa informa o papel, mas o servidor só aceita `MOTORISTA`/`RESPONSAVEL` com código de convite válido.
- **LGPD:** os alunos são menores de idade. Colete o mínimo necessário, informe a finalidade, não registre dados pessoais em logs e ⏳ permita exclusão de conta/dados.

## 9. Localização e mapas

**Estado atual:** rastreamento em **primeiro plano** (`hooks/use-rastreamento-viagem.ts`): `watchPositionAsync` com `Accuracy.Balanced`, envio no máximo a cada 10 s, assinatura removida ao sair da tela ou ao finalizar a viagem. Com o app em segundo plano ou a tela bloqueada, o GPS pausa — o motorista é avisado ("Mantenha o app aberto").

- Peça permissão **em contexto**, explicando o motivo. O app deve continuar funcionando se a pessoa negar (mostra aviso, não trava).
- Economize bateria: `accuracy` adequada, `distanceInterval`/`timeInterval` e **limite de envio** ao servidor (não envie cada ponto). O backend também tem rate limit.
- Textos de permissão em português no config plugin do `expo-location` (`app.json`).
- ⏳ **Segundo plano** (só se o MVP exigir):
  - `TaskManager.defineTask` **no escopo de módulo** + `Location.startLocationUpdatesAsync`; parar com `stopLocationUpdatesAsync` ao finalizar a viagem (**RN-08**);
  - ligar `isIosBackgroundLocationEnabled`/`isAndroidBackgroundLocationEnabled` no `app.json`;
  - primeiro *foreground*, depois *background*; no Android 11+ a permissão em segundo plano abre as configurações — mostre uma tela explicativa antes;
  - Google Play exige **revisão** para localização em segundo plano e serviço em primeiro plano; planeje a aprovação cedo;
  - não funciona no Expo Go → *development build*.
- **Mapas:** o projeto usa `react-native-maps` (`components/mapa-veiculo.tsx`, com versão web em texto). Funciona no Expo Go; **para build Android de loja é obrigatório configurar a chave do Google Maps** no plugin `react-native-maps` do `app.json` (chave restrita por pacote + SHA-1, fora do código-fonte quando possível).

## 10. Notificações ⏳

Ainda não implementadas (`expo-notifications` não está instalado). Quando forem:

- `expo-notifications` com push via serviço do Expo; token com `getExpoPushTokenAsync({ projectId })` (`extra.eas.projectId` no `app.json`, exige projeto EAS).
- No Android 13+, **crie o canal antes de pedir permissão**. Defina canais (ex.: `viagem`, `avisos`).
- Envie o token à API vinculado ao usuário e **atualize** quando mudar (`addPushTokenListener`). Remova no logout.
- **O envio é feito pelo backend** a partir dos eventos de viagem, nunca pelo app do motorista direto ao responsável.
- Eventos do escopo: rota iniciada, transporte próximo, aluno embarcou, aluno entregue, rota finalizada. Uma notificação por evento, sem repetição.
- Push remoto **não funciona no Expo Go** (Android, SDK 53+) → development build. Teste em build de release.

## 11. Desempenho

- **Listas que crescem com os dados** (rotas, alunos, pessoas, histórico): `FlatList`, **nunca** `ScrollView` + `map`. Use `keyExtractor` com ID estável, `ListEmptyComponent` e puxar para atualizar.
- `ScrollView` é aceito em telas de **detalhe/formulário** com conteúdo fixo, incluindo pequenas listas limitadas por natureza (ex.: os responsáveis de um aluno).
- Com o React Compiler ativo, `renderItem` inline é aceitável; extraia um componente de item quando ele crescer ou para reaproveitar. Use `getItemLayout` quando a altura for fixa.
- Animações com `react-native-reanimated` (thread de UI); evite animar com estado do React.
- Evite trabalho pesado no render e no JS thread.
- Sem `console.*` no código do app: o ESLint bloqueia em `src/` (`no-console`).
- Meça antes de otimizar: React DevTools Profiler, `npx expo export --platform android` + análise de bundle.
- Hermes e a nova arquitetura já são padrão no SDK 57 — não os desligue.

## 12. Dependências

- **Instale sempre com `npx expo install <pacote>`** (resolve a versão compatível com o SDK). Nunca `npm i` direto para pacotes ligados ao Expo/RN.
- Rode `npx expo-doctor` e `npx expo install --fix` ao suspeitar de incompatibilidade.
- Biblioteca com código nativo exige *development build* (`npx expo run:android|ios` ou `eas build --profile development`).
- Commite o `package-lock.json`. Não misture gerenciadores de pacote (npm, yarn, bun).
- Cada dependência aumenta o bundle e a manutenção: prefira módulos Expo oficiais e justifique pacotes novos no PR.
- Atualização de SDK: uma versão por vez, seguindo o changelog oficial (`expo.dev/changelog`).

## 13. Qualidade de código

- **`npm run check`** (typecheck + lint + Prettier + testes + contraste) deve passar antes de qualquer commit/PR.
- Formatação automática com Prettier (`npm run format`); configuração em `.prettierrc.json`.
- Funções pequenas, nomes descritivos, retorno antecipado em vez de `if` aninhado.
- Comentários explicam o **porquê**, não o óbvio. Referencie regras de negócio pelo código (RN-xx).
- Sem código morto, sem `TODO` sem dono/contexto, sem arquivos duplicados.
- Tratamento de erros: nunca engolir exceção em silêncio; mostre algo útil ao usuário. ⏳ Captura de erros em produção (ex.: Sentry), sem dados pessoais.

## 14. Testes

Stack: `jest-expo` + `@testing-library/react-native` (já configurados no `package.json`; `"types": ["jest"]` no `tsconfig`). Rode com `npm test`.

- **Unitários:** funções puras e infra (`lib/http`, `lib/session-tokens`, `lib/formatar`), hooks e services.
- **Componentes:** React Native Testing Library, testando o que o usuário vê (`getByText`, `getByRole`), não detalhes de implementação.
- **Regras de negócio e autorização** (transições de viagem, acesso negado a dados de outro usuário) são testadas **no backend**, onde a regra mora.
- **Prioridade no app:** sessão (login, renovação, logout, servidor indisponível), iniciar/finalizar viagem, embarcar/entregar aluno, estados de erro/vazio.
- Snapshots só para componentes pequenos e estáveis; ⏳ para fluxos completos, E2E (ex.: Maestro).
- Bug corrigido = teste que o reproduz.

## 15. Git e fluxo de trabalho

- Branch principal: `master`. Trabalho em branches curtas (`feat/…`, `fix/…`, `chore/…`) e PRs pequenos.
- Commits no padrão *Conventional Commits* em português, com escopo: `feat(frontend): adiciona tela de histórico`, `fix(backend): corrige status do aluno`.
- Nunca commitar: segredos, `backend/.env`, `.env*.local`, `node_modules`, `ios/`, `android/`, chaves (`*.jks`, `*.p8`, `*.p12`, `*.key`).
- Antes de concluir tarefa: `npm run check` em `frontend/` (e em `backend/`, se mexeu lá).
- Fim de linha **LF** em todos os sistemas, garantido pelo `.gitattributes` da raiz (`* text=auto eol=lf`). Não remova: no Windows o `core.autocrlf=true` faria o checkout em CRLF e o Prettier reprovaria todos os arquivos.
- O `package-lock.json` precisa passar no `npm ci`. Se o `npm ci` reclamar de pacote faltando no lock, corrija o lock no mesmo PR que mudou as dependências.
- ⏳ Build e publicação via EAS (`eas build`, `eas submit`, `eas update`) com perfis `development`, `preview` e `production` — ainda falta criar o `eas.json` e o projeto EAS.

## 16. Checklist de PR

- [ ] Segue a estrutura de pastas e o alias `@/`
- [ ] Telas chamam a API só via `services/`; dados do servidor no TanStack Query
- [ ] Sem `any`, sem `console.log`, sem código duplicado
- [ ] Estados de carregando/erro/vazio tratados
- [ ] Acessibilidade e toque ≥ 44 pt conferidos; `alert` só em erros
- [ ] Nenhum segredo no app; tipos de `types/` batem com os schemas do backend
- [ ] Efeitos com cleanup (GPS, timers, listeners); render sem efeitos colaterais
- [ ] `npm run check` passando
- [ ] Testado em Android e iOS (e em tela pequena / fonte grande)

---

## Fontes

- Expo: [llms.txt](https://docs.expo.dev/llms.txt), [src directory](https://docs.expo.dev/router/reference/src-directory.md), [Protected routes](https://docs.expo.dev/router/advanced/protected.md), [Variáveis de ambiente](https://docs.expo.dev/guides/environment-variables.md), [SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore.md), [Location](https://docs.expo.dev/versions/latest/sdk/location.md), [Notifications](https://docs.expo.dev/versions/latest/sdk/notifications.md), [Unit testing](https://docs.expo.dev/develop/unit-testing.md)
- TanStack Query: [React Native](https://tanstack.com/query/latest/docs/framework/react/react-native)
- React Native: [Optimizing FlatList](https://reactnative.dev/docs/optimizing-flatlist-configuration)
- react-native-maps: [Expo config](https://docs.expo.dev/versions/latest/sdk/map-view.md)
- [Changelog do Expo SDK 57](https://expo.dev/changelog/sdk-57)
