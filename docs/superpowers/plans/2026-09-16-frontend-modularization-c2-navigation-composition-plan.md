# Spec C2 Navigation and App Composition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganizar navegação e composição do frontend em `src/app/navigation/` e `src/app/shell/`, criando um `AppRoot` fino e um contrato pequeno de navegação, sem alterar UX, regras de negócio, URLs, polling ou workflows de domínio.

**Architecture:** A C2 parte da `master` pós-C1 e mantém `App.jsx` como orquestrador transitório das responsabilidades que só serão migradas em C3-C9. Um registro declarativo único passa a descrever destinos/áreas/menus, funções puras resolvem acesso e fallback, `useNavigationController` continua sendo o único owner do estado transitório, `NavigationContext` expõe somente navegação, e `AppRoot`/`AppShell` cuidam exclusivamente da composição visual global e da moldura autenticada.

**Tech Stack:** React 19.2.8, React DOM 19.2.8, Vite 8.2.2, Node 22 `node:test`, `react-test-renderer` 19.2.8, oxlint 1.79.0, Cloudflare Worker/D1, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-16-frontend-modularization-c2-navigation-composition-design.md`

## Global Constraints

- Base obrigatória: `master` em `f5d8b7267cdbf91a7d254a3c1546464d4d9b0210`; branch de execução: `feature/spec-c2-navigation-composition`.
- Não implementar diretamente na `master`.
- Preservar comportamento e visual atuais; C2 não é redesign, feature ou mudança de regra.
- Não adicionar React Router, Redux, Zustand, WebSocket/SSE, nova API, migration, dependência ou mecanismo próprio de URL/history.
- Não alterar Worker/D1 nem contratos HTTP; qualquer necessidade desse tipo é bloqueio e deve ser discutida antes de continuar.
- Não alterar polling global (~5 s) nem polling dedicado de `orders` (~2 s enquanto Cozinha está ativa).
- `activeTab === 'orders'` continua sendo sinal transitório válido para polling/relógio da Cozinha nesta slice.
- Preservar integralmente IDs de destino, fallbacks por área, capabilities, `Mais`, retorno de Novo Pedido, guards de Novo Pedido/Settings, foco, direção da animação e queries por sessão.
- Settings em `saving` ou `unconfirmed` não ganha guarda global de navegação; `beforeunload` continua com o owner atual até C3.
- Não antecipar ownership de C3-C9: settings engine, orders, table-service, finance/workflows, customers, catalog e printing permanecem nos donos atuais.
- Não mover CSS por estética. Só ajustar caminho de import quando um componente for movido.
- Não adicionar trigger amplo `feature/**` em staging. C2 usa `workflow_dispatch` no SHA exato a homologar.
- Nenhum merge ou deploy de produção é autorizado por este plano. Merge exige aprovação explícita após homologação; produção exige nova autorização explícita após merge e validação da `master`.
- Reexports temporários criados apenas para manter commits intermediários verdes devem ser removidos dentro da própria C2 antes de staging; nenhum facade novo pode atravessar a slice sem registro em `docs/superpowers/qa/spec-c-compatibility-facades.md`.
- Cada tarefa: teste RED focado → implementação mínima → GREEN focado + regressões proporcionais → revisão de diff → commit. Não acumular tarefas sem revisão.

## Execution preflight

Antes da Task 1, em worktree isolada criada a partir da branch remota atual:

```bash
git fetch origin
git switch feature/spec-c2-navigation-composition
git status --short
git rev-parse HEAD
git merge-base HEAD origin/master
node --version
npm ci
npm test
npm run lint
npm run test:architecture
npm run build
npm run d1:migrate:local
```

Esperado antes de código funcional:

- `git status --short` vazio;
- `merge-base` igual a `f5d8b7267cdbf91a7d254a3c1546464d4d9b0210`;
- Node 22;
- todos os gates verdes na branch documental.

Se a worktree estiver suja/divergente, não usar `reset`, `restore`, `clean`, `stash` ou `push --force`; criar worktree nova ou parar e relatar o bloqueio.

---

## File map da C2

### Arquivos novos finais

- `src/app/navigation/registry.js` — única fonte declarativa de destinos, áreas, grupos desktop, entradas mobile/`Mais` e ordem de transição mobile.
- `src/app/navigation/resolution.js` — funções puras de acesso, fallback, home, target e direção da transição.
- `src/app/navigation/useNavigationController.js` — único owner do estado transitório de navegação.
- `src/app/navigation/NavigationContext.jsx` — provider/hook com contrato mínimo de navegação.
- `src/app/navigation/useNavigationEventBridge.js` — bridge de compatibilidade do evento `app:navigate`.
- `src/app/navigation/queryContext.js` / `useQueryContext.js` — continuidade de consulta por sessão.
- `src/app/navigation/settingsDraftGuard.js` — adaptador de guard para drafts de Settings, sem mover o engine da Spec B.
- `src/app/navigation/AreaNavigation.jsx` — navegação interna de área consumindo o contrato comum.
- `src/app/shell/AppRoot.jsx` — estados visuais globais e montagem do conteúdo ready.
- `src/app/shell/AppShell.jsx` — moldura autenticada, foco e transição.
- `src/app/shell/Sidebar.jsx` — menu desktop a partir do registry/context.
- `src/app/shell/MobileNavigation.jsx` — menu mobile/`Mais` a partir do registry/context.

### Arquivos legados que não devem existir no final

- `src/app/navigation.js`
- `src/app/useNavigationController.js`
- `src/app/queryContext.js`
- `src/app/useQueryContext.js`
- `src/components/AppShell.jsx`
- `src/components/Sidebar.jsx`
- `src/components/MobileNavigation.jsx`
- `src/components/AreaNavigation.jsx`
- `src/utils/mobileNavigation.js`

### Páginas com `AreaNavigation` que serão ajustadas mecanicamente

- `src/pages/Orders.jsx`
- `src/pages/OrderHistory.jsx`
- `src/pages/Dashboard.jsx`
- `src/pages/Receivables.jsx`
- `src/pages/Finance.jsx`
- `src/pages/Settings.jsx`

---

### Task 1: Centralizar registry e resolução pura da navegação

**Files:**
- Create: `src/app/navigation/registry.js`
- Create: `src/app/navigation/resolution.js`
- Create: `src/app/navigation/registry.test.js`
- Move/Modify: `src/app/navigation.test.js` → `src/app/navigation/resolution.test.js`
- Modify temporarily: `src/app/navigation.js` — reexport intra-slice somente para consumidores ainda não migrados

**Interfaces:**
- Consumes: `hasCapability(granted, key)` de `src/app/access.js`.
- Produces: `NAVIGATION_DESTINATIONS`, `destinationById`, `AREA_DESTINATION_IDS`, `HOME_AREA_ORDER`, `AREA_LABELS`, `DESKTOP_NAV_GROUPS`, `MOBILE_DIRECT_ENTRIES`, `MOBILE_MORE_ENTRIES`, `MOBILE_SECTION_IDS`, `resolveArea()`, `resolveDestination()`, `resolveHome()`, `resolveNavigationEntry()`, `decideNavigation()`, `getMobilePageDirection()`.

- [ ] **Step 1: Escrever o RED do registry exato**

Criar `src/app/navigation/registry.test.js` com caracterização explícita dos metadados hoje espalhados:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  NAVIGATION_DESTINATIONS,
  AREA_DESTINATION_IDS,
  DESKTOP_NAV_GROUPS,
  MOBILE_DIRECT_ENTRIES,
  MOBILE_MORE_ENTRIES,
  MOBILE_SECTION_IDS,
} from './registry.js'

const ids = NAVIGATION_DESTINATIONS.map(({ id }) => id)

test('C2 preserva os IDs e a ordem dos destinos atuais', () => {
  assert.deepEqual(ids, [
    'settings-home', 'settings-operations', 'settings-modalities',
    'settings-payments', 'settings-cancellations', 'settings-finance-categories',
    'orders', 'history', 'new-order', 'comandas', 'print-queue',
    'dashboard', 'receivables', 'finance', 'clients', 'products', 'tables',
    'settings-printing', 'settings-device',
  ])
})

test('registry preserva fallbacks, desktop, mobile, Mais e ordem de transição', () => {
  assert.deepEqual(AREA_DESTINATION_IDS, {
    orders: ['orders', 'history'],
    finance: ['dashboard', 'receivables', 'finance'],
    settings: [
      'settings-home', 'settings-operations', 'settings-modalities',
      'settings-payments', 'settings-cancellations',
      'settings-finance-categories', 'settings-printing', 'settings-device',
    ],
  })
  assert.deepEqual(DESKTOP_NAV_GROUPS.map(({ label }) => label), [
    'OPERAÇÃO', 'FINANCEIRO', 'CADASTROS', 'CONFIGURAÇÕES',
  ])
  assert.deepEqual(MOBILE_DIRECT_ENTRIES.map((item) => item.area || item.id), [
    'orders', 'comandas', 'finance',
  ])
  assert.deepEqual(MOBILE_MORE_ENTRIES.map((item) => item.area || item.id), [
    'print-queue', 'clients', 'products', 'tables', 'settings',
  ])
  assert.deepEqual(MOBILE_SECTION_IDS, [
    'orders', 'history', 'comandas', 'dashboard', 'receivables', 'finance',
    'print-queue', 'clients', 'products', 'tables',
    'settings-printing', 'settings-device',
  ])
})
```

- [ ] **Step 2: Rodar o RED**

Run:

```bash
node --test src/app/navigation/registry.test.js
```

Expected: FAIL porque `registry.js` ainda não existe.

- [ ] **Step 3: Implementar o registry declarativo sem mudar dados**

Criar `registry.js` a partir dos valores atuais. Estrutura obrigatória:

```js
export const NAVIGATION_DESTINATIONS = Object.freeze([
  Object.freeze({ id: 'settings-home', area: 'settings', label: 'Configurações', mobileEntry: 'more', anyCapability: Object.freeze(['operations.settings.view', 'payments.settings.view', 'orders.settings.view', 'finance.categories.view', 'printing.settings.view', 'printing.settings', 'printing.station.view', 'preferences.local']) }),
  Object.freeze({ id: 'settings-operations', area: 'settings', label: 'Operação', mobileEntry: 'more', capability: 'operations.settings.view' }),
  Object.freeze({ id: 'settings-modalities', area: 'settings', label: 'Modalidades de pedido', mobileEntry: 'more', capability: 'operations.settings.view' }),
  Object.freeze({ id: 'settings-payments', area: 'settings', label: 'Formas de pagamento', mobileEntry: 'more', capability: 'payments.settings.view' }),
  Object.freeze({ id: 'settings-cancellations', area: 'settings', label: 'Motivos de cancelamento', mobileEntry: 'more', capability: 'orders.settings.view' }),
  Object.freeze({ id: 'settings-finance-categories', area: 'settings', label: 'Categorias financeiras', mobileEntry: 'more', capability: 'finance.categories.view' }),
  Object.freeze({ id: 'orders', area: 'orders', label: 'Cozinha', mobileEntry: 'orders', capability: 'orders.view' }),
  Object.freeze({ id: 'history', area: 'orders', label: 'Histórico', mobileEntry: 'orders', capability: 'orders.history' }),
  Object.freeze({ id: 'new-order', area: 'orders', label: 'Novo pedido', mobileEntry: null, capability: 'orders.create' }),
  Object.freeze({ id: 'comandas', area: 'comandas', label: 'Comandas', mobileEntry: 'comandas', capability: 'comandas.view' }),
  Object.freeze({ id: 'print-queue', area: 'print-queue', label: 'Fila de impressão', mobileEntry: 'more', capability: 'printing.queue' }),
  Object.freeze({ id: 'dashboard', area: 'finance', label: 'Visão geral', mobileEntry: 'finance', capability: 'finance.overview' }),
  Object.freeze({ id: 'receivables', area: 'finance', label: 'A receber', mobileEntry: 'finance', capability: 'finance.receivables' }),
  Object.freeze({ id: 'finance', area: 'finance', label: 'Movimentações', mobileEntry: 'finance', capability: 'finance.movements' }),
  Object.freeze({ id: 'clients', area: 'clients', label: 'Clientes', mobileEntry: 'more', capability: 'clients.view' }),
  Object.freeze({ id: 'products', area: 'products', label: 'Produtos e preços', mobileEntry: 'more', capability: 'products.view' }),
  Object.freeze({ id: 'tables', area: 'tables', label: 'Mesas', mobileEntry: 'more', capability: 'tables.view' }),
  Object.freeze({ id: 'settings-printing', area: 'settings', label: 'Impressão', mobileEntry: 'more', anyCapability: Object.freeze(['printing.settings.view', 'printing.settings', 'printing.station.view', 'printing.station.configure']) }),
  Object.freeze({ id: 'settings-device', area: 'settings', label: 'Preferências deste dispositivo', mobileEntry: 'more', capability: 'preferences.local' }),
])

export const destinationById = new Map(NAVIGATION_DESTINATIONS.map((item) => [item.id, item]))
export const AREA_DESTINATION_IDS = Object.freeze({
  orders: Object.freeze(['orders', 'history']),
  finance: Object.freeze(['dashboard', 'receivables', 'finance']),
  settings: Object.freeze(['settings-home', 'settings-operations', 'settings-modalities', 'settings-payments', 'settings-cancellations', 'settings-finance-categories', 'settings-printing', 'settings-device']),
})
export const HOME_AREA_ORDER = Object.freeze(['orders', 'finance', 'settings'])
export const AREA_LABELS = Object.freeze({ orders: 'Pedidos', finance: 'Financeiro', settings: 'Configurações' })
export const DESKTOP_NAV_GROUPS = Object.freeze([
  Object.freeze({ label: 'OPERAÇÃO', items: Object.freeze([{ area: 'orders', label: 'Pedidos', icon: 'orders' }, { id: 'comandas', label: 'Comandas', icon: 'clipboard' }, { id: 'print-queue', label: 'Fila de impressão', icon: 'printer' }]) }),
  Object.freeze({ label: 'FINANCEIRO', items: Object.freeze([{ id: 'dashboard', label: 'Visão geral', icon: 'dashboard' }, { id: 'receivables', label: 'A receber', icon: 'wallet' }, { id: 'finance', label: 'Movimentações', icon: 'finance' }]) }),
  Object.freeze({ label: 'CADASTROS', items: Object.freeze([{ id: 'clients', label: 'Clientes', icon: 'clients' }, { id: 'products', label: 'Produtos e preços', icon: 'products' }, { id: 'tables', label: 'Mesas', icon: 'table' }]) }),
  Object.freeze({ label: 'CONFIGURAÇÕES', items: Object.freeze([{ area: 'settings', label: 'Configurações', icon: 'settings' }]) }),
])
export const MOBILE_DIRECT_ENTRIES = Object.freeze([{ area: 'orders', label: 'Pedidos', icon: 'orders' }, { id: 'comandas', label: 'Comandas', icon: 'clipboard' }, { area: 'finance', label: 'Financeiro', icon: 'finance' }])
export const MOBILE_MORE_ENTRIES = Object.freeze([{ id: 'print-queue', icon: 'printer' }, { id: 'clients', icon: 'clients' }, { id: 'products', icon: 'products' }, { id: 'tables', icon: 'table' }, { area: 'settings', icon: 'settings', label: 'Configurações' }])
export const MOBILE_SECTION_IDS = Object.freeze(['orders', 'history', 'comandas', 'dashboard', 'receivables', 'finance', 'print-queue', 'clients', 'products', 'tables', 'settings-printing', 'settings-device'])
```

- [ ] **Step 4: Escrever o RED/characterization da resolução**

Mover o teste atual para `src/app/navigation/resolution.test.js`, preservar todas as asserções existentes e acrescentar:

```js
import { getMobilePageDirection, resolveHome, resolveNavigationEntry } from './resolution.js'

test('home e entries usam somente o registry atual', () => {
  const implemented = new Set(['orders', 'history', 'dashboard', 'receivables', 'finance'])
  assert.equal(resolveHome(new Set(['finance.receivables']), implemented), 'receivables')
  assert.deepEqual(
    resolveNavigationEntry({ area: 'finance', label: 'Financeiro' }, new Set(['finance.receivables']), implemented),
    { area: 'finance', label: 'Financeiro', id: 'receivables' },
  )
})

test('direção mobile preserva none fora da lista histórica', () => {
  assert.equal(getMobilePageDirection('orders', 'history'), 'forward')
  assert.equal(getMobilePageDirection('finance', 'dashboard'), 'backward')
  assert.equal(getMobilePageDirection('settings-home', 'settings-payments'), 'none')
})
```

- [ ] **Step 5: Implementar `resolution.js` com decisões puras**

```js
import { hasCapability } from '../access.js'
import {
  AREA_DESTINATION_IDS,
  HOME_AREA_ORDER,
  MOBILE_SECTION_IDS,
  NAVIGATION_DESTINATIONS,
  destinationById,
} from './registry.js'

const canAccess = (destination, granted) => destination.capability
  ? hasCapability(granted, destination.capability)
  : destination.anyCapability.some((key) => hasCapability(granted, key))

export function resolveDestination(id, granted, implemented) {
  const destination = destinationById.get(id)
  if (!destination) return { status: 'unknown' }
  if (!canAccess(destination, granted)) return { status: 'denied' }
  if (!(implemented instanceof Set) || !implemented.has(id)) return { status: 'unavailable' }
  return { status: 'allowed', id }
}

export function resolveArea(area, granted, implemented) {
  for (const id of AREA_DESTINATION_IDS[area] || []) {
    if (resolveDestination(id, granted, implemented).status === 'allowed') return id
  }
  return null
}

export function resolveHome(granted, implemented) {
  for (const area of HOME_AREA_ORDER) {
    const id = resolveArea(area, granted, implemented)
    if (id) return id
  }
  for (const { id } of NAVIGATION_DESTINATIONS) {
    if (id !== 'new-order' && resolveDestination(id, granted, implemented).status === 'allowed') return id
  }
  return null
}

export function resolveNavigationEntry(entry, granted, implemented) {
  const id = entry.area
    ? resolveArea(entry.area, granted, implemented)
    : resolveDestination(entry.id, granted, implemented).status === 'allowed' ? entry.id : null
  return id ? { ...entry, id, label: entry.label || destinationById.get(id)?.label } : null
}

export function decideNavigation({ allowed, checkoutPending, dirtyOrder, leavingOrder }) {
  if (!allowed) return 'reject'
  if (checkoutPending) return 'blocked'
  if (dirtyOrder && leavingOrder) return 'confirm'
  return 'navigate'
}

export function getMobilePageDirection(previousId, activeId) {
  const previousIndex = MOBILE_SECTION_IDS.indexOf(previousId)
  const activeIndex = MOBILE_SECTION_IDS.indexOf(activeId)
  if (previousId === activeId || previousIndex < 0 || activeIndex < 0) return 'none'
  return activeIndex > previousIndex ? 'forward' : 'backward'
}
```

- [ ] **Step 6: Manter compatibilidade apenas durante a própria C2**

Transformar temporariamente `src/app/navigation.js` em reexport para os consumidores ainda não movidos:

```js
export { NAVIGATION_DESTINATIONS, NAVIGATION_DESTINATIONS as destinations } from './navigation/registry.js'
export { decideNavigation, resolveArea, resolveDestination } from './navigation/resolution.js'
```

Esse arquivo deve ser removido na Task 6 e não pode chegar ao staging final.

- [ ] **Step 7: Rodar GREEN e regressões puras**

```bash
node --test src/app/navigation/registry.test.js src/app/navigation/resolution.test.js
npm run lint
npm run test:architecture
```

Expected: PASS.

- [ ] **Step 8: Revisar diff e commit**

```bash
git diff --check
git diff -- src/app/navigation src/app/navigation.js
git add src/app/navigation src/app/navigation.js
git commit -m "refactor: centralize navigation registry"
```

---

### Task 2: Mover controller/query e extrair guard de Settings

**Files:**
- Move: `src/app/useNavigationController.js` → `src/app/navigation/useNavigationController.js`
- Move: `src/app/queryContext.js` → `src/app/navigation/queryContext.js`
- Move: `src/app/useQueryContext.js` → `src/app/navigation/useQueryContext.js`
- Move: `src/app/queryContext.test.js` → `src/app/navigation/queryContext.test.js`
- Create: `src/app/navigation/settingsDraftGuard.js`
- Create: `src/app/navigation/settingsDraftGuard.test.js`
- Modify: `src/navigationContext.test.js`
- Modify: `src/App.jsx` imports/guard adapter only; não alterar composição ainda

**Interfaces:**
- Consumes: registry/resolution da Task 1 e `DEFAULT_PRINT_QUEUE_QUERY` existente.
- Produces: `useNavigationController()` com a mesma API atual; `createQueryContext()`, `patchQueryContext()`, `useQueryContext()` com a mesma semântica; `getSettingsDraftForDestination()`, `shouldConfirmSettingsExit()`, `hasSettingsUnloadRisk()`.

- [ ] **Step 1: Escrever RED do guard de Settings**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getSettingsDraftForDestination,
  shouldConfirmSettingsExit,
  hasSettingsUnloadRisk,
} from './settingsDraftGuard.js'

const dirtyOperations = {
  operations: { dirty: true, status: 'idle', scopeId: null },
}

test('operações e modalidades compartilham o mesmo guard', () => {
  const draft = getSettingsDraftForDestination(dirtyOperations, 'settings-operations')
  assert.equal(draft.resourceKey, 'operations')
  assert.equal(shouldConfirmSettingsExit(draft, 'settings-operations', 'settings-modalities'), false)
  assert.equal(shouldConfirmSettingsExit(draft, 'settings-operations', 'settings-home'), true)
})

test('saving/unconfirmed não cria bloqueio global novo', () => {
  for (const status of ['saving', 'unconfirmed']) {
    const draft = getSettingsDraftForDestination({ operations: { dirty: true, status } }, 'settings-operations')
    assert.equal(shouldConfirmSettingsExit(draft, 'settings-operations', 'orders'), false)
    assert.equal(hasSettingsUnloadRisk({ operations: { dirty: true, status } }), true)
  }
})
```

Run:

```bash
node --test src/app/navigation/settingsDraftGuard.test.js
```

Expected: FAIL porque o módulo ainda não existe.

- [ ] **Step 2: Implementar somente o adaptador de guard**

```js
const SETTINGS_DRAFT_ROUTES = Object.freeze({
  'settings-operations': Object.freeze({ resource: 'operations', destinations: new Set(['settings-operations', 'settings-modalities']) }),
  'settings-modalities': Object.freeze({ resource: 'operations', destinations: new Set(['settings-operations', 'settings-modalities']) }),
  'settings-payments': Object.freeze({ resource: 'paymentMethods', destinations: new Set(['settings-payments']) }),
  'settings-cancellations': Object.freeze({ resource: 'cancellationReasons', destinations: new Set(['settings-cancellations']) }),
  'settings-finance-categories': Object.freeze({ resource: 'financeCategories', destinations: new Set(['settings-finance-categories']) }),
  'settings-printing': Object.freeze({ resource: 'printingPolicy', destinations: new Set(['settings-printing']) }),
})

export function getSettingsDraftForDestination(resources, destination) {
  const route = SETTINGS_DRAFT_ROUTES[destination]
  const state = route ? resources?.[route.resource] : null
  return state ? { ...route, resourceKey: route.resource, dirty: state.dirty, status: state.status, scopeId: state.scopeId } : null
}

export const shouldConfirmSettingsExit = (draft, active, destination) => Boolean(
  draft?.dirty
  && !['saving', 'unconfirmed'].includes(draft.status)
  && draft.destinations instanceof Set
  && draft.destinations.has(active)
  && !draft.destinations.has(destination),
)

export function hasSettingsUnloadRisk(resources) {
  return Object.values(resources || {}).some((resource) => (
    resource?.dirty === true || ['saving', 'unconfirmed'].includes(resource?.status)
  ))
}
```

- [ ] **Step 3: Mover controller e query sem reescrever comportamento**

Usar moves reais para manter histórico:

```bash
mkdir -p src/app/navigation
git mv src/app/useNavigationController.js src/app/navigation/useNavigationController.js
git mv src/app/queryContext.js src/app/navigation/queryContext.js
git mv src/app/useQueryContext.js src/app/navigation/useQueryContext.js
git mv src/app/queryContext.test.js src/app/navigation/queryContext.test.js
```

Ajustes exatos:

- `queryContext.js`: `../pages/printQueueQuery.js` → `../../pages/printQueueQuery.js`.
- `useQueryContext.js`: continua importando `./queryContext.js`.
- controller: importar `NAVIGATION_DESTINATIONS` de `./registry.js`, `decideNavigation`, `resolveArea`, `resolveDestination`, `resolveHome` de `./resolution.js`, e `shouldConfirmSettingsExit` de `./settingsDraftGuard.js`.
- remover `HOME_AREAS`, `resolveHome()` local, `hasSettingsUnloadRisk()` local e `shouldConfirmSettingsExit()` local do controller.
- manter mensagens, precedência e API pública atuais sem alteração.

- [ ] **Step 4: Atualizar App somente nos imports e callbacks de guard**

No `src/App.jsx`:

```js
import { resolveDestination } from './app/navigation/resolution.js'
import { useNavigationController } from './app/navigation/useNavigationController.js'
import { useQueryContext } from './app/navigation/useQueryContext.js'
import { getSettingsDraftForDestination, hasSettingsUnloadRisk } from './app/navigation/settingsDraftGuard.js'
```

Remover `SETTINGS_DRAFT_ROUTES` e `settingsDraftAt` do topo; no controller usar:

```js
getSettingsDraft: (destination) => getSettingsDraftForDestination(
  businessSettingsRef.current?.resources,
  destination,
),
```

Não tocar ainda no return/composição do App.

- [ ] **Step 5: Atualizar os testes existentes para os novos caminhos e reforçar guards**

Em `src/navigationContext.test.js`, trocar loads para:

```js
const { useQueryContext } = await h.load('/src/app/navigation/useQueryContext.js')
const { useNavigationController } = await h.load('/src/app/navigation/useNavigationController.js')
```

Acrescentar um caso com `getSettingsDraft`/`onDiscardSettings` confirmando que Settings dirty pede confirmação somente ao abandonar o recurso e que `saving`/`unconfirmed` não cria nova confirmação.

- [ ] **Step 6: Rodar GREEN focado**

```bash
node --test \
  src/app/navigation/queryContext.test.js \
  src/app/navigation/settingsDraftGuard.test.js \
  src/app/navigation/resolution.test.js \
  src/navigationContext.test.js \
  src/AppNewOrderGuard.test.js
npm run lint
npm run test:architecture
```

Expected: PASS.

- [ ] **Step 7: Confirmar que não há consumidor dos caminhos antigos antes do commit**

```bash
grep -R "app/useNavigationController\|app/useQueryContext\|app/queryContext" -n src --include='*.js' --include='*.jsx' || true
```

Expected: nenhuma referência de produção/teste aos três arquivos antigos.

- [ ] **Step 8: Revisar diff e commit**

```bash
git diff --check
git diff -- src/app/navigation src/App.jsx src/navigationContext.test.js
git add src/app/navigation src/App.jsx src/navigationContext.test.js
git commit -m "refactor: isolate navigation state ownership"
```

---

### Task 3: Adicionar NavigationContext mínimo e bridge `app:navigate`

**Files:**
- Create: `src/app/navigation/useNavigationEventBridge.js`
- Create: `src/app/navigation/NavigationContext.jsx`
- Create: `src/app/navigation/NavigationContext.test.js`

**Interfaces:**
- Consumes: `requestNavigation(target)` do controller.
- Produces: `NavigationProvider` e `useNavigation()`; contexto com exatamente `activeTab`, `activeMobileEntry`, `granted`, `implemented`, `moreOpen`, `requestNavigation`, `openMore`, `closeMore`; listener `app:navigate` somente enquanto o provider estiver montado.

- [ ] **Step 1: Escrever RED do contexto pequeno**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { workspaceHarness } from '../../test-support/renderWorkspace.js'

test('NavigationContext expõe somente o contrato de navegação', async (t) => {
  const h = await workspaceHarness(t)
  const { NavigationProvider, useNavigation } = await h.load('/src/app/navigation/NavigationContext.jsx')
  const seen = React.createRef()
  function Probe() {
    seen.current = useNavigation()
    return React.createElement('output', null, seen.current.activeTab)
  }
  await h.render(NavigationProvider, {
    activeTab: 'orders', activeMobileEntry: undefined,
    granted: new Set(['orders.view']), implemented: new Set(['orders']),
    moreOpen: false, requestNavigation() {}, openMore() {}, closeMore() {},
    children: React.createElement(Probe),
  })
  assert.deepEqual(Object.keys(seen.current).sort(), [
    'activeMobileEntry', 'activeTab', 'closeMore', 'granted', 'implemented',
    'moreOpen', 'openMore', 'requestNavigation',
  ].sort())
  assert.equal(Object.hasOwn(seen.current, 'orders'), false)
})
```

Expected RED: arquivo inexistente.

- [ ] **Step 2: Escrever RED do bridge e cleanup**

No mesmo teste, instrumentar `window.addEventListener/removeEventListener` e verificar:

```js
const calls = []
const handlers = new Map()
const originalAdd = window.addEventListener
const originalRemove = window.removeEventListener
window.addEventListener = (type, handler) => handlers.set(type, handler)
window.removeEventListener = (type, handler) => {
  if (handlers.get(type) === handler) handlers.delete(type)
}
t.after(() => {
  window.addEventListener = originalAdd
  window.removeEventListener = originalRemove
})

// montar provider com requestNavigation: value => calls.push(value)
handlers.get('app:navigate')?.({ detail: 'clients' })
handlers.get('app:navigate')?.({ detail: { id: 'clients' } })
assert.deepEqual(calls, ['clients'])
// unmount
assert.equal(handlers.has('app:navigate'), false)
```

- [ ] **Step 3: Implementar bridge com callback atual e listener único**

```js
import { useEffect, useRef } from 'react'

export function useNavigationEventBridge(requestNavigation) {
  const navigateRef = useRef(requestNavigation)
  useEffect(() => { navigateRef.current = requestNavigation }, [requestNavigation])
  useEffect(() => {
    const handleNavigate = (event) => {
      if (typeof event?.detail === 'string') navigateRef.current?.(event.detail)
    }
    window.addEventListener('app:navigate', handleNavigate)
    return () => window.removeEventListener('app:navigate', handleNavigate)
  }, [])
}
```

- [ ] **Step 4: Implementar provider restrito**

```jsx
import { createContext, useContext, useMemo } from 'react'
import { useNavigationEventBridge } from './useNavigationEventBridge.js'

const NavigationContext = createContext(null)

export function NavigationProvider({
  activeTab,
  activeMobileEntry,
  granted,
  implemented,
  moreOpen,
  requestNavigation,
  openMore,
  closeMore,
  children,
}) {
  useNavigationEventBridge(requestNavigation)
  const value = useMemo(() => ({
    activeTab, activeMobileEntry, granted, implemented, moreOpen,
    requestNavigation, openMore, closeMore,
  }), [activeTab, activeMobileEntry, granted, implemented, moreOpen, requestNavigation, openMore, closeMore])
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>
}

export function useNavigation() {
  const value = useContext(NavigationContext)
  if (!value) throw new Error('useNavigation must be used within NavigationProvider')
  return value
}
```

- [ ] **Step 5: Rodar GREEN**

```bash
node --test src/app/navigation/NavigationContext.test.js
npm run lint
```

Expected: PASS, um listener durante montagem e cleanup no unmount.

- [ ] **Step 6: Revisar diff e commit**

```bash
git diff --check
git add src/app/navigation/NavigationContext.jsx src/app/navigation/useNavigationEventBridge.js src/app/navigation/NavigationContext.test.js
git commit -m "refactor: add scoped navigation context"
```

---

### Task 4: Mover shell/menus/AreaNavigation para seus owners

**Files:**
- Move: `src/components/AppShell.jsx` → `src/app/shell/AppShell.jsx`
- Move: `src/components/Sidebar.jsx` → `src/app/shell/Sidebar.jsx`
- Move: `src/components/MobileNavigation.jsx` → `src/app/shell/MobileNavigation.jsx`
- Move: `src/components/AreaNavigation.jsx` → `src/app/navigation/AreaNavigation.jsx`
- Delete after migration: `src/utils/mobileNavigation.js`
- Create: `src/app/shell/AppShell.test.js`
- Create: `src/app/navigation/AreaNavigation.test.js`
- Modify: `src/pages/Orders.jsx`
- Modify: `src/pages/OrderHistory.jsx`
- Modify: `src/pages/Dashboard.jsx`
- Modify: `src/pages/Receivables.jsx`
- Modify: `src/pages/Finance.jsx`
- Modify: `src/pages/Settings.jsx`
- Modify: `src/App.jsx` import de `AppShell` e props de páginas apenas

**Interfaces:**
- Consumes: `NavigationProvider/useNavigation`, registry/resolution e `getMobilePageDirection()`.
- Produces: shell autenticado que não contém registry local nem listener global; menus e AreaNavigation usam o mesmo contrato.

- [ ] **Step 1: Escrever RED da AreaNavigation baseada no contexto**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { buttonNamed, workspaceHarness } from '../../test-support/renderWorkspace.js'

test('AreaNavigation usa o contexto e mantém somente destinos permitidos da área', async (t) => {
  const h = await workspaceHarness(t)
  const { NavigationProvider } = await h.load('/src/app/navigation/NavigationContext.jsx')
  const { default: AreaNavigation } = await h.load('/src/app/navigation/AreaNavigation.jsx')
  const calls = []
  const renderer = await h.render(NavigationProvider, {
    activeTab: 'history',
    granted: new Set(['orders.view', 'orders.history']),
    implemented: new Set(['orders', 'history', 'new-order']),
    moreOpen: false,
    requestNavigation: (id) => calls.push(id), openMore() {}, closeMore() {},
    children: React.createElement(AreaNavigation, { area: 'orders' }),
  })
  const nav = renderer.root.findByProps({ 'aria-label': 'Navegação de Pedidos' })
  assert.equal(buttonNamed(nav, 'Histórico').props['aria-current'], 'page')
  await buttonNamed(nav, 'Cozinha').props.onClick()
  assert.deepEqual(calls, ['orders'])
})
```

Expected RED: novo caminho ainda não existe.

- [ ] **Step 2: Escrever RED da transição/foco do shell**

Criar `AppShell.test.js` com provider e `createNodeMock`/harness para comprovar:

- `orders → history` resulta `data-direction="forward"`;
- `history → orders` resulta `backward`;
- `settings-home → settings-payments` continua `none`;
- mudança de `activeTab` chama `focus()` uma vez no `.app-content`;
- o shell não registra `app:navigate` diretamente.

A asserção de direção deve derivar do comportamento real do `AppShell`; a lógica pura já está coberta em `resolution.test.js`.

- [ ] **Step 3: Mover arquivos preservando JSX/CSS existente**

```bash
mkdir -p src/app/shell src/app/navigation
git mv src/components/AppShell.jsx src/app/shell/AppShell.jsx
git mv src/components/Sidebar.jsx src/app/shell/Sidebar.jsx
git mv src/components/MobileNavigation.jsx src/app/shell/MobileNavigation.jsx
git mv src/components/AreaNavigation.jsx src/app/navigation/AreaNavigation.jsx
```

Ajustar imports mecânicos:

- shell → componentes compartilhados via `../../components/...`;
- `AppShell` → `../../order-cancellation.css`, `../../components/DashboardPeriodProvider`;
- `MobileNavigation` → `../../mobile-navigation.css`, `../../components/BottomSheet`, `../../components/Icon`;
- `AreaNavigation` → `../../area-navigation.css` se necessário e registry/context locais.

- [ ] **Step 4: Remover definições duplicadas de menu dos componentes**

`Sidebar.jsx` deve consumir:

```js
import { DESKTOP_NAV_GROUPS } from '../navigation/registry.js'
import { resolveNavigationEntry } from '../navigation/resolution.js'
import { useNavigation } from '../navigation/NavigationContext.jsx'
```

E obter `activeTab`, `activeMobileEntry`, `granted`, `implemented`, `requestNavigation` do contexto. Não manter `groups`/`activeAreas` locais; a atividade por área deve usar `destinationById.get(activeTab)?.area === item.area`, preservando `new-order` como área `orders`.

`MobileNavigation.jsx` deve consumir `MOBILE_DIRECT_ENTRIES`, `MOBILE_MORE_ENTRIES`, `destinationById`, `resolveNavigationEntry` e `useNavigation()`. Remover `directEntries`, `moreEntries` e `destinationById` locais.

`AreaNavigation.jsx` deve receber somente `{ area }` e usar:

```jsx
const { activeTab, granted, implemented, requestNavigation } = useNavigation()
const destinations = NAVIGATION_DESTINATIONS.filter((destination) => (
  destination.area === area
  && destination.id !== 'new-order'
  && resolveDestination(destination.id, granted, implemented).status === 'allowed'
))
```

- [ ] **Step 5: Deixar AppShell somente com shell/foco/transição**

Remover o effect de `app:navigate`. Usar:

```js
const { activeTab } = useNavigation()
const previousTab = useRef(activeTab)
const contentRef = useRef(null)
const [pageDirection, setPageDirection] = useState('none')

useEffect(() => {
  setPageDirection(getMobilePageDirection(previousTab.current, activeTab))
  if (previousTab.current !== activeTab) contentRef.current?.focus?.()
  previousTab.current = activeTab
}, [activeTab])
```

Manter exatamente `key={activeTab}`, `className="app-content page-transition"`, `tabIndex={-1}` e `DashboardPeriodProvider`.

- [ ] **Step 6: Migrar os seis consumidores de AreaNavigation**

Trocar imports para `../app/navigation/AreaNavigation.jsx` e renderizar somente `area`:

```jsx
<AreaNavigation area="orders" />
<AreaNavigation area="finance" />
<AreaNavigation area="settings" />
```

Remover de signatures/props somente argumentos usados exclusivamente por AreaNavigation:

- `Orders`: remover `implemented`, `onNavigate`; manter `granted` porque pagamento usa capability.
- `OrderHistory`: remover `implemented`, `onNavigate`, `activeTab`; manter `granted`.
- `Dashboard`: remover `granted`, `implemented`, `onNavigate`, `activeTab`.
- `Receivables`: remover `granted`, `implemented`, `onNavigate`, `activeTab` se não houver outro uso no arquivo.
- `Finance`: remover `granted`, `implemented`, `onNavigate`, `activeTab` se não houver outro uso no arquivo.
- `Settings`: manter `granted`, `implemented`, `onNavigate` porque a própria superfície e `SettingsHome` ainda os usam; somente AreaNavigation deixa de receber esses props.

Atualizar as chamadas correspondentes em `App.jsx`, sem mover handlers de domínio.

- [ ] **Step 7: Remover util legado de transição**

Depois de nenhum import restante:

```bash
grep -R "utils/mobileNavigation" -n src --include='*.js' --include='*.jsx' || true
git rm src/utils/mobileNavigation.js
```

- [ ] **Step 8: Rodar GREEN e regressões de navegação/superfícies**

```bash
node --test \
  src/app/navigation/registry.test.js \
  src/app/navigation/resolution.test.js \
  src/app/navigation/AreaNavigation.test.js \
  src/app/shell/AppShell.test.js \
  src/navigationContext.test.js \
  src/AppNewOrderGuard.test.js \
  src/pages/DashboardMobile.test.js \
  src/pages/ClientsProductsMobile.test.js
npm run lint
npm run test:architecture
```

Expected: PASS.

- [ ] **Step 9: Revisar diff e commit**

```bash
git diff --check
git diff -- src/app/shell src/app/navigation src/pages src/App.jsx src/utils/mobileNavigation.js
git add -A src/app/shell src/app/navigation src/pages src/App.jsx src/utils/mobileNavigation.js
git commit -m "refactor: move application shell navigation"
```

---

### Task 5: Extrair AppRoot fino para estados globais

**Files:**
- Create: `src/app/shell/AppRoot.jsx`
- Create: `src/app/shell/AppRoot.test.js`
- Modify: `src/App.jsx` somente na integração visual global

**Interfaces:**
- Consumes props já calculados pelo App: `authState`, `isOnline`, login state/callback, bootstrap state/retry, feedback e `children`.
- Produces somente estados globais visuais; nenhum dado/handler de domínio entra no `AppRoot`.

- [ ] **Step 1: Escrever RED dos cinco estados globais**

Cobrir em `AppRoot.test.js`:

```js
const base = {
  isOnline: true,
  authState: 'authenticated',
  loginLoading: false,
  loginError: '',
  onLogin() {},
  bootstrapState: 'ready',
  onRetryBootstrap() {},
  retryDisabled: false,
  toastMessage: '',
  successMessage: '',
  children: React.createElement('div', { id: 'ready-content' }, 'ready'),
}
```

Asserções obrigatórias:

- `authState='checking'` → “Carregando sistema” / “Verificando sua sessão…”;
- `anonymous` → Login e banner quando `isOnline=false`;
- `bootstrapState='loading'` → “Carregando dados”;
- `bootstrapState='error'` → botão “Tentar novamente” chama `onRetryBootstrap`;
- `ready` → monta `children` e feedback global.

Expected RED: `AppRoot.jsx` inexistente.

- [ ] **Step 2: Implementar AppRoot sem domínio**

Estrutura de implementação:

```jsx
import { createPortal } from 'react-dom'
import Button from '../../components/Button'
import ConnectionBanner from '../../components/ConnectionBanner'
import Icon from '../../components/Icon'
import LoginScreen from '../../components/LoginScreen'

const renderToast = (message) => (
  <div className="toast-success" role="status">
    <span className="toast-icon"><Icon name="dashboard" size={17} /></span>{message}
  </div>
)

const renderSuccess = (message) => (
  <div className="success-confirmation-overlay" role="status" aria-live="polite">
    <div className="success-confirmation-card">
      <span className="success-confirmation-icon"><Icon name="check" size={30} /></span>
      <strong>{message}</strong>
    </div>
  </div>
)

export default function AppRoot({
  isOnline,
  authState,
  loginLoading,
  loginError,
  onLogin,
  bootstrapState,
  onRetryBootstrap,
  retryDisabled,
  toastMessage,
  successMessage,
  children,
}) {
  if (authState === 'checking') return <div className="system-state-screen"><div className="system-state-card"><h2>Carregando sistema</h2><p>Verificando sua sessão…</p></div></div>
  if (authState === 'anonymous') return <>{!isOnline && <ConnectionBanner />}<LoginScreen onLogin={onLogin} loading={loginLoading} error={loginError} disabled={!isOnline} /></>
  if (bootstrapState !== 'ready') return <>{!isOnline && <ConnectionBanner />}<div className="system-state-screen"><div className="system-state-card">{bootstrapState === 'error' ? <><h2>Não foi possível carregar os dados</h2><p>Confira sua conexão e tente novamente.</p><Button type="button" onClick={onRetryBootstrap} disabled={retryDisabled}>Tentar novamente</Button></> : <><h2>Carregando dados</h2><p>Sincronizando a operação da Amor &amp; Sabor…</p></>}</div></div></>

  const toast = toastMessage ? renderToast(toastMessage) : null
  const success = successMessage ? renderSuccess(successMessage) : null
  const portal = (node) => node && typeof document !== 'undefined' ? createPortal(node, document.body) : node
  return <>{!isOnline && <ConnectionBanner />}{portal(toast)}{portal(success)}{children}</>
}
```

Não adicionar outras props.

- [ ] **Step 3: Rodar GREEN unitário**

```bash
node --test src/app/shell/AppRoot.test.js
```

Expected: PASS.

- [ ] **Step 4: Integrar AppRoot sem alterar a árvore ready**

No `App.jsx`:

- importar `AppRoot` de `./app/shell/AppRoot.jsx`;
- remover imports diretos `createPortal`, `ConnectionBanner` e `LoginScreen` se não usados em outro lugar;
- remover os três early returns de checking/anonymous/bootstrap;
- envolver a árvore atual no fim do App:

```jsx
return (
  <AppRoot
    isOnline={isOnline}
    authState={authState}
    loginLoading={requestKey === 'auth:login'}
    loginError={loginError}
    onLogin={handleLogin}
    bootstrapState={bootstrapState}
    onRetryBootstrap={() => void refreshBootstrap()}
    retryDisabled={!isOnline || requestKey !== null}
    toastMessage={toastMessage}
    successMessage={successMessage}
  >
    {/* árvore autenticada ready permanece aqui */}
  </AppRoot>
)
```

O AppRoot não deve conhecer `orders`, `clients`, `printing`, settings ou handlers CRUD.

- [ ] **Step 5: Rodar regressões de sessão/bootstrap/feedback**

```bash
node --test \
  src/app/shell/AppRoot.test.js \
  src/app/runtime/session/useSessionRuntime.test.js \
  src/app/runtime/feedback/useFeedbackRuntime.test.js \
  src/app/runtime/runtimeExtractionContract.test.js \
  src/navigationContext.test.js
