# Spec A — Plano de implementação da informação e navegação

> **For agentic workers:** Use `superpowers:executing-plans`, uma tarefa por execução. Não iniciar a tarefa seguinte nem abrir rodadas automáticas de subagentes/revisores. Checkboxes registram execução, não autorização de merge/deploy.

**Goal:** Entregar somente a navegação e os ajustes de atendimento aprovados na Spec A, com continuidade de sessão, pagamento e impressão.
**Architecture:** Um registro de destinos/capacidades alimenta menus, navegação interna e atalhos. Contexto de consulta permanece acima das páginas remontadas; dados oficiais, reconciliação e motor de impressão continuam sob sua coordenação atual. Extrações restritas a conteúdo de configuração, análise operacional e auxiliares de navegação.
**Tech Stack:** React/Vite e ferramentas do lockfile existente; Node 22 como no CI; `node:test`, `react-test-renderer`/harness atual; Worker/D1 existentes. Nenhuma atualização de dependências.
**Spec:** `docs/superpowers/specs/2026-09-11-information-architecture-navigation-design.md`, revisão 2, commit `45e6565e7be34c3c07d905f562e8f69dcc85f948`; blob `7458cdb8fd7a2d3a428a81eab95ec600336f08a5`.
**Base de código conferida:** `99c1f04677b54243a43d470b743cdd16ac499154`.
**Estado:** plano proposto para aprovação; nenhuma tarefa executada.

## Restrições globais e controle de escopo

- “Não trabalhar diretamente em master.” “Não há autorização de deploy ou de merge em produção.”
- “Não adicionar Redux, Zustand, React Router, migração para TypeScript, nova API, migrations ou atualização de dependências como requisito incidental de A.”
- T1 é a única dependência com mudança de contrato, em plano/PR separado: `docs/superpowers/plans/2026-09-11-table-transfer-identity-plan.md`.
- Sem Specs B/C/D, usuários reais, editor de permissões, novas políticas, novas categorias, pesquisa no Histórico, filtros em Movimentações, saldo inicial novo ou redesign de tickets.
- Não alterar fórmulas, elegibilidade, modelos de pagamento, polling, quantidade/ordem das vias, recovery ou tecnologia de impressão. Não transformar preferências locais em D1.
- A guarda de Configurações segue a seção 8.3 da spec: bloquear navegação que desmontaria gravação pendente; NÃO implementar a alternativa de permitir sair e criar um gerenciador global de gravações.
- Arquivos autorizados aparecem por tarefa. Testes existentes só podem ser ajustados por assinatura, título/destino ou propriedade realmente alterados pela tarefa; preservar o comportamento protegido. Nenhuma limpeza oportunista. Ao adaptar um teste de texto que exige o menu antigo ou o FAB removido, substituir apenas a expectativa explicitamente superada; manter a proteção de foco, responsividade e operações não duplicadas.
- Defeito externo ou requisito que demande banco, API adicional, biblioteca, módulo novo não listado ou mudança de produto: registrar caminho, evidência e impacto; parar somente a tarefa dependente. Não corrigir por iniciativa própria, nem reabrir toda a spec.
- Cada tarefa: RED focado → implementação mínima → GREEN + regressões afetadas → conferência única do diff → commit/push na branch autorizada → parar. Não repetir revisão integral da spec por tarefa.
- Revisão independente apenas no fechamento de T1 e no fechamento de A. Reexaminar somente correções e testes afetados quando surgir falha concreta; sem rodadas preventivas sucessivas. Não dispensar testes/CI existentes.

## Execução e branches

Há **T1 + nove tarefas de A**, não nove PRs obrigatórios. T1 tem PR próprio; A tem um PR de entrega com commits pequenos por tarefa.

Após aprovação do plano, criar `integration/spec-a-navigation` no HEAD remoto da branch documental que contém estes planos. Criar uma worktree nova de `fix/table-transfer-identity` a partir dessa mesma base para T1. Abrir o PR de T1 para `integration/spec-a-navigation`; integrar somente com autorização explícita após os testes. Em seguida executar A1–A9 na worktree nova da integração. O PR da integração para `master` permanece draft até homologação/liberação separadas.

Não executar `pull` sobre trabalho desconhecido, rebase forçado, `reset`, `restore`, `clean`, `stash` ou `push --force`. Antes de retomar, verificar branch, `git status --short`, HEAD e commits remotos. Divergência ou edição inesperada: parar, sem sobrescrever. Se T1 já tiver sido entregue por outra tarefa, conferir seu commit e os testes do plano T1; não reaplicar.

