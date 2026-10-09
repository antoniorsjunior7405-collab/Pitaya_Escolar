# Boas práticas – Pitaya Escolar (React Native + Expo)

Guia a ser seguido por todo o código do projeto. Base: documentação oficial do Expo e do React Native, ajustada à stack do projeto (Expo SDK 57, React Native 0.86, React 19.2, Expo Router, TypeScript estrito, React Compiler ativo, Supabase).

> **Regra de ouro:** o Expo muda a cada SDK. Antes de usar qualquer API de Expo/EAS/RN, confira a doc da versão em `https://docs.expo.dev/versions/v57.0.0/` (índice: `https://docs.expo.dev/llms.txt`). Nunca confie na memória.

---

## 1. Estrutura de pastas

O repositório é dividido em `frontend/` (app Expo), `backend/` (API Node.js) e `docs/`. Todos os comandos Expo/npm deste guia rodam **dentro de `frontend/`**. Os caminhos abaixo são relativos a `frontend/`.

```
src/
  app/            # SÓ rotas (cada arquivo = uma tela). Sem lógica reutilizável aqui.
  components/     # Componentes reutilizáveis (ui/ para os genéricos)
  features/       # (opcional, quando crescer) agrupar por domínio: motorista, responsavel, admin
  hooks/          # Hooks customizados
  services/       # Acesso a dados (Supabase, mapas, notificações). As telas nunca chamam o Supabase direto.
  lib/            # Clientes e configs (ex.: lib/supabase.ts)
  constants/      # theme.ts, cores, espaçamentos, textos fixos
  types/          # Tipos do domínio
docs/             # Documentação do projeto
```

Regras:
- Rotas ficam em `src/app/`; todo o resto fica **fora** dela. Não mude a raiz de rotas.
- Arquivos de configuração (`app.json`, `package.json`, `tsconfig.json`, `metro.config.js`) ficam na raiz.
- Use o alias `@/` (→ `src/`). Proibido `../../../`.
- Nada de pastas duplicadas (ex.: `components` dentro de `constants`).
- `ios/` e `android/` **nunca** são criados ou editados à mão (Continuous Native Generation). Configure o nativo em `app.json`/config plugins.

## 2. Nomes e convenções

| Item | Convenção | Exemplo |
|---|---|---|
| Arquivos de componente/hook/util | `kebab-case` | `status-badge.tsx`, `use-theme.ts` |
| Componentes | `PascalCase` | `StatusBadge` |
| Hooks | prefixo `use` | `useViagemAtual` |
| Tipos/Interfaces | `PascalCase`, sem prefixo `I` | `Aluno`, `StatusViagem` |
| Constantes globais | `UPPER_SNAKE_CASE` | `INTERVALO_GPS_MS` |
| Arquivos de rota | `kebab-case`; layouts `_layout.tsx`; dinâmicas `[id].tsx`; grupos `(auth)` | |
| Testes | `nome-test.tsx` ou `nome.test.tsx` | |

- Domínio em português (como já está: `Aluno`, `Rota`, `Viagem`); código técnico/infra em inglês (`useColorScheme`, `supabase`). Seja consistente.
- Um componente por arquivo. `export default` apenas para telas (exigência do router); demais usam export nomeado.

## 3. Componentes

- **Somente function components + hooks.** Nada de classes.
- **Pequenos e com uma responsabilidade.** Passou de ~150 linhas ou mistura UI com regra de negócio → quebre.
- **Separe apresentação de dados:** componente de UI recebe props; quem busca dados é a tela ou um hook.
- **Props tipadas** com `type Props = {...}`; sem `any`; sem `React.FC`.
- **Composição > configuração:** prefira `children`/slots a dezenas de props booleanas.
- **Reutilize antes de criar.** Antes de um novo botão/card/badge, veja `src/components/`.
- **Sem estilos duplicados:** cores, espaçamentos e fontes vêm de `constants/theme.ts` (nada de `#6B7280` solto nas telas).
- **React Compiler está ativo** (`experiments.reactCompiler`): não espalhe `useMemo`/`useCallback`/`memo` por reflexo. Escreva código simples e só otimize à mão com medição ou quando o compilador não resolver. Respeite as Regras do React (sem mutar props/estado, hooks no topo, componentes puros).
- **Estados de tela obrigatórios:** toda tela que busca dados trata **carregando, erro e vazio** — não só o caminho feliz.
- **Efeitos (`useEffect`) são último recurso.** Não use para derivar estado (calcule no render) nem para buscar dados sem cancelar/limpar. Sempre faça cleanup (listeners, timers, assinaturas realtime, rastreamento de GPS).

