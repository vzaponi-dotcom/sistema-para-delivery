# Spec C2 Navigation and App Composition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganizar navegação e composição do frontend em `src/app/navigation/` e `src/app/shell/`, criando um `AppRoot` fino e um contrato pequeno de navegação, sem alterar UX, regras de negócio, URLs, polling ou workflows de domínio.

**Architecture:** A C2 parte da `master` pós-C1 e mantém `App.jsx` como orquestrador transitório das responsabilidades destinadas a C3-C9. Um registry declarativo único descreve destinos/áreas/menus; funções puras resolvem acesso/fallback; `useNavigationController` continua sendo o único owner do estado transitório; `NavigationContext` expõe somente navegação; `AppRoot` e `AppShell` cuidam apenas da composição visual global e da moldura autenticada.

**Tech Stack:** React 19.2.8, React DOM 19.2.8, Vite 8.2.2, Node 22 `node:test`, `react-test-renderer` 19.2.8, oxlint 1.79.0, Cloudflare Worker/D1, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-16-frontend-modularization-c2-navigation-composition-design.md`

## Global Constraints

- Base obrigatória: `master` em `f5d8b7267cdbf91a7d254a3c1546464d4d9b0210`; branch: `feature/spec-c2-navigation-composition`.
- Não implementar diretamente na `master`.
- Preservar comportamento e visual atuais; C2 não é redesign, feature ou mudança de regra.
- Não adicionar React Router, Redux, Zustand, WebSocket/SSE, nova API, migration, dependência ou mecanismo próprio de URL/history.
- Não alterar Worker/D1 nem contratos HTTP. Qualquer necessidade desse tipo é bloqueio e exige nova decisão antes de continuar.
- Não alterar polling global (~5 s) nem polling dedicado de `orders` (~2 s enquanto Cozinha está ativa).
- `activeTab === 'orders'` continua sendo sinal transitório válido para polling/relógio da Cozinha nesta slice.
- Preservar IDs de destino, fallbacks de área, capabilities, `Mais`, retorno de Novo Pedido, guards de Novo Pedido/Settings, foco, animação e queries por sessão.
- Settings em `saving` ou `unconfirmed` não ganha guarda global de navegação; `beforeunload` continua com o owner atual até C3.
- Não antecipar C3-C9: settings engine, orders, table-service, finance/workflows, customers, catalog e printing permanecem nos donos atuais.
- Não mover CSS por estética. Ajustar somente caminhos de imports já existentes quando o arquivo dono for movido.
- Não adicionar trigger amplo `feature/**` em staging. C2 usa `workflow_dispatch` no SHA exato a homologar.
- Reexports usados para manter commits intermediários verdes devem desaparecer dentro da própria C2 antes de staging; facade que atravessar a slice exige registro no compatibility ledger.
- Cada tarefa: RED focado → implementação mínima → GREEN focado/regressões proporcionais → revisão de diff → commit.
- Nenhum merge ou deploy de produção é autorizado por este plano. Merge e produção permanecem autorizações separadas.

## Execution preflight

Na execução, criar worktree isolada com `superpowers:using-git-worktrees`; então:

```bash
git fetch origin
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

Antes de código funcional, exigir:

- `git status --short` vazio;
- `merge-base` igual a `f5d8b7267cdbf91a7d254a3c1546464d4d9b0210`;
- Node 22;
- todos os gates verdes.

Worktree inesperadamente suja/divergente é bloqueio. Não usar `reset`, `restore`, `clean`, `stash` ou `push --force` para contornar o estado.

---

## File map final

### Novos owners

- `src/app/navigation/registry.js` — destinos, áreas, menus desktop/mobile/`Mais` e ordem da transição.
- `src/app/navigation/resolution.js` — acesso, fallback, home, entries e direção da transição.
- `src/app/navigation/useNavigationController.js` — owner de `activeTab`, `moreOpen` e navegação pendente.
- `src/app/navigation/NavigationContext.jsx` — contexto mínimo de navegação.
- `src/app/navigation/useNavigationEventBridge.js` — compatibilidade `app:navigate`.
- `src/app/navigation/queryContext.js`, `useQueryContext.js` — query por sessão.
- `src/app/navigation/settingsDraftGuard.js` — adaptador de guard de Settings.
- `src/app/navigation/AreaNavigation.jsx` — navegação interna por área.
- `src/app/shell/AppRoot.jsx` — estados visuais globais.
- `src/app/shell/AppShell.jsx` — moldura autenticada, foco/transição.
- `src/app/shell/Sidebar.jsx` — menu desktop.
- `src/app/shell/MobileNavigation.jsx` — menu mobile/`Mais`.

### Caminhos que devem desaparecer antes de staging

```text
src/app/navigation.js
src/app/useNavigationController.js
src/app/queryContext.js
src/app/useQueryContext.js
src/components/AppShell.jsx
src/components/Sidebar.jsx
src/components/MobileNavigation.jsx
src/components/AreaNavigation.jsx
src/utils/mobileNavigation.js
```

### Consumidores de `AreaNavigation`

```text
src/pages/Orders.jsx
src/pages/OrderHistory.jsx
src/pages/Dashboard.jsx
src/pages/Receivables.jsx
src/pages/Finance.jsx
src/pages/Settings.jsx
```

---

### Task 1: Registry único e resolução pura

**Files:**
- Create: `src/app/navigation/registry.js`
- Create: `src/app/navigation/resolution.js`
- Create: `src/app/navigation/registry.test.js`
- Move/Modify: `src/app/navigation.test.js` → `src/app/navigation/resolution.test.js`
- Modify temporarily: `src/app/navigation.js`

**Interfaces:**
- Consumes: `hasCapability(granted, key)` de `src/app/access.js`.
- Produces: `NAVIGATION_DESTINATIONS`, `destinationById`, `AREA_DESTINATION_IDS`, `HOME_AREA_ORDER`, `AREA_LABELS`, `DESKTOP_NAV_GROUPS`, `MOBILE_DIRECT_ENTRIES`, `MOBILE_MORE_ENTRIES`, `MOBILE_SECTION_IDS`, `resolveArea`, `resolveDestination`, `resolveHome`, `resolveNavigationEntry`, `decideNavigation`, `getMobilePageDirection`.

- [ ] **Step 1: RED do registry exato**

Criar `registry.test.js`:

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

test('C2 preserva IDs, fallbacks e menus atuais', () => {
  assert.deepEqual(NAVIGATION_DESTINATIONS.map(({ id }) => id), [
    'settings-home', 'settings-operations', 'settings-modalities',
    'settings-payments', 'settings-cancellations', 'settings-finance-categories',
    'orders', 'history', 'new-order', 'comandas', 'print-queue',
    'dashboard', 'receivables', 'finance', 'clients', 'products', 'tables',
    'settings-printing', 'settings-device',
  ])
  assert.deepEqual(AREA_DESTINATION_IDS, {
    orders: ['orders', 'history'],
    finance: ['dashboard', 'receivables', 'finance'],
    settings: [
      'settings-home', 'settings-operations', 'settings-modalities',
      'settings-payments', 'settings-cancellations',
      'settings-finance-categories', 'settings-printing', 'settings-device',
    ],
  })
  assert.deepEqual(DESKTOP_NAV_GROUPS.map(({ label }) => label), ['OPERAÇÃO', 'FINANCEIRO', 'CADASTROS', 'CONFIGURAÇÕES'])
  assert.deepEqual(MOBILE_DIRECT_ENTRIES.map((item) => item.area || item.id), ['orders', 'comandas', 'finance'])
  assert.deepEqual(MOBILE_MORE_ENTRIES.map((item) => item.area || item.id), ['print-queue', 'clients', 'products', 'tables', 'settings'])
  assert.deepEqual(MOBILE_SECTION_IDS, [
    'orders', 'history', 'comandas', 'dashboard', 'receivables', 'finance',
    'print-queue', 'clients', 'products', 'tables', 'settings-printing', 'settings-device',
  ])
})
```

- [ ] **Step 2: Confirmar RED**

```bash
node --test src/app/navigation/registry.test.js
```

Expected: FAIL porque `registry.js` ainda não existe.

- [ ] **Step 3: Implementar registry sem mudar nenhum valor**

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

- [ ] **Step 4: Mover o teste puro atual e adicionar home/entry/direção**

Mover `src/app/navigation.test.js` para `src/app/navigation/resolution.test.js`, ajustar imports e manter todas as asserções existentes. Acrescentar:

```js
import { getMobilePageDirection, resolveHome, resolveNavigationEntry } from './resolution.js'

test('home e entry por área mantêm fallback atual', () => {
  const implemented = new Set(['orders', 'history', 'dashboard', 'receivables', 'finance'])
  assert.equal(resolveHome(new Set(['finance.receivables']), implemented), 'receivables')
  assert.deepEqual(resolveNavigationEntry(
    { area: 'finance', label: 'Financeiro' },
    new Set(['finance.receivables']),
    implemented,
  ), { area: 'finance', label: 'Financeiro', id: 'receivables' })
})

test('direção mobile preserva none para destinos fora da lista histórica', () => {
  assert.equal(getMobilePageDirection('orders', 'history'), 'forward')
  assert.equal(getMobilePageDirection('history', 'orders'), 'backward')
  assert.equal(getMobilePageDirection('settings-home', 'settings-payments'), 'none')
})
```

- [ ] **Step 5: Implementar `resolution.js`**

```js
import { hasCapability } from '../access.js'
import { AREA_DESTINATION_IDS, HOME_AREA_ORDER, MOBILE_SECTION_IDS, NAVIGATION_DESTINATIONS, destinationById } from './registry.js'

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

- [ ] **Step 6: Manter reexport intra-slice temporário**

Até os consumidores serem migrados, `src/app/navigation.js` deve conter somente:

```js
export { NAVIGATION_DESTINATIONS, NAVIGATION_DESTINATIONS as destinations } from './navigation/registry.js'
export { decideNavigation, resolveArea, resolveDestination } from './navigation/resolution.js'
```

Ele é removido na Task 6 e não pode chegar ao staging final.

- [ ] **Step 7: GREEN e commit**

```bash
node --test src/app/navigation/registry.test.js src/app/navigation/resolution.test.js
npm run lint
npm run test:architecture
git diff --check
git add src/app/navigation src/app/navigation.js
git commit -m "refactor: centralize navigation registry"
```

---

### Task 2: Controller/query no novo owner e guard de Settings

**Files:**
- Move: `src/app/useNavigationController.js` → `src/app/navigation/useNavigationController.js`
- Move: `src/app/queryContext.js` → `src/app/navigation/queryContext.js`
- Move: `src/app/useQueryContext.js` → `src/app/navigation/useQueryContext.js`
- Move: `src/app/queryContext.test.js` → `src/app/navigation/queryContext.test.js`
- Create: `src/app/navigation/settingsDraftGuard.js`
- Create: `src/app/navigation/settingsDraftGuard.test.js`
- Modify: `src/navigationContext.test.js`
- Modify: `src/App.jsx` somente imports/adaptador do guard

**Interfaces:**
- Consumes: registry/resolution da Task 1 e `DEFAULT_PRINT_QUEUE_QUERY` existente.
- Produces: API atual de `useNavigationController`; query API atual; `getSettingsDraftForDestination`, `shouldConfirmSettingsExit`, `hasSettingsUnloadRisk`.

- [ ] **Step 1: RED do guard puro**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { getSettingsDraftForDestination, shouldConfirmSettingsExit, hasSettingsUnloadRisk } from './settingsDraftGuard.js'

test('operações e modalidades compartilham o mesmo guard', () => {
  const draft = getSettingsDraftForDestination({ operations: { dirty: true, status: 'idle' } }, 'settings-operations')
  assert.equal(draft.resourceKey, 'operations')
  assert.equal(shouldConfirmSettingsExit(draft, 'settings-operations', 'settings-modalities'), false)
  assert.equal(shouldConfirmSettingsExit(draft, 'settings-operations', 'settings-home'), true)
})

test('saving/unconfirmed mantém unload risk sem criar confirmação de navegação', () => {
  for (const status of ['saving', 'unconfirmed']) {
    const resources = { operations: { dirty: true, status } }
    const draft = getSettingsDraftForDestination(resources, 'settings-operations')
    assert.equal(shouldConfirmSettingsExit(draft, 'settings-operations', 'orders'), false)
    assert.equal(hasSettingsUnloadRisk(resources), true)
  }
})
```

```bash
node --test src/app/navigation/settingsDraftGuard.test.js
```

Expected: FAIL porque o módulo não existe.

- [ ] **Step 2: Implementar o adaptador de guard, sem mover engine de Settings**

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
  return Object.values(resources || {}).some((resource) => resource?.dirty === true || ['saving', 'unconfirmed'].includes(resource?.status))
}
```

- [ ] **Step 3: Mover controller/query preservando corpos**

```bash
git mv src/app/useNavigationController.js src/app/navigation/useNavigationController.js
git mv src/app/queryContext.js src/app/navigation/queryContext.js
git mv src/app/useQueryContext.js src/app/navigation/useQueryContext.js
git mv src/app/queryContext.test.js src/app/navigation/queryContext.test.js
```

Mudanças exatas:

- `queryContext.js`: `../pages/printQueueQuery.js` → `../../pages/printQueueQuery.js`.
- controller: importar `NAVIGATION_DESTINATIONS` de `./registry.js`; `decideNavigation`, `resolveArea`, `resolveDestination`, `resolveHome` de `./resolution.js`; `shouldConfirmSettingsExit` de `./settingsDraftGuard.js`.
- remover do controller as implementações locais `HOME_AREAS`, `resolveHome`, `hasSettingsUnloadRisk`, `shouldConfirmSettingsExit`.
- manter mensagens, precedência e retorno do hook inalterados.

- [ ] **Step 4: Atualizar App só nos imports/adapter**

```js
import { resolveDestination } from './app/navigation/resolution.js'
import { useNavigationController } from './app/navigation/useNavigationController.js'
import { useQueryContext } from './app/navigation/useQueryContext.js'
import { getSettingsDraftForDestination, hasSettingsUnloadRisk } from './app/navigation/settingsDraftGuard.js'
```

Remover `SETTINGS_DRAFT_ROUTES`/`settingsDraftAt` de `App.jsx` e usar:

```js
getSettingsDraft: (destination) => getSettingsDraftForDestination(
  businessSettingsRef.current?.resources,
  destination,
),
```

- [ ] **Step 5: Atualizar loads dos testes e adicionar integração do guard**

Em `src/navigationContext.test.js`, usar os novos paths e acrescentar:

```js
test('controller permite navegar no mesmo draft de Settings e confirma ao abandonar o recurso', async (t) => {
  const h = await workspaceHarness(t)
  const { useNavigationController } = await h.load('/src/app/navigation/useNavigationController.js')
  const { getSettingsDraftForDestination } = await h.load('/src/app/navigation/settingsDraftGuard.js')
  const api = React.createRef()
  const discarded = []
  const resources = { operations: { dirty: true, status: 'idle' } }

  const Probe = React.forwardRef(function Probe(_props, ref) {
    const current = useNavigationController({
      granted: new Set(['operations.settings.view', 'clients.view']),
      implemented: new Set(['settings-home', 'settings-operations', 'settings-modalities', 'clients']),
      checkoutPending: false,
      dirtyOrder: false,
      onDiscardOrder() {},
      getSettingsDraft: (destination) => getSettingsDraftForDestination(resources, destination),
      onDiscardSettings: () => { discarded.push('operations'); return true },
      onFeedback() {},
    })
    React.useImperativeHandle(ref, () => current, [current])
    return React.createElement('output', null, `${current.activeTab}:${current.pendingDestination || ''}`)
  })

  const renderer = await h.render(Probe, { ref: api })
  await act(async () => api.current.requestNavigation('settings-operations'))
  await act(async () => api.current.requestNavigation('settings-modalities'))
  assert.equal(renderer.root.findByType('output').children.join(''), 'settings-modalities:')
  await act(async () => api.current.requestNavigation('clients'))
  assert.equal(renderer.root.findByType('output').children.join(''), 'settings-modalities:clients')
  await act(async () => api.current.confirmDiscard())
  assert.equal(renderer.root.findByType('output').children.join(''), 'clients:')
  assert.deepEqual(discarded, ['operations'])
})
```

- [ ] **Step 6: GREEN, ausência de imports antigos e commit**

```bash
node --test src/app/navigation/queryContext.test.js src/app/navigation/settingsDraftGuard.test.js src/app/navigation/resolution.test.js src/navigationContext.test.js src/AppNewOrderGuard.test.js
npm run lint
npm run test:architecture
grep -R "app/useNavigationController\|app/useQueryContext\|app/queryContext" -n src --include='*.js' --include='*.jsx' || true
git diff --check
git add src/app/navigation src/App.jsx src/navigationContext.test.js
git commit -m "refactor: isolate navigation state ownership"
```

Expected do `grep`: nenhuma referência aos três caminhos antigos.

---

### Task 3: NavigationContext mínimo e bridge `app:navigate`

**Files:**
- Create: `src/app/navigation/useNavigationEventBridge.js`
- Create: `src/app/navigation/NavigationContext.jsx`
- Create: `src/app/navigation/NavigationContext.test.js`

**Interfaces:**
- Consumes: `requestNavigation(target)` do controller.
- Produces: contexto exatamente com `activeTab`, `activeMobileEntry`, `granted`, `implemented`, `moreOpen`, `requestNavigation`, `openMore`, `closeMore`; um listener `app:navigate` durante a montagem do provider.

- [ ] **Step 1: RED do contrato e lifecycle do listener**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'
import { workspaceHarness } from '../../test-support/renderWorkspace.js'

test('NavigationProvider expõe só navegação e possui um listener app:navigate', async (t) => {
  const h = await workspaceHarness(t)
  const { NavigationProvider, useNavigation } = await h.load('/src/app/navigation/NavigationContext.jsx')
  const seen = React.createRef()
  const calls = []
  function Probe() {
    seen.current = useNavigation()
    return React.createElement('output', null, seen.current.activeTab)
  }
  const before = h.activitySnapshot({ ignoreFocus: true }).listeners
  const renderer = await h.render(NavigationProvider, {
    activeTab: 'orders', activeMobileEntry: undefined,
    granted: new Set(['orders.view']), implemented: new Set(['orders']),
    moreOpen: false, requestNavigation: (id) => calls.push(id), openMore() {}, closeMore() {},
    children: React.createElement(Probe),
  })
  assert.deepEqual(Object.keys(seen.current).sort(), [
    'activeMobileEntry', 'activeTab', 'closeMore', 'granted', 'implemented',
    'moreOpen', 'openMore', 'requestNavigation',
  ].sort())
  assert.equal(h.activitySnapshot({ ignoreFocus: true }).listeners, before + 1)
  await act(async () => h.window.dispatchEvent(Object.assign(new Event('app:navigate'), { detail: 'clients' })))
  await act(async () => h.window.dispatchEvent(Object.assign(new Event('app:navigate'), { detail: { id: 'clients' } })))
  assert.deepEqual(calls, ['clients'])
  await act(async () => renderer.unmount())
  assert.equal(h.activitySnapshot({ ignoreFocus: true }).listeners, before)
})
```

```bash
node --test src/app/navigation/NavigationContext.test.js
```

Expected: FAIL porque os módulos não existem.

- [ ] **Step 2: Implementar bridge com callback atualizado sem recriar listener**

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

- [ ] **Step 3: Implementar provider fechado**

```jsx
import { createContext, useContext, useMemo } from 'react'
import { useNavigationEventBridge } from './useNavigationEventBridge.js'

const NavigationContext = createContext(null)

export function NavigationProvider({ activeTab, activeMobileEntry, granted, implemented, moreOpen, requestNavigation, openMore, closeMore, children }) {
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

- [ ] **Step 4: GREEN e commit**

```bash
node --test src/app/navigation/NavigationContext.test.js
npm run lint
git diff --check
git add src/app/navigation/NavigationContext.jsx src/app/navigation/useNavigationEventBridge.js src/app/navigation/NavigationContext.test.js
git commit -m "refactor: add scoped navigation context"
```

---

### Task 4: Mover shell, menus e AreaNavigation

**Files:**
- Move: `src/components/AppShell.jsx` → `src/app/shell/AppShell.jsx`
- Move: `src/components/Sidebar.jsx` → `src/app/shell/Sidebar.jsx`
- Move: `src/components/MobileNavigation.jsx` → `src/app/shell/MobileNavigation.jsx`
- Move: `src/components/AreaNavigation.jsx` → `src/app/navigation/AreaNavigation.jsx`
- Delete after consumers migrate: `src/utils/mobileNavigation.js`
- Create: `src/app/shell/AppShell.test.js`
- Create: `src/app/navigation/AreaNavigation.test.js`
- Modify: `src/pages/Orders.jsx`, `OrderHistory.jsx`, `Dashboard.jsx`, `Receivables.jsx`, `Finance.jsx`, `Settings.jsx`
- Modify: `src/App.jsx` import do shell e props de páginas

**Interfaces:**
- Consumes: `NavigationProvider/useNavigation`, registry/resolution.
- Produces: shell sem registry local e sem listener global; Sidebar/Mobile/Area usando o mesmo contrato.

- [ ] **Step 1: RED da AreaNavigation pelo contexto**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { workspaceHarness, buttonNamed } from '../../test-support/renderWorkspace.js'

test('AreaNavigation usa contexto e marca destino ativo', async (t) => {
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
  buttonNamed(nav, 'Cozinha').props.onClick()
  assert.deepEqual(calls, ['orders'])
})
```

Expected: FAIL porque o novo caminho ainda não existe.

- [ ] **Step 2: RED do foco/transição do novo AppShell**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'
import { workspaceHarness } from '../../test-support/renderWorkspace.js'

test('AppShell preserva direção e foco ao trocar de página', async (t) => {
  const h = await workspaceHarness(t)
  const { NavigationProvider } = await h.load('/src/app/navigation/NavigationContext.jsx')
  const { default: AppShell } = await h.load('/src/app/shell/AppShell.jsx')
  const granted = new Set(['orders.view', 'orders.history'])
  const implemented = new Set(['orders', 'history'])
  const Wrapper = ({ activeTab }) => React.createElement(NavigationProvider, {
    activeTab, granted, implemented, moreOpen: false,
    requestNavigation() {}, openMore() {}, closeMore() {},
    children: React.createElement(AppShell, {
      dashboardPeriod: '30d', onDashboardPeriodChange() {},
      children: React.createElement('span', null, activeTab),
    }),
  })
  const renderer = await h.render(Wrapper, { activeTab: 'orders' }, {
    createNodeMock: (element) => element.props?.className === 'app-content page-transition'
      ? { focus: h.recordFocus }
      : {},
  })
  const beforeFocus = h.activitySnapshot().focus
  await act(async () => renderer.update(React.createElement(Wrapper, { activeTab: 'history' })))
  const content = renderer.root.findByProps({ className: 'app-content page-transition' })
  assert.equal(content.props['data-direction'], 'forward')
  assert.equal(h.activitySnapshot().focus, beforeFocus + 1)
  await act(async () => renderer.update(React.createElement(Wrapper, { activeTab: 'orders' })))
  assert.equal(renderer.root.findByProps({ className: 'app-content page-transition' }).props['data-direction'], 'backward')
})
```

Expected: FAIL porque o novo shell ainda não existe.

- [ ] **Step 3: Mover os quatro componentes preservando marcação/CSS**

```bash
git mv src/components/AppShell.jsx src/app/shell/AppShell.jsx
git mv src/components/Sidebar.jsx src/app/shell/Sidebar.jsx
git mv src/components/MobileNavigation.jsx src/app/shell/MobileNavigation.jsx
git mv src/components/AreaNavigation.jsx src/app/navigation/AreaNavigation.jsx
```

Ajustar imports mecanicamente:

- `AppShell`: `../../order-cancellation.css`, `../../components/DashboardPeriodProvider`, `./Sidebar`, `./MobileNavigation`, `../navigation/NavigationContext.jsx`, `../navigation/resolution.js`.
- `Sidebar`: `../../components/Icon`, registry/resolution/context.
- `MobileNavigation`: `../../mobile-navigation.css`, `../../components/BottomSheet`, `../../components/Icon`, registry/resolution/context.
- `AreaNavigation`: registry/resolution/context. **Não adicionar import novo de CSS**; manter `src/pages/Settings.jsx` com o import global `../area-navigation.css` existente nesta slice.

- [ ] **Step 4: Implementar Sidebar sem árvore local**

Núcleo obrigatório:

```js
const { activeTab, activeMobileEntry, granted, implemented, requestNavigation } = useNavigation()
const visibleGroups = DESKTOP_NAV_GROUPS.map((group) => ({
  ...group,
  items: group.items.map((item) => resolveNavigationEntry(item, granted, implemented)).filter(Boolean),
})).filter((group) => group.items.length)

const isActive = (item) => activeMobileEntry
  ? (item.area || item.id) === activeMobileEntry
  : item.area
    ? destinationById.get(activeTab)?.area === item.area
    : activeTab === item.id
```

O JSX/copies/ícones/logout permanecem os atuais.

- [ ] **Step 5: Implementar MobileNavigation sem arrays locais**

Núcleo obrigatório:

```js
const { activeTab, activeMobileEntry, granted, implemented, moreOpen, requestNavigation, openMore, closeMore } = useNavigation()
const directItems = MOBILE_DIRECT_ENTRIES.map((item) => resolveNavigationEntry(item, granted, implemented)).filter(Boolean)
const moreItems = MOBILE_MORE_ENTRIES.map((item) => resolveNavigationEntry(item, granted, implemented)).filter(Boolean)
const currentEntry = activeMobileEntry || destinationById.get(activeTab)?.mobileEntry
const moreActive = currentEntry === 'more'
```

Manter exatamente o BottomSheet “Mais opções”, logout e `aria-current` atuais.

- [ ] **Step 6: Implementar AreaNavigation com prop única `area`**

```jsx
import { AREA_LABELS, NAVIGATION_DESTINATIONS } from './registry.js'
import { resolveDestination } from './resolution.js'
import { useNavigation } from './NavigationContext.jsx'

export default function AreaNavigation({ area }) {
  const { activeTab, granted, implemented, requestNavigation } = useNavigation()
  const destinations = NAVIGATION_DESTINATIONS.filter((destination) => (
    destination.area === area
    && destination.id !== 'new-order'
    && resolveDestination(destination.id, granted, implemented).status === 'allowed'
  ))
  if (!destinations.length) return null
  return <nav className="area-navigation" aria-label={`Navegação de ${AREA_LABELS[area] || area}`}>
    {destinations.map((destination) => <button key={destination.id} type="button" aria-current={activeTab === destination.id ? 'page' : undefined} className={activeTab === destination.id ? 'area-navigation-item active' : 'area-navigation-item'} onClick={() => requestNavigation(destination.id)}>{destination.label}</button>)}
  </nav>
}
```

- [ ] **Step 7: Deixar AppShell somente com shell/foco/transição**

Remover o effect `app:navigate`. Usar:

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

Manter `key={activeTab}`, `className="app-content page-transition"`, `data-direction`, `tabIndex={-1}` e `DashboardPeriodProvider`.

- [ ] **Step 8: Migrar os seis consumidores sem deixar prop drilling morto**

Todos passam a renderizar somente `AreaNavigation area="..."`.

Remover dos signatures/calls:

- `Orders`: `implemented`, `onNavigate`; manter `granted`.
- `OrderHistory`: `implemented`, `onNavigate`, `activeTab`; manter `granted`.
- `Dashboard`: `granted`, `implemented`, `onNavigate`, `activeTab`.
- `Receivables`: `granted`, `implemented`, `onNavigate`, `activeTab` — hoje só aparecem no AreaNavigation.
- `Finance`: `granted`, `implemented`, `onNavigate`, `activeTab` — hoje só aparecem no AreaNavigation.
- `Settings`: não remover `granted`, `implemented`, `onNavigate`; a própria superfície ainda os usa. Somente a chamada a AreaNavigation vira `<AreaNavigation area="settings" />`.

Atualizar as chamadas em `App.jsx` exatamente na mesma rodada.

- [ ] **Step 9: Remover util legado e rodar GREEN**

```bash
grep -R "utils/mobileNavigation" -n src --include='*.js' --include='*.jsx' || true
git rm src/utils/mobileNavigation.js
node --test src/app/navigation/registry.test.js src/app/navigation/resolution.test.js src/app/navigation/AreaNavigation.test.js src/app/shell/AppShell.test.js src/navigationContext.test.js src/AppNewOrderGuard.test.js src/pages/DashboardMobile.test.js src/pages/ClientsProductsMobile.test.js
npm run lint
npm run test:architecture
git diff --check
git add -A src/app/shell src/app/navigation src/pages src/App.jsx src/utils/mobileNavigation.js
git commit -m "refactor: move application shell navigation"
```

Expected do `grep`: nenhuma referência antes do `git rm`.

---

### Task 5: AppRoot fino para estados globais

**Files:**
- Create: `src/app/shell/AppRoot.jsx`
- Create: `src/app/shell/AppRoot.test.js`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes somente `authState`, `isOnline`, estado/callback de login, bootstrap/retry, feedback e `children`.
- Produces checking/Login/bootstrap/feedback/ready visual; nenhum dado/handler de domínio entra no componente.

- [ ] **Step 1: RED dos estados globais**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'
import { workspaceHarness, buttonNamed, nodeText } from '../../test-support/renderWorkspace.js'

const baseProps = {
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

test('AppRoot preserva checking, anonymous, bootstrap error e ready', async (t) => {
  const h = await workspaceHarness(t)
  const { default: AppRoot } = await h.load('/src/app/shell/AppRoot.jsx')
  const renderer = await h.render(AppRoot, { ...baseProps, authState: 'checking' })
  assert.match(nodeText(renderer.root), /Carregando sistema/)
  await act(async () => renderer.update(React.createElement(AppRoot, { ...baseProps, authState: 'anonymous', isOnline: false })))
  assert.equal(renderer.root.findAllByProps({ placeholder: 'Digite o PIN' }).length, 1)
  let retries = 0
  await act(async () => renderer.update(React.createElement(AppRoot, { ...baseProps, bootstrapState: 'error', onRetryBootstrap: () => { retries += 1 } })))
  await act(async () => buttonNamed(renderer.root, 'Tentar novamente').props.onClick())
  assert.equal(retries, 1)
  await act(async () => renderer.update(React.createElement(AppRoot, { ...baseProps, toastMessage: 'Aviso', successMessage: 'Sucesso' })))
  assert.match(nodeText(renderer.root), /ready/)
  assert.match(nodeText(renderer.root), /Aviso/)
  assert.match(nodeText(renderer.root), /Sucesso/)
})
```

```bash
node --test src/app/shell/AppRoot.test.js
```

Expected: FAIL porque `AppRoot.jsx` não existe.

- [ ] **Step 2: Implementar AppRoot sem domínio**

```jsx
import { createPortal } from 'react-dom'
import Button from '../../components/Button'
import ConnectionBanner from '../../components/ConnectionBanner'
import Icon from '../../components/Icon'
import LoginScreen from '../../components/LoginScreen'

const Toast = ({ message }) => <div className="toast-success" role="status"><span className="toast-icon"><Icon name="dashboard" size={17} /></span>{message}</div>
const Success = ({ message }) => <div className="success-confirmation-overlay" role="status" aria-live="polite"><div className="success-confirmation-card"><span className="success-confirmation-icon"><Icon name="check" size={30} /></span><strong>{message}</strong></div></div>
const portal = (node) => node && typeof document !== 'undefined' ? createPortal(node, document.body) : node

export default function AppRoot({ isOnline, authState, loginLoading, loginError, onLogin, bootstrapState, onRetryBootstrap, retryDisabled, toastMessage, successMessage, children }) {
  if (authState === 'checking') return <div className="system-state-screen"><div className="system-state-card"><h2>Carregando sistema</h2><p>Verificando sua sessão…</p></div></div>
  if (authState === 'anonymous') return <>{!isOnline && <ConnectionBanner />}<LoginScreen onLogin={onLogin} loading={loginLoading} error={loginError} disabled={!isOnline} /></>
  if (bootstrapState !== 'ready') return <>{!isOnline && <ConnectionBanner />}<div className="system-state-screen"><div className="system-state-card">{bootstrapState === 'error' ? <><h2>Não foi possível carregar os dados</h2><p>Confira sua conexão e tente novamente.</p><Button type="button" onClick={onRetryBootstrap} disabled={retryDisabled}>Tentar novamente</Button></> : <><h2>Carregando dados</h2><p>Sincronizando a operação da Amor &amp; Sabor…</p></>}</div></div></>
  return <>{!isOnline && <ConnectionBanner />}{toastMessage && portal(<Toast message={toastMessage} />)}{successMessage && portal(<Success message={successMessage} />)}{children}</>
}
```

Não adicionar outras props.

- [ ] **Step 3: Integrar sem alterar a árvore ready**

Em `App.jsx`, remover os early returns checking/anonymous/bootstrap e os renders globais de connection/toast/success. O retorno passa a começar assim:

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
    {/* a árvore autenticada atual permanece como children */}
  </AppRoot>
)
```

Remover de `App.jsx` imports `createPortal`, `ConnectionBanner` e `LoginScreen` depois de confirmar que não têm outro uso.

- [ ] **Step 4: GREEN e commit**

```bash
node --test src/app/shell/AppRoot.test.js src/app/runtime/session/useSessionRuntime.test.js src/app/runtime/feedback/useFeedbackRuntime.test.js src/app/runtime/runtimeExtractionContract.test.js src/navigationContext.test.js
npm run lint
git diff --check
git add src/app/shell/AppRoot.jsx src/app/shell/AppRoot.test.js src/App.jsx
git commit -m "refactor: extract app root composition"
```

---

### Task 6: Integrar NavigationProvider e fechar a fronteira C2

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/navigationContext.test.js`
- Create: `src/app/navigation/navigationExtractionContract.test.js`
- Delete: `src/app/navigation.js`
- Verify absent: todos os caminhos legados do File map

