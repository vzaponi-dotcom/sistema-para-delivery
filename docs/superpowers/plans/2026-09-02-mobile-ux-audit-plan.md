# Mobile UX Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidar e auditar a experiência mobile do Gestão Delivery para funcionar de forma consistente, ergonômica e sem sobreposições entre 320 px e 480 px, preservando o desktop.

**Architecture:** Criar uma fundação mobile compartilhada com tokens e regras estruturais de viewport, safe area, overlays e touch targets; remover regras estruturais duplicadas de CSS específicos; depois ajustar cada fluxo/tela sobre essa base. As mudanças serão incrementais, orientadas por regressões automatizadas com `node:test`, sem introduzir nova biblioteca de UI ou framework de testes.

**Tech Stack:** React 19, React DOM 19, Vite 8, CSS responsivo, Node.js `node:test`, oxlint, Cloudflare Worker/Wrangler 4.128.0.

**Spec:** `docs/superpowers/specs/2026-09-02-mobile-ux-audit-design.md`

## Global Constraints

- Suporte mobile alvo: 320 px a 480 px de largura.
- Referências obrigatórias de revisão: 320 px, 360 px, 390/393 px e 480 px.
- Preservar a identidade visual atual; ajustes visuais só quando melhorarem hierarquia, legibilidade, densidade ou ergonomia.
- Não criar aplicação mobile separada nem duplicar a interface desktop.
- Não adicionar nova biblioteca de UI, CSS framework ou test runner.
- Touch targets importantes devem ficar em aproximadamente 44–48 px no menor eixo sempre que possível.
- Nenhuma tela deve criar scroll horizontal involuntário.
- Safe areas devem ser respeitadas por navegação, overlays e elementos flutuantes.
- Componentes fixos não podem depender de ancestrais transformados.
- Problemas repetidos em duas ou mais telas devem ser corrigidos na base compartilhada ou componente comum.
- Desktop não pode sofrer regressões funcionais ou visuais relevantes.
- Todo bug real identificado durante a execução recebe teste de regressão antes da correção ou no mesmo ciclo TDD.
- Cada tarefa termina com testes relevantes e `npm test`, `npm run lint` e `npm run build` verdes antes da revisão.

---

## File Structure

### Fundação compartilhada

- **Create:** `src/mobile-foundation.css` — único dono de tokens e regras estruturais mobile compartilhadas: viewport, safe area, conteúdo, overlays e scroll padding.
- **Create:** `src/mobileFoundation.test.js` — regressões dos tokens e propriedade das regras estruturais.
- **Modify:** `src/App.jsx` — importar a fundação e melhorar semântica de inputs globais.
- **Modify:** `src/index.css` — manter apenas base global e remover overflow mobile duplicado depois da migração.
- **Modify:** `src/App.css` — manter estilos visuais gerais; remover regras estruturais mobile que forem transferidas para a fundação.
- **Modify:** `src/mobile-navigation.css` — manter navegação/animação específicas e consumir tokens compartilhados.
- **Modify:** `src/dashboard.css` — consumir tokens compartilhados para o FAB.
- **Modify/Test:** `src/mobileStabilityRegression.test.js`, `src/mobilePageMotion.test.js` — apontar para o novo dono das regras sem reduzir cobertura.

### Overlays e selects

- **Create:** `src/mobileOverlayRegression.test.js` — portal, foco, Escape, scroll lock, `dvh` e scroll interno.
- **Modify:** `src/components/Modal.jsx`
- **Modify:** `src/components/BottomSheet.jsx`
- **Modify:** `src/components/SystemSelect.jsx`
- **Modify:** `src/bottom-sheet.css`
- **Modify:** `src/system-select.css`
- **Modify/Test:** `src/bottomSheet.test.js`, `src/systemSelect.test.js`

### Fluxos críticos

- **Modify:** `src/pages/NewOrder.jsx`, `src/new-order.css`, `src/components/OrderProductCatalog.jsx`, `src/components/OrderCart.jsx`, `src/components/OrderCheckoutSummary.jsx`
- **Create/Test:** `src/pages/NewOrderMobile.test.js`
- **Modify/Test:** `src/pages/NewOrder.test.js`
- **Modify:** `src/pages/Orders.jsx`, `src/order-operations.css`, `src/order-operations-compact.css`, `src/components/OrderDetail.jsx`
- **Create/Test:** `src/pages/OrdersMobile.test.js`
- **Modify/Test:** `src/pages/OrdersMultiItem.test.js`
- **Modify:** `src/pages/Receivables.jsx`, `src/receivables.css`, formulários de pagamento em `src/App.jsx`
- **Create/Test:** `src/pages/ReceivablesMobile.test.js`
- **Modify/Test:** `src/pages/ReceivablesDetails.test.js`

