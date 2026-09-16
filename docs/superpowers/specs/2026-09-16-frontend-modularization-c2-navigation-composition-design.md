# Spec C2 — Navigation and App Composition

**Projeto:** Gestão Delivery / Amor & Sabor  
**Repositório:** `vzaponi-dotcom/sistema-para-delivery`  
**Data:** 16/09/2026  
**Base de implementação:** `master` em `f5d8b7267cdbf91a7d254a3c1546464d4d9b0210`  
**Branch:** `feature/spec-c2-navigation-composition`  
**Spec-mãe:** `docs/superpowers/specs/2026-09-15-frontend-modularization-design.md`  
**Rollout:** `docs/superpowers/plans/2026-09-15-frontend-modularization-rollout-plan.md`  
**Estado:** desenho aprovado em conversa; documento para revisão antes do plano executável.  
**Natureza desta entrega:** documentação. Não autoriza implementação funcional, merge ou deploy.

---

## 1. Objetivo

A C2 cria a fronteira de **navegação e composição da aplicação** prevista na Spec C sem alterar a experiência já homologada.

A entrega deve:

- reduzir o acoplamento entre `App.jsx` e os detalhes de navegação desktop/mobile;
- organizar shell e navegação sob ownership explícito em `src/app/shell/` e `src/app/navigation/`;
- criar um `AppRoot` fino para a composição visual global da aplicação;
- manter o mecanismo atual baseado em `activeTab`, sem React Router;
- centralizar a definição de destinos, áreas e entradas de navegação hoje distribuída entre arquivos diferentes;
- disponibilizar um contrato pequeno de navegação para descendentes, sem criar um mega-contexto;
- preservar todas as invariantes funcionais e visuais da Spec A e as garantias já mantidas pela C1.

A C2 é uma refatoração estrutural. Não é redesign, feature ou mudança de fluxo.

---

## 2. Base real pós-C1

A C2 parte exclusivamente da `master` após o merge da PR #45, SHA `f5d8b7267cdbf91a7d254a3c1546464d4d9b0210`.

A C1 já extraiu do `App.jsx`:

- sessão/login/logout/expiração para `src/app/runtime/session/`;
- bootstrap, coleções oficiais e sincronização para `src/app/runtime/data/`;
- online/offline para `src/app/runtime/network/`;
- feedback global para `src/app/runtime/feedback/`;
- HTTP genérico/auth para `src/infrastructure/`;
- gate permanente de arquitetura em `scripts/architecture/`.

Após C1, `App.jsx` ainda coordena legitimamente responsabilidades que pertencem a slices posteriores, como pagamentos, comandas, clientes, produtos, financeiro, settings, impressão e regras operacionais de pedido. C2 não deve antecipar C3-C9 para reduzir o arquivo artificialmente.

O estado atual relevante para C2 é:

- `src/App.jsx` instancia `useNavigationController()` e `useQueryContext()`;
- `activeTab` ainda participa da ativação do polling dedicado da Cozinha e do relógio operacional;
- `App.jsx` ainda escolhe a superfície ativa e monta `AppShell`;
- `src/components/AppShell.jsx` controla shell, foco após troca de destino, `app:navigate` e animação de direção mobile;
- `src/components/Sidebar.jsx` mantém grupos e entradas desktop;
- `src/components/MobileNavigation.jsx` mantém entradas diretas, `Mais` e resolução de rótulos;
- `src/components/AreaNavigation.jsx` resolve abas internas por área;
- `src/app/navigation.js` mantém destinos, capacidades, fallbacks e decisões puras;
- `src/utils/mobileNavigation.js` mantém a ordem usada na transição mobile;
- `src/app/queryContext.js` e `src/app/useQueryContext.js` preservam estado de consulta por sessão.

A C2 deve consolidar essas seams sem alterar regras de domínio.

---

## 3. Invariantes obrigatórias

### 3.1 Navegação

Devem permanecer equivalentes:

- IDs de destino atuais;
- ordem e fallback das áreas;
- negação de destino explícito sem fallback silencioso;
- resolução baseada nas capabilities atuais;
- home/fallback por capability;
- menu desktop;
- menu mobile e entrada `Mais`;
- navegação interna por área;
- `new-order` fora dos menus principais;
- retorno do Novo Pedido para sua origem atual;
- contexto de Comandas ao iniciar pedido;
- `completeNavigation()` para retornos aceitos;
- evento global `app:navigate` enquanto existir;
- foco em `.app-content` após troca de destino;
- direção da animação mobile;
- `activeMobileEntry` usado durante Novo Pedido;
- queries preservadas enquanto a sessão permanece a mesma;
- callbacks de query de sessão anterior invalidados após reset.