npm run lint
```

Expected: PASS.

- [ ] **Step 6: Revisar diff e commit**

```bash
git diff --check
git diff -- src/app/shell/AppRoot.jsx src/app/shell/AppRoot.test.js src/App.jsx
git add src/app/shell/AppRoot.jsx src/app/shell/AppRoot.test.js src/App.jsx
git commit -m "refactor: extract app root composition"
```

---

### Task 6: Integrar NavigationProvider e fechar a fronteira C2

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/navigationContext.test.js`
- Create: `src/app/navigation/navigationExtractionContract.test.js`
- Delete: `src/app/navigation.js` (reexport temporário da Task 1)
- Verify absent: todos os caminhos legados listados no File map

**Interfaces:**
- Consumes: controller/query/guard, NavigationProvider, AppRoot/AppShell.
- Produces: árvore ready com um único contrato de navegação; `App.jsx` continua dono apenas das operações transitórias C3-C9 e sinais necessários como `activeTab` para Cozinha.

- [ ] **Step 1: Escrever RED do contrato estrutural final**

Criar `navigationExtractionContract.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'

const legacyPaths = [
  'src/app/navigation.js',
  'src/app/useNavigationController.js',
  'src/app/queryContext.js',
  'src/app/useQueryContext.js',
  'src/components/AppShell.jsx',
  'src/components/Sidebar.jsx',
  'src/components/MobileNavigation.jsx',
  'src/components/AreaNavigation.jsx',
  'src/utils/mobileNavigation.js',
]

test('C2 remove caminhos legados de shell/navigation', async () => {
  for (const path of legacyPaths) {
    await assert.rejects(access(path), undefined, `${path} should not exist after C2`)
  }
})

test('App não redefine registry nem listener global de navegação', async () => {
  const source = await readFile('src/App.jsx', 'utf8')
  assert.equal(source.includes('SETTINGS_DRAFT_ROUTES'), false)
  assert.equal(source.includes("addEventListener('app:navigate'"), false)
  assert.equal(source.includes('DESKTOP_NAV_GROUPS'), false)
  assert.equal(source.includes('MOBILE_DIRECT_ENTRIES'), false)
  assert.match(source, /ordersSyncEnabled:\s*activeTab === 'orders'/)
})
```

