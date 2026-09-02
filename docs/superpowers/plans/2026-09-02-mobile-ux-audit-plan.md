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
- Cada tarefa deve terminar com testes, lint/build relevantes e commit independente antes da revisão.

---

## File Structure

### Fundação compartilhada

- **Create:** `src/mobile-foundation.css` — único dono de tokens e regras estruturais mobile compartilhadas: viewport, safe area, conteúdo, touch targets genéricos, overlays e scroll padding.
- **Modify:** `src/App.jsx` — importar a fundação compartilhada e manter formulários globais semanticamente adequados ao mobile.
- **Modify:** `src/index.css` — manter apenas tokens globais de tema/base e remover regra mobile duplicada de overflow depois da migração.
- **Modify:** `src/App.css` — remover regras estruturais mobile duplicadas de modal/form/viewport e manter estilos de componentes/layout gerais.
- **Modify:** `src/mobile-navigation.css` — manter apenas regras específicas da navegação e animação mobile; consumir tokens da fundação.
- **Modify:** `src/dashboard.css` — consumir tokens compartilhados para o FAB.
- **Test:** `src/mobileFoundation.test.js` — regressões de tokens, overflow, safe area, touch targets e ausência de duplicação estrutural.
- **Modify/Test:** `src/mobileStabilityRegression.test.js`, `src/mobilePageMotion.test.js` — alinhar testes existentes ao novo dono das regras.

### Overlays e selects

- **Modify:** `src/components/Modal.jsx` — foco inicial/restauração, Escape, bloqueio de scroll de fundo e semântica consistente.
- **Modify:** `src/components/BottomSheet.jsx` — reutilizar comportamento compartilhado de overlay e manter focus trap.
- **Modify:** `src/components/SystemSelect.jsx` — preservar BottomSheet no mobile e foco do trigger após fechamento.
- **Modify:** `src/bottom-sheet.css`, `src/system-select.css` — altura por `dvh`, scroll interno, overscroll containment e touch targets.
- **Create:** `src/mobileOverlayRegression.test.js` — regressões de portal, foco, body scroll lock, altura dinâmica e scroll interno.

### Fluxos e páginas

- **Modify:** `src/pages/NewOrder.jsx`, `src/new-order.css`, `src/components/OrderCart.jsx`, `src/components/OrderCheckoutSummary.jsx`, `src/components/OrderProductCatalog.jsx`.
- **Create:** `src/pages/NewOrderMobile.test.js`.
- **Modify:** `src/pages/Orders.jsx`, `src/order-operations.css`, `src/order-operations-compact.css`, `src/components/OrderDetail.jsx`.
- **Create:** `src/pages/OrdersMobile.test.js`.
- **Modify:** `src/pages/Receivables.jsx`, `src/receivables.css`.
- **Create:** `src/pages/ReceivablesMobile.test.js`.
- **Modify:** `src/pages/Dashboard.jsx`, `src/dashboard.css`, componentes de gráficos somente se a auditoria mostrar necessidade de composição.
- **Create:** `src/pages/DashboardMobile.test.js`.
- **Modify:** `src/pages/Clients.jsx`, `src/clients-phonebook.css`, `src/pages/Products.jsx`, `src/product-form.css`.
- **Create:** `src/pages/ClientsProductsMobile.test.js`.
- **Modify:** `src/pages/Finance.jsx`, `src/components/MobileNavigation.jsx`, `src/mobile-navigation.css`, formulários globais em `src/App.jsx`/`src/App.css`.
- **Create:** `src/pages/FinanceMoreMobile.test.js`.

### Validação final

- **Create:** `docs/superpowers/qa/2026-09-02-mobile-ux-audit-checklist.md` — matriz manual por viewport, tela, teclado, tema e estados.
- **Modify:** testes de regressão existentes somente quando a nova arquitetura mover a responsabilidade sem reduzir cobertura.

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
- Consumes: classes atuais `.app-shell`, `.app-main`, `.app-content`, `.mobile-bottom-nav`, `.modal-backdrop`, `.modal-card`, `.dashboard-new-order-fab`.
- Produces: CSS custom properties `--mobile-bottom-nav-height`, `--mobile-safe-bottom`, `--mobile-content-bottom-space`, `--mobile-floating-gap`, `--mobile-page-inline`, `--mobile-touch-target`, `--mobile-overlay-inset`, `--mobile-overlay-max-height`, `--layer-mobile-nav`, `--layer-overlay`, `--layer-toast`.

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