**Interfaces:**
- Consumes: controller/query/guard, NavigationProvider, AppRoot/AppShell.
- Produces: árvore ready com um único contrato de navegação; `App.jsx` continua usando `activeTab` apenas onde comportamento existente exige.

- [ ] **Step 1: RED do contrato estrutural final**

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
  for (const path of legacyPaths) await assert.rejects(access(path), { code: 'ENOENT' })
})

test('App preserva sinais operacionais sem redefinir navegação extraída', async () => {
  const source = await readFile('src/App.jsx', 'utf8')
  assert.equal(source.includes('SETTINGS_DRAFT_ROUTES'), false)
  assert.equal(source.includes("addEventListener('app:navigate'"), false)
  assert.equal(source.includes('DESKTOP_NAV_GROUPS'), false)
  assert.equal(source.includes('MOBILE_DIRECT_ENTRIES'), false)
  assert.match(source, /ordersSyncEnabled:\s*activeTab === 'orders'/)
  assert.match(source, /active:\s*activeTab === 'orders'/)
  assert.match(source, /activeMobileEntry\s*=\s*activeTab === 'new-order' \? newOrderContext\.returnTab/)
  assert.match(source, /requestNavigation\(newOrderContext\.returnTab\)/)
})
```

Antes da integração final, expected: FAIL porque `src/app/navigation.js` ainda existe.

- [ ] **Step 2: Montar provider somente no conteúdo ready**

Em `App.jsx`:

```js
const activeMobileEntry = activeTab === 'new-order' ? newOrderContext.returnTab : undefined
```

Dentro dos children de `AppRoot`:

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
    {/* condicionais de páginas atuais */}
  </AppShell>
  {/* modais/overlays de domínio atuais continuam definidos no App */}
</NavigationProvider>
```