### 3.2 Guards

Devem permanecer equivalentes:

- checkout em andamento bloqueia saída do Novo Pedido;
- pedido sujo exige confirmação antes de sair;
- cancelamento da confirmação mantém o usuário no fluxo;
- confirmação descarta somente o draft correto;
- settings dirty exige confirmação apenas ao abandonar o recurso protegido;
- navegação entre destinos pertencentes ao mesmo draft de settings continua permitida;
- settings em `saving` ou `unconfirmed` não ganha nova guarda global de navegação;
- cancelamento de um discard devolve foco ao conteúdo como hoje;
- `beforeunload` de settings continua com o owner atual até C3.

### 3.3 Runtime

A C2 não altera:

- estados de sessão `checking | anonymous | authenticated`;
- bootstrap/loading/error;
- polling global de aproximadamente 5 segundos;
- polling dedicado de `orders` de aproximadamente 2 segundos enquanto Cozinha está ativa;
- refresh por reconnect/focus/visibility;
- semântica de sync guards e official effects;
- logout/expiração/reset da C1;
- feedback global da C1.

`activeTab === 'orders'` pode continuar sendo o sinal transitório para ativar o polling dedicado durante C2. O objetivo é isolar ownership de navegação, não mudar a política de sincronização.

### 3.4 Visual

C2 não muda intencionalmente:

- posições, textos, ícones, grupos ou labels dos menus;
- CSS, salvo ajuste mecânico de import necessário por mudança de arquivo;
- animações existentes;
- tema claro/escuro;
- comportamento desktop/mobile;
- bottom sheets, overlays ou foco visível;
- páginas ou conteúdo das superfícies.

---

## 4. Não objetivos

C2 **não**:

- adiciona React Router;
- altera URL, history, deep-linking ou refresh semântico;
- cria Redux, Zustand ou store global;
- cria um roteador próprio paralelo ao controlador atual;
- move regras de pedidos para `domains/orders` — isso é C4;
- move regras de Comandas/Mesas — isso é C5;
- move pagamentos/financeiro — isso é C6;
- move clientes/produtos — C7/C8;
- move impressão/QZ — C9;
- reorganiza o engine de Settings — C3;
- refatora Worker, endpoints ou D1;
- renomeia IDs de destino;
- cria feature de perfis/permissões;
- transforma a C2 em limpeza geral de `App.jsx`.

Qualquer oportunidade fora desses limites deve ser registrada para a slice correspondente, não incorporada oportunisticamente.

---

## 5. Decisão arquitetural

Foram considerados três caminhos:

1. **Movimentação mecânica apenas:** mover arquivos para as novas pastas, mantendo `App.jsx` como dono de toda a composição. Risco baixo, mas não completa o objetivo de C2.
2. **Extração equilibrada — aprovada:** criar fronteiras reais de shell/navigation, centralizar metadados de navegação, adicionar contrato pequeno de navegação e introduzir `AppRoot` de apresentação global, sem mover workflows de domínio.
3. **Extração agressiva:** criar registry de superfícies e retirar grande parte das páginas/workflows de `App.jsx` imediatamente. Foi rejeitada porque invade C3-C9 e ampliaria o risco de regressão.

A C2 usa a opção 2.

---

## 6. Arquitetura-alvo da C2

A estrutura desejada ao final da slice é conceitualmente:

```text
src/
  App.jsx

  app/
    runtime/
      ...                    # preservado de C1

    shell/
      AppRoot.jsx
      AppShell.jsx
      Sidebar.jsx
      MobileNavigation.jsx

    navigation/
      registry.js
      resolution.js
      useNavigationController.js
      NavigationContext.jsx
      useNavigationEventBridge.js
      queryContext.js
      useQueryContext.js
      settingsDraftGuard.js
      AreaNavigation.jsx
```

Os nomes podem sofrer pequeno ajuste no plano se o dependency map revelar conflito objetivo, mas as responsabilidades abaixo são normativas.

### 6.1 `App.jsx`

Permanece como **orquestrador transitório** dos workflows ainda não migrados em C3-C9.

Durante C2 ele:

- continua instanciando runtimes necessários;
- continua coordenando handlers de domínio ainda legados;
- continua conhecendo o `activeTab` quando isso é necessário para comportamento já existente, como polling da Cozinha;
- fornece o valor do contrato de navegação para a árvore;
- não deve voltar a absorver lógica extraída para `app/navigation` ou `app/shell`.

C2 não mede sucesso pelo número de linhas removidas de `App.jsx`.