### Demais telas

- **Modify:** `src/pages/Dashboard.jsx`, `src/dashboard.css`; componentes de gráfico somente se a composição em 320 px exigir mudança.
- **Create/Test:** `src/pages/DashboardMobile.test.js`
- **Modify/Test:** `src/pages/DashboardAnalytics.test.js`
- **Modify:** `src/pages/Clients.jsx`, `src/clients-phonebook.css`, `src/pages/Products.jsx`, `src/product-form.css`
- **Create/Test:** `src/pages/ClientsProductsMobile.test.js`
- **Modify/Test:** `src/clientsPhonebook.test.js`, `src/productCatalogUi.test.js`
- **Modify:** `src/pages/Finance.jsx`, `src/components/MobileNavigation.jsx`, `src/mobile-navigation.css`, formulários globais em `src/App.jsx`/`src/App.css`
- **Create/Test:** `src/pages/FinanceMoreMobile.test.js`
- **Modify/Test:** `src/mobileNavigation.test.js`

### Consistência e QA

- **Create:** `src/mobileConsistencyRegression.test.js`
- **Create:** `docs/superpowers/qa/2026-09-02-mobile-ux-audit-checklist.md`

---

### Task 1: Consolidar tokens e propriedade das regras estruturais mobile

**Files:**
- Create: `src/mobile-foundation.css`
- Create: `src/mobileFoundation.test.js`
- Modify: `src/App.jsx`
- Modify: `src/index.css`
- Modify: `src/App.css`
- Modify: `src/mobile-navigation.css`
- Modify: `src/dashboard.css`
- Modify: `src/mobileStabilityRegression.test.js`
- Modify: `src/mobilePageMotion.test.js`

**Interfaces:**
- Consumes: `.app-shell`, `.app-main`, `.app-content`, `.mobile-bottom-nav`, `.modal-backdrop`, `.modal-card`, `.dashboard-new-order-fab`.
- Produces: `--mobile-bottom-nav-height`, `--mobile-safe-bottom`, `--mobile-content-bottom-space`, `--mobile-floating-gap`, `--mobile-page-inline`, `--mobile-touch-target`, `--mobile-overlay-inset`, `--mobile-overlay-max-height`, `--layer-mobile-nav`, `--layer-overlay`, `--layer-toast`.

- [ ] **Step 1: escrever o teste RED da fundação compartilhada**

Criar `src/mobileFoundation.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('mobile foundation owns shared viewport safe-area and layer tokens', async () => {
  const css = await read('./mobile-foundation.css')
  assert.match(css, /--mobile-bottom-nav-height:\s*65px/)
  assert.match(css, /--mobile-safe-bottom:\s*env\(safe-area-inset-bottom/)
  assert.match(css, /--mobile-touch-target:\s*44px/)
  assert.match(css, /--mobile-overlay-max-height:\s*min\(88dvh,\s*720px\)/)
  assert.match(css, /\.app-main\s*\{[^}]*overflow-x:\s*clip[^}]*touch-action:\s*pan-y\s+pinch-zoom/s)
  assert.match(css, /html,\s*body,\s*#root\s*\{[^}]*overflow-x:\s*clip/s)
})

test('shared structural rules are not duplicated in navigation css', async () => {
  const navigation = await read('./mobile-navigation.css')
  const dashboard = await read('./dashboard.css')
  assert.doesNotMatch(navigation, /--mobile-bottom-nav-height:\s*65px/)
  assert.match(dashboard, /var\(--mobile-bottom-nav-height\)/)
  assert.match(dashboard, /var\(--mobile-floating-gap\)/)
})
```

- [ ] **Step 2: executar RED**

```bash
node --test src/mobileFoundation.test.js
```

Expected: FAIL porque `src/mobile-foundation.css` ainda não existe.

- [ ] **Step 3: criar a fundação mínima**

Criar `src/mobile-foundation.css`:

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

Importar `./mobile-foundation.css` em `src/App.jsx` junto aos estilos globais da aplicação.

- [ ] **Step 4: migrar consumidores e remover duplicação**

Em `src/mobile-navigation.css`:

```css
.mobile-bottom-nav {
  z-index: var(--layer-mobile-nav);
}
```

Em `src/dashboard.css`:

```css
@media (max-width: 820px) {
  .dashboard-new-order-fab {
    bottom: calc(var(--mobile-bottom-nav-height) + var(--mobile-floating-gap) + var(--mobile-safe-bottom));
  }
}
```

