# Mobile UX Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidar e auditar a experiência mobile do Gestão Delivery para funcionar de forma consistente, ergonômica e sem sobreposições entre 320 px e 480 px, preservando o desktop.

**Architecture:** Criar uma fundação mobile compartilhada com tokens e regras estruturais de viewport, safe area, overlays e touch targets; remover regras estruturais duplicadas de CSS específicos; depois ajustar cada fluxo/tela sobre essa base. As mudanças serão incrementais, orientadas por regressões automatizadas com `node:test`, sem nova biblioteca de UI ou framework de testes.

**Tech Stack:** React 19, React DOM 19, Vite 8, CSS responsivo, Node.js `node:test`, oxlint, Cloudflare Worker/Wrangler 4.128.0.

**Spec:** `docs/superpowers/specs/2026-09-02-mobile-ux-audit-design.md`

## Global Constraints

- Suporte mobile alvo: 320 px a 480 px de largura.
- Referências de revisão: 320 px, 360 px, 390/393 px e 480 px.
- Preservar identidade visual; mudar aparência somente para melhorar hierarquia, legibilidade, densidade ou ergonomia.
- Não criar app mobile separado, UI duplicada, framework CSS ou novo test runner.
- Touch targets importantes: aproximadamente 44–48 px no menor eixo sempre que possível.
- Nenhuma tela pode criar scroll horizontal involuntário.
- Menu, overlays e elementos flutuantes devem respeitar safe areas.
- Elementos fixos não podem depender de ancestrais transformados.
- Problema repetido em duas ou mais telas deve ser corrigido na base/componente comum.
- Desktop não pode sofrer regressão relevante.
- Todo bug real encontrado na rodada recebe regressão automatizada no mesmo ciclo TDD.
- Cada tarefa termina com testes focados, `npm test`, `npm run lint` e `npm run build` verdes antes da revisão.

---

## File Structure

### Fundação
- Create: `src/mobile-foundation.css`
- Create: `src/mobileFoundation.test.js`
- Modify: `src/App.jsx`, `src/index.css`, `src/App.css`, `src/mobile-navigation.css`, `src/dashboard.css`
- Modify tests: `src/mobileStabilityRegression.test.js`, `src/mobilePageMotion.test.js`

### Overlays
- Create: `src/mobileOverlayRegression.test.js`
- Modify: `src/components/Modal.jsx`, `src/components/BottomSheet.jsx`, `src/components/SystemSelect.jsx`
- Modify: `src/bottom-sheet.css`, `src/system-select.css`
- Modify tests: `src/bottomSheet.test.js`, `src/systemSelect.test.js`

### Fluxos críticos
- New Order: `src/pages/NewOrder.jsx`, `src/new-order.css`, `src/components/OrderProductCatalog.jsx`, `src/components/OrderCart.jsx`, `src/components/OrderCheckoutSummary.jsx`, `src/pages/NewOrder.test.js`; create `src/pages/NewOrderMobile.test.js`
- Orders: `src/pages/Orders.jsx`, `src/order-operations.css`, `src/order-operations-compact.css`, `src/components/OrderDetail.jsx`, `src/pages/OrdersMultiItem.test.js`; create `src/pages/OrdersMobile.test.js`
- Receivables: `src/pages/Receivables.jsx`, `src/receivables.css`, `src/App.jsx`, `src/App.css`, `src/pages/ReceivablesDetails.test.js`; create `src/pages/ReceivablesMobile.test.js`

### Demais telas
- Dashboard: `src/pages/Dashboard.jsx`, `src/dashboard.css`, `src/pages/DashboardAnalytics.test.js`; create `src/pages/DashboardMobile.test.js`; alterar componentes de gráfico apenas se a revisão de 320 px exigir
- Clients/Products: `src/pages/Clients.jsx`, `src/clients-phonebook.css`, `src/pages/Products.jsx`, `src/product-form.css`, `src/App.jsx`, `src/App.css`, `src/clientsPhonebook.test.js`, `src/productCatalogUi.test.js`; create `src/pages/ClientsProductsMobile.test.js`
- Finance/More: `src/pages/Finance.jsx`, `src/components/MobileNavigation.jsx`, `src/mobile-navigation.css`, `src/bottom-sheet.css`, `src/App.jsx`, `src/App.css`, `src/mobileNavigation.test.js`; create `src/pages/FinanceMoreMobile.test.js`