Preparação incorporada à primeira tarefa executada, sem criar uma rodada de infraestrutura:
```powershell
git fetch origin
git status --short
git rev-parse HEAD
node --version
npm ci
npm test
```
Executar instalação/testes somente na nova worktree. Guardar a linha de base; se falhar, distinguir falha anterior de regressão antes de editar. Outra worktree exige `npm ci`, mas não uma nova auditoria arquitetural. O executor escolhe um caminho inexistente fora das worktrees antigas e usa `git worktree add`, sem substituir pastas existentes.

## Mapa de arquivos novos e contratos

| Arquivo novo | Responsabilidade limitada |
|---|---|
| `src/app/access.js` | Capacidades da interface, avaliação exata e adaptação explícita da sessão legada. Não autoriza APIs. |
| `src/app/navigation.js` | Registro, resolução de área/destino e decisão pura dos bloqueios. |
| `src/app/queryContext.js` / `useQueryContext.js` | Defaults e atualização dos campos da matriz 9.1 da spec; sem dados oficiais. |
| `src/app/useNavigationController.js` | Destino ativo, Mais, intenção de descarte e reset da sessão. |
| `src/components/PrintingSettingsContent.jsx` | Conteúdo extraído do modal atual, com aviso de gravação pendente. |
| `src/pages/Settings.jsx` | Composição de impressão e preferências locais. |
| `src/components/OperationalHistoryAnalysis.jsx` | Seção operacional extraída do Dashboard, com período próprio. |
| `src/components/AreaNavigation.jsx` / `src/area-navigation.css` | Navegação interna com aparência de abas e estilos mínimos de composição. |
| `src/utils/orderPaymentEligibility.js` | Elegibilidade do atalho de pagamento avulso; não calcula valores. |

Testes novos são nomeados nas tarefas. Reutilizar `src/test-support/renderWorkspace.js`, `workspaceHarness(t)`, `h.load(path)`, `h.render(Component, props)`, `buttonNamed`, `nodeText` e `src/test-support/comandaFixtures.js`. Não introduzir outro harness/framework. Os trechos de teste abaixo são pontos de partida concretos; executar também os casos de aceite listados na própria tarefa, não apenas o exemplo.

### Contratos comuns fechados

`hasCapability(granted, key)` aceita somente chaves conhecidas; `granted` é um `Set<string>`. `legacyCapabilities(authenticated)` fornece conjunto explícito completo somente à sessão atual autenticada. Conjunto vazio/desconhecido fornecido nos testes não ativa esse adaptador. O ponto de composição pode receber `capabilities` para teste; não criar seletor, query string ou storage de perfis.

Capacidades de destinos: `orders.view`, `orders.history`, `orders.analysis`, `comandas.view`, `printing.queue`, `finance.overview`, `finance.receivables`, `finance.movements`, `clients.view`, `products.view`, `tables.view`, `printing.settings`, `preferences.local`.
Capacidades de ações: `orders.create`, `orders.finalize`, `orders.cancel`, `orders.discount`, `payments.receive`, `payments.refund`, `comandas.transfer`, `clients.manage`, `products.manage`, `tables.manage`, `finance.movements.manage`, `finance.promises.manage`, `printing.execute`, `printing.discard`, `printing.station.configure`.
Esses identificadores são interfaces de UI, não uma matriz de perfis. A seleção de clientes/produtos/mesas necessária ao pedido não exige entrar no cadastro administrativo. A lista distingue ação de consulta; não criar novas ações para utilizar uma capacidade.

Destinos preservados: `orders`, `history`, `new-order`, `comandas`, `print-queue`, `dashboard`, `receivables`, `finance`, `clients`, `products`, `tables`. Novos: `settings-printing`, `settings-device`. A seção de impressão exige ao menos `printing.settings` ou `printing.station.configure`; cada controle interno ainda exige sua própria capacidade. Nada de destinos futuros vazios. `new-order` é ação, não entrada de menu.

`resolveArea(area, granted, implemented)` retorna ID ou `null`: Pedidos → `orders, history`; Financeiro → `dashboard, receivables, finance`; Configurações → `settings-printing, settings-device`. `resolveDestination(id, granted, implemented)` retorna `{status:'allowed', id}` ou `{status:'unknown'|'denied'|'unavailable'}`. Um ID explícito negado não é convertido silenciosamente em outro; fallback só resolve entrada de área/home.

`decideNavigation({allowed, checkoutPending, settingsPending, leavingSettings, dirtyOrder, leavingOrder})` retorna `reject`, `blocked`, `confirm` ou `navigate`, nessa precedência. `settingsPending` bloqueia apenas desmontagem/troca de seção de configuração; o checkout mantém o bloqueio atual de saída. Intenção bloqueada não é armazenada.