Expected RED antes da integração final: ao menos `src/app/navigation.js` ainda existe.

- [ ] **Step 2: Montar NavigationProvider somente dentro do estado ready**

Derivar no `App.jsx`:

```js
const activeMobileEntry = activeTab === 'new-order' ? newOrderContext.returnTab : undefined
```

Dentro dos children de `AppRoot`, envolver shell + modais ready:

```jsx
<NavigationProvider
  activeTab={activeTab}
  activeMobileEntry={activeMobileEntry}
  granted={granted}
  implemented={IMPLEMENTED_DESTINATIONS}
  moreOpen={moreOpen}
  requestNavigation={requestNavigation}
  openMore={openMore}
  closeMore={closeMore}
>
  <AppShell
    onLogout={handleLogout}
    logoutDisabled={writesBlocked}
    dashboardPeriod={query.dashboard.period}
    onDashboardPeriodChange={(period) => patchQuery('dashboard', { period })}
  >
    {/* páginas atuais */}
  </AppShell>
  {/* modais/overlays de domínio atuais continuam definidos no App */}
</NavigationProvider>
```

Como `AppRoot` só renderiza `children` quando ready, o listener `app:navigate` mantém a mesma janela de vida que o AppShell autenticado atual.

- [ ] **Step 3: Preservar os pontos em que App ainda precisa de activeTab**