### Consistência e QA
- Create: `src/mobileConsistencyRegression.test.js`
- Create: `docs/superpowers/qa/2026-09-02-mobile-ux-audit-checklist.md`

---

### Task 1: Consolidar a fundação mobile

**Files:** `src/mobile-foundation.css`, `src/mobileFoundation.test.js`, `src/App.jsx`, `src/index.css`, `src/App.css`, `src/mobile-navigation.css`, `src/dashboard.css`, `src/mobileStabilityRegression.test.js`, `src/mobilePageMotion.test.js`

**Interfaces:** produz os tokens `--mobile-bottom-nav-height`, `--mobile-safe-bottom`, `--mobile-content-bottom-space`, `--mobile-floating-gap`, `--mobile-page-inline`, `--mobile-touch-target`, `--mobile-overlay-inset`, `--mobile-overlay-max-height`, `--layer-mobile-nav`, `--layer-overlay`, `--layer-toast`.

- [ ] **Step 1: escrever RED**

Criar `src/mobileFoundation.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('mobile foundation owns viewport safe-area and shared tokens', async () => {
  const css = await read('./mobile-foundation.css')
  assert.match(css, /--mobile-bottom-nav-height:\s*65px/)
  assert.match(css, /--mobile-safe-bottom:\s*env\(safe-area-inset-bottom/)
  assert.match(css, /--mobile-touch-target:\s*44px/)
  assert.match(css, /--mobile-overlay-max-height:\s*min\(88dvh,\s*720px\)/)
  assert.match(css, /\.app-main\s*\{[^}]*overflow-x:\s*clip[^}]*touch-action:\s*pan-y\s+pinch-zoom/s)
  assert.match(css, /html,\s*body,\s*#root\s*\{[^}]*overflow-x:\s*clip/s)
})

test('navigation no longer owns shared structural tokens', async () => {
  const nav = await read('./mobile-navigation.css')
  const dashboard = await read('./dashboard.css')
  assert.doesNotMatch(nav, /--mobile-bottom-nav-height:\s*65px/)
  assert.match(dashboard, /var\(--mobile-bottom-nav-height\)/)
  assert.match(dashboard, /var\(--mobile-floating-gap\)/)
})
```

- [ ] **Step 2: confirmar RED**

```bash
node --test src/mobileFoundation.test.js
```

Expected: FAIL porque a fundação ainda não existe.

- [ ] **Step 3: criar a fundação**

```css
@media (max-width: 820px) {
  :root {
    --mobile-bottom-nav-height: 65px;
    --mobile-safe-bottom: env(safe-area-inset-bottom, 0px);
    --mobile-floating-gap: 16px;
    --mobile-page-inline: 14px;
    --mobile-touch-target: 44px;
    --mobile-overlay-inset: 12px;
    --mobile-overlay-max-height: min(88dvh, 720px);
    --mobile-content-bottom-space: calc(var(--mobile-bottom-nav-height) + 37px + var(--mobile-safe-bottom));
    --layer-mobile-nav: 60;
    --layer-overlay: 100;
    --layer-toast: 120;
  }

  html,
  body,
  #root {
    max-width: 100%;
    overflow-x: clip;
  }

  .app-main {
    min-width: 0;
    overflow-x: clip;
    overscroll-behavior-x: none;
    touch-action: pan-y pinch-zoom;
  }

  .app-shell .app-content {
    padding-bottom: var(--mobile-content-bottom-space);
    scroll-padding-bottom: var(--mobile-content-bottom-space);
  }
}
```

Importar `./mobile-foundation.css` em `src/App.jsx`.

- [ ] **Step 4: remover duplicação e migrar consumidores**

Remover de `index.css`, `App.css` e `mobile-navigation.css` apenas as regras estruturais transferidas. Em `mobile-navigation.css`, usar `z-index: var(--layer-mobile-nav)`. Em `dashboard.css`:

```css
bottom: calc(var(--mobile-bottom-nav-height) + var(--mobile-floating-gap) + var(--mobile-safe-bottom));
```

- [ ] **Step 5: atualizar regressões existentes**