Remover de `src/index.css`, `src/App.css` e `src/mobile-navigation.css` somente as versões estruturais que agora têm dono em `mobile-foundation.css`; não remover estilos visuais de desktop.

- [ ] **Step 5: atualizar testes existentes para o novo dono**

Em `src/mobileStabilityRegression.test.js` e `src/mobilePageMotion.test.js`, ler `mobile-foundation.css` para tokens/viewport e continuar lendo `mobile-navigation.css` para navegação/animação e `dashboard.css` para FAB.

- [ ] **Step 6: executar GREEN focado e suíte completa**

```bash
node --test src/mobileFoundation.test.js src/mobileStabilityRegression.test.js src/mobilePageMotion.test.js
npm test
npm run lint
npm run build
```

Expected: 0 falhas.

- [ ] **Step 7: commit**

```bash
git add src/mobile-foundation.css src/mobileFoundation.test.js src/App.jsx src/index.css src/App.css src/mobile-navigation.css src/dashboard.css src/mobileStabilityRegression.test.js src/mobilePageMotion.test.js
git commit -m "refactor: centralize mobile layout foundation"
```

---

### Task 2: Tornar Modal, BottomSheet e SystemSelect robustos para viewport e teclado

**Files:**
- Create: `src/mobileOverlayRegression.test.js`
- Modify: `src/components/Modal.jsx`
- Modify: `src/components/BottomSheet.jsx`
- Modify: `src/components/SystemSelect.jsx`
- Modify: `src/mobile-foundation.css`
- Modify: `src/bottom-sheet.css`
- Modify: `src/system-select.css`
- Modify: `src/bottomSheet.test.js`
- Modify: `src/systemSelect.test.js`

**Interfaces:**
- Consumes: APIs públicas atuais de `Modal`, `BottomSheet` e `SystemSelect`.
- Produces: overlays portalizados com Escape, foco restaurado, fundo travado e conteúdo rolável dentro de `dvh`; `SystemSelect` continua usando BottomSheet em `max-width: 820px`.

- [ ] **Step 1: escrever regressões RED de overlay**

Criar `src/mobileOverlayRegression.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('modal and bottom sheet lock background scroll and restore focus', async () => {
  const modal = await read('./components/Modal.jsx')
  const sheet = await read('./components/BottomSheet.jsx')
  assert.match(modal, /document\.body\.style\.overflow/)
  assert.match(modal, /previousFocus/)
  assert.match(modal, /event\.key === 'Escape'/)
  assert.match(sheet, /document\.body\.style\.overflow/)
  assert.match(sheet, /previousFocus/)
})

test('mobile overlays use dynamic viewport and internal scrolling', async () => {
  const foundation = await read('./mobile-foundation.css')
  const sheetCss = await read('./bottom-sheet.css')
  assert.match(foundation, /--mobile-overlay-max-height:\s*min\(88dvh,\s*720px\)/)
  assert.match(foundation, /\.modal-card\s*\{[^}]*max-height:\s*var\(--mobile-overlay-max-height\)/s)
  assert.match(foundation, /\.modal-body\s*\{[^}]*overscroll-behavior:\s*contain/s)
  assert.match(sheetCss, /\.bottom-sheet-body\s*\{[^}]*overflow-y:\s*auto[^}]*overscroll-behavior:\s*contain/s)
})
```

- [ ] **Step 2: executar RED**

```bash
node --test src/mobileOverlayRegression.test.js
```

Expected: FAIL nas novas expectativas.

- [ ] **Step 3: implementar lifecycle acessível em Modal**

Adicionar `useEffect`/`useRef`, registrar foco anterior, focar o primeiro controle do diálogo, fechar por Escape, fazer trap de Tab entre primeiro/último controle e travar/restaurar `document.body.style.overflow`. Manter `createPortal(..., document.body)` e a API atual.

Estrutura de cleanup obrigatória:

```jsx
return () => {
  document.removeEventListener('keydown', handleKeyDown)
  document.body.style.overflow = previousOverflow
  previousFocus.current?.focus?.()
}
```

- [ ] **Step 4: alinhar BottomSheet sem duplicar efeitos concorrentes**

No efeito existente de `BottomSheet`, adicionar preservação/restauração do overflow do body e manter o focus trap atual. Um único efeito deve cuidar de Escape, Tab, scroll lock e foco.

- [ ] **Step 5: centralizar sizing mobile de modal**

Adicionar à fundação:

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

Remover a regra mobile conflitante de `.modal-backdrop/.modal-card` de `App.css` e `mobile-navigation.css`.

- [ ] **Step 6: padronizar opções mobile**