Não alterar estas relações:

```js
ordersSyncEnabled: activeTab === 'orders' && isOnline && authState === 'authenticated'
const kitchenNow = useKitchenClock(orders, { active: activeTab === 'orders', currentTiming })
```

Preservar também:

- `resetNavigation()` e `resetQueries()` em `clearBusinessData()`;
- `handleCancelDiscard()` com `requestAnimationFrame(() => document.querySelector?.('.app-content')?.focus?.())`;
- `pendingDestination`/`pendingDiscardKind`, `confirmDiscard`, `cancelDiscard`, `discardSettingsAndNavigate`, `completeNavigation` consumidos diretamente do controller onde já são necessários ao App.

- [ ] **Step 4: Reforçar integração em `navigationContext.test.js`**

Acrescentar caracterizações:

1. `app:navigate` em estado authenticated/ready navega para destino permitido;
2. após logout/Login novo, query anterior não reaparece;
3. Novo Pedido iniciado a partir de Comandas mantém `Comandas` como entrada mobile ativa e retorno correto;
4. cancelamento do dialog de discard mantém o wizard e devolve foco ao conteúdo.

Reutilizar `workspaceHarness`, `buttonNamed`, `nodeText` já existentes; não criar novo harness.

- [ ] **Step 5: Remover o reexport temporário e provar ausência de imports antigos**

