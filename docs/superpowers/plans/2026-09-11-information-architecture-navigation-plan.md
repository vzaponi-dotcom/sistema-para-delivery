# Spec A — Plano de implementação da informação e navegação

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:executing-plans`, uma tarefa por execução. Não iniciar a tarefa seguinte nem abrir rodadas automáticas de subagentes/revisores. Checkboxes registram execução, não autorização de merge/deploy.

**Goal:** Entregar somente a navegação e os ajustes de atendimento aprovados na Spec A.
**Architecture:** Registro único de destinos/capacidades; contexto de consulta e gravações de configuração acima das páginas remontadas. Dados oficiais, reconciliação e impressão continuam nos donos atuais. Extrações limitadas aos arquivos e funções deste plano.
**Tech Stack:** React/Vite, Worker/D1, Node 22 e ferramentas do lockfile atual; `node:test` e harness React existente. Sem atualização de dependências.
**Spec:** `docs/superpowers/specs/2026-09-11-information-architecture-navigation-design.md`, **revisão 2.1**, commit `cc43a6914f92a8af722d413d7e06c256ba68b88d`, blob `c2195742d18c52805a9430ee3f75122529ad73fe`.
**Base de aplicação:** `99c1f04677b54243a43d470b743cdd16ac499154`.
**Estado:** plano para aprovação; nenhuma tarefa executada nesta entrega. Substitui o rascunho que apontava para a revisão 2. A spec não é modificada por este plano.

## 1. Limites obrigatórios

- “Não trabalhar diretamente em master.” “Não há autorização de deploy ou de merge em produção.”
- “Não adicionar Redux, Zustand, React Router, migração para TypeScript, nova API, migrations ou atualização de dependências como requisito incidental de A.”
- **T1 é separado:** `docs/superpowers/plans/2026-09-11-table-transfer-identity-plan.md`. Só essa tarefa modifica o contrato de transferência, em PR próprio.
- Não implementar B/C/D, perfis reais, editor de permissões, políticas editáveis, categorias novas, busca no Histórico, filtros em Movimentações, saldo inicial novo ou redesign dos tickets.
- Não alterar fórmulas, prazos, elegibilidade do servidor, modelo de pagamentos, polling, vias, recovery ou transporte físico. Tema/som continuam locais.
- **Configurações permite sair durante salvamento.** Preservar a pendência fora da página e bloquear somente a edição conflitante do recurso; não introduzir guarda global de navegação por salvamento.
- Cada tarefa tem lista de arquivos de produção autorizados. Ajustes em testes existentes só podem acompanhar assinatura, propriedade, título ou comportamento explicitamente alterado; preservar as outras asserções. Nenhuma limpeza oportunista.
- Se faltar um arquivo de produção, endpoint, dependência ou decisão de produto: informar caminho, motivo e critério afetado; parar a tarefa dependente. Não ampliar a lista por conta própria, nem reabrir a arquitetura inteira.
- Uma tarefa: **RED focado → alteração mínima → GREEN e regressões afetadas → uma conferência do diff → commit/push → parar**. Não rodar a suíte completa após cada edição.
- Revisão independente somente ao fechar T1 e ao fechar A. Reexaminar apenas correções de falhas concretas; não criar revisão da revisão. Gates existentes não podem ser removidos.
- Não continuar automaticamente: o usuário escolhe a próxima tarefa. Ao atingir o aceite, encerrar; melhorias opcionais ficam fora.

## 2. Ordem e checkpoints

| Etapa | Entrega | Dependência | Parada |
|---|---|---|---|
| T1 | Transferência presa à comanda confirmada | Base validada | PR separado, testes e autorização de integração |
| A1 | Registro de navegação/capacidades | T1 incorporado à base | Commit testado, sem novos menus |
| A2 | Navegação e consultas por sessão | A1 | Estado controlado, sem redesign |
| A3 | Configurações existentes com salvamento independente da página | A2 | Dois destinos funcionais |
| A4 | Visão geral financeira e análise no Histórico | A2; executar depois de A3 | Cálculos preservados |
| A5 | Menus desktop/mobile e navegação interna | A1–A4 | Experiência aprovada conectada |
| A6 | Transferência em Comandas e seleção por atendimento | T1 e A5 | Fluxo operacional conectado |
| A7 | Recebimento avulso pelos detalhes | A5/A6 | Pagamento central reutilizado |
| A8 | Capacidades nas ações existentes | A1–A7 | Casos reduzidos testados |
| A9 | Regressão final e homologação | T1/A1–A8 | Evidências e parada antes de produção |

São **T1 + nove tarefas de A**, não dez PRs obrigatórios. Usar um PR exclusivo de T1 e um PR de entrega de A com commits pequenos. Não trabalhar em `App.jsx` em paralelo. A ordem é sequencial para facilitar alternar Codex e ChatGPT.

Depois da aprovação deste plano, criar `integration/spec-a-navigation` a partir do HEAD remoto conferido de `docs/information-architecture-navigation`. Verificar que, além dos documentos, a base não contém mudanças inesperadas. Criar `fix/table-transfer-identity` na mesma base, com worktree nova. O PR de T1 aponta para a integração; merge só após autorização. Em seguida, A1–A9 usam worktree nova da integração já contendo T1. Criar o PR para `master` no fechamento de A, sem merge automático.

Antes de retomar: conferir branch, HEAD, upstream e `git status --short`; atualizar referências com `git fetch origin`. Worktree inesperadamente suja/divergente é bloqueio, não convite a limpar. Proibidos `reset`, `restore`, `clean`, `stash` e `push --force` nas worktrees antigas. Não substituir diretórios existentes.

Instalação/linha de base fazem parte da primeira execução, não de uma tarefa extra:
```powershell
node --version
npm ci
npm test
```
Executar somente na nova worktree. Node deve ser 22 com suporte a `node:sqlite`, como exigido pelos testes existentes. Registrar falhas anteriores antes de editar. Outra worktree precisa de instalação, não de nova auditoria arquitetural.

## 3. Arquivos e contratos fechados

| Arquivo novo | Única responsabilidade |
|---|---|
| `src/app/access.js` | Capacidades da interface e adaptação explícita da sessão legada. |
| `src/app/navigation.js` | Registro estático e decisões puras de destino/bloqueio. |
| `src/app/queryContext.js`, `src/app/useQueryContext.js` | Campos exatos da matriz 9.1 da spec; sem entidades. |
| `src/app/useNavigationController.js` | Página, Mais, intenção de descarte e reset. |
| `src/app/usePrintingSettingsController.js` | Leituras/gravações e feedback de configurações de impressão na sessão. Não é store genérico nem engine de impressão. |
| `src/components/PrintingSettingsContent.jsx`, `src/pages/Settings.jsx` | Conteúdo existente e composição de impressão/preferências. |
| `src/components/OperationalHistoryAnalysis.jsx` | Seção de análise extraída do Dashboard. |
| `src/components/AreaNavigation.jsx`, `src/area-navigation.css` | Navegação interna com aparência de abas e composição mínima. |
| `src/utils/orderPaymentEligibility.js` | Elegibilidade da entrada avulsa, sem cálculos. |

Testes novos são indicados nas tarefas. Reutilizar `workspaceHarness(t)`, `h.load(path)`, `h.render(Component, props)`, `buttonNamed`, `nodeText` de `src/test-support/renderWorkspace.js`, e fixtures existentes. Não criar outro framework. Exemplos abaixo são testes/contratos para implementação futura, não resultados executados.

**Capacidades.** `hasCapability(granted, key)` aceita somente chaves conhecidas de um `Set<string>`. `legacyCapabilities(authenticated)` concede o conjunto explícito atual apenas no adaptador da sessão autenticada. `App({capabilities})` admite injeção de teste; `undefined` usa o adaptador, conjunto vazio não. Sem seletor, URL ou storage de cargos.

Consultas: `orders.view`, `orders.history`, `orders.analysis`, `comandas.view`, `printing.queue`, `finance.overview`, `finance.receivables`, `finance.movements`, `clients.view`, `products.view`, `tables.view`, `printing.settings`, `preferences.local`.
Ações: `orders.create`, `orders.finalize`, `orders.cancel`, `orders.discount`, `payments.receive`, `payments.refund`, `comandas.transfer`, `clients.manage`, `products.manage`, `tables.manage`, `finance.movements.manage`, `finance.promises.manage`, `printing.execute`, `printing.discard`, `printing.station.configure`.
Não criar novas ações para utilizar uma capacidade. Selecionar catálogo/cliente/mesa no atendimento não exige permissão de editar cadastro. Cancelamento com estorno exige ambas as capacidades correspondentes; desconto/acréscimo exige `orders.discount`.

**Navegação.** IDs atuais permanecem; acrescentar apenas `settings-printing` e `settings-device`. `settings-printing` abre com `printing.settings` ou `printing.station.configure`; cada controle exige sua capacidade. `new-order` não é item de menu. Análise exige `orders.history` e `orders.analysis`.
`resolveArea(area, granted, implemented)` retorna ID ou `null`: `orders` → `orders, history`; `finance` → `dashboard, receivables, finance`; `settings` → `settings-printing, settings-device`.
`resolveDestination(id, granted, implemented)` retorna `{status:'allowed', id}` ou `{status:'unknown'|'denied'|'unavailable'}`. ID explícito negado não vira outro ID; fallback só resolve entrada de área/home.
`decideNavigation({allowed, checkoutPending, dirtyOrder, leavingOrder})` retorna `reject`, `blocked`, `confirm` ou `navigate`, nessa precedência. Não recebe `settingsPending`: gravação não bloqueia navegação.
`useNavigationController({granted, implemented, checkoutPending, dirtyOrder, onDiscardOrder, onFeedback})` fornece `activeTab`, `moreOpen`, `pendingDestination`, `requestNavigation(target)`, `openMore()`, `closeMore()`, `confirmDiscard()`, `cancelDiscard()`, `resetNavigation()` e `completeNavigation(id)` para retorno de operação aceita na sessão atual. `target` é ID ou `{area}`. `completeNavigation` também valida destino/capacidade, mas não pede descarte de um pedido já salvo. Sem destino: estado sem acesso e Sair.

**Consultas.** `createQueryContext()` cria só a matriz 9.1; `patchQueryContext(state,page,patch)` só muda a página indicada. `useQueryContext()` fornece `{query,patchQuery(page,patch),resetQueries()}`. Páginas controladas recebem `queryState` e `onQueryChange(patch)`. Atualizações capturam geração da sessão; reset invalida callbacks antigos. Seleção de comanda/pagamentos mantém os donos existentes de `App`.

**Configurações.** `usePrintingSettingsController({authenticated,sessionKey,printing,granted,onFeedback})` é montado uma vez no App autenticado, acima da página. `sessionKey` é o token estável do ciclo autenticado (não apenas `businessId`); muda em logout/expiração/nova sessão, não a cada render. Fornece `resources`, `reload(resource)`, `saveCopies(value)`, `saveStation(patch)`, `makePrimary(stationId)`, `selectPrinter(name)`. Recursos fechados: `business-copies`, `station-config` e `local-printer`, limitados ao negócio/estação da sessão. `station-config` inclui seleção principal porque ela conflita com a atualização da estação. Estado por recurso: `status:'idle'|'loading'|'saving'|'error'|'unconfirmed'`, `confirmedValue`, `error`, contador de revisão e dono `{sessionKey,operationId}`. Sem motor genérico, persistência nova ou segundo polling.

## A1 — Registro de navegação e capacidades

**Criar:** `src/app/access.js`, `src/app/navigation.js`, `src/app/navigation.test.js`. **Nenhuma página/CSS/API.**
**Entrega:** contratos puros da seção 3, sem substituir menus.

- [ ] RED: áreas, IDs negados/desconhecidos, conjunto vazio, defaults e bloqueios. Teste inicial:
```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveArea, resolveDestination, decideNavigation } from './navigation.js'
test('financeiro sem dashboard e salvamento fora da guarda de navegação', () => {
  const caps = new Set(['finance.receivables'])
  const pages = new Set(['dashboard','receivables','finance'])
  assert.equal(resolveArea('finance', caps, pages), 'receivables')
  assert.equal(resolveDestination('dashboard', caps, pages).status, 'denied')
  assert.equal(resolveArea('finance', new Set(), pages), null)
  assert.equal(decideNavigation({allowed:true,checkoutPending:false,
    dirtyOrder:false,leavingOrder:false}), 'navigate')
})
```
- [ ] Rodar `node --test src/app/navigation.test.js`; confirmar falha esperada, não ambiente quebrado.
- [ ] Implementar registro/avaliadores conforme seção 3, sem permissões implícitas. `implemented` contém só destinos conectados; ordem estável após filtragem. Mais preserva ações de sessão.
- [ ] GREEN no mesmo comando + `npm run lint`. Uma conferência de diff. Commit `feat: define scoped navigation contracts`, push e parar.
**Aceite:** A16/A17 e base de A29. Nada de perfis reais ou novas regras.

## A2 — Estado de navegação e consultas por sessão

**Criar:** `src/app/queryContext.js`, `src/app/useQueryContext.js`, `src/app/useNavigationController.js`, `src/app/queryContext.test.js`, `src/navigationContext.test.js`.
**Alterar:** `src/App.jsx`, `src/components/AppShell.jsx`, `src/components/DashboardPeriodProvider.jsx`; páginas `Dashboard.jsx`, `OrderHistory.jsx`, `Receivables.jsx`, `Products.jsx`, `PrintQueue.jsx` em `src/pages/`.
**Entrega:** hooks da seção 3 e páginas controladas; sem redesign. A entrada passa a Cozinha; A5 aplica os menus novos.

- [ ] RED de isolamento/reset e de navegação/retorno com componentes reais. Teste puro inicial:
```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createQueryContext, patchQueryContext } from './queryContext.js'
test('períodos separados e reset', () => {
  const initial = createQueryContext()
  const next = patchQueryContext(initial, 'dashboard', {period:'7d'})
  assert.equal(next.dashboard.period, '7d')
  assert.equal(next.history.analysisPeriod, '30d')
  assert.equal(createQueryContext().dashboard.period, '30d')
  assert.equal(Object.hasOwn(next, 'ordersData'), false)
})
```
- [ ] Rodar `node --test src/app/queryContext.test.js src/navigationContext.test.js`; registrar RED.
- [ ] Integrar controlador acima de `key={activeTab}`, substituindo apenas o dono atual da navegação/guarda. Sem activeTab duplicado. `app:navigate`, retornos de checkout e reset usam o contrato comum, sem descartar pedido aceito.
- [ ] Migrar só campos da matriz 9.1: Cozinha/search; Histórico/filter e analysisPeriod; Dashboard/period e valuesVisible; Clientes/search e sort; Produtos/search e categoryFilter; A receber/search, activeView, timingFilter, sortMode, exactDateFilter e selectedEntryKey; Fila/cópia de `DEFAULT_PRINT_QUEUE_QUERY`. Padrões são os da spec. Seleção da entrada é chave resolvida contra dados atuais, não modal para reabrir. Comandas permanece no dono atual até A6. Sem filtros em Finance nem expansão persistente de Produtos.
- [ ] Preservar guards de leitura e invalidar callbacks no reset. `DashboardPeriodProvider` vira adaptador controlado, sem manter segundo período próprio. Movimentos/pedidos nunca entram no contexto visual.
- [ ] GREEN: `node --test src/app/queryContext.test.js src/navigationContext.test.js src/AppNewOrderGuard.test.js src/dashboardPeriodPersistence.test.js src/comandasAppWiring.test.js`; lint. Commit `refactor: preserve query context per session`, push e parar.
**Aceite:** A10/A12/A18/A27. Não inventar storage, abas ou queries novas.

## A3 — Configurações existentes e salvamento ao navegar

**Criar:** `src/app/usePrintingSettingsController.js`, `src/components/PrintingSettingsContent.jsx`, `src/pages/Settings.jsx`, `src/settingsNavigation.test.js`, `src/area-navigation.css` (composição).
**Alterar:** `src/components/PrintingSettings.jsx`, `src/App.jsx`, `src/pages/PrintQueue.jsx`, `src/printing/printing.css`.
**Exceção delimitada:** `src/printing/usePrintingManager.js`, somente ownership/retorno de `saveStationSettings`, `makePrimary`, `selectPrinter` e leituras de configuração acionadas por esses callbacks. Não mudar polling, elegibilidade, execução física, jobs, recovery ou assinatura pública já usada por outros consumidores.
**Entrega:** dois destinos de Configurações, usando o controlador fixo da seção 3. Sem bloquear navegação.

- [ ] RED montando o App: PUT de vias adiado; sair para Clientes e voltar; edição do recurso continua bloqueada; uma resposta antiga de GET não substitui o PUT. Cobrir estação, escolha local, sucesso fora da página, erro/resultado incerto e nova sessão. Teste inicial de intenção, junto dos testes montados:
```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { decideNavigation } from './app/navigation.js'
test('um salvamento de configuração não é um checkout', () => {
  assert.equal(decideNavigation({allowed:true,checkoutPending:false,
    dirtyOrder:false,leavingOrder:false}), 'navigate')
})
```
- [ ] Rodar `node --test src/settingsNavigation.test.js`; o RED deve vir dos cenários montados de pendência/retorno, não deste contrato já entregue em A1.
- [ ] Mover só estado/leitura/gravação da configuração para o novo hook. `PrintingSettingsContent({printing,settings,granted})` recebe o controlador por props; Settings recebe seção, controlador e callbacks atuais de tema/som. Wrapper modal delega ao mesmo conteúdo. Não montar segundo manager nem salvar a partir de efeitos de renderização.
- [ ] Usar `getPrintSettings/savePrintSettings` e callbacks existentes da estação. Revisão por recurso invalida GET anterior ao início da escrita; GET nova durante escrita não substitui o valor confirmado. Duplicata no mesmo recurso não envia. Concluir somente se sessão e token ainda forem donos; `finally` antigo não libera recurso de outra sessão.
- [ ] Classificação fechada: sucesso com resposta/valor confirmado libera; rejeição conclusiva de validação mantém último valor confirmado e informa erro; falha de transporte, timeout ou 5xx fica `unconfirmed`, faz uma reconsulta após a falha e só libera com leitura válida posterior. Reconsulta falhou: manter edição conflitante bloqueada e botão Reconsultar; nenhuma nova escrita automática. 401 encerra/invalida conforme fluxo atual. Não anunciar rollback de resultado incerto. Sem garantia nova de ordenação entre dispositivos.
- [ ] A estação usa leitura oficial existente (`getPrintStations`/refresh) e a impressora local a chave já existente. Falha de diagnóstico após salvar não deve ser declarada falha de persistência sem reconsulta. Se o manager aplicar estado antes de devolver o callback, proteger esse ponto estreito por geração; ignorar efeito/feedback antigo. Não basta guardar só o setState do novo hook.
- [ ] Conectar destinos/atalho da fila no App e então incluí-los em `implemented`. Tema/som conservam fonte local única; regra de mesa/uma via permanece. Feedback global identificado, sem redirecionar ou roubar foco; teste físico não impede saída.
- [ ] GREEN no arquivo novo + testes existentes de PrintingSettings/manager afetados + lint. Commit `feat: compose settings with session scoped saves`, push e parar.
**Aceite:** A06–A08/A18/A25. Sem política nova, store universal, novas chaves de storage ou transporte novo.

## A4 — Separar Visão geral de análise operacional

**Criar:** `src/components/OperationalHistoryAnalysis.jsx`, `src/operationalHistoryAnalysis.test.js`.
**Alterar:** `src/pages/Dashboard.jsx`, `src/pages/OrderHistory.jsx`, composição em `src/dashboard.css`/`src/area-navigation.css`; testes afetados, incluindo `src/dashboardFloatingAction.test.js`.
**Entrega:** `OperationalHistoryAnalysis({orders,period,onPeriodChange,now})`, sem fetch/cálculo novo.

- [ ] RED: mesma amostra/instante/período mantém média, extremos, faixas e grupos; filtrar Cancelados na lista não altera análise; períodos não se contaminam. `node --test src/operationalHistoryAnalysis.test.js`.
- [ ] Extrair JSX/mapeamentos operacionais, usando `calculateOperationalMetrics` sem alterar função. Receber pedidos oficiais antes do filtro da lista. Contrato:
```jsx
<OperationalHistoryAnalysis orders={orders} period={queryState.analysisPeriod}
  onPeriodChange={(analysisPeriod) => onQueryChange({analysisPeriod})} now={now} />
