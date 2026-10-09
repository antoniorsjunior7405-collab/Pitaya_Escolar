# Design – Pitaya Escolar

Sistema visual do app. Vale para **todas** as telas (motorista, responsável e admin), nos temas claro e escuro.
A implementação mora em `frontend/src/constants/theme.ts` (tokens) e `frontend/src/components/` (componentes). Este documento explica as decisões; o código é a fonte da verdade.

> **Regra de ouro:** telas e componentes **nunca** usam cores, raios ou espaçamentos soltos. Tudo vem do tema. Rode `npm run design:contraste` (em `frontend/`) depois de mexer na paleta.

---

## 1. Princípios

1. **Confiança e calma.** Os usuários são pais preocupados e motoristas dirigindo. Interface limpa, sem ruído, informação mais importante primeiro (o status do filho, o próximo aluno).
2. **Status nunca só pela cor.** Todo status tem rótulo em texto (e ponto colorido). Funciona para daltônicos e em sol forte.
3. **Vermelho é para alerta de verdade.** `danger` só em erros e emergências — nunca em status de rotina.
4. **Toque fácil.** Alvos de toque ≥ 44 pt (botões e campos têm 48). O motorista usa o app com pressa.
5. **Acessível por padrão.** Contraste WCAG 2.2, rótulos para leitor de tela, fonte do sistema respeitada.

## 2. Paleta "Pitaya"

Inspirada na fruta: **magenta** da casca como cor de marca e **verde** da folha como apoio.

### Marca

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `primary` | `#C2185B` | `#FF6FA8` | Ação principal, links, cabeçalho, seleção |
| `onPrimary` | `#FFFFFF` | `#1A0710` | Texto/ícone sobre `primary` |
| `secondary` | `#2E7D32` | `#7ED685` | Confirmações, sucesso, "Escolar" na marca |
| `onSecondary` | `#FFFFFF` | `#0B1F0D` | Texto sobre `secondary` |
| `danger` | `#B42318` | `#FF8A80` | **Somente** erros e alertas |

### Base

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `background` | `#FFFFFF` | `#140D12` | Fundo das telas |
| `backgroundElement` | `#FBF2F6` | `#22171E` | Superfície de cards e campos |
| `backgroundSelected` | `#F5DCE7` | `#33222D` | Item selecionado/pressionado |
| `text` | `#211520` | `#F8EEF3` | Texto principal |
| `textSecondary` | `#6B5864` | `#C7B3BF` | Rótulos, descrições, metadados |
| `border` | `#EADBE2` | `#3D2C37` | Bordas **decorativas** (cards) |
| `borderStrong` | `#8E7A86` | `#8C7385` | Bordas de **controles** (campos, chips) — precisam de 3:1 |

Os neutros têm um leve tom de ameixa (puxado do magenta) para a paleta parecer uma só, em vez de cinza puro.

### Status

| Status | Tom | Por quê |
|---|---|---|
| Planejada / Aguardando | Neutro (`statusNeutro*`) | Nada aconteceu ainda |
| Em andamento | Marca (`statusMarca*`) | Destaque calmo: "está acontecendo agora" |
| Embarcado | Atenção (`statusAtencao*`, âmbar) | Aluno em trânsito: merece atenção, não alarme |
| Entregue / Finalizada | Sucesso (`statusSucesso*`, verde) | Ciclo concluído com segurança |

O mapeamento fica em um único lugar: `components/status-badge.tsx`.

### Contraste (WCAG 2.2)

Todos os pares abaixo são verificados por `npm run design:contraste`, que lê o `theme.ts`:

- Texto (`text`, `textSecondary`, `primary`, `secondary`, `danger`) sobre `background` e `backgroundElement`: **≥ 4,5:1**.
- `onPrimary`/`primary` e `onSecondary`/`secondary`: **≥ 4,5:1**.
- Cada par texto/fundo de status: **≥ 4,5:1**.
- `borderStrong` (bordas de campos e chips) sobre os fundos: **≥ 3:1** (SC 1.4.11).

Resultado atual: todos passam. Menor folga: `borderStrong` sobre `backgroundElement` no claro (3,62:1) e `secondary` sobre `background` no claro (5,13:1).

## 3. Tipografia

Fonte do sistema (San Francisco no iOS, Roboto no Android). Escala em `components/themed-text.tsx`:

| Tipo | Tamanho / altura | Peso | Uso |
|---|---|---|---|
| `title` | 32 / 40 | 800 | Marca, código de convite |
| `subtitle` | 22 / 30 | 700 | Títulos de seção e de estados (vazio/erro) |
| `default` | 16 / 24 | 400 | Texto corrido |
| `link` | 16 / 24 | 600 | Links (cor `primary` automática) |
| `smallBold` | 14 / 20 | 700 | Nomes em cards, rótulos de campo, botões |
| `small` | 14 / 20 | 400 | Metadados e descrições |