```bash
grep -R "from './app/navigation'\|from '../app/navigation'\|from './navigation.js'\|from '../navigation.js'" -n src --include='*.js' --include='*.jsx' || true
git rm src/app/navigation.js
```

Depois:

```bash
grep -R "components/AppShell\|components/Sidebar\|components/MobileNavigation\|components/AreaNavigation\|utils/mobileNavigation\|app/useNavigationController\|app/useQueryContext\|app/queryContext" -n src --include='*.js' --include='*.jsx' || true
```

Expected: nenhuma referência aos caminhos legados.

- [ ] **Step 6: Rodar GREEN focado + regressões proporcionais**

```bash
node --test \
  src/app/navigation/registry.test.js \
  src/app/navigation/resolution.test.js \
  src/app/navigation/queryContext.test.js \
  src/app/navigation/settingsDraftGuard.test.js \
  src/app/navigation/NavigationContext.test.js \
  src/app/navigation/AreaNavigation.test.js \
  src/app/navigation/navigationExtractionContract.test.js \
  src/app/shell/AppShell.test.js \
  src/app/shell/AppRoot.test.js \
  src/navigationContext.test.js \
  src/AppNewOrderGuard.test.js \
  src/actionCapabilities.test.js
npm run lint
npm run test:architecture
```