### 6.2 `AppRoot.jsx`

`AppRoot` é um componente **de apresentação/composição global**, não um novo runtime monolítico.

Ele deve ser responsável somente por montar, a partir de props/contratos já calculados:

- banner offline;
- estado de verificação de sessão;
- Login quando anônimo;
- estado de bootstrap loading/error/retry;
- feedback global (toast e success overlay);
- shell autenticado quando o bootstrap está pronto.

Ele **não** recebe coleções de domínio nem implementa handlers de pedidos, clientes, produtos, pagamentos, finance, comandas, settings ou impressão.

A intenção é retirar do `App.jsx` a decisão visual de alto nível sem simplesmente mover o monólito para outro arquivo.

### 6.3 `AppShell.jsx`

É dono apenas da moldura autenticada:

- Sidebar;
- conteúdo principal focável;
- MobileNavigation;
- DashboardPeriodProvider enquanto esse provider continuar sendo preocupação transversal da composição atual;
- transição visual ao trocar de destino.

O bridge `app:navigate` deve sair do shell e ir para navegação, pois é mecanismo de navegação e não responsabilidade visual do shell.

### 6.4 `app/navigation/registry.js`

É a fonte declarativa única da estrutura de navegação.

Deve concentrar, sem duplicação dispersa:

- destinos conhecidos;
- área de cada destino;
- label;
- capability/anyCapability;
- mobile entry;
- candidatos/fallbacks de área;
- grupos e entradas desktop;
- entradas mobile diretas;
- entradas do `Mais`;
- metadados estritamente necessários para a ordem da animação mobile.

Não deve conter regras de domínio nem callbacks React.

Entradas por **área** continuam distintas de destinos explícitos. Clicar em `Pedidos`, `Financeiro` ou `Configurações` resolve o primeiro destino acessível da área conforme a ordem atual; um destino explícito negado continua negado e não faz fallback silencioso.

### 6.5 `app/navigation/resolution.js`

Mantém funções puras derivadas do registro:

- `resolveArea()`;
- `resolveDestination()`;
- `decideNavigation()`;
- resolução de home quando aplicável.

A separação entre registro e resolução evita que componentes visuais recriem regras.

### 6.6 `useNavigationController.js`

Continua sendo o único owner do estado transitório de navegação:

- `activeTab`;
- `moreOpen`;
- intenção pendente de descarte;
- resolução de targets;
- confirmação/cancelamento de navegação;
- reset por nova sessão;
- `completeNavigation()`.

C2 reorganiza sua localização e dependências, mas não muda suas decisões funcionais.

### 6.7 `NavigationContext.jsx`

Será um contexto pequeno, deliberadamente limitado a navegação.

Pode expor somente o que é necessário para consumidores de navegação, por exemplo:

- `activeTab`;
- `activeMobileEntry` quando aplicável;
- `granted` e `implemented` enquanto fazem parte da resolução de navegação;
- `moreOpen`;
- `requestNavigation()`;
- `openMore()`;
- `closeMore()`.

Estados de confirmação que permanecem necessários ao `App.jsx` podem continuar sendo consumidos diretamente do controller em C2; não precisam ser colocados no contexto só para “completar” uma API.

É proibido colocar no contexto:

- `orders`, `clients`, `products`, `tables`, `movements`;
- settings resources;
- printing manager;
- dados de pagamento;
- handlers CRUD de domínio;
- feedback global;
- sessão/bootstrap completos.

Ou seja: `NavigationContext` não substitui `App.jsx` como mega-contexto.

### 6.8 `useNavigationEventBridge.js`

O listener de `window.addEventListener('app:navigate', ...)` sai de `AppShell` e vira um bridge explícito de navegação.

O bridge:

- chama `requestNavigation(event.detail)` somente quando `detail` é uma string válida para o controller;
- registra um único listener por montagem;
- limpa o listener no unmount;
- não cria novo formato de evento.

O evento permanece por compatibilidade; removê-lo ou mudar seu contrato fica fora da C2.

### 6.9 Query context

`queryContext.js` e `useQueryContext.js` passam para `app/navigation/` porque representam continuidade de navegação/superfície por sessão, não dados oficiais de domínio.

Devem preservar exatamente:

- campos existentes;
- allowlist de patches por página;
- isolamento entre páginas;
- reset de sessão;
- invalidação de callback antigo por generation.

Nenhum estado oficial de entidades entra nesse contexto.

### 6.10 `settingsDraftGuard.js`