`useNavigationController({granted, implemented, checkoutPending, settingsPending, dirtyOrder, onDiscardOrder, onFeedback})` produz `activeTab`, `moreOpen`, `pendingDestination`, `requestNavigation(target)`, `openMore()`, `closeMore()`, `confirmDiscard()`, `cancelDiscard()`, `resetNavigation()`. `target` é ID ou `{area}`. Estado inicial/home é a primeira página autorizada, preferindo Cozinha; sem página, estado sem acesso e Sair. Todos os caminhos usam este controlador.

`createQueryContext()` retorna somente campos da matriz 9.1. `patchQueryContext(state, page, patch)` não altera outras páginas. `useQueryContext()` fornece `{query, patchQuery(page, patch), resetQueries()}`. Páginas recebem `queryState` e `onQueryChange(patch)`; callbacks do contexto capturam a geração da sessão e ignoram respostas antigas. Seleção de comanda e obrigações de pagamento continuam nos donos existentes de `App`, fora desse contexto de consulta.

---

## A1 — Contratos de navegação e capacidades (sem mudança visual)

**Depende:** base documental aprovada. **Entrega:** funções puras testadas, ainda sem substituir os menus.
**Criar:** `src/app/access.js`, `src/app/navigation.js`, `src/app/navigation.test.js`. **Não alterar:** APIs, páginas, CSS.
**Consome/produz:** contratos comuns; o registro inclui rótulo, grupo, owner mobile, ordem e capacidade. `orders.analysis` é seção de Histórico e exige também `orders.history`.

- [ ] Escrever RED para resolução de áreas, ID explícito negado, capacidades desconhecidas/vazias, defaults e precedência de bloqueios. Exemplo completo de teste puro:
```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveArea, resolveDestination, decideNavigation } from './navigation.js'
test('financeiro pode abrir somente A receber, sem liberar o dashboard', () => {
  const granted = new Set(['finance.receivables'])
  const implemented = new Set(['dashboard', 'receivables', 'finance'])
  assert.equal(resolveArea('finance', granted, implemented), 'receivables')
  assert.equal(resolveDestination('dashboard', granted, implemented).status, 'denied')
  assert.equal(resolveArea('finance', new Set(), implemented), null)
  assert.equal(decideNavigation({allowed:true, checkoutPending:false,
    settingsPending:true, leavingSettings:true, dirtyOrder:false, leavingOrder:false}), 'blocked')
})
```
- [ ] Rodar `node --test src/app/navigation.test.js`; registrar falha por comportamento/função ausente, não por ambiente quebrado.
- [ ] Implementar o registro estático e funções dos contratos; IDs desconhecidos nunca concedem acesso. `implemented` contém apenas páginas realmente conectadas, para não publicar Configurações antecipadamente. Ordem estável dos itens após filtragem; Mais tem ações de sessão mesmo sem cadastros.
- [ ] Rodar o mesmo comando e `npm run lint`; conferir diff apenas desses arquivos. Commit `feat: define scoped navigation contracts`; push e parar.
**Aceite:** A16/A17 e base de A29. Nenhum perfil real, editor ou menu novo nesta tarefa.

## A2 — Estado de navegação e consultas por sessão

**Depende:** A1. **Criar:** `src/app/queryContext.js`, `src/app/useQueryContext.js`, `src/app/useNavigationController.js`, `src/app/queryContext.test.js`, `src/navigationContext.test.js`.
**Alterar:** `src/App.jsx`, `src/components/AppShell.jsx`, `src/components/DashboardPeriodProvider.jsx`, `src/pages/Dashboard.jsx`, `src/pages/OrderHistory.jsx`, `src/pages/Receivables.jsx`, `src/pages/Products.jsx`, `src/pages/PrintQueue.jsx`. Testes existentes diretamente afetados por navegação/estado podem ser ajustados sem perder suas verificações.
**Consome:** A1 e matriz 9.1. **Produz:** hooks dos contratos, páginas controladas e reset no encerramento da sessão; aparência preservada.