test('shared structural rules are not duplicated in navigation or dashboard css', async () => {
  const mobileNav = await read('./mobile-navigation.css')
  const dashboard = await read('./dashboard.css')
  assert.doesNotMatch(mobileNav, /--mobile-bottom-nav-height:\s*65px/)
  assert.match(dashboard, /var\(--mobile-bottom-nav-height\)/)
  assert.match(dashboard, /var\(--mobile-floating-gap\)/)
})
```

- [ ] **Step 2: executar o teste e confirmar RED**

Run:

```bash
node --test src/mobileFoundation.test.js
```

Expected: FAIL porque `src/mobile-foundation.css` ainda não existe.

- [ ] **Step 3: criar a fundação mínima e importar no app**

Criar `src/mobile-foundation.css` com a propriedade estrutural centralizada:

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

Importar `./mobile-foundation.css` em `src/App.jsx` junto dos CSS globais do app. Remover de `src/index.css` e `src/mobile-navigation.css` as regras estruturais que passam a ter dono único na fundação.

- [ ] **Step 4: migrar consumidores para tokens e eliminar conflitos de cascata**

Em `src/mobile-navigation.css` usar:

```css
.mobile-bottom-nav {
  z-index: var(--layer-mobile-nav);
}
```

Em `src/dashboard.css` usar:

```css
@media (max-width: 820px) {
  .dashboard-new-order-fab {
    bottom: calc(var(--mobile-bottom-nav-height) + var(--mobile-floating-gap) + var(--mobile-safe-bottom));
  }
}
```

Remover de `src/App.css` e `src/mobile-navigation.css` as versões mobile conflitantes de `.modal-backdrop`, `.modal-card`, `.app-main` e `.app-content` que tenham responsabilidade estrutural compartilhada; o estilo visual não estrutural permanece no arquivo original.

- [ ] **Step 5: atualizar regressões existentes sem reduzir cobertura**

Atualizar `src/mobileStabilityRegression.test.js` e `src/mobilePageMotion.test.js` para ler `mobile-foundation.css` quando verificarem tokens, viewport ou modal compartilhado; manter `mobile-navigation.css` para swipe/animação e `dashboard.css` para o FAB.

- [ ] **Step 6: executar testes da fundação e regressões mobile**

Run:

```bash
node --test src/mobileFoundation.test.js src/mobileStabilityRegression.test.js src/mobilePageMotion.test.js
```

Expected: PASS.

- [ ] **Step 7: executar suíte completa, lint e build**

```bash
npm test
npm run lint
npm run build
```

Expected: todos verdes.

- [ ] **Step 8: commit**

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
- Consumes: `Modal({ title, onClose, children, footer })`, `BottomSheet({ open, title, onClose, children })`, `SystemSelect({ value, options, onChange, disabled, label, id, placeholder })`.
- Produces: overlays portalizados com Escape, foco inicial/restaurado, fundo sem scroll enquanto abertos e conteúdo rolável dentro de `dvh`.

- [ ] **Step 1: escrever regressões RED de overlay**

Criar `src/mobileOverlayRegression.test.js` verificando explicitamente:

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

Expected: FAIL nas novas expectativas de scroll lock/foco/modal foundation.

- [ ] **Step 3: implementar lifecycle de Modal**

Em `src/components/Modal.jsx`, usar `useEffect` e `useRef` para registrar foco anterior, focar o botão de fechar, ouvir Escape, travar `document.body.style.overflow = 'hidden'` e restaurar os valores no cleanup. Não alterar a API pública do componente.

Estrutura esperada:

```jsx
const cardRef = useRef(null)
const previousFocus = useRef(null)