O mapeamento atualmente mantido em `App.jsx` para identificar o draft de settings associado a cada destino é mecanismo de **guard de navegação**, não regra de edição do recurso.

C2 pode extrair apenas o adaptador necessário para responder:

> “o destino atual possui draft sujo cuja saída exige confirmação?”

O estado, save, conflict, reconcile e discard continuam pertencendo aos controllers atuais até C3.

Essa extração não move o engine de Settings nem muda sua semântica.

---

## 7. Componentes de navegação

### 7.1 Sidebar

`Sidebar` muda de localização para `app/shell/` e deixa de manter uma definição própria da árvore de navegação.

Ele consome:

- registro declarativo;
- resolução pura;
- contrato de navegação.

Deve renderizar exatamente os mesmos grupos, labels, ícones, estado ativo e logout existentes.

### 7.2 MobileNavigation

`MobileNavigation` também deixa de manter arrays paralelos de entradas.

Deve preservar:

- Pedidos, Comandas e Financeiro como entradas diretas quando permitidas;
- `Mais` como bottom sheet;
- mesmas entradas dentro de `Mais`;
- mesmo estado ativo;
- mesmo logout;
- mesmo fechamento do sheet após navegação;
- mesma resolução por capability.

### 7.3 AreaNavigation

`AreaNavigation` passa para `app/navigation/` e usa o mesmo registro/resolução.

Seu contrato visual permanece:

- área como entrada;
- destinos permitidos na ordem atual;
- `aria-current` na aba ativa;
- mesmo callback de navegação por destino.

Não alterar aparência nesta slice.

---

## 8. Fluxo de dados e controle

### 8.1 Inicialização

```text
main.jsx
  ↓
App
  ├─ runtimes C1
  ├─ query/navigation controller
  ├─ workflows ainda legados C3-C9
  ↓
AppRoot (composição global)
  ↓
NavigationContext.Provider
  ↓
AppShell
  ├─ Sidebar
  ├─ superfície ativa
  └─ MobileNavigation
```

A ordem concreta de wrappers pode variar para respeitar hooks existentes, mas as dependências devem permanecer unidirecionais.

### 8.2 Navegação

```text
Sidebar / Mobile / Area / app:navigate
  ↓
requestNavigation(target)
  ↓
resolution + guards
  ├─ rejeita / bloqueia
  ├─ abre confirmação de discard
  └─ atualiza activeTab
  ↓
App observa activeTab
  ├─ mantém sinais operacionais atuais
  └─ monta a superfície correspondente
```

### 8.3 Sessão

Ao logout/expiração/nova sessão:

- `resetNavigation()` mantém o comportamento atual;
- `resetQueries()` mantém o comportamento atual;
- callbacks antigos de query continuam inválidos;
- não persiste activeTab em storage/URL;
- home é recalculada pelas capabilities da sessão.

---

## 9. Compatibilidade e migração

### 9.1 Sem facade permanente nova

A preferência é atualizar consumidores da navegação para os novos caminhos dentro da própria C2.

Só é aceitável manter reexport temporário de caminho legado se um consumidor fora do escopo não puder ser migrado com segurança no mesmo slice. Nesse caso:

- a facade deve ser registrada em `docs/superpowers/qa/spec-c-compatibility-facades.md`;
- deve ter slice de remoção explícita;
- não pode virar API permanente por conveniência.

### 9.2 Arquitetura gate

O gate criado na C1 permanece obrigatório.

C2 deve adicionar contratos de arquitetura/extração apenas se necessários para impedir regressão concreta, por exemplo:

- shell não reintroduzir registro duplicado de destinos;
- componentes de shell não importarem páginas/domínios para decidir navegação;
- `App.jsx` não voltar a definir metadados de menus já extraídos.

Não criar regras genéricas sem necessidade observada.

---

## 10. Estratégia de testes

C2 usa TDD/characterization antes de cada extração comportamental.

### 10.1 Contratos puros

Cobrir no mínimo:

- todos os IDs atuais;
- ordem de fallback de Pedidos, Financeiro e Configurações;
- destino explícito negado/desconhecido/indisponível;
- mesma lista/grupo desktop após filtragem por capability;
- mesmas entradas mobile diretas e `Mais`;
- mesma ordem usada na transição mobile.

### 10.2 Controller/navigation context

Cobrir:

- home inicial;
- bloqueio durante checkout;
- pedido sujo e confirmação;
- cancelamento de discard;
- settings dirty entre recursos;
- settings dirty dentro do mesmo recurso/destinos associados;
- `completeNavigation()`;
- `moreOpen` abre/fecha e fecha após navegação;
- reset de sessão;
- contexto não expõe dados de domínio.