- [ ] RED: navegar e voltar conserva consultas; logout seguido de nova sessão restaura defaults; resposta da sessão anterior não restaura estado. Teste puro mínimo:
```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createQueryContext, patchQueryContext } from './queryContext.js'
test('períodos independentes e reset sem dados oficiais', () => {
  const initial = createQueryContext()
  const changed = patchQueryContext(initial, 'dashboard', {period:'7d'})
  assert.equal(changed.dashboard.period, '7d')
  assert.equal(changed.history.analysisPeriod, '30d')
  assert.equal(createQueryContext().dashboard.period, '30d')
  assert.equal(Object.hasOwn(changed, 'ordersData'), false)
})
```
- [ ] Rodar `node --test src/app/queryContext.test.js src/navigationContext.test.js` e confirmar RED.
- [ ] Integrar controlador no `App`, acima do conteúdo com `key={activeTab}`; adaptar `completeNavigation`/guarda existente sem duplicar activeTab ou controle de checkout. `app:navigate` passa pelo mesmo caminho. Capturar geração nas respostas assíncronas que possam limpar/reabrir contexto.
- [ ] Levantar somente: Cozinha `search`; Histórico `filter:'all', analysisPeriod:'30d'`; Dashboard `period:'30d', valuesVisible:true`; Clientes `search, sort:'name-asc'`; Produtos `search, categoryFilter:'Todos'`; A receber `search, activeView:'pending', timingFilter:'all', sortMode:'urgency', exactDateFilter:null, selectedEntryKey:null`; Fila = cópia de `DEFAULT_PRINT_QUEUE_QUERY`. Não duplicar arrays de entidades. Validar seleção e paginação com dados atuais; menus/edições/seleção em lote ficam transitórios. Movimentações não ganha filtros.
- [ ] Testar páginas montadas via harness real, não apenas reducers. Rodar `node --test src/app/queryContext.test.js src/navigationContext.test.js src/AppNewOrderGuard.test.js src/dashboardPeriodPersistence.test.js src/comandasAppWiring.test.js` e `npm run lint`. Commit `refactor: preserve navigation query context per session`; push e parar.
**Aceite:** A10/A12/A18/A27 e base de A01. Nenhum `localStorage` novo nem páginas escondidas permanentemente montadas.

## A3 — Configurações usando os controles existentes

**Depende:** A2. **Criar:** `src/components/PrintingSettingsContent.jsx`, `src/pages/Settings.jsx`, `src/settingsNavigation.test.js`, `src/area-navigation.css` (somente composição).
**Alterar:** `src/components/PrintingSettings.jsx`, `src/App.jsx`, `src/pages/PrintQueue.jsx`; estilos estritamente locais em `src/printing/printing.css`/`src/area-navigation.css`.
**Consome:** `printing`, tema e som existentes; `settingsPending` do controlador. **Produz:** dois destinos funcionais e aviso de gravação.

- [ ] RED com resposta de `savePrintSettings` adiada: tentativa de saída mantém Configurações; sucesso/falha libera sem executar intenção antiga. Separar teste físico: job pendente não impede navegação. Cobrir expiração e retorno tardio.
- [ ] Rodar `node --test src/settingsNavigation.test.js` e registrar RED.
- [ ] Extrair o conteúdo atual para `PrintingSettingsContent({printing,onSavingChange,onFeedback})`. Manter o wrapper de modal para consumidores existentes enquanto necessário, sem duplicar lógica/manager. A notificação de gravação usa token da sessão/operação; `finally` antigo não libera uma gravação de outra sessão. O token contém geração da sessão e identificador da gravação; somente seu dono pode liberá-lo. Exemplo de fronteira dentro do handler de vias, preservando seu tratamento atual de erro:
```js
const token = {sessionGeneration, operationId: crypto.randomUUID()}
onSavingChange({token, pending:true})
try { await savePrintSettings({defaultCopies:next}) }
finally { onSavingChange({token, pending:false}) }
```
- [ ] `Settings` recebe `section:'printing'|'device'`, `printing`, preferências e callbacks já existentes. Só gravações de vias/estação/seleção geram `settingsPending`; diagnóstico, atualização da lista e conclusão física não. Gravação falha restaura o valor confirmado, informa erro e não faz retry automático. Reentrada carrega valor oficial. Não transformar todos os `pendingAction` de impressão em bloqueio do aplicativo.
- [ ] Conectar `settings-printing`/`settings-device` e atalho da fila no `App`; só então adicioná-los a `implemented`. Tema/som usam suas origens locais; som continua acessível na Cozinha. Preservar distinção negócio/estação/dispositivo e regra de mesa com uma via.
- [ ] GREEN com testes de erro, sessão e compartilhamento de som/tema; lint. Commit `feat: compose existing settings in dedicated pages`; push e parar.
**Aceite:** A06/A07/A08/A25. Não criar políticas editáveis, perfil de impressora, rodapé novo ou formulário Salvar tudo.

## A4 — Separar Visão geral de análise operacional