`mobileStabilityRegression.test.js` e `mobilePageMotion.test.js` passam a ler `mobile-foundation.css` para tokens/viewport; navegação/animação continuam em `mobile-navigation.css` e FAB em `dashboard.css`.

- [ ] **Step 6: GREEN e validação**

```bash
node --test src/mobileFoundation.test.js src/mobileStabilityRegression.test.js src/mobilePageMotion.test.js
npm test
npm run lint
npm run build
```

- [ ] **Step 7: commit**

```bash
git add src/mobile-foundation.css src/mobileFoundation.test.js src/App.jsx src/index.css src/App.css src/mobile-navigation.css src/dashboard.css src/mobileStabilityRegression.test.js src/mobilePageMotion.test.js
git commit -m "refactor: centralize mobile layout foundation"
```

---

### Task 2: Fortalecer Modal, BottomSheet e SystemSelect

**Files:** `src/mobileOverlayRegression.test.js`, `src/components/Modal.jsx`, `src/components/BottomSheet.jsx`, `src/components/SystemSelect.jsx`, `src/mobile-foundation.css`, `src/bottom-sheet.css`, `src/system-select.css`, `src/bottomSheet.test.js`, `src/systemSelect.test.js`

**Interfaces:** mantém as APIs públicas atuais e produz portal + Escape + focus trap/restauração + body scroll lock + `dvh`/scroll interno.

- [ ] **Step 1: escrever RED**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('modal and sheet lock background and restore focus', async () => {
  const modal = await read('./components/Modal.jsx')
  const sheet = await read('./components/BottomSheet.jsx')
  assert.match(modal, /document\.body\.style\.overflow/)
  assert.match(modal, /previousFocus/)
  assert.match(modal, /event\.key === 'Escape'/)
  assert.match(sheet, /document\.body\.style\.overflow/)
  assert.match(sheet, /previousFocus/)
})

test('mobile overlays use dynamic viewport and internal scroll', async () => {
  const foundation = await read('./mobile-foundation.css')
  const sheetCss = await read('./bottom-sheet.css')
  assert.match(foundation, /\.modal-card\s*\{[^}]*max-height:\s*var\(--mobile-overlay-max-height\)/s)
  assert.match(foundation, /\.modal-body\s*\{[^}]*overscroll-behavior:\s*contain/s)
  assert.match(sheetCss, /\.bottom-sheet-body\s*\{[^}]*overflow-y:\s*auto[^}]*overscroll-behavior:\s*contain/s)
})
```

- [ ] **Step 2: confirmar RED**

```bash
node --test src/mobileOverlayRegression.test.js
```

- [ ] **Step 3: Modal**

Adicionar `useEffect`/`useRef`; registrar foco anterior, focar primeiro controle, fechar por Escape, prender Tab entre primeiro/último controle e travar/restaurar `document.body.style.overflow`. Cleanup obrigatório:

```jsx
return () => {
  document.removeEventListener('keydown', handleKeyDown)
  document.body.style.overflow = previousOverflow
  previousFocus.current?.focus?.()
}
```

- [ ] **Step 4: BottomSheet**

No efeito já existente, incorporar scroll lock ao mesmo lifecycle; manter focus trap e Escape.

- [ ] **Step 5: sizing compartilhado**

Em `mobile-foundation.css`:

```css
@media (max-width: 640px) {
  .modal-backdrop {
    place-items: center;
    padding: var(--mobile-overlay-inset);
    overscroll-behavior: contain;
  }

  .modal-card {
    width: min(100%, 560px);
    max-height: var(--mobile-overlay-max-height);
    border-radius: 18px;
  }

  .modal-body {
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
  }
}
```

Remover regras mobile conflitantes dos outros CSS.

- [ ] **Step 6: SystemSelect/BottomSheet**

Opções mobile usam `min-height: var(--mobile-touch-target)`; lista longa rola no `.bottom-sheet-body`, nunca na página por trás. Desktop continua dropdown ancorado.

- [ ] **Step 7: validar**

```bash
node --test src/mobileOverlayRegression.test.js src/bottomSheet.test.js src/systemSelect.test.js src/mobileStabilityRegression.test.js
npm test
npm run lint
npm run build
```

- [ ] **Step 8: commit**

```bash
git add src/mobileOverlayRegression.test.js src/components/Modal.jsx src/components/BottomSheet.jsx src/components/SystemSelect.jsx src/mobile-foundation.css src/bottom-sheet.css src/system-select.css src/bottomSheet.test.js src/systemSelect.test.js
git commit -m "fix: harden mobile overlays and selects"
```

---

### Task 3: Otimizar Novo Pedido

**Files:** `src/pages/NewOrderMobile.test.js`, `src/pages/NewOrder.jsx`, `src/new-order.css`, `src/components/OrderProductCatalog.jsx`, `src/components/OrderCart.jsx`, `src/components/OrderCheckoutSummary.jsx`, `src/pages/NewOrder.test.js`

**Interfaces:** preserva regras atuais de identidade, carrinho, cálculo e payload; produz fluxo de uma coluna e teclado adequado.

- [ ] **Step 1: escrever RED**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('new order is touch-first on narrow screens', async () => {
  const css = await read('../new-order.css')
  assert.match(css, /@media\s*\(max-width:\s*640px\)/)
  assert.match(css, /grid-template-columns:\s*1fr/)
  assert.match(css, /min-width:\s*0/)
  assert.match(css, /min-height:\s*(?:44|48)px/)
})

test('order inputs expose mobile keyboard hints', async () => {
  const page = await read('./NewOrder.jsx')
  const checkout = await read('../components/OrderCheckoutSummary.jsx')
  assert.match(page, /inputMode="tel"/)
  assert.match(checkout, /inputMode="decimal"/)
})
```