Em `src/system-select.css` e `src/bottom-sheet.css`, opções acionáveis devem usar `min-height: var(--mobile-touch-target)` e a lista longa deve rolar dentro do `.bottom-sheet-body`, nunca no documento por trás.

- [ ] **Step 7: executar GREEN e regressões**

```bash
node --test src/mobileOverlayRegression.test.js src/bottomSheet.test.js src/systemSelect.test.js src/mobileStabilityRegression.test.js
npm test
npm run lint
npm run build
```

Expected: 0 falhas.

- [ ] **Step 8: commit**

```bash
git add src/mobileOverlayRegression.test.js src/components/Modal.jsx src/components/BottomSheet.jsx src/components/SystemSelect.jsx src/mobile-foundation.css src/bottom-sheet.css src/system-select.css src/bottomSheet.test.js src/systemSelect.test.js
git commit -m "fix: harden mobile overlays and selects"
```

---

### Task 3: Revisar o fluxo mobile de Novo Pedido

**Files:**
- Create: `src/pages/NewOrderMobile.test.js`
- Modify: `src/pages/NewOrder.jsx`
- Modify: `src/new-order.css`
- Modify: `src/components/OrderProductCatalog.jsx`
- Modify: `src/components/OrderCart.jsx`
- Modify: `src/components/OrderCheckoutSummary.jsx`
- Modify: `src/pages/NewOrder.test.js`

**Interfaces:**
- Consumes: `SystemSelect`, `OrderProductCatalog`, `OrderCart`, `OrderCheckoutSummary`, callbacks atuais e regras atuais de `orderCart`.
- Produces: fluxo em uma coluna nas telas estreitas, catálogo/carrinho sem overflow, controles de toque confortáveis, teclado adequado e ações finais com texto completo.

- [ ] **Step 1: escrever teste RED de composição mobile**

Criar `src/pages/NewOrderMobile.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('new order becomes a one-column touch-first flow on narrow screens', async () => {
  const css = await read('../new-order.css')
  assert.match(css, /@media\s*\(max-width:\s*640px\)/)
  assert.match(css, /grid-template-columns:\s*1fr/)
  assert.match(css, /min-width:\s*0/)
  assert.match(css, /min-height:\s*(?:44|48)px/)
})

test('new order inputs expose mobile-friendly keyboard hints', async () => {
  const page = await read('./NewOrder.jsx')
  assert.match(page, /inputMode="tel"/)
  assert.match(page, /inputMode="decimal"/)
})
```

- [ ] **Step 2: executar RED**

```bash
node --test src/pages/NewOrderMobile.test.js
```

- [ ] **Step 3: ajustar inputs sem mudar regra de negócio**

Adicionar `inputMode="tel"` em telefone e `inputMode="decimal"` em campos numéricos/monetários já existentes; preservar validação, payload, cálculo e opções de pedido.

- [ ] **Step 4: tornar layout e checkout resilientes**

Em `src/new-order.css`, em 640 px e abaixo, usar uma coluna, `min-width: 0` nos blocos internos, gap compacto e ações finais com largura total:

```css
@media (max-width: 640px) {
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
}
```

Aplicar aos seletores reais do arquivo; não criar markup mobile duplicado.

- [ ] **Step 5: revisar catálogo/carrinho/observação**

`OrderProductCatalog` e `OrderCart` devem manter nome do produto e observação com `min-width: 0` e quebra controlada. Controles isolados de quantidade/remoção/observação devem atingir pelo menos 44 px de área clicável no mobile. Observação expandida deve ocupar a largura disponível.

- [ ] **Step 6: executar testes**

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

### Task 4: Melhorar leitura e ações de Pedidos/Cozinha

**Files:**
- Create: `src/pages/OrdersMobile.test.js`
- Modify: `src/pages/Orders.jsx`
- Modify: `src/order-operations.css`
- Modify: `src/order-operations-compact.css`
- Modify: `src/components/OrderDetail.jsx`
- Modify: `src/pages/OrdersMultiItem.test.js`

**Interfaces:**
- Consumes: polling atual, `newOrderIds`, toggle de som, status/urgência e `OrderDetail`.
- Produces: cards densos e legíveis, ações que quebram de forma segura e detalhes sem overflow.

- [ ] **Step 1: escrever teste RED**

Criar `src/pages/OrdersMobile.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('order operation css contains narrow-screen action and text containment rules', async () => {
  const compact = await read('../order-operations-compact.css')
  assert.match(compact, /@media\s*\(max-width:\s*640px\)/)
  assert.match(compact, /min-width:\s*0/)
  assert.match(compact, /(flex-wrap:\s*wrap|grid-template-columns:)/)
  assert.match(compact, /overflow-wrap:\s*anywhere/)
})
```