**Depende:** A2. **Criar:** `src/components/OperationalHistoryAnalysis.jsx`, `src/operationalHistoryAnalysis.test.js`.
**Alterar:** `src/pages/Dashboard.jsx`, `src/pages/OrderHistory.jsx`; somente estilos de composição em `src/dashboard.css`/`src/area-navigation.css`. Ajustar testes do Dashboard afetados pelo reposicionamento, incluindo `src/dashboardFloatingAction.test.js`.
**Consome:** `orders` oficiais e períodos separados de A2. **Produz:** `OperationalHistoryAnalysis({orders,period,onPeriodChange,now})`, sem buscar dados ou alterar fórmulas.

- [ ] RED: análise continua acessível no Histórico; seleção Cancelados não altera amostra; mudar período operacional não altera o financeiro. Teste de caracterização usa `calculateOperationalMetrics` existente para mesma entrada/período/instante.
- [ ] Rodar `node --test src/operationalHistoryAnalysis.test.js` e confirmar RED.
- [ ] Mover apenas JSX/mapeamentos da seção de tempo, preservando faixas, amostra vazia e seletores `today/7d/30d`. Receber a coleção oficial completa autorizada à consulta, não `terminalOrders` já filtrado. Contrato de composição:
```jsx
<OperationalHistoryAnalysis orders={orders} period={queryState.analysisPeriod}
  onPeriodChange={(analysisPeriod) => onQueryChange({analysisPeriod})} now={now} />
```
- [ ] Dashboard vira título Visão geral sob Financeiro; manter indicadores de vendas/recebimento/recebíveis e gráficos comerciais. Retirar cartões/lista de fila, seção de tempo e FAB de Novo pedido, sem criar substitutos. Análise só aparece com `orders.history` + `orders.analysis`.
- [ ] GREEN + testes existentes de charts/controles/período afetados; lint. Commit `refactor: separate commercial and operational views`; push e parar.
**Aceite:** A09/A24. Zero alteração em `src/utils/dashboardAnalytics.js`, regras de tempo ou dinheiro.

## A5 — Aplicar a navegação desktop/mobile aprovada

**Depende:** A1–A4. **Criar:** `src/components/AreaNavigation.jsx`, `src/navigationLayout.test.js`. **Alterar:** `Sidebar.jsx`, `MobileNavigation.jsx`, `AppShell.jsx` em `src/components/`; `src/utils/mobileNavigation.js`, `src/App.jsx`, `src/pages/Orders.jsx`, `src/area-navigation.css`, `src/mobile-navigation.css`, `src/App.css`. `BottomSheet.jsx` só se necessário para conectar o ciclo de foco já existente, sem reescrevê-lo.
**Consome:** registro/controlador de A1/A2; destinos reais de A3/A4. **Produz:** `AreaNavigation({area,activeTab,granted,implemented,onNavigate})` e navegação única.

- [ ] RED para home Cozinha, sidebar agrupada, mobile com quatro/três itens, destaques e fallback financeiro. Teste mínimo de componente com harness:
```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { workspaceHarness, buttonNamed } from './test-support/renderWorkspace.js'
test('navegação interna não oferece Histórico sem capacidade', async (t) => {
  const h = await workspaceHarness(t)
  const {default: AreaNavigation} = await h.load('/src/components/AreaNavigation.jsx')
  const r = await h.render(AreaNavigation, {area:'orders', activeTab:'orders',
    granted:new Set(['orders.view']), implemented:new Set(['orders','history']), onNavigate:()=>{}})
  assert.ok(buttonNamed(r.root, 'Cozinha'))
  assert.equal(buttonNamed(r.root, 'Histórico'), undefined)
})
```
- [ ] Rodar `node --test src/navigationLayout.test.js`; confirmar RED.
- [ ] Lateral: Operação/Pedidos, Comandas, Fila; Financeiro/Visão geral, A receber, Movimentações; Cadastros/Clientes, Produtos e preços, Mesas; Configurações separado. Mobile: Pedidos, Comandas, Financeiro, Mais. Mais contém somente fila/cadastros/configurações/Sair, sem Histórico/financeiro duplicados. Nenhuma landing page. Remover controle de tema do menu antigo, pois sua entrada passa a Configurações.
- [ ] Navegação interna conforme seção 12: `nav`, botões nativos, `aria-current`, Tab/Enter/Espaço, sem ARIA tabs incompletas nem URLs fictícias. Renomear Impressão da Cozinha para Fila de impressão; substituir botão Histórico por navegação interna. Origem de novo pedido em comanda destaca Comandas.
- [ ] `moreOpen` pertence ao controlador: validar intenção/bloqueios; fechar Mais antes de exibir confirmação; uma intenção; Escape/Continuar a apaga; confirmar navega uma vez. Não montar confirmação enquanto Mais conserva foco modal. Intenção bloqueada não reaparece depois. Foco após troca vai ao título; polling não o desloca. Preservar área inferior segura e animação existente.
- [ ] GREEN + guardas/menus antigos diretamente afetados + lint/build. Commit `feat: apply approved operational navigation`; push e parar.
**Aceite:** A01–A05/A12/A16/A17/A19/A26/A28. Nenhuma mudança de conteúdo além dos títulos/atalhos aprovados.