Expected: PASS.

- [ ] **Step 7: Revisar diff contra o escopo C2**

```bash
git diff --check
git diff f5d8b7267cdbf91a7d254a3c1546464d4d9b0210...HEAD -- src scripts package.json .github
```

Bloqueadores de revisão:

- qualquer alteração em `worker/`, `migrations/`, endpoint ou dependência;
- mudança deliberada de CSS/textos/menu;
- criação de context com coleções/handlers de domínio;
- mudança nos intervalos/políticas de sync;
- facade legado permanecendo sem remoção.

- [ ] **Step 8: Commit de fechamento funcional C2**

```bash
git add -A src
git commit -m "refactor: complete c2 navigation boundary"
```

Não fazer deploy nem merge ainda.

---

### Task 7: Gates finais, PR, staging e homologação C2

**Files:**
- Create somente após evidência real: `docs/superpowers/qa/spec-c2-navigation-composition-qa.md`
- Modify após evidência real: `docs/superpowers/qa/spec-c-execution-ledger.md`
- Modify status-only: `docs/superpowers/plans/2026-09-15-frontend-modularization-rollout-plan.md`
- Modify se necessário: `docs/superpowers/qa/spec-c-compatibility-facades.md`

**Interfaces:**
- Consumes: HEAD funcional fechado da Task 6.
- Produces: evidência reproduzível de CI/staging/manual QA e gate de decisão de merge; não produz release de produção.