- [ ] **Step 2: confirmar RED**

```bash
node --test src/pages/NewOrderMobile.test.js
```

- [ ] **Step 3: inputs**

Telefone em `NewOrder.jsx` usa `inputMode="tel"`. Taxa de entrega e valor de ajuste em `OrderCheckoutSummary.jsx` usam `inputMode="decimal"`. Não mudar validação ou cálculos.

- [ ] **Step 4: layout**

Em 640 px e abaixo, o layout principal vira uma coluna, todos os blocos internos usam `min-width: 0`, e ações finais ficam em uma coluna:

```css
.order-checkout-actions {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.order-checkout-actions .button {
  width: 100%;
  min-height: 48px;
  white-space: normal;
}
```

- [ ] **Step 5: catálogo/carrinho**

Nome/observação quebram sem overflow; controles isolados de quantidade, remoção e observação mantêm 44 px; observação expandida ocupa a largura disponível.

- [ ] **Step 6: validar**

```bash
node --test src/pages/NewOrderMobile.test.js src/pages/NewOrder.test.js
npm test
npm run lint
npm run build
```

- [ ] **Step 7: commit**

```bash
git add src/pages/NewOrderMobile.test.js src/pages/NewOrder.jsx src/new-order.css src/components/OrderProductCatalog.jsx src/components/OrderCart.jsx src/components/OrderCheckoutSummary.jsx src/pages/NewOrder.test.js
git commit -m "fix: optimize new order flow for mobile"
```

---

### Task 4: Melhorar Pedidos/Cozinha

**Files:** `src/pages/OrdersMobile.test.js`, `src/pages/Orders.jsx`, `src/order-operations.css`, `src/order-operations-compact.css`, `src/components/OrderDetail.jsx`, `src/pages/OrdersMultiItem.test.js`

**Interfaces:** preserva polling, `newOrderIds`, som e regras de status; produz cards compactos e ações resilientes.