## A6 — Transferência em Comandas e seleção por atendimento

**Depende:** T1 incorporado e A5. **Criar:** `src/comandasTransferNavigation.test.js`.
**Alterar:** `src/pages/Comandas.jsx`, `src/components/ComandaDetail.jsx`, `src/pages/Tables.jsx`, `src/App.jsx`, `src/comandasAppWiring.test.js`; ajustes mínimos em `src/comandas.css`.
**Consome:** `onTransfer(sourceTableId,destinationTableId,expectedTableTabId)` de T1; referências atuais de pagamento/seleção. **Produz:** ação operacional e seleção segura, sem novo dono de pagamentos.

- [ ] RED: A transferida continua selecionada na nova mesa; A encerrada/substituída limpa seleção e intenções; B exige toque novo; pagamento aceito de A ainda reconcilia. Usar respostas adiadas e o harness de `comandasAppWiring.test.js`.
- [ ] Rodar `node --test src/comandasTransferNavigation.test.js src/comandasAppWiring.test.js`; registrar o caso novo falhando.
- [ ] Abrir o diálogo protegido pela comanda selecionada, com `key` de sua identidade. Em Mesas substituir transferência direta por Abrir comanda autorizado, capturando a comanda exibida. Caso fique obsoleta antes da abertura, informar e não selecionar B. Exemplo da intenção:
```js
const target = {tableId: table.id, tableTabId: table.openTableTab.id}
// Ao abrir, validar ambos contra os dados atuais; nunca substituir tableTabId por outro.
```
- [ ] Ajustar somente `applyOfficialTables`/seleção/retorno necessários: acompanhar ID estável transferido; limpar substituição, avançar geração de UI e fechar modais antigos. NÃO esvaziar `paymentSyncRef` de obrigações aceitas. Retorno de novo pedido para origem inválida abre Comandas sem substituir atendimento.
- [ ] Transferência exige `comandas.transfer`, cadastro exige `tables.manage`; consulta não concede mutação. Erros preservam dados oficiais e não repetem transferência. GREEN nos testes da tarefa/T1 afetados; lint. Commit `feat: move protected table transfers into service flow`; push e parar.
**Aceite:** A11/A12/A13/A14/A23/A27. Nenhuma divisão de conta, nova mesa ou mudança de regra financeira.

## A7 — Recebimento avulso operacional

**Depende:** A5/A6. **Criar:** `src/utils/orderPaymentEligibility.js`, `src/utils/orderPaymentEligibility.test.js`, `src/operationalPayment.test.js`.
**Alterar:** `src/App.jsx`, `src/components/OrderDetail.jsx`, `src/pages/Orders.jsx`, `src/pages/OrderHistory.jsx`. Não mover os controllers das outras páginas.
**Consome:** `hasCapability`, dados oficiais e `registerPayment`/diálogo central existentes. **Produz:** `canReceiveStandaloneOrder(order,granted)` e `onRegisterPayment(orderId)` reutilizado pelos detalhes.

- [ ] RED para pendente imediato/finalizado elegível, pago/cancelado/comanda inelegível, rede/envio, clique duplo, navegação/retorno e resposta de sessão antiga. Teste puro:
```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { canReceiveStandaloneOrder } from './orderPaymentEligibility.js'
test('receber atendimento não exige abrir o financeiro', () => {
  const caps = new Set(['payments.receive'])
  const order = {id:'p1', type:'Entrega', status:'Finalizado', paymentStatus:'Pendente'}
  assert.equal(canReceiveStandaloneOrder(order, caps), true)
  assert.equal(canReceiveStandaloneOrder({...order, tableTabId:'tab1'}, caps), false)
  assert.equal(canReceiveStandaloneOrder({...order, paymentStatus:'Pago'}, caps), false)
  assert.equal(canReceiveStandaloneOrder(order, new Set()), false)
})
```
- [ ] Rodar `node --test src/utils/orderPaymentEligibility.test.js src/operationalPayment.test.js`; confirmar RED.
- [ ] Detalhes resolvem o pedido por ID nos dados oficiais atuais; novo callback fecha detalhes e abre o pagamento central. Guardar origem/identidade e geração da sessão; revalidar antes do envio. Botão duplo não envia novamente. Sucesso mantém página/filtros, aplica efeitos oficiais e fecha diálogo; cancelar não muda dados. Tarde/409/incerto não gera pagamento otimista, não repete POST e não fecha diálogo de outro atendimento/sessão. Manter o tratamento e refresh atuais, sem novo protocolo financeiro.
- [ ] Excluir mesa pelo `tableTabId`, identificação `table` ou tipo Local conforme dados existentes, inclusive registros legados. Receber na comanda continua pelo fluxo integral. A receber mantém seu acesso ao mesmo controlador.
- [ ] GREEN nos testes novos e `src/comandasAppWiring.test.js`; lint. Commit `feat: expose operational standalone payment`; push e parar.
**Aceite:** A14/A21/A22. Sem perfis reais, nova carteira, pagamentos parciais ou dinheiro recalculado no cliente.