- [ ] **Step 1: Rodar todos os gates locais no HEAD funcional**

```bash
npm test
npm run lint
npm run test:architecture
npm run build
npm run d1:migrate:local
git diff --check
```

Todos devem PASS. Registrar o SHA exato após o último commit funcional:

```bash
git rev-parse HEAD
```

- [ ] **Step 2: Revisar o diff completo contra a base pós-C1**

```bash
git diff --stat f5d8b7267cdbf91a7d254a3c1546464d4d9b0210...HEAD
git diff --name-status f5d8b7267cdbf91a7d254a3c1546464d4d9b0210...HEAD
```

Confirmar explicitamente:

- nenhum `worker/**` ou `migrations/**` alterado;
- nenhuma mudança de dependência;
- `.github/workflows/deploy-staging.yml` sem trigger amplo novo;
- alterações limitadas a C2 + testes + documentação de execução.

- [ ] **Step 3: Abrir PR C2 em draft contra `master` e aguardar CI**

Título sugerido:

```text
Spec C2: modularizar navegação e composição do frontend
```

Descrição mínima:

- base C1/master SHA;
- escopo C2 e não objetivos;
- tarefas/commits;
- testes focados e gates locais;
- compatibilities (esperado: nenhuma nova final);
- produção não autorizada.