- [ ] **Step 1: escrever RED**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('order operations contain narrow-screen containment and action rules', async () => {
  const css = await read('../order-operations-compact.css')
  assert.match(css, /@media\s*\(max-width:\s*640px\)/)
  assert.match(css, /min-width:\s*0/)
  assert.match(css, /(flex-wrap:\s*wrap|grid-template-columns:)/)
  assert.match(css, /overflow-wrap:\s*anywhere/)
})
```

- [ ] **Step 2: confirmar RED**

```bash
node --test src/pages/OrdersMobile.test.js
```

- [ ] **Step 3: cabeçalho/status/tempo**

Nome/mesa/local podem quebrar; badges e tempo continuam visíveis. Reduzir somente espaços excessivos.

- [ ] **Step 4: ações**

Grid ou flex-wrap; botões operacionais ≥44 px; textos longos da ação final podem quebrar em duas linhas.

- [ ] **Step 5: OrderDetail**

Itens/observações usam `min-width: 0` e quebra; valores permanecem `white-space: nowrap`.

- [ ] **Step 6: estabilidade do refresh**

Não adicionar `scrollIntoView`; manter keys por pedido e destaque `newOrderIds` pontual.

- [ ] **Step 7: validar**

```bash
node --test src/pages/OrdersMobile.test.js src/pages/OrdersMultiItem.test.js
npm test
npm run lint
npm run build
```

- [ ] **Step 8: commit**

```bash
git add src/pages/OrdersMobile.test.js src/pages/Orders.jsx src/order-operations.css src/order-operations-compact.css src/components/OrderDetail.jsx src/pages/OrdersMultiItem.test.js
git commit -m "fix: improve mobile kitchen order ergonomics"
```

---

### Task 5: Fechar A Receber/pagamentos

**Files:** `src/pages/ReceivablesMobile.test.js`, `src/pages/Receivables.jsx`, `src/receivables.css`, `src/App.jsx`, `src/App.css`, `src/pages/ReceivablesDetails.test.js`

**Interfaces:** usa somente `Modal`, `SystemSelect` e `OrderDetail` compartilhados; produz grupos/ações utilizáveis em 320 px.

- [ ] **Step 1: escrever RED**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('receivables cards and payment actions fit narrow screens', async () => {
  const css = await read('../receivables.css')
  const app = await read('../App.jsx')
  assert.match(css, /@media\s*\(max-width:\s*640px\)/)
  assert.match(css, /min-width:\s*0/)
  assert.match(css, /(grid-template-columns:\s*1fr|flex-direction:\s*column)/)
  assert.match(app, /<SystemSelect[\s\S]*label="Forma de pagamento"/)
})
```

- [ ] **Step 2: confirmar RED**

```bash
node --test src/pages/ReceivablesMobile.test.js
```

- [ ] **Step 3: grupos/valores/ações**

Identificação/status ficam no bloco principal, valor não quebra e ações podem ir para linha própria; ações de cobrança ≥44 px.

- [ ] **Step 4: overlays**

Pagamento individual e consolidado continuam em `Modal` + `SystemSelect`; não criar dropdown/modal alternativo mobile.

- [ ] **Step 5: detalhes**

Continuar reutilizando `OrderDetail` da Task 4.

- [ ] **Step 6: validar**

```bash
node --test src/pages/ReceivablesMobile.test.js src/pages/ReceivablesDetails.test.js
npm test
npm run lint
npm run build
```

- [ ] **Step 7: commit**

```bash
git add src/pages/ReceivablesMobile.test.js src/pages/Receivables.jsx src/receivables.css src/App.jsx src/App.css src/pages/ReceivablesDetails.test.js
git commit -m "fix: stabilize receivables payments on mobile"
```

---

### Task 6: Refinar Dashboard

**Files:** `src/pages/DashboardMobile.test.js`, `src/pages/Dashboard.jsx`, `src/dashboard.css`, `src/pages/DashboardAnalytics.test.js`; se necessário, `src/components/DashboardBarChart.jsx`, `src/components/DashboardLineChart.jsx`, `src/components/DashboardPaymentMix.jsx`

**Interfaces:** preserva FAB portalizado, métricas e dados dos gráficos; produz composição sem overflow.