```
- [ ] Preservar `today/7d/30d`, início `30d`, faixas e amostra vazia. Explicitar que período se aplica só à análise. Seção requer `orders.history` + `orders.analysis`.
- [ ] Dashboard vira Visão geral, mantém indicadores/gráficos comerciais; retirar cartões/lista operacionais, seção de tempo e FAB de Novo pedido, sem inventar substitutos.
- [ ] GREEN no teste novo + regressões existentes de gráficos/período/FAB alteradas; lint. Commit `refactor: separate commercial and operational views`, push e parar.
**Aceite:** A09/A24. `src/utils/dashboardAnalytics.js`, dinheiro e prazos não são alterados.

## A5 — Aplicar menus desktop/mobile e navegação interna

**Criar:** `src/components/AreaNavigation.jsx`, `src/navigationLayout.test.js`.
**Alterar:** `src/components/Sidebar.jsx`, `src/components/MobileNavigation.jsx`, `src/components/AppShell.jsx`; `src/utils/mobileNavigation.js`, `src/App.jsx`, `src/pages/Orders.jsx`, `src/area-navigation.css`, `src/mobile-navigation.css`, `src/App.css`. `src/components/BottomSheet.jsx` somente para conectar foco/intenção, sem reescrever o modal.
**Entrega:** `AreaNavigation({area,activeTab,granted,implemented,onNavigate})`, consumindo A1/A2 e destinos reais A3/A4.

- [ ] RED para agrupamentos, quatro/três itens, destaque, fallback financeiro e descarte/foco. Exemplo de teste montado:
```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { workspaceHarness, buttonNamed } from './test-support/renderWorkspace.js'
test('Histórico não aparece sem capacidade', async (t) => {
  const h = await workspaceHarness(t)
  const {default: AreaNavigation} = await h.load('/src/components/AreaNavigation.jsx')
  const r = await h.render(AreaNavigation, {area:'orders',activeTab:'orders',
    granted:new Set(['orders.view']),implemented:new Set(['orders','history']),onNavigate:()=>{}})
  assert.ok(buttonNamed(r.root, 'Cozinha'))
  assert.equal(buttonNamed(r.root, 'Histórico'), undefined)
})
```
- [ ] Rodar `node --test src/navigationLayout.test.js`; confirmar RED.
- [ ] Lateral exatamente conforme seção 4 da spec. Mobile Pedidos/Comandas/Financeiro/Mais; Mais tem fila, cadastros, Configurações e Sair, sem Histórico/Financeiro repetidos. Grupos sem destinos somem, sem promoção automática ou quinta entrada. Remover tema do menu antigo; manter em Configurações.
- [ ] Usar nav/botões/`aria-current`, sem tabs ARIA incompletas, URLs ou animações novas. Renomear Impressão para Fila de impressão; substituir botão Histórico por navegação interna. Novo pedido da comanda destaca Comandas.
- [ ] Mais controlado por A2: destino válido fecha painel antes da confirmação; Cancelar/Escape limpa intenção; Confirmar revalida capacidade antes de descartar e navegar uma vez. Bloqueio de checkout não enfileira intenção. Foco só muda na troca efetiva, não em polling; preservar espaço da barra inferior.
- [ ] GREEN no arquivo novo + regressões de menus/guardas afetadas + lint/build. Commit `feat: apply approved operational navigation`, push e parar.
**Aceite:** A01–A05/A12/A16/A17/A19/A26/A28. Sem outra mudança de UX.

## A6 — Transferência em Comandas e seleção por atendimento

**Criar:** `src/comandasTransferNavigation.test.js`.
**Alterar:** `src/pages/Comandas.jsx`, `src/components/ComandaDetail.jsx`, `src/pages/Tables.jsx`, `src/App.jsx`, `src/comandasAppWiring.test.js`, ajustes mínimos em `src/comandas.css`.
**Entrega:** consumir `onTransfer(sourceTableId,destinationTableId,expectedTableTabId)` de T1; não modificar API nesta tarefa.

- [ ] RED: mesma comanda transferida acompanha destino; substituída/encerrada limpa seleção, detalhes e intenções; obrigação de pagamento aceito permanece. `node --test src/comandasTransferNavigation.test.js src/comandasAppWiring.test.js`.
- [ ] Adicionar ação em ComandaDetail e usar diálogo protegido. Em Mesas, Abrir comanda captura identidade mostrada:
```js
const target = {tableId: table.id, tableTabId: table.openTableTab.id}
```
  Validar ambos contra dados atuais antes de abrir. Se obsoleto, informar; não selecionar a substituta.
- [ ] Ajustar somente `applyOfficialTables`, geração/seleção e retorno de novo pedido necessários. Acompanhamento é por ID da comanda, não número da mesa. Limpar UI antiga não apaga `paymentSyncRef` de pagamentos aceitos. Origem inválida retorna ao espaço Comandas.
- [ ] Exigir `comandas.transfer` sem exigir `tables.manage`; erro atualiza leitura sem repetir POST. GREEN nos testes da tarefa e de transferência afetados; lint. Commit `feat: move protected transfers into service flow`, push e parar.
**Aceite:** A11–A14/A23/A27. T1 precisa ter commit e testes incorporados, não só mock.

## A7 — Recebimento avulso operacional

**Criar:** `src/utils/orderPaymentEligibility.js`, `src/utils/orderPaymentEligibility.test.js`, `src/operationalPayment.test.js`.
**Alterar:** `src/App.jsx`, `src/components/OrderDetail.jsx`, `src/pages/Orders.jsx`, `src/pages/OrderHistory.jsx`.
**Entrega:** `canReceiveStandaloneOrder(order,granted,source)`; `source` é `orders` ou `history` e exige a consulta correspondente + `payments.receive`; callback central `onRegisterPayment(orderId)`.

- [ ] RED: pendente em preparo/finalizado, pago/cancelado/mesa, consulta/recebimento ausentes, clique duplo, retorno, 409 e sessão antiga. Teste inicial:
```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { canReceiveStandaloneOrder } from './orderPaymentEligibility.js'
test('recebe pelo Histórico sem consulta financeira', () => {
  const caps = new Set(['orders.history','payments.receive'])
  const order = {id:'p1',type:'Entrega',status:'Finalizado',paymentStatus:'Pendente'}
  assert.equal(canReceiveStandaloneOrder(order, caps, 'history'), true)
  assert.equal(canReceiveStandaloneOrder({...order,tableTabId:'tab1'}, caps, 'history'), false)
  assert.equal(canReceiveStandaloneOrder({...order,paymentStatus:'Pago'}, caps, 'history'), false)
  assert.equal(canReceiveStandaloneOrder(order, new Set(['payments.receive']), 'history'), false)
})
```
- [ ] Rodar `node --test src/utils/orderPaymentEligibility.test.js src/operationalPayment.test.js`; confirmar RED.
- [ ] Resolver detalhe e pagamento pelo ID nos dados oficiais, não pelo objeto antigo. Acionar Registrar pagamento fecha detalhe e abre diálogo central; guardar origem e geração da sessão. Rede/envio bloqueia; double-click não repete. Sucesso aplica efeitos centrais e preserva página/filtros; cancelar não reabre detalhe.
- [ ] Guardar alvo/token antes do await. Resposta de outro atendimento/sessão não fecha o novo diálogo nem altera seus dados; resposta aceita da sessão atual reconcilia mesmo após navegar. Erro 409/resultado incerto não gera pago otimista nem retry de POST; usar leitura oficial existente. Excluir `tableTabId`, identidade `table` e Local, inclusive legados. A receber conserva seu acesso central; comanda continua integral.
- [ ] GREEN nos testes novos + `src/comandasAppWiring.test.js`; lint. Commit `feat: expose operational standalone payment`, push e parar.
**Aceite:** A14/A21/A22/A18. Sem carteira nova, pagamentos parciais ou cálculo novo.

## A8 — Ligar capacidades às ações existentes

**Criar:** `src/actionCapabilities.test.js`.
**Alterar somente props, visibilidade/disabled e guardas:** `src/App.jsx`; páginas em `src/pages/`: `Orders.jsx`, `OrderHistory.jsx`, `Clients.jsx`, `Products.jsx`, `NewOrder.jsx`, `Receivables.jsx`, `Finance.jsx`, `Tables.jsx`, `Comandas.jsx`, `PrintQueue.jsx`; componentes em `src/components/`: `NewOrderReviewStep.jsx`, `ComandaDetail.jsx`, `ReceivableDetail.jsx`, `OrderDetail.jsx`, `CancelOrderDialog.jsx`, `PrintingSettingsContent.jsx`; `src/app/usePrintingSettingsController.js` só para guarda das capacidades. Nenhuma regra/API/controller é reescrita.
**Entrega:** o mesmo conjunto de ações, com disponibilidade explícita no ponto de entrada e handler de UI.

- [ ] RED com componentes reais: receber sem Financeiro; ler sem editar; montar pedido sem editar catálogo; Histórico sem análise; preferências sem políticas; área sem subdestino padrão; desconhecida/vazia. `node --test src/actionCapabilities.test.js`.
- [ ] Espelhar capacidade no controle e no handler antes de enviar; padrão:
```js
if (!hasCapability(granted, 'products.manage')) return false
```
  O teste injeta spy, tenta a ação pelo callback guardado e verifica zero chamadas. Não inferir acesso a partir de botão escondido.
- [ ] Aplicar as chaves fechadas da seção 3 aos CRUDs/ações correspondentes. Pedido sem `orders.discount` não mostra nem aceita ajuste pela entrada de UI; cancelar com estorno também exige `payments.refund`. Preferências locais independem de política global. Sem limpar campos já confirmados nem modificar validação do servidor.
- [ ] `printing.execute` protege solicitações manuais/reimpressão/retry/priorização/teste; `printing.discard` descarte; `printing.settings` vias; `printing.station.configure` estação/impressora. Somente entradas manuais: não interceptar heartbeat, consumo automático, recovery ou confirmação física do job atual. Não oferecer segurança real por perfil.
- [ ] GREEN no teste novo + testes diretamente afetados; lint. Commit `feat: wire explicit UI action capabilities`, push e parar.
**Aceite:** A16/A17/A29 e complementos de A21. Capacidade desconhecida não invalida outras conhecidas; vazio nunca recebe fallback completo.

## A9 — Regressão final e uma homologação conjunta

**Criar:** `src/navigationContinuity.test.js`, `docs/superpowers/qa/2026-09-11-spec-a-acceptance.md`.
**Alterar:** `src/test-support/renderWorkspace.js` somente para contagem de listeners/timers e foco. Ajustes da aplicação apenas para falha demonstrada, dentro dos arquivos/objetivos das tarefas anteriores.

- [ ] Testar dez ciclos Cozinha/Configurações/Clientes/Comandas com rede/visibilidade controladas: consumidores globais não crescem; efeitos de página são limpos; nenhum pagamento/envio físico extra. Cobrir salvamento fora da página, reconciliação aceita e sessão antiga. Rodar `node --test src/navigationContinuity.test.js src/comandasAppWiring.test.js`; corrigir só falha demonstrada com RED/GREEN.
- [ ] Rodar os gates completos no HEAD candidato e registrar a evidência:
```powershell
npm test
npm run lint
npm run build
npx --yes wrangler@4.128.0 deploy --dry-run
npx --yes wrangler@4.128.0 deploy --dry-run --env staging
npm run d1:migrate:local
git diff --check
```
- [ ] Uma revisão final de diff contra A01–A30/T1: aceitar somente correção de requisito, regressão, integridade ou segurança. Preferência de estilo não abre tarefa. Depois de corrigir falha, retestar o afetado; o HEAD final ainda precisa ter os gates aplicáveis verdes, sem segunda auditoria completa.
- [ ] Commit/push das mudanças e evidências automatizadas; criar PR draft de A. **Parar para autorização de staging**, sem alterar workflows. Após autorizado, usar workflow/runbook existente, com branch/SHA/D1 de staging conferidos. O workflow de validação não dispara por todo PR para integração: ausência de CI não significa aprovado; usar evidência local ou dispatch do workflow existente quando autorizado.
- [ ] Uma homologação combinada: desktop/mobile, claro/escuro, teclado, rascunho, consultas, transferência em duas sessões, recebimento, falha/salvamento e impressão física de 1/2 vias/recovery. Só estação de testes; não consumir fila de produção. Falha abre correção localizada e reteste afetado, não rodada de melhorias.
- [ ] QA registra resultado ou pendência real para cada A01–A30, SHA e evidência T1. Sem ambiente/impressora, marcar teste físico pendente, nunca “passou”. Commit `test: record spec A acceptance`, push e parar; nenhum merge/deploy de produção.
**Aceite:** A15/A19/A20/A30 e evidências finais. Implementação e homologação têm estados separados.

## 4. Rastreabilidade e passagem de tarefa

| Critérios | Dono |
|---|---|
| A01–A05 | A2/A5 |
| A06–A08, A25 | A3 |
| A09, A24 | A4 |
| A10, A18 | A2; respostas antigas também A3/A7/A9 |
| A11, A13, A23 | T1/A6 |
| A12 | A2/A5/A6 |
| A14, A21, A22 | A7; regressões A6/A9 |
| A15, A20, A30 | A9 e limites globais |
| A16, A17, A29 | A1/A5/A8 |
| A19, A26, A28 | A5/A9 |
| A27 | A2/A6 |

Handoff de no máximo seis linhas: tarefa/status; branch e HEAD inicial/final; arquivos; RED/GREEN/regressões; pendência real; próxima tarefa não iniciada. Commit/push torna o estado legível aqui. Interrupção não é conclusão: informar último teste e edições pendentes, sem limpar.

Codex executa na worktree e roda integração/build. Aqui cabem leitura do diff, conferência das evidências e preparação da próxima tarefa; código pequeno somente com a mesma base e testes executáveis disponíveis. Commit aceito pelo GitHub não é prova de teste. Um executor por tarefa; não editar os mesmos arquivos em paralelo.

Prompt de execução, alterando apenas a tarefa desejada:
```text
Execute somente A1 de docs/superpowers/plans/2026-09-11-information-architecture-navigation-plan.md.
Leia a spec 2.1 fixada no plano e os limites globais. Use a worktree isolada da branch autorizada.
Entregue apenas os arquivos e comportamentos dessa tarefa, com RED/GREEN focado.
Não acrescente melhoria, dependência, regra, refatoração ou tarefa nova.
Fora da lista: explique o bloqueio e pare. Não execute a próxima tarefa, merge ou deploy.
Conclua com commit/push e handoff de seis linhas. Sem rodadas extras de revisão sem falha concreta.
```

**Primeira execução: somente T1, no plano separado, após aprovação dos planos.** Não começa A1 automaticamente. Fontes: spec fixada; `package.json`, `.github/workflows/validate.yml`, harness e testes de transferência conferidos. Esta entrega é documental: nenhum teste da aplicação, worktree de execução, integração ou deploy foi realizado.