### 10.3 Query continuity

Preservar os testes existentes e cobrir os imports após a mudança de pasta:

- query sobrevive à troca de páginas;
- páginas não contaminam queries umas das outras;
- reset limpa queries;
- callback capturado antes do reset não altera a nova sessão.

### 10.4 Shell e bridges

Caracterizar:

- `app:navigate` encaminha para o controller e limpa listener ao desmontar;
- troca de destino move foco para `.app-content`;
- direção de transição continua `forward`/`backward` conforme ordem atual;
- `activeMobileEntry` do Novo Pedido mantém a entrada de origem ativa;
- Sidebar e MobileNavigation resolvem capabilities igualmente.

### 10.5 AppRoot

Cobrir os estados globais sem depender de regras de domínio:

- checking;
- anonymous online/offline;
- bootstrap loading;
- bootstrap error + retry;
- ready monta shell;
- toast/success continuam renderizados globalmente.

### 10.6 Regressões proporcionais

Além dos testes novos, C2 deve executar regressões existentes relacionadas a:

- `navigation.test.js`;
- `navigationContext.test.js`;
- `queryContext.test.js`;
- `AppNewOrderGuard.test.js`;
- Settings navigation/discard tests;
- mobile navigation tests existentes;
- action capability/navigation tests afetados.

Antes de homologação: suíte completa + architecture + lint + build + D1 local, conforme rollout.

---

## 11. Homologação manual esperada

O plano detalhado deve fechar uma matriz manual proporcional. No mínimo:

1. login e home continuam iguais;
2. Sidebar desktop abre cada área/destino permitido;
3. fallback de área continua correto quando capability principal não existe;
4. navegação mobile direta continua correta;
5. `Mais` abre, navega e fecha corretamente;
6. navegação interna de Pedidos, Financeiro e Settings continua correta;
7. busca/filtros permanecem ao trocar de página e somem após nova sessão;
8. Novo Pedido retorna para a origem correta;
9. pedido sujo mantém confirmação de descarte;
10. checkout em andamento continua bloqueando saída;
11. Settings dirty mantém confirmação sem criar bloqueio novo durante saving/unconfirmed;
12. foco e animação de troca de página continuam equivalentes;
13. Cozinha continua ativando polling dedicado e sair dela continua desativando-o;
14. `app:navigate` continua funcionando onde ainda utilizado;
15. desktop/mobile e light/dark sem regressão visual atribuível a C2.

A matriz final pode adicionar casos descobertos durante o dependency map, mas não pode remover invariantes relevantes sem justificativa registrada.

---

## 12. Release e segurança

C2 segue o mesmo modelo de release da Spec C:

- branch própria a partir da `master` pós-C1;
- implementação nunca diretamente na `master`;
- commits pequenos e revisáveis;
- PR própria da C2;
- gates completos antes de staging;
- deploy de staging por `workflow_dispatch` no SHA exato a homologar;
- homologação manual antes de merge;
- merge somente após aprovação explícita;
- produção somente com autorização explícita após merge e validação da nova `master`.

Não adicionar trigger amplo `feature/**` ao staging.

---

## 13. Critérios de aceite da C2

C2 está pronta para decisão de merge apenas quando:

- shell/navigation estão nos ownerships previstos;
- registro de navegação não permanece duplicado entre Sidebar/Mobile/Area;
- `NavigationContext` é pequeno e não contém estado de domínio;
- `AppRoot` é de composição, não um monólito renomeado;
- `App.jsx` não ganhou nova responsabilidade de navegação;
- todas as invariantes da seção 3 permanecem verdes;
- testes focados e regressões passam;
- `npm test` passa;
- `npm run lint` passa;
- `npm run test:architecture` passa;
- `npm run build` passa;
- `npm run d1:migrate:local` passa;
- diff final é revisado contra esta spec;
- staging manual passa no SHA final executável;
- matriz manual C2 é registrada com evidência real;
- compatibilities novas, se inevitáveis, estão registradas com remoção futura;
- nenhuma mudança de Worker/D1/produção foi feita sem necessidade e autorização.

---

## 14. Dependência para C3

C3 só começa depois de C2 homologada, aprovada e mergeada.

A C2 deve entregar para C3:

- navegação estável fora de `App.jsx`;
- guard de saída de Settings com fronteira explícita;
- `AreaNavigation` e shell consumindo contrato comum;
- query/navigation ownership já definido;
- nenhuma mudança no engine de Settings que C3 precise desfazer.

C3 então poderá mover a superfície Settings e o engine versionado sobre uma composição já estabilizada.