Como `AppRoot` só monta `children` em `ready`, o bridge `app:navigate` mantém a janela de vida do shell autenticado atual.

- [ ] **Step 3: Preservar os owners que continuam no App**

Estas linhas continuam semanticamente iguais:

```js
ordersSyncEnabled: activeTab === 'orders' && isOnline && authState === 'authenticated'
const kitchenNow = useKitchenClock(orders, { active: activeTab === 'orders', currentTiming })
```

Também manter:

```js
resetNavigation()
resetQueries()
```

em `clearBusinessData()`, e:

```js
const handleCancelDiscard = useCallback(() => {
  cancelDiscard()
  window.requestAnimationFrame(() => document.querySelector?.('.app-content')?.focus?.())
}, [cancelDiscard])
```

`pendingDestination`, `pendingDiscardKind`, `confirmDiscard`, `cancelDiscard`, `discardSettingsAndNavigate` e `completeNavigation` continuam consumidos diretamente do controller no App quando necessários.

- [ ] **Step 4: Adicionar comportamento `app:navigate` ao teste de App existente**

No teste `App preserva consulta ao navegar e nova sessão rejeita callback da sessão anterior` de `src/navigationContext.test.js`, após voltar à Cozinha e confirmar a busca preservada, inserir:

```js
await act(async () => h.window.dispatchEvent(Object.assign(new Event('app:navigate'), { detail: 'clients' })))
assert.equal(nodeText(renderer.root).includes('Clientes'), true)
await act(async () => buttonNamed(navigation(), 'Pedidos').props.onClick())
assert.equal(kitchenSearch().props.value, 'maria')
```