useEffect(() => {
  previousFocus.current = document.activeElement
  const previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  cardRef.current?.querySelector('button, input, textarea, [tabindex]:not([tabindex="-1"])')?.focus()

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') onClose()
  }
  document.addEventListener('keydown', handleKeyDown)
  return () => {
    document.removeEventListener('keydown', handleKeyDown)
    document.body.style.overflow = previousOverflow
    previousFocus.current?.focus?.()
  }
}, [onClose])
```

Adicionar `ref={cardRef}` em `.modal-card`.

- [ ] **Step 4: alinhar BottomSheet ao mesmo contrato sem quebrar focus trap**

Manter o trap existente e adicionar preservação/restauração do `document.body.style.overflow` dentro do mesmo `useEffect`, evitando um segundo efeito concorrente.

- [ ] **Step 5: centralizar sizing mobile de modal**

Adicionar em `src/mobile-foundation.css`:

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

Remover a versão conflitante mobile de modal de `App.css`.

- [ ] **Step 6: garantir options confortáveis no SystemSelect mobile**

Em `src/system-select.css` e `src/bottom-sheet.css`, garantir `min-height: var(--mobile-touch-target)` nas opções e `overflow-y: auto` no corpo. Não alterar o comportamento desktop do dropdown.

- [ ] **Step 7: executar testes focados e suíte completa**

```bash
node --test src/mobileOverlayRegression.test.js src/bottomSheet.test.js src/systemSelect.test.js src/mobileStabilityRegression.test.js
npm test
npm run lint
npm run build
```

Expected: PASS.

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
- Consumes: `SystemSelect`, `OrderProductCatalog`, `OrderCart`, `OrderCheckoutSummary`, `buildOrderPayload` e callbacks atuais de `NewOrder`.
- Produces: fluxo de pedido em uma coluna no mobile, catálogo/carrinho sem overflow, ações finais de largura útil e campos compatíveis com teclado.

- [ ] **Step 1: escrever teste RED de composição mobile do pedido**

Criar `src/pages/NewOrderMobile.test.js` verificando que `new-order.css` possui regras entre 320–480 px para uma coluna, quebra de toolbar, touch targets e ações finais:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('new order becomes one-column touch-first flow on narrow screens', async () => {
  const css = await read('../new-order.css')
  assert.match(css, /@media\s*\(max-width:\s*640px\)/)
  assert.match(css, /\.new-order-layout\s*\{[^}]*grid-template-columns:\s*1fr/s)
  assert.match(css, /\.order-product-card[\s\S]*min-width:\s*0/)
  assert.match(css, /\.order-checkout-actions[\s\S]*\.button[\s\S]*width:\s*100%/)
})
```

Adequar os nomes de classes ao markup real existente; não criar uma segunda estrutura paralela só para satisfazer o teste.

- [ ] **Step 2: confirmar RED**

```bash
node --test src/pages/NewOrderMobile.test.js
```

Expected: pelo menos uma expectativa mobile falha.

- [ ] **Step 3: ajustar campos sem mudar regras de negócio**

No JSX de `NewOrder`, aplicar `inputMode`/tipos adequados aos campos já existentes:

```jsx
<input type="tel" inputMode="tel" ... />
<input type="text" autoComplete="name" ... />
<input type="number" inputMode="decimal" ... />
```

Não mudar validação de identidade, cálculo, taxa ou pagamento.

- [ ] **Step 4: compactar layout e catálogo em 320–480 px**

Em `src/new-order.css`, garantir:

```css
@media (max-width: 640px) {
  .new-order-layout {
    grid-template-columns: 1fr;
    gap: 14px;
  }

  .order-product-card,
  .order-cart-item,
  .order-checkout-summary {
    min-width: 0;
  }

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

Preservar labels completos de delivery/local e permitir `overflow-wrap: anywhere` apenas em textos longos, não em valores monetários.

- [ ] **Step 5: revisar carrinho e observações por item**

No `OrderCart` e CSS associado, manter quantidade e ação principal alinhadas, mas fazer observação expandida ocupar largura completa no mobile. Botões `+`, `−`, remover e observação devem manter área de toque de pelo menos 44 px quando forem ações isoladas.

- [ ] **Step 6: executar testes do fluxo de pedido**

```bash
node --test src/pages/NewOrderMobile.test.js src/pages/NewOrder.test.js src/newOrderUxRegression.test.js
npm test
npm run lint
npm run build
```

Se `src/newOrderUxRegression.test.js` não existir no repositório, executar apenas os dois arquivos existentes e a suíte completa; não criar um arquivo redundante.

Expected: PASS.

- [ ] **Step 7: commit**

```bash
git add src/pages/NewOrderMobile.test.js src/pages/NewOrder.jsx src/new-order.css src/components/OrderProductCatalog.jsx src/components/OrderCart.jsx src/components/OrderCheckoutSummary.jsx src/pages/NewOrder.test.js
git commit -m "fix: optimize new order flow for mobile"
```

---

### Task 4: Melhorar leitura e ações de Pedidos/Cozinha no mobile

**Files:**
- Create: `src/pages/OrdersMobile.test.js`
- Modify: `src/pages/Orders.jsx`
- Modify: `src/order-operations.css`
- Modify: `src/order-operations-compact.css`
- Modify: `src/components/OrderDetail.jsx`
- Modify: `src/pages/OrdersMultiItem.test.js`

**Interfaces:**
- Consumes: atualização automática atual, `newOrderIds`, toggle de som, funções de status/urgência e `OrderDetail`.
- Produces: cards densos, ações alinhadas e detalhes expansíveis sem overflow ou reflow desnecessário.

- [ ] **Step 1: escrever teste RED de card operacional mobile**

Criar `src/pages/OrdersMobile.test.js` com verificações de `min-width: 0`, quebra de ação e textos longos:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('active order cards keep actions usable and text contained at 320px', async () => {
  const compact = await read('../order-operations-compact.css')
  assert.match(compact, /@media\s*\(max-width:\s*640px\)/)
  assert.match(compact, /\.active-order-card[\s\S]*min-width:\s*0/)
  assert.match(compact, /\.active-order-actions[\s\S]*(grid-template-columns|flex-wrap)/)
  assert.match(compact, /overflow-wrap:\s*anywhere/)
})
```

Usar os seletores reais do arquivo ao implementar.

- [ ] **Step 2: confirmar RED**

```bash
node --test src/pages/OrdersMobile.test.js
```

- [ ] **Step 3: compactar cabeçalho/status/tempo sem esconder informação**

No CSS operacional, garantir que nome/mesa, status e tempo possam quebrar em duas linhas quando necessário, mantendo valores de tempo e badges legíveis. Não reduzir fonte de informação crítica abaixo do tamanho atual sem necessidade.

- [ ] **Step 4: tornar linha de ações resiliente**

Em telas estreitas, usar grid/flex wrap para as ações existentes, com `min-height: 44px`. A ação final (`Finalizar`, `Saiu para entrega`, equivalente atual) deve ter espaço para texto completo e não usar `white-space: nowrap` quando isso provocar overflow.

- [ ] **Step 5: revisar expansão de detalhes**

No `OrderDetail`, listas de itens e observações devem ter `min-width: 0`, valores à direita com `white-space: nowrap`, e nomes/observações com `overflow-wrap: anywhere`.

- [ ] **Step 6: garantir que refresh não mova scroll por efeito visual**

Não inserir `scrollIntoView` nem remontar a lista inteira no polling. Preservar o mecanismo atual de `newOrderIds` e animação pontual; qualquer alteração de markup deve manter keys estáveis por pedido.

- [ ] **Step 7: testes e commit**

```bash
node --test src/pages/OrdersMobile.test.js src/pages/OrdersMultiItem.test.js src/ordersElapsedRefresh.test.js src/ordersRealtime.test.js
npm test
npm run lint
npm run build
git add src/pages/OrdersMobile.test.js src/pages/Orders.jsx src/order-operations.css src/order-operations-compact.css src/components/OrderDetail.jsx src/pages/OrdersMultiItem.test.js
git commit -m "fix: improve mobile kitchen order ergonomics"
```