## A8 — Ligar capacidades às ações já existentes

**Depende:** A1–A7. **Criar:** `src/actionCapabilities.test.js`.
**Alterar somente passagem de capacidades, visibilidade/disabled e guardas de handlers:** `src/App.jsx`; páginas `Clients.jsx`, `Products.jsx`, `NewOrder.jsx`, `Receivables.jsx`, `Finance.jsx`, `Tables.jsx`, `Comandas.jsx`, `PrintQueue.jsx`; componentes `NewOrderReviewStep.jsx`, `ComandaDetail.jsx`, `ReceivableDetail.jsx`, `OrderDetail.jsx`, `PrintingSettingsContent.jsx`, todos sob `src/pages/` ou `src/components/` conforme indicado. Nenhum controller é movido.
**Consome:** chaves fechadas de A1; callbacks atuais. **Produz:** mesmas ações, disponíveis somente com capacidade de interface explícita. Sem novas ações nem APIs.

- [ ] RED com componentes reais: leitura de cadastro sem edição; monta pedido sem editar preço de catálogo; recebe sem Financeiro; Histórico sem análise; preferência local sem política; subárea permitida sem página padrão; desconhecida/vazia. Não testar somente o registro puro. Asserção mínima reutilizável em teste montado:
```js
assert.equal(buttonNamed(r.root, 'Editar'), undefined)
assert.equal(mutationCalls.length, 0)
```
  `r` é o renderer do componente montado pelo `workspaceHarness`; `mutationCalls` é o array local preenchido pelo spy do callback de mutação. Usar os rótulos reais de cada tela e também chamar o callback guardado para demonstrar ausência de mutação.
- [ ] Rodar `node --test src/actionCapabilities.test.js`; confirmar RED.
- [ ] Aplicar `clients.manage`, `products.manage`, `tables.manage` aos CRUDs existentes; `orders.create/finalize/cancel/discount` aos respectivos handlers/controles; `payments.receive/refund`, `finance.promises.manage` e `finance.movements.manage` às ações correspondentes. Selecionar um produto/mesa para atendimento não exige editar seu cadastro. Acesso ao detalhe não concede estorno ou cancelamento.
- [ ] Aplicar `printing.execute` a impressão/reimpressão/retry autorizado e teste; `printing.discard` a descarte; `printing.settings` a valores do negócio; `printing.station.configure` a configuração da estação. Preferências usam `preferences.local`. Guardar o handler além de esconder o botão. NÃO alterar motor automático, impressão física ou APIs para simular autorização. Quando a seção tem só controles indisponíveis, não criar botões fictícios.
- [ ] GREEN + testes de componentes diretamente afetados; lint. Commit `feat: wire explicit UI action capabilities`; push e parar.
**Aceite:** A16/A17/A29, complementando A21. A sessão legada continua com seu conjunto explícito completo; nenhum perfil restrito é oferecido ao usuário.

## A9 — Regressões finais e homologação única

**Depende:** T1/A1–A8. **Criar:** `src/navigationContinuity.test.js`, `docs/superpowers/qa/2026-09-11-spec-a-acceptance.md`.
**Alterar:** `src/test-support/renderWorkspace.js` somente para expor contagem de intervalos/listeners e simular foco já usado; testes afetados. Código da aplicação só para corrigir falha demonstrada e dentro do escopo de tarefa anterior.