Manter em seguida o logout/login/reset que já prova invalidação da sessão anterior.

- [ ] **Step 5: Remover reexport e provar ausência dos paths antigos**

```bash
git rm src/app/navigation.js
grep -R "components/AppShell\|components/Sidebar\|components/MobileNavigation\|components/AreaNavigation\|utils/mobileNavigation\|app/useNavigationController\|app/useQueryContext\|app/queryContext" -n src --include='*.js' --include='*.jsx' || true
```

Expected: nenhuma referência.

- [ ] **Step 6: GREEN focado e contrato final**

```bash
node --test src/app/navigation/registry.test.js src/app/navigation/resolution.test.js src/app/navigation/queryContext.test.js src/app/navigation/settingsDraftGuard.test.js src/app/navigation/NavigationContext.test.js src/app/navigation/AreaNavigation.test.js src/app/navigation/navigationExtractionContract.test.js src/app/shell/AppShell.test.js src/app/shell/AppRoot.test.js src/navigationContext.test.js src/AppNewOrderGuard.test.js src/actionCapabilities.test.js
npm run lint
npm run test:architecture
```

Expected: PASS.

- [ ] **Step 7: Revisar diff de código e commit**

```bash
git diff --check
git diff f5d8b7267cdbf91a7d254a3c1546464d4d9b0210...HEAD -- src scripts package.json .github
```