- O tamanho **cresce com a fonte escolhida no celular** (acessibilidade). `maxFontSizeMultiplier={2}` evita quebrar o layout em escalas extremas sem desligar o recurso.
- Nunca use altura fixa em containers de texto (use `minHeight`).

## 4. Espaçamento e forma

- **Espaçamento** (`Spacing`): 2, 4, 8, **16**, 24, 32, 64. Padrão entre cards: 16. Margem lateral: 16 no celular, 32 no tablet.
- **Raios** (`Radius`): `sm` 8 · `md` 12 (botões, campos) · `lg` 16 (cards, mapa) · `pill` (badges, chips).
- **Bordas**: 1 px; botão secundário 1,5 px em `primary`.

## 5. Componentes

| Componente | Arquivo | Notas |
|---|---|---|
| `Card` | `ui/card.tsx` | Superfície padrão. Com `onPress` vira botão acessível |
| `PrimaryButton` | `ui/primary-button.tsx` | `primario` (preenchido) ou `secundario` (contorno). Estados carregando/desabilitado anunciados |
| `TextField` | `ui/text-field.tsx` | Rótulo visível + `accessibilityLabel`; erro em `danger` com `role="alert"` |
| `Seletor` | `ui/seletor.tsx` | Escolha única em chips (radiogroup). Quebra linha sozinho |
| `StatusBadge` | `status-badge.tsx` | Ponto + rótulo; nunca só cor |
| `EstadoCarregando` / `EstadoErro` / `EstadoVazio` | `ui/` | **Toda tela que busca dados** trata os três estados |
| `Marca` | `marca.tsx` | "Pitaya" (magenta) + "Escolar" (verde) e o selo da fruta |
| `MapaVeiculo` | `mapa-veiculo.tsx` (+ `.web.tsx`) | Mapa com o veículo; na web mostra coordenadas em texto |
| `ServidorIndisponivel` | `servidor-indisponivel.tsx` | Sem rede/servidor dormindo, sem deslogar a pessoa |

Cabeçalhos de navegação usam `useStackOptions()` (fundo `background`, título `text`, botão voltar `primary`, sem sombra).

### Padrões de tela

- **Lista**: `FlatList` + `ListEmptyComponent` (estado vazio) + puxar para atualizar.
- **Formulário de cadastro**: `Card` no topo da lista ("Novo …"), erro da API logo acima do botão, botão desabilitado até o mínimo estar preenchido.
- **Ação destrutiva ou sem volta** (finalizar viagem): confirmação em `Alert`.
- **Mensagens**: português simples, dizendo o que fazer ("Peça à escola para…", "Ative nas configurações…").

## 6. Responsividade

Implementada em `hooks/use-responsive.ts` com `useWindowDimensions` (reage a rotação, dobra de tela e janela na web).

| Faixa | Largura | Comportamento |
|---|---|---|
| Celular | < 600 dp | Conteúdo de ponta a ponta, margem 16 |
| Tablet / web | ≥ 600 dp | Margem 32, conteúdo **centralizado** |

- Larguras máximas (`MaxWidth`): **720** para listas e conteúdo; **440** para formulários (login, cadastro). Evita cards e campos esticados em telas largas.
- Grupos de botões/chips usam `flexWrap` + `flexBasis`: ficam lado a lado quando cabem e **empilham sozinhos** em telas estreitas ou com fonte grande.
- Teclado: formulários usam `KeyboardAvoidingView` + `keyboardShouldPersistTaps="handled"`.
- Áreas seguras: todas as telas usam `SafeAreaView`.

## 7. Acessibilidade (checklist)

- [ ] Contraste conferido (`npm run design:contraste`).
- [ ] Botões e cards tocáveis com `accessibilityRole="button"` e rótulo que diz a ação ("Abrir rota X", "Embarcou: Ana").
- [ ] Status com texto; nada comunicado só por cor.
- [ ] Erros anunciados (`accessibilityRole="alert"`).
- [ ] Alvo de toque ≥ 44 pt.
- [ ] Testado com fonte grande do sistema e no tema escuro.

## 8. Como evoluir

- **Nova cor?** Adicione o token em `light` **e** `dark` no `theme.ts`, inclua o par em `scripts/verificar-contraste.mjs` e rode a verificação.
- **Novo status?** Mapeie em `status-badge.tsx` para um dos quatro tons existentes antes de criar um novo.
- **Ícone do app/splash:** `app.json` já usa o magenta (`#C2185B`) na splash e `#FCE4EF` no fundo do ícone adaptativo; os desenhos do ícone ainda são os do template e devem ser substituídos pela marca.

## Fontes

- [WCAG 2.2 – Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- [React Native – Dimensions / useWindowDimensions](https://reactnative.dev/docs/dimensions)
- [Estudo de caso de app de transporte escolar (paleta calma para transmitir confiança)](https://www.designstudiouiux.com/case-study/dashboard-ui-ux-design/)