## 4. Navegação (Expo Router)

- Navegação 100% via Expo Router: `Link`, `router`, `useLocalSearchParams` de `expo-router`.
- `typedRoutes` está ligado — use rotas tipadas, não strings soltas.
- Cada pasta de navegador precisa de `_layout.tsx` (**atenção:** `motorista/layout.tsx` está com o nome errado).
- Organize por **grupos**: `(auth)` (login/cadastro), `(motorista)`, `(responsavel)`, `(admin)`.
- Proteja áreas com `Stack.Protected guard={...}` usando a sessão e o perfil do usuário.
  - **Isso é só UX.** A segurança real é do backend (RLS no Supabase). Esconder uma tela não protege dado.
- Mantenha a sessão em um Provider/contexto e segure a splash screen (`expo-splash-screen`) até saber se há usuário logado, para não piscar a tela de login.
- Passe **IDs** nos parâmetros de rota, nunca objetos inteiros; a tela busca o dado.

## 5. TypeScript

- `strict: true` sempre. Proibido `any` (use `unknown` + validação) e `// @ts-ignore` sem justificativa.
- Tipos do domínio em `src/types/`. Com o Supabase, **gere os tipos do schema** (`supabase gen types typescript`) em vez de escrevê-los à mão.
- Valide dados externos (resposta de API, deep link, formulários) na borda — por exemplo com `zod`.
- Use *union types* para status (`'PLANEJADA' | 'EM_ANDAMENTO' | 'FINALIZADA'`) em vez de strings livres ou enums.
- Rode `npx tsc --noEmit` antes de concluir qualquer tarefa.

## 6. Estilização e UI

- `StyleSheet.create` no fim do arquivo (padrão atual) ou componentes temáticos. Evite estilos inline em listas.
- Suporte **claro/escuro** (`userInterfaceStyle: automatic`) via `useTheme`/`ThemedText`/`ThemedView`.
- **Mobile-first e responsivo:** layout com flex; sem larguras fixas em px para a tela inteira; teste telas pequenas e fontes grandes (acessibilidade do sistema).
- Use `react-native-safe-area-context` (`SafeAreaView`/insets) em todas as telas; respeite teclado (`KeyboardAvoidingView`) em formulários.
- Alvos de toque com no mínimo **44×44 pt**.
- **Acessibilidade:** `accessibilityLabel`, `accessibilityRole` e `accessibilityState` em botões/ícones; contraste suficiente; nunca transmitir status só por cor (use texto/ícone junto — importante para o `StatusBadge`).
- Imagens com `expo-image` (cache e placeholder). Ícones com `expo-symbols`/vetores, não PNGs pesados.
- Textos visíveis ao usuário em português, centralizados e fáceis de achar (preparar para i18n depois se necessário).

## 7. Estado e dados

- **Estado local** com `useState`/`useReducer`; **estado global** apenas para sessão/usuário e poucos itens (Context). Não introduza biblioteca de estado sem necessidade real.
- **Dados do servidor** (rotas, alunos, viagens) não são "estado global": use uma camada de cache de servidor (recomendação: TanStack Query) com chaves de query bem definidas, em vez de `useEffect` + `useState` manual.
- Toda chamada a dados passa por `src/services/*`. As telas **não** conhecem Supabase. (O `mockData.ts` já segue esse padrão — mantenha as mesmas assinaturas ao trocar por async.)
- Trate erros de rede explicitamente (offline é comum no trânsito): mensagem clara, botão de tentar de novo.
- Dados em tempo real (posição do veículo, status do aluno) via Supabase Realtime, com assinatura criada e **removida** no ciclo de vida da tela.

## 8. Supabase e segurança

- Cliente único em `src/lib/supabase.ts`. Configuração recomendada pela doc do Expo:
  - pacotes via `npx expo install @supabase/supabase-js expo-sqlite`;
  - `import 'expo-sqlite/localStorage/install'` e `auth.storage: localStorage`, `autoRefreshToken: true`, `persistSession: true`, `detectSessionInUrl: false`;
  - parar/iniciar o auto-refresh conforme `AppState` (`active` → `startAutoRefresh`, senão `stopAutoRefresh`).