- [ ] Executar cenários reais de navegação pelo App: dez ciclos Cozinha/Configurações/Clientes/Comandas, com rede e visibilidade controladas; contar um consumidor global por papel, zero mutações repetidas e limpeza dos efeitos da página. Permitir os timers legítimos da página ativa. Resposta tardia após logout não popula outra sessão. Pagamento aceito continua reconciliando mesmo sem modal; reconciliar pode fazer mais de uma leitura, nunca outra mutação financeira por retorno.
- [ ] Rodar `node --test src/navigationContinuity.test.js src/comandasAppWiring.test.js`. Corrigir apenas regressão demonstrada, com teste RED; não abrir nova auditoria do sistema.
- [ ] Executar uma vez os gates completos do repositório e registrar resultado/HEAD:
```powershell
npm test
npm run lint
npm run build
npx --yes wrangler@4.128.0 deploy --dry-run
npx --yes wrangler@4.128.0 deploy --dry-run --env staging
npm run d1:migrate:local
git diff --check
git status --short
```
- [ ] Fazer uma revisão final do diff contra A01–A30 e T1. Registrar apenas bloqueadores concretos; preferências de estilo/refactors ficam fora. Não repetir a revisão completa depois de corrigir um ponto: retestar o afetado e manter evidência dos gates pertinentes ao HEAD final.
- [ ] Parar e pedir autorização para publicar em staging; usar o workflow/runbook existente, conferindo branch, SHA e D1 de staging. Não editar workflow para automatizar a entrega nem executar comando de produção. Após autorizado, realizar uma homologação combinada: desktop/mobile, claro/escuro, teclado/foco, rascunho, consultas, transferência concorrente, recebimento, configuração com falha e impressão física de 1/2 vias e recovery na estação de testes.
- [ ] Preencher QA com resultado ou “pendente — motivo” por critério. Sem impressora/ambiente, não afirmar homologação física. Commit `test: validate spec A navigation and continuity`, push; manter PR sem merge/liberação de produção. Falha de homologação abre apenas correção localizada e reteste afetado.
**Aceite:** A15/A19/A20/A30 e evidências finais A01–A30. Conclusão da implementação não significa produção liberada.

## Rastreabilidade de aceite

| Critérios | Tarefa responsável |
|---|---|
| A01–A05 | A5; A2 fornece ciclo de sessão/guarda. |
| A06–A08, A25 | A3. |
| A09, A24 | A4. |
| A10, A18 | A2; A9 testa respostas tardias. |
| A11, A13, A23 | A6 + evidência obrigatória T1. |
| A12 | A2/A5/A6. |
| A14, A21, A22 | A7 + regressões de reconciliação em A6/A9. |
| A15, A20, A30 | A9 e restrições globais de todas as tarefas. |
| A16, A17, A29 | A1/A5/A8. |
| A19, A26, A28 | A5 + homologação A9. |
| A27 | A2/A6. |

## Passagem entre Codex e ChatGPT

Depois de cada tarefa, fazer commit e push da branch correta para que a próxima execução leia o mesmo estado. Reportar em até seis linhas: tarefa/status; branch/HEAD inicial/final; arquivos; testes RED/GREEN e regressões; pendência real; próxima tarefa ainda não iniciada. Interrupção: não marcar completo; informar último teste/comando e arquivos não commitados, sem reset/limpeza.

Codex: trabalho na worktree, testes de integração e validação local. Aqui: conferir documentos, diffs, evidências e preparar o próximo comando; implementação pequena só quando houver ambiente com a mesma base e testes executáveis. Nenhuma edição remota de código é considerada validada apenas porque o GitHub aceitou o commit. Um executor por tarefa; não editar `App.jsx` em paralelo.

Prompt de execução (trocar apenas o identificador da tarefa):
```text
Execute somente A1 do plano docs/superpowers/plans/2026-09-11-information-architecture-navigation-plan.md.
Leia a spec revisão 2 e os limites globais. Use uma worktree isolada da branch autorizada.
Faça RED/GREEN focado, sem acrescentar funcionalidades ou refatoração externa.
Não execute a tarefa seguinte, merge ou deploy. Ao concluir, commit/push e informe branch,
HEAD, testes e pendências. Não abra rodadas extras de revisão sem falha concreta.
```
O primeiro comando de implementação será para **T1**, usando seu plano separado, depois da aprovação destes planos. A criação deste documento não executa preparação, código, testes da aplicação ou deploy.

## Fontes de execução conferidas

Spec e base fixadas no cabeçalho; `package.json` e `.github/workflows/validate.yml` fornecem scripts/Node; `src/test-support/renderWorkspace.js` fornece harness; `worker/tableRepository.test.js` fornece SQLite de teste; `src/api/client.js` define a fronteira de APIs. As referências detalhadas de produto estão na seção 16 da spec, sem necessidade de repetir uma auditoria.