Bloquear se aparecer:

- `worker/` ou `migrations/`;
- mudança de dependência;
- mudança deliberada de CSS/textos/menu;
- contexto com coleções/handlers de domínio;
- mudança de polling/sync;
- facade legado final.

Se o diff estiver dentro do escopo:

```bash
git add -A src
git commit -m "refactor: complete c2 navigation boundary"
```

Não fazer deploy/merge ainda.

---

### Task 7: Gates finais, PR, staging e homologação

**Files após evidência real:**
- Create: `docs/superpowers/qa/spec-c2-navigation-composition-qa.md`
- Modify: `docs/superpowers/qa/spec-c-execution-ledger.md`
- Modify status-only: `docs/superpowers/plans/2026-09-15-frontend-modularization-rollout-plan.md`
- Modify somente se houver mudança real: `docs/superpowers/qa/spec-c-compatibility-facades.md`

**Interfaces:**
- Consumes: HEAD funcional fechado da Task 6.
- Produces: evidência reproduzível de CI/staging/QA e gate de decisão de merge; não produz release de produção.

- [ ] **Step 1: Full gates e captura do SHA executável**

```bash
npm test
npm run lint
npm run test:architecture
npm run build
npm run d1:migrate:local
git diff --check
EXECUTABLE_SHA="$(git rev-parse HEAD)"
printf '%s\n' "$EXECUTABLE_SHA"
```