- [ ] **Step 1: escrever RED**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('dashboard stacks analytics and uses shared FAB tokens', async () => {
  const css = await read('../dashboard.css')
  assert.match(css, /@media\s*\(max-width:\s*820px\)[\s\S]*\.dashboard-analytics-grid\s*\{[^}]*grid-template-columns:\s*1fr/s)
  assert.match(css, /\.dashboard-chart-card\s*\{[^}]*min-width:\s*0[^}]*overflow:\s*hidden/s)
  assert.match(css, /var\(--mobile-floating-gap\)/)
})
```

- [ ] **Step 2: confirmar RED**

```bash
node --test src/pages/DashboardMobile.test.js
```

- [ ] **Step 3: métricas/seletor**

Reduzir apenas padding/gaps excessivos; seletor e privacidade continuam ≥44 px.

- [ ] **Step 4: gráficos**

Em 320 px, se labels de eixo se chocarem, mostrar labels alternadas quando a série tiver mais de 7 pontos; não remover dados/pontos/barras.

- [ ] **Step 5: FAB**

Manter portal em `document.body` e:

```css
bottom: calc(var(--mobile-bottom-nav-height) + var(--mobile-floating-gap) + var(--mobile-safe-bottom));
```

- [ ] **Step 6: validar**

```bash
node --test src/pages/DashboardMobile.test.js src/pages/DashboardAnalytics.test.js src/mobileStabilityRegression.test.js
npm test
npm run lint
npm run build
```

- [ ] **Step 7: commit**

```bash
git add src/pages/DashboardMobile.test.js src/pages/Dashboard.jsx src/dashboard.css src/pages/DashboardAnalytics.test.js src/components/DashboardBarChart.jsx src/components/DashboardLineChart.jsx src/components/DashboardPaymentMix.jsx
git commit -m "fix: refine dashboard for narrow mobile screens"
```

Unmodified graph files are harmless in `git add`; the commit contains only actual diffs.

---

### Task 7: Revisar Clientes e Produtos

**Files:** `src/pages/ClientsProductsMobile.test.js`, `src/pages/Clients.jsx`, `src/clients-phonebook.css`, `src/pages/Products.jsx`, `src/product-form.css`, `src/App.jsx`, `src/App.css`, `src/clientsPhonebook.test.js`, `src/productCatalogUi.test.js`

**Interfaces:** mantém BottomSheet/SystemSelect e regras de catálogo/duplicidade; produz listas compactas e formulários de uma coluna.

- [ ] **Step 1: escrever RED**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('client rows and product form remain touchable at 320px', async () => {
  const clients = await read('../clients-phonebook.css')
  const form = await read('../product-form.css')
  assert.match(clients, /min-height:\s*(?:44|48)px/)
  assert.match(clients, /@media\s*\(max-width:\s*640px\)/)
  assert.match(form, /@media\s*\(max-width:\s*640px\)/)
  assert.match(form, /grid-template-columns:\s*1fr/)
})
```

- [ ] **Step 2: confirmar RED**

```bash
node --test src/pages/ClientsProductsMobile.test.js
```

- [ ] **Step 3: Clientes**

Linha inteira acionável, altura confortável, `min-width: 0`, endereço quebrável; ações editar/excluir continuam no BottomSheet.

- [ ] **Step 4: Produtos**

Busca/filtro ocupam largura útil. Nome/apresentação/preço permanecem legíveis; se ações comprimirem o nome em 320 px, mover ações para outra linha.

- [ ] **Step 5: ProductForm**

Categoria, apresentação, tamanho/volume/peso, preço e preview empilham; inputs mobile ≥16 px; decimal usa `inputMode="decimal"`.

- [ ] **Step 6: cliente global**

Telefone em `App.jsx`: `type="tel" inputMode="tel"`; nome `autoComplete="name"`; endereço `autoComplete="street-address"`. Não mudar duplicidade.

- [ ] **Step 7: validar**

```bash
node --test src/pages/ClientsProductsMobile.test.js src/clientsPhonebook.test.js src/productCatalogUi.test.js
npm test
npm run lint
npm run build
```

- [ ] **Step 8: commit**

```bash
git add src/pages/ClientsProductsMobile.test.js src/pages/Clients.jsx src/clients-phonebook.css src/pages/Products.jsx src/product-form.css src/App.jsx src/App.css src/clientsPhonebook.test.js src/productCatalogUi.test.js
git commit -m "fix: improve clients and products mobile usability"
```

---

### Task 8: Revisar Financeiro e menu Mais

**Files:** `src/pages/FinanceMoreMobile.test.js`, `src/pages/Finance.jsx`, `src/App.jsx`, `src/App.css`, `src/components/MobileNavigation.jsx`, `src/mobile-navigation.css`, `src/bottom-sheet.css`, `src/mobileNavigation.test.js`

**Interfaces:** mantém destinos atuais de Mais e modal de movimento; produz histórico legível e ações de 48 px.