- [ ] **Step 2: executar RED**

```bash
node --test src/pages/OrdersMobile.test.js
```

- [ ] **Step 3: compactar cabeçalho/status/tempo**

Em telas estreitas, nome/mesa/local pode quebrar; badges e tempo permanecem legíveis. Não esconder status nem tempo de urgência. Reduzir apenas espaços/paddings excessivos.

- [ ] **Step 4: tornar ações resilientes**

A linha de ações deve usar grid ou `flex-wrap` e todos os botões operacionais relevantes devem manter ao menos 44 px. Textos como ação final de entrega podem quebrar em duas linhas sem aumentar a largura do card.

- [ ] **Step 5: revisar OrderDetail compartilhado**

Itens e observações recebem `min-width: 0` e quebra; valores monetários permanecem sem quebra. Essa correção será reutilizada em A Receber.

- [ ] **Step 6: preservar estabilidade do refresh**

Não adicionar `scrollIntoView` durante polling e manter `key` estável por pedido. A marcação de `newOrderIds` continua pontual, sem remontar a lista inteira.

- [ ] **Step 7: executar testes**

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

### Task 5: Fechar A Receber e pagamentos para telas estreitas

**Files:**
- Create: `src/pages/ReceivablesMobile.test.js`
- Modify: `src/pages/Receivables.jsx`
- Modify: `src/receivables.css`
- Modify: `src/App.jsx`
- Modify: `src/App.css`
- Modify: `src/pages/ReceivablesDetails.test.js`

**Interfaces:**
- Consumes: `Modal`, `SystemSelect`, `OrderDetail`, `onRegisterPayment`, `onRegisterTableTabPayment`.
- Produces: grupos/linhas de recebíveis legíveis em 320 px e pagamentos executáveis sem depender do scroll da página por trás.

- [ ] **Step 1: escrever teste RED**

Criar `src/pages/ReceivablesMobile.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('receivables cards and payment actions fit narrow mobile viewports', async () => {
  const css = await read('../receivables.css')
  const app = await read('../App.jsx')
  assert.match(css, /@media\s*\(max-width:\s*640px\)/)
  assert.match(css, /min-width:\s*0/)
  assert.match(css, /(grid-template-columns:\s*1fr|flex-direction:\s*column)/)
  assert.match(app, /<SystemSelect[\s\S]*label="Forma de pagamento"/)
})
```

- [ ] **Step 2: executar RED**

```bash
node --test src/pages/ReceivablesMobile.test.js
```

- [ ] **Step 3: ajustar grupos, valores e ações**

Em 640 px e abaixo, identificação/status ficam no bloco principal, valor não quebra e ações podem ocupar linha própria. Nenhuma ação de cobrança deve ficar comprimida abaixo de 44 px.

- [ ] **Step 4: usar apenas os overlays compartilhados**

Pagamento individual em `App.jsx` e pagamento consolidado em `Receivables.jsx` continuam em `Modal` + `SystemSelect`. Não criar dropdown ou modal específico alternativo para mobile.

- [ ] **Step 5: preservar detalhe completo**

Continuar reutilizando `OrderDetail`; qualquer correção de item longo deve permanecer no componente compartilhado da Task 4.

- [ ] **Step 6: executar testes**

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

### Task 6: Refinar Dashboard para 320–480 px

**Files:**
- Create: `src/pages/DashboardMobile.test.js`
- Modify: `src/pages/Dashboard.jsx`
- Modify: `src/dashboard.css`
- Modify conditionally only if required by 320 px layout: `src/components/DashboardBarChart.jsx`, `src/components/DashboardLineChart.jsx`, `src/components/DashboardPaymentMix.jsx`
- Modify: `src/pages/DashboardAnalytics.test.js`

**Interfaces:**
- Consumes: tokens da fundação, FAB portalizado, seletor de período e gráficos atuais.
- Produces: métricas/gráficos sem overflow e FAB sempre acima da navegação.

- [ ] **Step 1: escrever teste RED**

Criar `src/pages/DashboardMobile.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('dashboard analytics stack and stay inside narrow cards', async () => {
  const css = await read('../dashboard.css')
  assert.match(css, /@media\s*\(max-width:\s*820px\)[\s\S]*\.dashboard-analytics-grid\s*\{[^}]*grid-template-columns:\s*1fr/s)
  assert.match(css, /\.dashboard-chart-card\s*\{[^}]*min-width:\s*0[^}]*overflow:\s*hidden/s)
  assert.match(css, /\.dashboard-new-order-fab[\s\S]*var\(--mobile-floating-gap\)/)
})
```

- [ ] **Step 2: executar RED**