Se um dos arquivos de teste focado listado tiver nome diferente, localizar o teste existente equivalente antes da execução; não criar duplicata apenas pelo nome.

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
- Produces: grupos/linhas de recebíveis legíveis em 320 px e todos os pagamentos executáveis sem scroll do documento por trás.

- [ ] **Step 1: escrever regressão RED**

Criar teste que exija composição móvel dos grupos e forma de pagamento via `SystemSelect`, além de ações de largura total no modal:

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

- [ ] **Step 2: confirmar RED**

```bash
node --test src/pages/ReceivablesMobile.test.js
```

- [ ] **Step 3: ajustar cartões/grupos e valores**

Em `receivables.css`, em 640 px e abaixo, permitir que identificação e status ocupem a primeira linha, valor permaneça sem quebra, e ações desçam para uma linha própria. Nenhuma ação deve ficar comprimida abaixo de 44 px.

- [ ] **Step 4: manter modais de pagamento dentro da viewport**

Aproveitar a fundação da Task 2. No formulário de pagamento em `App.jsx` e no pagamento consolidado em `Receivables.jsx`, manter `.form-actions` em coluna no mobile e usar `SystemSelect` para método de pagamento. Não criar dropdown custom adicional.

- [ ] **Step 5: preservar detalhe completo sem duplicar lógica**

Continuar reutilizando `OrderDetail`; qualquer ajuste para itens longos deve ser feito no componente compartilhado da Task 4.

- [ ] **Step 6: testes e commit**

```bash
node --test src/pages/ReceivablesMobile.test.js src/pages/ReceivablesDetails.test.js src/tableTabUi.test.js
npm test
npm run lint
npm run build
git add src/pages/ReceivablesMobile.test.js src/pages/Receivables.jsx src/receivables.css src/App.jsx src/App.css src/pages/ReceivablesDetails.test.js
git commit -m "fix: stabilize receivables payments on mobile"
```

---

### Task 6: Refinar Dashboard para 320–480 px

**Files:**
- Create: `src/pages/DashboardMobile.test.js`
- Modify: `src/pages/Dashboard.jsx`
- Modify: `src/dashboard.css`
- Modify: `src/components/DashboardBarChart.jsx`
- Modify: `src/components/DashboardLineChart.jsx`
- Modify: `src/components/DashboardPaymentMix.jsx`
- Modify: `src/pages/DashboardAnalytics.test.js`

**Interfaces:**
- Consumes: tokens da fundação, FAB portalizado, seletor de período e gráficos SVG/CSS atuais.
- Produces: dashboard sem overflow, métricas compactas e FAB sempre acima do menu.