- [ ] **Step 1: escrever RED**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('finance rows and more menu remain usable on narrow screens', async () => {
  const appCss = await read('../App.css')
  const navCss = await read('../mobile-navigation.css')
  assert.match(appCss, /@media\s*\(max-width:\s*640px\)[\s\S]*\.movement-row/)
  assert.match(navCss, /\.mobile-more-action[\s\S]*min-height:\s*48px/)
  assert.match(navCss, /\.mobile-more-logout[\s\S]*min-height:\s*48px/)
})
```

- [ ] **Step 2: confirmar RED**

```bash
node --test src/pages/FinanceMoreMobile.test.js
```

- [ ] **Step 3: Financeiro**

Descrição/categoria no bloco principal; valor pode ir para linha própria em 320 px; dinheiro não quebra no meio.

- [ ] **Step 4: movimento**

Valor usa `inputMode="decimal"`; tipo/categoria continuam em SystemSelect; duas colunas empilham no mobile.

- [ ] **Step 5: Mais**

A Receber, Financeiro, tema e logout continuam no BottomSheet; ações 48 px, safe area e estado ativo sem depender de hover.

- [ ] **Step 6: validar**

```bash
node --test src/pages/FinanceMoreMobile.test.js src/mobileNavigation.test.js src/bottomSheet.test.js
npm test
npm run lint
npm run build
```

- [ ] **Step 7: commit**

```bash
git add src/pages/FinanceMoreMobile.test.js src/pages/Finance.jsx src/App.jsx src/App.css src/components/MobileNavigation.jsx src/mobile-navigation.css src/bottom-sheet.css src/mobileNavigation.test.js
git commit -m "fix: polish finance and more menu on mobile"
```

---

### Task 9: Padronizar estados e feedback de toque

**Files:** `src/mobileConsistencyRegression.test.js`, `src/App.css`, `src/mobile-foundation.css`; `src/theme.css` somente se a auditoria encontrar contraste divergente.

**Interfaces:** produz feedback touch, toast acima do menu e mantém reduced motion/temas.

- [ ] **Step 1: escrever RED**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('touch feedback does not depend on hover', async () => {
  const app = await read('./App.css')
  assert.match(app, /@media\s*\(hover:\s*none\)/)
  assert.match(app, /\.button:active/)
})

test('mobile toast stays above bottom navigation', async () => {
  const foundation = await read('./mobile-foundation.css')
  assert.match(foundation, /\.toast-success[\s\S]*var\(--mobile-bottom-nav-height\)/)
})
```

- [ ] **Step 2: confirmar RED**

```bash
node --test src/mobileConsistencyRegression.test.js
```

- [ ] **Step 3: touch**

```css
@media (hover: none) {
  .button:hover { transform: none; }
  .button:active:not(:disabled) { transform: scale(0.98); }
}
```

Aplicar o mesmo princípio a controles que hoje usam transform somente em hover, preservando foco.

- [ ] **Step 4: toast**

```css
@media (max-width: 820px) {
  .toast-success {
    z-index: var(--layer-toast);
    bottom: calc(var(--mobile-bottom-nav-height) + 12px + var(--mobile-safe-bottom));
  }
}
```

- [ ] **Step 5: estados/tema/reduced motion**

Verificar loading, erro, vazio, claro/escuro. Não criar tema mobile separado. O bloco global `prefers-reduced-motion` continua cobrindo qualquer animação da rodada.

- [ ] **Step 6: validar**

```bash
node --test src/mobileConsistencyRegression.test.js src/mobilePageMotion.test.js src/mobileStabilityRegression.test.js
npm test
npm run lint
npm run build
```

- [ ] **Step 7: commit**

```bash
git add src/mobileConsistencyRegression.test.js src/App.css src/mobile-foundation.css src/theme.css
git commit -m "fix: unify mobile interaction and state feedback"
```

Unmodified `theme.css` does not enter the commit.

---

### Task 10: Executar QA manual 320/360/390–393/480

**Files:** create `docs/superpowers/qa/2026-09-02-mobile-ux-audit-checklist.md`; corrigir arquivos de tela/CSS/testes apenas para bugs concretos encontrados.

**Interfaces:** produz evidência de revisão e zero P0/P1 aberto.

- [ ] **Step 1: criar matriz**