- Variáveis: `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- **Tudo que tem `EXPO_PUBLIC_` vai em texto puro dentro do app.** Nunca coloque `service_role`, senha de banco, chave secreta de mapa/push ou qualquer segredo no app. Segredos ficam em Edge Functions / servidor.
- **RLS (Row Level Security) obrigatório em todas as tabelas.** Regras mínimas:
  - responsável só vê os **próprios filhos** e a viagem em que eles estão;
  - motorista só vê/edita **suas rotas** e alunos dessas rotas;
  - localização do veículo só para responsáveis vinculados, e só durante viagem `EM_ANDAMENTO`;
  - admin separado por papel, nunca por flag editável pelo cliente.
- O **papel do usuário** vem do banco/claims do token, nunca de uma escolha na tela (a tela "Escolha de papel" é provisória e será removida com o login).
- Variáveis: leia sempre com acesso estático (`process.env.EXPO_PUBLIC_X`); destructuring e `process.env[nome]` **não** são substituídos no bundle.
- `.env` com valores públicos pode ser versionado; `.env*.local` fica no `.gitignore`. Não use `NODE_ENV` para escolher ambiente; use `eas env:pull` / perfis do EAS.
- Dados sensíveis locais (tokens extras) em `expo-secure-store`, nunca em `AsyncStorage`/arquivo simples.
- **LGPD:** os alunos são menores de idade. Colete o mínimo necessário, informe a finalidade, não registre dados pessoais em logs e permita exclusão de conta/dados.

## 9. Localização e mapas

- Peça permissão **em contexto**, explicando o motivo antes do pedido do sistema. Primeiro *foreground*, depois *background* só se necessário; o app deve funcionar se o usuário negar o background.
- No Android 11+ a permissão em segundo plano abre as configurações do sistema — mostre uma tela explicativa antes.
- Rastreamento em segundo plano: `TaskManager.defineTask` **no escopo de módulo** + `Location.startLocationUpdatesAsync`; pare com `stopLocationUpdatesAsync` ao finalizar a viagem (**RN-08**).
- Economize bateria: `accuracy` adequada (Balanced costuma bastar), `distanceInterval`/`timeInterval` e atualizações adiadas. Não envie ao servidor a cada ponto — agrupe/limite a frequência.
- Config plugin de `expo-location` com `isIosBackgroundLocationEnabled` e `isAndroidBackgroundLocationEnabled` e textos de permissão claros em português.
- Google Play exige **revisão** para localização em segundo plano e serviço em primeiro plano; planeje essa aprovação desde cedo.
- Background location, foreground service e `expo-maps` **não funcionam no Expo Go** → use *development build*.
- Mapas: `expo-maps` (Apple Maps no iOS, Google Maps no Android) está em **alpha** e pode ter quebras; avalie `react-native-maps` antes de decidir. A chave do Google Maps é restrita por pacote + SHA-1 e fica em `app.json`.

## 10. Notificações

- `expo-notifications` com push via serviço do Expo; token com `getExpoPushTokenAsync({ projectId })` (`extra.eas.projectId` no `app.json`).
- No Android 13+, **crie o canal antes de pedir permissão**. Defina canais (ex.: `viagem`, `avisos`).
- Salve o token no backend vinculado ao usuário e **atualize** quando mudar (`addPushTokenListener`). Remova no logout.
- **O envio é feito pelo servidor** (Edge Function/trigger do Supabase), nunca pelo app do motorista direto ao responsável.
- Eventos do escopo: rota iniciada, transporte próximo, aluno embarcou, aluno entregue, rota finalizada. Evite spam: uma notificação por evento, sem repetição.
- Push remoto **não funciona no Expo Go** (Android, SDK 53+) → development build. Teste notificações em build de release.

## 11. Desempenho

- Listas: `FlatList`/`FlashList`, **nunca** `ScrollView` + `map` para listas dinâmicas. Use `keyExtractor` com ID estável, `renderItem` definido fora do JSX, itens simples e leves, `getItemLayout` quando a altura é fixa, e ajuste `initialNumToRender`/`windowSize` se necessário.
- Animações com `react-native-reanimated` (thread de UI); evite animar com estado do React.
- Imagens otimizadas e com tamanho adequado (`expo-image`).
- Evite trabalho pesado no render e no JS thread; adie com `InteractionManager`/`requestIdleCallback` quando fizer sentido.
- Remova `console.log` do código final.
- Meça antes de otimizar: React DevTools Profiler, `npx expo export --platform android` + análise de bundle.
- Hermes e a nova arquitetura já são padrão no SDK 57 — não os desligue.
- Dependências: cada uma aumenta o bundle e a superfície de manutenção. Prefira módulos Expo oficiais e justifique qualquer pacote novo.

## 12. Dependências

- **Instale sempre com `npx expo install <pacote>`** (resolve a versão compatível com o SDK). Nunca `npm i` direto para pacotes ligados ao Expo/RN.
- Rode `npx expo-doctor` e `npx expo install --fix` ao suspeitar de incompatibilidade.
- Biblioteca com código nativo exige *development build* (`npx expo run:android|ios` ou `eas build --profile development`).
- Commite o `package-lock.json`. Não misture gerenciadores de pacote (npm, yarn, bun).
- Atualização de SDK: uma versão por vez, seguindo o changelog oficial (`expo.dev/changelog`).

## 13. Qualidade de código

- **ESLint** (`npx expo lint`) e **typecheck** (`npx tsc --noEmit`) devem passar antes de qualquer commit/PR.
- Formatação automática com Prettier (adicionar ao projeto) para evitar discussões de estilo.
- Funções pequenas, nomes descritivos, retorno antecipado em vez de `if` aninhado.
- Comentários explicam o **porquê**, não o óbvio. Referencie regras de negócio pelo código (RN-xx).
- Sem código morto, sem `TODO` sem dono/contexto, sem arquivos duplicados.
- Tratamento de erros: nunca engolir exceção em silêncio; mostre algo útil ao usuário e registre (ferramenta de erros como Sentry, sem dados pessoais).

## 14. Testes

Setup recomendado (doc do Expo): `npx expo install jest-expo jest @types/jest --dev` e `@testing-library/react-native --dev`, com `"jest": { "preset": "jest-expo" }` e `"types": ["jest"]` no `tsconfig`.

- **Unitários:** funções puras, regras de negócio (transições de status da viagem), hooks e services.
- **Componentes:** React Native Testing Library, testando o que o usuário vê (`getByText`, `getByRole`), não detalhes de implementação.
- **Prioridade de cobertura (orçamento prevê "testes das principais funcionalidades"):** login/permissões, iniciar/finalizar viagem, embarcar/entregar aluno, notificações disparadas, RLS (testes de política no banco).
- Snapshots só para componentes pequenos e estáveis; para fluxos completos prefira E2E (ex.: Maestro).
- Bug corrigido = teste que o reproduz.

## 15. Git e fluxo de trabalho

- Branch principal: `master`. Trabalho em branches curtas (`feat/…`, `fix/…`, `chore/…`) e PRs pequenos.
- Commits no padrão *Conventional Commits* em português: `feat: adiciona tela de histórico`, `fix: corrige status do aluno`.
- Nunca commitar: segredos, `.env*.local`, `node_modules`, `ios/`, `android/`, chaves (`*.jks`, `*.p8`, `*.p12`, `*.key`).
- Antes de concluir tarefa: `npx expo lint` + `npx tsc --noEmit` + testes passando.
- Build e publicação via EAS (`eas build`, `eas submit`, `eas update`), com perfis `development`, `preview` e `production`.

## 16. Checklist de PR

- [ ] Segue a estrutura de pastas e o alias `@/`
- [ ] Sem `any`, sem `console.log`, sem código duplicado
- [ ] Estados de carregando/erro/vazio tratados
- [ ] Acessibilidade e toque ≥ 44 pt conferidos
- [ ] Nenhum segredo no app; RLS cobre a nova tabela/consulta
- [ ] Efeitos com cleanup (GPS, realtime, listeners)
- [ ] Lint, typecheck e testes passando
- [ ] Testado em Android e iOS (e em tela pequena)

---

## Fontes

- Expo: [llms.txt](https://docs.expo.dev/llms.txt), [src directory](https://docs.expo.dev/router/reference/src-directory.md), [Protected routes](https://docs.expo.dev/router/advanced/protected.md), [Supabase](https://docs.expo.dev/guides/using-supabase.md), [Variáveis de ambiente](https://docs.expo.dev/guides/environment-variables.md), [Location](https://docs.expo.dev/versions/latest/sdk/location.md), [Notifications](https://docs.expo.dev/versions/latest/sdk/notifications.md), [Maps](https://docs.expo.dev/versions/latest/sdk/maps.md), [Unit testing](https://docs.expo.dev/develop/unit-testing.md)
- React Native: [Optimizing FlatList](https://reactnative.dev/docs/optimizing-flatlist-configuration)
- [Changelog do Expo SDK 57](https://expo.dev/changelog/sdk-57)