```bash
node --test src/pages/DashboardMobile.test.js
```

- [ ] **Step 3: compactar métricas e seletor de período**

Em 640 px e abaixo, reduzir padding/gaps excessivos sem reduzir touch target de 44 px no seletor e no controle de privacidade.

- [ ] **Step 4: validar gráficos em 320 px**

Se labels de eixo se chocarem, alterar somente a apresentação dos rótulos, preservando todos os dados do gráfico. Quando houver mais de 7 pontos em largura estreita, o componente pode exibir labels alternadas, sem remover pontos/barras.

- [ ] **Step 5: garantir FAB por token**

A regra final continua:

```css
bottom: calc(var(--mobile-bottom-nav-height) + var(--mobile-floating-gap) + var(--mobile-safe-bottom));
```

O FAB continua portalizado em `document.body`.

- [ ] **Step 6: executar testes**

```bash
node --test src/pages/DashboardMobile.test.js src/pages/DashboardAnalytics.test.js src/mobileStabilityRegression.test.js
npm test
npm run lint
npm run build
```

- [ ] **Step 7: commit**

Adicionar somente os componentes de gráfico que realmente precisarem de alteração:

```bash
git add src/pages/DashboardMobile.test.js src/pages/Dashboard.jsx src/dashboard.css src/pages/DashboardAnalytics.test.js
git add src/components/DashboardBarChart.jsx src/components/DashboardLineChart.jsx src/components/DashboardPaymentMix.jsx 2>/dev/null || true
git commit -m "fix: refine dashboard for narrow mobile screens"
```

---

### Task 7: Revisar Clientes e Produtos como listas mobile de uso rápido

**Files:**
- Create: `src/pages/ClientsProductsMobile.test.js`
- Modify: `src/pages/Clients.jsx`
- Modify: `src/clients-phonebook.css`
- Modify: `src/pages/Products.jsx`
- Modify: `src/product-form.css`
- Modify: `src/App.jsx`
- Modify: `src/App.css`
- Modify: `src/clientsPhonebook.test.js`
- Modify: `src/productCatalogUi.test.js`

**Interfaces:**
- Consumes: `BottomSheet`, `SystemSelect`, modais globais de cliente/produto e catálogo aprovado.
- Produces: agenda compacta, filtros responsivos, lista de produtos legível e formulários sem zoom/corte.

- [ ] **Step 1: escrever teste RED**

Criar `src/pages/ClientsProductsMobile.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('client rows and product form remain touchable at 320px', async () => {
  const clients = await read('../clients-phonebook.css')
  const productForm = await read('../product-form.css')
  assert.match(clients, /min-height:\s*(?:44|48)px/)
  assert.match(clients, /@media\s*\(max-width:\s*640px\)/)
  assert.match(productForm, /@media\s*\(max-width:\s*640px\)/)
  assert.match(productForm, /grid-template-columns:\s*1fr/)
})
```

- [ ] **Step 2: executar RED**

```bash
node --test src/pages/ClientsProductsMobile.test.js
```

- [ ] **Step 3: Clientes**

A linha inteira continua acionável. Garantir altura mínima confortável, `min-width: 0` no conteúdo e quebra de endereço. O BottomSheet continua sendo o local das ações editar/excluir no mobile.

- [ ] **Step 4: Produtos**

Em 640 px e abaixo, busca/filtro ocupam largura útil. Nome, apresentação e preço permanecem legíveis. Se a coluna de ações comprimir o nome em 320 px, mover ações para linha própria em vez de reduzir o texto crítico.

- [ ] **Step 5: formulário de produto**

Categoria, apresentação, tamanho/volume/peso, preço e preview devem empilhar em uma coluna. Inputs de texto/valor no mobile permanecem com `font-size: 16px`; campos decimais usam `inputMode="decimal"` no JSX apropriado.

- [ ] **Step 6: formulário global de cliente**

Em `App.jsx`, telefone usa `type="tel" inputMode="tel"`, nome pode usar `autoComplete="name"` e endereço `autoComplete="street-address"`. Não alterar regras de duplicidade.

- [ ] **Step 7: executar testes**

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

### Task 8: Revisar Financeiro, formulários globais e menu Mais

**Files:**
- Create: `src/pages/FinanceMoreMobile.test.js`
- Modify: `src/pages/Finance.jsx`
- Modify: `src/App.jsx`
- Modify: `src/App.css`
- Modify: `src/components/MobileNavigation.jsx`
- Modify: `src/mobile-navigation.css`
- Modify: `src/bottom-sheet.css`
- Modify: `src/mobileNavigation.test.js`