Todos devem PASS. O valor impresso é o único SHA elegível para staging até novo commit funcional.

- [ ] **Step 2: Revisar diff completo contra a base C1**

```bash
git diff --stat f5d8b7267cdbf91a7d254a3c1546464d4d9b0210...HEAD
git diff --name-status f5d8b7267cdbf91a7d254a3c1546464d4d9b0210...HEAD
```

Confirmar: nenhum `worker/**`, `migrations/**`, dependência ou trigger amplo novo; somente C2, testes e documentação.

- [ ] **Step 3: Abrir PR draft contra `master`**

Título:

```text
Spec C2: modularizar navegação e composição do frontend
```

Corpo deve registrar a base `f5d8b726...`, escopo/não objetivos, commits, gates locais, compatibilities finais e “produção não autorizada”. Não marcar ready/merge antes da homologação.

- [ ] **Step 4: Validar CI no HEAD exato**

Aguardar **Validate application** e conferir o SHA do run. Exigir PASS em tests, architecture, lint, build, Worker dry-runs e gates D1 existentes. Registrar números/IDs reais somente depois do run concluído.

- [ ] **Step 5: Deploy staging manual**

Executar **Deploy staging** via `workflow_dispatch` na branch `feature/spec-c2-navigation-composition`. Conferir `head_sha == EXECUTABLE_SHA`, event `workflow_dispatch`, conclusion `success` e smoke de login do workflow.