```markdown
| Tela/fluxo | 320 | 360 | 390/393 | 480 | Claro | Escuro | Teclado | Resultado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Dashboard | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | n/a | Pendente |
| Pedidos/Cozinha | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | n/a | Pendente |
| Novo Pedido | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | Pendente |
| Clientes | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | Pendente |
| Produtos | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | Pendente |
| A Receber | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | Pendente |
| Financeiro | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | Pendente |
| Mais | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | n/a | Pendente |
```

Registrar também primeiro carregamento, scroll longo, texto longo, lista vazia/longa, loading, erro, overlay, ação principal e safe area.

- [ ] **Step 2: revisar 320 px** — classificar achados P0/P1/P2.
- [ ] **Step 3: revisar 360 px com teclado** — abrir teclado no topo/meio/fim de Novo Pedido, Cliente, Produto, Pagamento e Movimento.
- [ ] **Step 4: revisar 390/393 px** — validar safe area, menu, FAB, modal, sheet e toast.
- [ ] **Step 5: revisar 480 px** — confirmar breakpoints e densidade.
- [ ] **Step 6: corrigir cada P0/P1 com RED/GREEN e commit individual**. P2 somente após zerar P0/P1.
- [ ] **Step 7: marcar `✅` somente após teste efetivo; resultado final de cada tela: `Sem P0/P1 aberto`.**
- [ ] **Step 8: commit**

```bash
git add docs/superpowers/qa/2026-09-02-mobile-ux-audit-checklist.md
git commit -m "docs: record mobile UX audit results"
```

---

### Task 11: Verificação final e prontidão para produção

**Files:** read `docs/superpowers/specs/2026-09-02-mobile-ux-audit-design.md` and `docs/superpowers/qa/2026-09-02-mobile-ux-audit-checklist.md`; code only if verification finds a regression.

- [ ] **Step 1: suíte**

```bash
npm test
```

Expected: 0 falhas.

- [ ] **Step 2: lint**

```bash
npm run lint
```

Expected: sucesso.

- [ ] **Step 3: build**

```bash
npm run build
```

Expected: sucesso.

- [ ] **Step 4: Worker dry-run**

```bash
npx --yes wrangler@4.128.0 deploy --dry-run
```

Expected: bundle válido e binding D1 reconhecido.

- [ ] **Step 5: cobertura da spec**

Confirmar no checklist: 320–480, sem scroll horizontal, menu/FAB/safe area, teclado, Modal, BottomSheet, SystemSelect, todas as oito áreas, claro/escuro, loading/erro/vazio e reduced motion.

- [ ] **Step 6: verificar escopo do diff sem placeholder de SHA**

Localizar o primeiro commit de implementação desta rodada e usar seu pai como base:

```bash
FIRST_IMPL="$(git log --grep='^refactor: centralize mobile layout foundation$' --format=%H -n 1)"
test -n "$FIRST_IMPL"
BASE_SHA="$(git rev-parse "${FIRST_IMPL}^")"
git status --short
git diff --stat "$BASE_SHA"...HEAD
```

Expected: nenhuma migration, schema D1 ou regra de negócio alterada sem justificativa direta de UX.

- [ ] **Step 7: falha reabre a tarefa responsável** — novo RED/GREEN antes de declarar conclusão.
- [ ] **Step 8: deploy somente após aprovação do usuário** — não alterar workflow de produção como parte desta rodada.

---

## Spec Coverage Matrix

| Requisito | Tarefa |
| --- | --- |
| 320–480 e 320/360/390–393/480 | 1, 10 |
| Tokens/viewport/sem scroll horizontal | 1 |
| Menu inferior/safe area/FAB | 1, 6, 8, 10 |
| Touch targets | 1–8 |
| Teclado/formulários | 2, 3, 5, 7, 8, 10 |
| Modal/BottomSheet/SystemSelect | 2 |
| Swipe/reduced motion | 1, 9 |
| Novo Pedido | 3 |
| Pedidos/Cozinha | 4 |
| A Receber | 5 |
| Dashboard | 6 |
| Clientes/Produtos | 7 |
| Financeiro/Mais | 8 |
| Loading/erro/vazio/tema/touch | 9 |
| P0/P1/P2 e QA manual | 10 |
| Testes/lint/build/Worker/escopo | 11 |