**Interfaces:**
- Consumes: `MobileNavigation`, `BottomSheet`, `SystemSelect`, modal de movimento e tokens de navegação.
- Produces: histórico financeiro legível, movimento cadastrável com teclado correto e menu Mais confortável em safe area.

- [ ] **Step 1: escrever teste RED**

Criar `src/pages/FinanceMoreMobile.test.js`:

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

- [ ] **Step 2: executar RED**

```bash
node --test src/pages/FinanceMoreMobile.test.js
```

- [ ] **Step 3: ajustar linhas financeiras**

Em 320 px, descrição/categoria ficam no bloco principal e valor pode ir para linha própria. Valores monetários não quebram no meio; descrição pode usar `overflow-wrap: anywhere`.

- [ ] **Step 4: melhorar modal de movimento**

Campo de valor em `App.jsx` recebe `inputMode="decimal"`. Tipo e categoria continuam em `SystemSelect`; o grid de duas colunas empilha no mobile.

- [ ] **Step 5: menu Mais**

Manter A Receber, Financeiro, tema e logout no BottomSheet. Ações com 48 px, texto completo e safe area. Estado ativo precisa ser visível sem depender de hover.

- [ ] **Step 6: executar testes**

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

### Task 9: Padronizar estados, densidade e feedback de toque

**Files:**
- Create: `src/mobileConsistencyRegression.test.js`
- Modify: `src/App.css`
- Modify: `src/mobile-foundation.css`
- Modify only if required by actual theme discrepancy: `src/theme.css`

**Interfaces:**
- Consumes: `.button`, `.surface-card`, `.empty-state`, `.system-state-screen`, `.toast-success` e variáveis de tema.
- Produces: feedback de toque consistente, toast fora da navegação, loading/erro/vazio legíveis e reduced motion preservado.

- [ ] **Step 1: escrever teste RED**

Criar `src/mobileConsistencyRegression.test.js`:

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