Não criar trigger automático para C2.

- [ ] **Step 6: Matriz manual obrigatória**

Registrar resultado real de cada item:

1. login e home iguais;
2. Sidebar desktop abre áreas/destinos permitidos;
3. fallback de área correto sem capability principal;
4. navegação mobile direta correta;
5. `Mais` abre, navega e fecha;
6. navegação interna Pedidos/Financeiro/Settings correta;
7. buscas/filtros persistem entre páginas e resetam em nova sessão;
8. Novo Pedido retorna à origem correta, inclusive Comandas;
9. pedido sujo exige confirmação e cancelar mantém wizard;
10. checkout em andamento bloqueia saída;
11. Settings dirty confirma saída correta sem novo bloqueio em `saving`/`unconfirmed`;
12. foco e animação permanecem equivalentes;
13. Cozinha mantém `orders` ~2 s e sair interrompe somente esse polling dedicado;
14. `app:navigate` continua funcional;
15. desktop/mobile + light/dark sem regressão visual atribuível a C2.

Qualquer FAIL volta para systematic-debugging/TDD antes do fechamento.

- [ ] **Step 7: Criar QA record somente com valores reais**

Criar `docs/superpowers/qa/spec-c2-navigation-composition-qa.md` somente depois de conhecer todos os dados. O documento deve registrar literalmente:

- branch `feature/spec-c2-navigation-composition`;
- base SHA `f5d8b7267cdbf91a7d254a3c1546464d4d9b0210`;
- valor real de `EXECUTABLE_SHA` homologado;
- número real da PR;
- número/ID/conclusão reais do Validate application;
- número/ID/conclusão reais do Deploy staging;
- os 15 resultados reais da matriz com evidência curta;
- compatibilities finais reais;
- `Production deploy: NO`.

Não criar o arquivo antes desses valores existirem e não usar marcadores incompletos.

- [ ] **Step 8: Reconciliar ledger e rollout com fatos comprovados**

Atualizar status de execução, sem alterar contratos normativos:

- C1 = MERGED + RELEASED; merge `f5d8b7267cdbf91a7d254a3c1546464d4d9b0210`; Validate #1205/run `35114139465`; Deploy production #49/run `35114517283`; smoke de produção aprovado pelo usuário.
- C2 = branch/PR/CI/staging/QA que realmente ocorreram.
- C3 = bloqueada até aprovação e merge de C2.

Compatibility ledger só muda se C2 realmente introduzir/remover bridge/facade final.

- [ ] **Step 9: Commit docs-only pós-homologação sem redeploy**

O shell desta sessão ainda possui `EXECUTABLE_SHA`; usar:

```bash
git diff --name-only "$EXECUTABLE_SHA"..HEAD
```

Antes do commit docs, a lista deve ser vazia. Depois de editar QA/ledger/rollout, verificar:

```bash
git diff --name-only "$EXECUTABLE_SHA"
```

Expected: somente `docs/**`.

Então:

```bash
git add docs/superpowers/qa/spec-c2-navigation-composition-qa.md docs/superpowers/qa/spec-c-execution-ledger.md docs/superpowers/plans/2026-09-15-frontend-modularization-rollout-plan.md
# adicionar spec-c-compatibility-facades.md apenas se ele realmente mudou
git commit -m "docs: record c2 staging homologation"
```

Rodar a validação normal do HEAD documental. Não redeployar staging apenas por docs-only.

- [ ] **Step 10: Parar no gate de merge**

Apresentar ao usuário: SHA homologado, PR, CI, staging, 15/15 e diff pós-homologação. Manter produção intocada e C3 não iniciada. Merge somente após autorização explícita. Depois do merge, validar a nova `master`; produção continua exigindo autorização separada.

---

## Self-review do plano

Cobertura conferida contra a spec aprovada:

- registry único cobre destinos, fallbacks, desktop, mobile, `Mais` e transição;
- controller permanece único owner de `activeTab`/pending navigation;
- query permanece por sessão e invalida callbacks antigos;
- guard de Settings preserva dirty/same-resource e não cria bloqueio novo em saving/unconfirmed;
- `app:navigate` sai do shell e mantém lifecycle equivalente;
- NavigationContext não recebe dados/handlers de domínio;
- shell preserva foco/transição/CSS;
- AppRoot contém apenas estados globais visuais;
- App mantém `activeTab` para polling/clock da Cozinha;
- C3-C9 permanecem fora do escopo;
- Worker/D1/API/dependências permanecem intocados;
- staging continua manual;
- homologação, merge e produção permanecem gates separados.