Não marcar ready/merge antes da homologação.

- [ ] **Step 4: Exigir Validate application verde no HEAD exato**

Conferir que o run corresponde ao SHA funcional/documental atual e que passam:

- `npm test`;
- architecture gate;
- lint;
- build;
- production/staging Worker dry-run;
- D1 local e gates existentes.

Não registrar PASS sem ID/run real.

- [ ] **Step 5: Deploy staging manual no SHA exato a homologar**

GitHub Actions → **Deploy staging** → `workflow_dispatch` → branch `feature/spec-c2-navigation-composition`.

Antes da homologação, conferir:

- `head_branch` exata;
- `head_sha` exato;
- event `workflow_dispatch`;
- conclusion `success`;
- teste/login smoke do workflow verde.

Não criar trigger automático para C2.

- [ ] **Step 6: Executar a matriz manual C2 e registrar somente resultados reais**

Matriz mínima obrigatória:

1. login e home continuam iguais;
2. Sidebar desktop abre cada área/destino permitido;
3. fallback de área permanece correto quando a capability principal não existe;
4. navegação mobile direta permanece correta;
5. `Mais` abre, navega e fecha corretamente;
6. navegação interna de Pedidos, Financeiro e Settings permanece correta;
7. buscas/filtros persistem ao trocar de página e somem após nova sessão;
8. Novo Pedido retorna para a origem correta, inclusive Comandas;
9. pedido sujo mantém confirmação de descarte e cancelar mantém o wizard;
10. checkout em andamento continua bloqueando saída;
11. Settings dirty mantém confirmação correta, sem novo bloqueio durante `saving`/`unconfirmed`;
12. foco e animação de troca de página continuam equivalentes;
13. Cozinha ativa polling `orders` ~2 s e sair da Cozinha interrompe o polling dedicado enquanto sync global continua;
14. `app:navigate` continua funcionando onde utilizado;
15. desktop/mobile + light/dark sem regressão visual atribuível a C2.

Qualquer FAIL interrompe o fechamento e volta para debugging/TDD; não mascarar como observação.

- [ ] **Step 7: Criar o QA record após a matriz real**

`docs/superpowers/qa/spec-c2-navigation-composition-qa.md` deve conter:

```markdown
# Spec C2 — Navigation and App Composition QA

- Branch: `feature/spec-c2-navigation-composition`
- Base SHA: `f5d8b7267cdbf91a7d254a3c1546464d4d9b0210`
- Homologated executable SHA: `<SHA real>`
- PR: `#<real>`
- Validate application: `#<run number>` / run `<id>` — PASS
- Deploy staging: `#<run number>` / run `<id>` — PASS (`workflow_dispatch`)
- Production deploy: **NO**

## Manual matrix
1. ... — PASS/FAIL + evidence
...
15. ... — PASS/FAIL + evidence

## Compatibility
- New final compatibility facades: none / exact entries if unavoidable.
```

Os campos entre `<...>` são instrução de formato para o executor: substituir pelos valores reais antes do commit; o arquivo não deve ser criado com placeholders.

- [ ] **Step 8: Reconciliar ledger/rollout somente com fatos já comprovados**

Atualizar:

- C1: MERGED + RELEASED, merge SHA `f5d8b726...`, Validate #1205/run `35114139465`, Deploy production #49/run `35114517283`, smoke de produção aprovado pelo usuário;
- C2: branch/PR reais, tarefas concluídas, CI/staging/QA reais;
- C3: bloqueada até aprovação/merge C2.

Não reescrever os contratos normativos do rollout; alterar apenas status de execução.

- [ ] **Step 9: Se QA/docs forem commitados depois do SHA homologado, provar docs-only**

```bash
git diff --name-only <SHA_HOMOLOGADO>..HEAD
```

Esperado: somente `docs/**`. Rodar a validação normal do novo HEAD; **não** redeployar staging apenas por commit docs-only.

Commit sugerido:

```bash
git add docs/superpowers/qa/spec-c2-navigation-composition-qa.md \
  docs/superpowers/qa/spec-c-execution-ledger.md \
  docs/superpowers/plans/2026-09-15-frontend-modularization-rollout-plan.md \
  docs/superpowers/qa/spec-c-compatibility-facades.md
git commit -m "docs: record c2 staging homologation"
```

- [ ] **Step 10: Parar no gate de decisão de merge**

Estado esperado:

- PR C2 aberta/draft ou pronta para review;
- CI verde;
- staging homologado 15/15;
- QA/ledger atualizados;
- produção intocada;
- C3 não iniciada.

Apresentar evidências ao usuário e solicitar autorização explícita para merge. Não fazer merge automaticamente. Após merge autorizado, validar a nova `master`; deploy de produção continua exigindo autorização separada.

---

## Plan self-review checklist

Antes da execução, o plano foi conferido contra a spec C2 nos seguintes pontos:

- registry único cobre destinos, fallbacks, desktop, mobile, `Mais` e transição;
- controller continua único owner de `activeTab`/pending navigation;
- queries continuam por sessão e invalidam callbacks antigos;
- Settings guard preserva `dirty` e não cria bloqueio novo em `saving`/`unconfirmed`;
- `app:navigate` sai do shell e mantém lifecycle equivalente;
- `NavigationContext` não recebe dados/handlers de domínio;
- shell mantém foco/transição e CSS atual;
- AppRoot contém apenas estados globais visuais;
- App continua usando `activeTab` para polling/clock da Cozinha;
- C3-C9 permanecem fora do escopo;
- nenhuma alteração de Worker/D1/API/dependências é prevista;
- staging permanece manual;
- homologação e produção continuam gates separados.