- [ ] **Step 1: escrever teste RED de dashboard estreito**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('dashboard analytics stack and labels stay inside narrow cards', async () => {
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

Em 640 px e abaixo, reduzir apenas padding/gaps excessivos; manter touch target de 44 px no seletor e controle de privacidade. Não esconder período, labels ou valores.

- [ ] **Step 4: revisar SVGs para labels sem overflow**

Se labels de eixo excederem a largura em 320 px, reduzir número de labels exibidas por cálculo do componente, preservando todos os pontos/barras. Exemplo de regra: mostrar rótulo em índices alternados quando a série tiver mais de 7 pontos e largura for estreita; não remover dados do gráfico.

- [ ] **Step 5: verificar FAB com os tokens compartilhados**

Manter portal em `document.body` e posição:

```css
bottom: calc(var(--mobile-bottom-nav-height) + var(--mobile-floating-gap) + var(--mobile-safe-bottom));
```

- [ ] **Step 6: testes e commit**

```bash
node --test src/pages/DashboardMobile.test.js src/pages/DashboardAnalytics.test.js src/mobileStabilityRegression.test.js
npm test
npm run lint
npm run build
git add src/pages/DashboardMobile.test.js src/pages/Dashboard.jsx src/dashboard.css src/components/DashboardBarChart.jsx src/components/DashboardLineChart.jsx src/components/DashboardPaymentMix.jsx src/pages/DashboardAnalytics.test.js
git commit -m "fix: refine dashboard for narrow mobile screens"
```

Se os gráficos não precisarem de mudança JSX após a verificação em 320 px, não editar os três componentes de gráfico; limitar o commit ao CSS/testes necessários.

---

### Task 7: Revisar Clientes e Produtos como listas mobile de uso rápido

**Files:**
- Create: `src/pages/ClientsProductsMobile.test.js`
- Modify: `src/pages/Clients.jsx`
- Modify: `src/clients-phonebook.css`
- Modify: `src/pages/Products.jsx`
- Modify: `src/product-form.css`
- Modify: `src/App.css`
- Modify: `src/clientsPhonebook.test.js`
- Modify: `src/productCatalogUi.test.js`

**Interfaces:**
- Consumes: `BottomSheet`, `SystemSelect`, modais globais de cliente/produto e catálogo de categorias aprovado.
- Produces: listas compactas com linhas tocáveis, filtros empilháveis e formulários sem zoom/corte.

- [ ] **Step 1: escrever teste RED conjunto**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('client rows and product controls remain touchable at 320px', async () => {
  const clients = await read('../clients-phonebook.css')
  const productForm = await read('../product-form.css')
  assert.match(clients, /min-height:\s*44px/)
  assert.match(clients, /@media\s*\(max-width:\s*640px\)/)
  assert.match(productForm, /@media\s*\(max-width:\s*640px\)/)
  assert.match(productForm, /grid-template-columns:\s*1fr/)
})
```

- [ ] **Step 2: confirmar RED**

```bash
node --test src/pages/ClientsProductsMobile.test.js
```

- [ ] **Step 3: Clientes — manter agenda compacta sem ações minúsculas**

A linha inteira continua acionável. Garantir altura mínima confortável e `min-width: 0` no conteúdo; telefone deve permanecer em uma linha quando couber, endereço pode quebrar. O BottomSheet continua sendo o único lugar para editar/excluir no mobile.

- [ ] **Step 4: Produtos — empilhar filtro e busca quando necessário**

Em 640 px e abaixo, busca/filtro devem ocupar a largura disponível; cards/lista devem manter nome, apresentação e preço legíveis. Ações editar/excluir não devem criar coluna estreita que force nome a poucos caracteres; se necessário, mover ações para segunda linha no mobile.

- [ ] **Step 5: formulário de produto — uma coluna real em 320 px**

Em `product-form.css`, categoria, apresentação, tamanho/volume/peso, preço e preview devem empilhar. Inputs monetários devem permanecer com `font-size: 16px` no mobile e `inputMode="decimal"` quando aplicável no JSX já existente.

- [ ] **Step 6: formulário global de cliente — teclado adequado**

Em `App.jsx`, manter telefone como `type="tel" inputMode="tel"`, nome com `autoComplete="name"` e endereço com `autoComplete="street-address"` quando semanticamente adequado. Não alterar regras de duplicidade.

- [ ] **Step 7: testes e commit**

```bash
node --test src/pages/ClientsProductsMobile.test.js src/clientsPhonebook.test.js src/productCatalogUi.test.js src/productForm.test.js
npm test
npm run lint
npm run build
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

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('finance rows and more menu remain usable on narrow screens', async () => {
  const appCss = await read('../App.css')
  const navCss = await read('../mobile-navigation.css')
  assert.match(appCss, /@media\s*\(max-width:\s*640px\)[\s\S]*\.movement-row/)
  assert.match(navCss, /\.mobile-more-action[\s\S]*min-height:\s*(?:44|48)px/)
  assert.match(navCss, /\.mobile-more-logout[\s\S]*min-height:\s*(?:44|48)px/)
})
```

- [ ] **Step 2: confirmar RED**

```bash
node --test src/pages/FinanceMoreMobile.test.js
```

- [ ] **Step 3: ajustar linhas financeiras**

Em 320 px, descrição/categoria ficam no bloco principal e valor passa para linha própria quando necessário. Valores monetários não quebram no meio; descrição pode usar `overflow-wrap: anywhere`.

- [ ] **Step 4: melhorar modal de movimento sem alterar API**

No `App.jsx`, campo monetário deve usar teclado decimal:

```jsx
<input type="number" inputMode="decimal" min="0" step="0.01" ... />
```

Tipo e categoria continuam em `SystemSelect`; em mobile, o grid de duas colunas deve empilhar pela fundação/App.css.

- [ ] **Step 5: menu Mais**

Manter A Receber, Financeiro, tema e logout no BottomSheet. As ações devem ter 48 px, texto completo, safe area e nenhum hover necessário para comunicar estado ativo. Não adicionar mais destinos nesta rodada.

- [ ] **Step 6: testes e commit**

```bash
node --test src/pages/FinanceMoreMobile.test.js src/mobileNavigation.test.js src/bottomSheet.test.js
npm test
npm run lint
npm run build
git add src/pages/FinanceMoreMobile.test.js src/pages/Finance.jsx src/App.jsx src/App.css src/components/MobileNavigation.jsx src/mobile-navigation.css src/bottom-sheet.css src/mobileNavigation.test.js
git commit -m "fix: polish finance and more menu on mobile"
```

---

### Task 9: Padronizar estados, densidade e feedback de toque

**Files:**
- Create: `src/mobileConsistencyRegression.test.js`
- Modify: `src/App.css`
- Modify: `src/mobile-foundation.css`
- Modify: `src/theme.css`
- Modify: CSS de página somente quando um estado específico ainda divergir.

**Interfaces:**
- Consumes: `.button`, `.surface-card`, `.empty-state`, `.system-state-screen`, `.toast-success`, variáveis de tema.
- Produces: comportamento consistente de loading, erro, vazio, toque e reduced motion em todas as telas.

- [ ] **Step 1: escrever teste RED de consistência**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('mobile interaction states do not depend on hover and respect reduced motion', async () => {
  const app = await read('./App.css')
  const foundation = await read('./mobile-foundation.css')
  assert.match(app, /@media\s*\(hover:\s*none\)/)
  assert.match(foundation, /prefers-reduced-motion:\s*reduce/)
})

test('mobile toast stays clear of fixed navigation', async () => {
  const foundation = await read('./mobile-foundation.css')
  assert.match(foundation, /\.toast-success[\s\S]*var\(--mobile-bottom-nav-height\)/)
})
```

- [ ] **Step 2: confirmar RED**

```bash
node --test src/mobileConsistencyRegression.test.js
```

- [ ] **Step 3: adicionar feedback de toque sem transformar hover em requisito**

Adicionar regras `@media (hover: none)` para remover transform de hover persistente e usar `:active` de forma discreta:

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

Aplicar o mesmo princípio a FAB e controles que atualmente usam apenas hover.

- [ ] **Step 4: manter toast acima da navegação mobile**

Mover regra estrutural mobile do toast para a fundação:

```css
@media (max-width: 820px) {
  .toast-success {
    z-index: var(--layer-toast);
    bottom: calc(var(--mobile-bottom-nav-height) + 12px + var(--mobile-safe-bottom));
  }
}
```

- [ ] **Step 5: reduced motion**

Manter o bloco global existente e garantir que a fundação não introduza animação que o contorne. Se houver animação específica nova, incluir seletor dentro do bloco de `prefers-reduced-motion`.

- [ ] **Step 6: testes e commit**

```bash
node --test src/mobileConsistencyRegression.test.js src/mobilePageMotion.test.js src/mobileStabilityRegression.test.js
npm test
npm run lint
npm run build
git add src/mobileConsistencyRegression.test.js src/App.css src/mobile-foundation.css src/theme.css
git commit -m "fix: unify mobile interaction and state feedback"
```

Não editar `theme.css` se a verificação claro/escuro não revelar divergência; o arquivo só entra no commit quando necessário.

---

### Task 10: Criar matriz de QA mobile e executar auditoria manual completa

**Files:**
- Create: `docs/superpowers/qa/2026-09-02-mobile-ux-audit-checklist.md`
- Modify: arquivos de tela/CSS/teste apenas para bugs concretos encontrados na matriz, cada correção com regressão específica.

**Interfaces:**
- Consumes: aplicação final das Tasks 1–9.
- Produces: evidência reproduzível de revisão em 320, 360, 390/393 e 480 px e lista fechada de P0/P1/P2.

- [ ] **Step 1: criar checklist manual com matriz explícita**

Criar documento com esta tabela-base para cada largura:

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

Abaixo da tabela, incluir para cada tela: primeiro carregamento, scroll longo, textos longos, lista vazia, lista longa, loading, erro, overlay, ação primária e safe area.

- [ ] **Step 2: executar auditoria em 320 px**

Verificar todas as telas e registrar cada achado como `P0`, `P1` ou `P2`, com reprodução objetiva. Não corrigir vários achados não relacionados no mesmo commit.

- [ ] **Step 3: executar auditoria em 360 px**

Repetir a matriz, incluindo abertura do teclado nos campos de topo/meio/final de Novo Pedido, Cliente, Produto, Pagamento e Movimento.

- [ ] **Step 4: executar auditoria em 390/393 px**

Repetir a matriz em viewport representativa de iPhone moderno e validar safe area inferior.

- [ ] **Step 5: executar auditoria em 480 px**

Confirmar que os breakpoints não deixam a interface excessivamente estreita nem com controles indevidamente empilhados.

- [ ] **Step 6: corrigir cada P0/P1 encontrado com TDD**

Para cada bug: escrever ou ampliar um teste que falhe, executar RED, aplicar correção mínima, executar GREEN e commit. O formato de commit deve indicar a área, por exemplo:

```bash
git commit -m "fix: keep product actions visible at 320px"
```

P2 só entra depois de todos os P0/P1 da matriz estarem fechados.

- [ ] **Step 7: fechar checklist**

Trocar cada `☐` por `✅` após teste efetivo e registrar `Sem P0/P1 aberto` na coluna Resultado quando aplicável. Não marcar como concluído por inspeção de código apenas.

- [ ] **Step 8: commit da evidência de QA**

```bash
git add docs/superpowers/qa/2026-09-02-mobile-ux-audit-checklist.md
git commit -m "docs: record mobile UX audit results"
```

---

### Task 11: Verificação final e prontidão para produção

**Files:**
- No code file required unless verification uncovers a regression.
- Read: `docs/superpowers/specs/2026-09-02-mobile-ux-audit-design.md`
- Read: `docs/superpowers/qa/2026-09-02-mobile-ux-audit-checklist.md`

**Interfaces:**
- Consumes: todos os commits anteriores.
- Produces: branch/master com suíte verde e evidência de que os critérios de aceite da spec foram cobertos.

- [ ] **Step 1: executar suíte completa**

```bash
npm test
```

Expected: 0 falhas.

- [ ] **Step 2: executar lint**

```bash
npm run lint
```

Expected: 0 erros e 0 warnings tratados como erro pelo projeto.

- [ ] **Step 3: executar build**

```bash
npm run build
```

Expected: build Vite concluído com sucesso.

- [ ] **Step 4: validar bundle do Worker**

```bash
npx --yes wrangler@4.128.0 deploy --dry-run
```

Expected: dry-run concluído e binding D1 reconhecido.

- [ ] **Step 5: revisar cobertura da spec contra o checklist**

Confirmar explicitamente: 320–480 px, sem scroll horizontal, menu/FAB/safe area, teclado, Modal, BottomSheet, SystemSelect, Novo Pedido, Pedidos, A Receber, Dashboard, Clientes, Produtos, Financeiro, Mais, claro/escuro, loading/erro/vazio e reduced motion.

- [ ] **Step 6: verificar diff de escopo**

```bash
git status --short
git diff --stat <commit-base-da-rodada>...HEAD
```

Expected: nenhum arquivo de banco, migration ou regra de negócio alterado sem justificativa direta de UX.

- [ ] **Step 7: corrigir qualquer falha antes de declarar conclusão**

Se uma verificação falhar, voltar ao ciclo RED/GREEN da tarefa responsável; não publicar nem declarar a rodada concluída com falha conhecida.

- [ ] **Step 8: preparar deploy somente após aprovação do resultado**

Não alterar o workflow de produção como parte do plano de UX. O deploy segue o processo manual existente e só deve ser disparado quando o usuário aprovar a rodada validada.