test('mobile toast stays clear of bottom navigation', async () => {
  const foundation = await read('./mobile-foundation.css')
  assert.match(foundation, /\.toast-success[\s\S]*var\(--mobile-bottom-nav-height\)/)
})
```

- [ ] **Step 2: executar RED**

```bash
node --test src/mobileConsistencyRegression.test.js
```

- [ ] **Step 3: adicionar feedback de toque**

Em `App.css`:

```css
@media (hover: none) {
  .button:hover {
    transform: none;
  }

  .button:active:not(:disabled) {
    transform: scale(0.98);
  }
}
```

Aplicar o mesmo princípio a controles que hoje usam transform somente em hover, sem remover estados de foco.

- [ ] **Step 4: posicionar toast por token**

Em `mobile-foundation.css`:

```css
@media (max-width: 820px) {
  .toast-success {
    z-index: var(--layer-toast);
    bottom: calc(var(--mobile-bottom-nav-height) + 12px + var(--mobile-safe-bottom));
  }
}
```

- [ ] **Step 5: validar claro/escuro, loading, erro e vazio**

Usar os componentes/estilos existentes. Só alterar `theme.css` se contraste ou legibilidade realmente falhar na auditoria. Não criar temas mobile separados.

- [ ] **Step 6: preservar reduced motion**

O bloco existente de `prefers-reduced-motion` deve continuar cobrindo transições/animações. Qualquer animação adicionada na rodada deve estar coberta por ele.

- [ ] **Step 7: executar testes**

```bash
node --test src/mobileConsistencyRegression.test.js src/mobilePageMotion.test.js src/mobileStabilityRegression.test.js
npm test
npm run lint
npm run build
```

- [ ] **Step 8: commit**

```bash
git add src/mobileConsistencyRegression.test.js src/App.css src/mobile-foundation.css
git add src/theme.css 2>/dev/null || true
git commit -m "fix: unify mobile interaction and state feedback"
```

---

### Task 10: Executar QA manual em 320, 360, 390/393 e 480 px

**Files:**
- Create: `docs/superpowers/qa/2026-09-02-mobile-ux-audit-checklist.md`
- Modify: arquivos de tela/CSS/testes somente para bugs concretos encontrados nesta matriz.

**Interfaces:**
- Consumes: resultado das Tasks 1–9.
- Produces: evidência de revisão e lista zerada de P0/P1.

- [ ] **Step 1: criar matriz de QA**

Criar:

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

Para cada tela registrar também: primeiro carregamento, scroll longo, texto longo, lista vazia, lista longa, loading, erro, overlay, ação principal e safe area.

- [ ] **Step 2: revisar 320 px**

Executar todos os fluxos da matriz e registrar cada achado como P0, P1 ou P2 com reprodução objetiva.

- [ ] **Step 3: revisar 360 px com teclado**

Abrir teclado em campos do topo, meio e fim de Novo Pedido, Cliente, Produto, Pagamento e Movimento. Confirmar que a ação necessária continua alcançável por scroll natural/interno.

- [ ] **Step 4: revisar 390/393 px com safe area**

Validar menu inferior, FAB, modais, BottomSheets e toast em viewport representativa de iPhone moderno.

- [ ] **Step 5: revisar 480 px**

Confirmar que breakpoints não deixam controles desnecessariamente empilhados ou espaços exagerados.

- [ ] **Step 6: corrigir P0/P1 um por vez com TDD**

Para cada bug: adicionar expectativa ao teste de regressão da área, executar RED, aplicar correção mínima, executar GREEN e commit independente. Exemplo:

```bash
git commit -m "fix: keep product actions visible at 320px"
```

Somente depois de todos os P0/P1 fechados realizar refinamentos P2.

- [ ] **Step 7: fechar checklist**

Trocar `☐` por `✅` apenas após teste efetivo. Resultado de cada tela deve terminar como `Sem P0/P1 aberto`.

- [ ] **Step 8: commit da evidência**

```bash
git add docs/superpowers/qa/2026-09-02-mobile-ux-audit-checklist.md
git commit -m "docs: record mobile UX audit results"
```

---

### Task 11: Verificação final e prontidão para produção

**Files:**
- Read: `docs/superpowers/specs/2026-09-02-mobile-ux-audit-design.md`
- Read: `docs/superpowers/qa/2026-09-02-mobile-ux-audit-checklist.md`
- No code file is modified unless verification reveals a regression.

**Interfaces:**
- Consumes: todos os commits anteriores.
- Produces: rodada validada, sem falhas conhecidas, pronta para aprovação antes de deploy.

- [ ] **Step 1: suíte completa**

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

Expected: build Vite concluído.

- [ ] **Step 4: Worker dry-run**

```bash
npx --yes wrangler@4.128.0 deploy --dry-run
```

Expected: bundle válido e binding D1 reconhecido.

- [ ] **Step 5: cobertura da spec**

Confirmar no checklist: 320–480 px, ausência de scroll horizontal, menu/FAB/safe area, teclado, Modal, BottomSheet, SystemSelect, Novo Pedido, Pedidos, A Receber, Dashboard, Clientes, Produtos, Financeiro, Mais, temas claro/escuro, loading/erro/vazio e reduced motion.

- [ ] **Step 6: verificar escopo do diff**

```bash
git status --short
git diff --stat <commit-base-da-rodada>...HEAD
```

Antes de executar este comando, substituir `<commit-base-da-rodada>` pelo SHA real do `master` registrado imediatamente antes da Task 1. O resultado não deve conter migration, schema D1 ou regra de negócio sem justificativa direta de UX.

- [ ] **Step 7: corrigir qualquer falha antes de declarar conclusão**

Falha em teste, lint, build, Worker ou P0/P1 reabre a tarefa responsável e exige novo ciclo RED/GREEN.

- [ ] **Step 8: deploy somente após aprovação**

Não alterar o workflow de produção como parte desta rodada. O deploy continua pelo processo manual existente e só deve ser disparado depois que o usuário aprovar o resultado validado.

---

## Spec Coverage Matrix

| Requisito da spec | Tarefa |
| --- | --- |
| 320–480 px e referências 320/360/390–393/480 | Tasks 1, 10 |
| Tokens compartilhados e redução de números duplicados | Task 1 |
| Sem scroll horizontal / viewport estável | Task 1 |
| Menu inferior e safe area | Tasks 1, 8, 10 |
| FAB acima do menu | Tasks 1, 6 |
| Touch targets 44–48 px | Tasks 1, 2, 3, 4, 5, 7, 8 |
| Formulários e teclado | Tasks 2, 3, 5, 7, 8, 10 |
| Modal, BottomSheet, SystemSelect | Task 2 |
| Swipe e reduced motion | Tasks 1, 9 |
| Novo Pedido | Task 3 |
| Pedidos/Cozinha | Task 4 |
| A Receber | Task 5 |
| Dashboard | Task 6 |
| Clientes | Task 7 |
| Produtos | Task 7 |
| Financeiro | Task 8 |
| Mais/navegação secundária | Task 8 |
| Loading, erro, vazio, tema e feedback de toque | Task 9 |
| Priorização P0/P1/P2 e validação manual | Task 10 |
| Testes, lint, build e Worker | Tasks 1–11, com verificação final na Task 11 |
| Sem mudanças de banco/regras fora do escopo | Task 11 |
