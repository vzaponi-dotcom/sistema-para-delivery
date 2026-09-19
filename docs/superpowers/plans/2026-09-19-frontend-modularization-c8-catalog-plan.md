# Spec C8 Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **STATUS: APPROVED — Tasks 1–5 COMPLETE / GREEN; Task 6 é a próxima task e ainda não foi iniciada.**
> **Design C8: APPROVED pelo usuário em 2026-09-19**, após a autorrevisão no HEAD `4466944a8aadecd667270c2c20f98450e254af32`.
> **Plano C8: APPROVED pelo usuário em 2026-09-19** no HEAD documental `20abf94359e0e2883fc3b870c69688f8eeabc12c`. A aprovação não autoriza merge, staging, produção nem Tasks 2–10.

**Goal:** Estabelecer Catalog como owner frontend do catálogo atual, retirar CRUD/editor de produto do App e encerrar `updateCollection`, preservando comportamento e contratos existentes.

**Architecture:** O operational runtime continua dono de `products[]` e dos sync guards. Catalog possui regras frontend, API, comandos e UI administrativa; Orders consome somente o contrato público de apresentação, mantendo carrinho e checkout. O contrato realmente compartilhado com o Worker permanece em `shared/productCatalog.js`, sem metadata exclusiva da UI.

**Tech Stack:** React 19, Vite 8, Node 22 `node:test`, `react-test-renderer` já instalado, oxlint, Cloudflare Worker/D1 e GitHub Actions. Manter `package.json` e lockfile; Wrangler `4.128.0`, como nos workflows existentes.

**Spec:** `docs/superpowers/specs/2026-09-19-frontend-modularization-c8-catalog-design.md`

## Global Constraints

- não implementar diretamente em `master`;
- trabalhar em `feature/spec-c8-catalog`;
- TDD RED → GREEN para extrações e mudanças de ownership;
- backend/bootstrap continuam fonte de verdade;
- não criar store oficial independente para produtos;
- polling/sync global permanecem como estão;
- não introduzir Redux, Zustand, React Router, WebSocket/SSE ou microserviços;
- não redesenhar Produtos nem o seletor de produtos de Novo Pedido;
- não alterar regras de produto, categoria, apresentação, preço ou exclusão;
- não antecipar C9, C10 ou Spec D;
- produção somente mediante autorização explícita separada.

A remoção de `updateCollection` é escopo explicitamente aprovado da C8, não autorização para limpeza geral da C10. Não alterar Worker, schema, migrations, políticas, QZ, versões de bibliotecas, CSS ou gatilhos de workflow. Preservar light/dark, desktop/mobile, textos, teclados, foco, confirmação e semântica de erro.

## Review Focus

1. **Bootstrap antigo após DELETE aceito:** não ressuscitar o produto; proteger somente a coleção mutada, permitindo atualização das demais — Task 2.
2. **Falha controlada no meio do bulk:** DELETEs continuam sequenciais; erro não produz efeito/sucesso; confirmação simples fecha após `false` resolvido e seleção bulk termina como hoje — Tasks 2 e 3.
3. **Preço/identidade de edição:** produto novo mostra zero uma única vez, digitação não é sobrescrita e edição não zera preço; `size` legado e decimais permanecem equivalentes — Task 4.
4. **Lifetime da UI:** extração não introduz fechamento do editor por navegação incidental; lista pode desmontar por destino, mas editor não sobrevive a logout/login — Task 5.
5. **Consumidor puro esquecido:** `orders/domain/orderCart.js`, além da UI, usa o formatter; import público deve carregar em Node sem executar JSX/Vite e manter `Un`/apresentação e quantidades do carrinho — Task 1.

Cada foco tem testes atribuídos abaixo; nenhum fica apenas como recomendação de revisão.

---

## 1. Base, aprovação e handoff documental

| Item | Estado de partida |
|---|---|
| Repositório | `vzaponi-dotcom/sistema-para-delivery` |
| Base técnica / master | `a7a8285ee125d90058c739f52daba6c170921adb` |
| C7 | PR #51 MERGED / COMPLETE |
| Validate pós-merge C7 | #1429 / run `35459175985` — SUCCESS na base exata |
| Último HEAD documental inspecionado antes deste plano | `4466944a8aadecd667270c2c20f98450e254af32` |
| Design C8 | **APPROVED**, 2026-09-19 |
| Plano C8 | **APPROVED**, 2026-09-19 |
| Tasks funcionais C8 | **Tasks 1–5 COMPLETE / GREEN**; Task 6 próxima/não iniciada; Tasks 7–10 não iniciadas |
| Deploy desta rodada de planejamento | Nenhum |

A base tinha rollout/ledger ainda indicando merge pendente de C7. O estado correto acima está reconciliado com o GitHub; **a atualização dos arquivos canônicos é a preparação documental obrigatória descrita abaixo**, não uma tarefa funcional já executada. Não considerar o texto antigo uma revogação da aprovação do design.

### Preparação documental e de execução — antes de Task 1

**Arquivos:** a spec C8 acima; `docs/superpowers/qa/spec-c-execution-ledger.md`; `docs/superpowers/qa/spec-c-compatibility-facades.md`; `docs/superpowers/plans/2026-09-15-frontend-modularization-rollout-plan.md`; este plano.

- [x] Registrar a aprovação deste plano somente depois de o usuário concedê-la. No cabeçalho da spec, registrar a aprovação do design já concedida, preservando integralmente as decisões aprovadas.
- [x] Reconciliar C7 como MERGED / COMPLETE, PR #51 fechado, base e Validate acima. Marcar C8 como DESIGN/PLAN APPROVED, implementação ainda não iniciada. Preservar evidências históricas; não reescrever resultados antigos como se fossem execuções novas.
- [x] Manter `updateCollection` como debt **ainda presente** até Task 6 e os reexports generic/auth para C10. Nada nesta preparação remove código.
- [x] Ler integralmente spec C, rollout, execution ledger, compatibility ledger, spec C8 e este plano antes de alterar código.
- [x] Confirmar branch/HEAD remoto novamente. Usar workspace isolada; não executar `reset`, `restore`, `clean`, `stash` ou force-push na workspace antiga do usuário.

```bash
git fetch origin
BASE=a7a8285ee125d90058c739f52daba6c170921adb
BRANCH=feature/spec-c8-catalog
git rev-parse origin/master
git rev-parse "origin/$BRANCH"
git merge-base --is-ancestor "$BASE" "origin/$BRANCH"
git diff --name-status "$BASE" "origin/$BRANCH"
git status --short
```

Se `master` ou a feature divergirem do handoff, inspecionar commits/diff antes de escrever; não assumir que divergência equivale a corrupção. Antes do primeiro RED, o diff desta fatia deve ser apenas documental. Registrar o HEAD realmente encontrado, sem substituir pelo SHA histórico acima.

- [x] Abrir/reutilizar um PR **draft** da feature para `master` antes do RED funcional. A abertura não autoriza merge. `validate.yml` roda em PR para `master`; push isolado nesta feature não dispara Validate automaticamente.
- [x] Usar Node 22 e `npm ci`; confirmar baseline por Validate no SHA atual. Se o ambiente local não executar testes, usar o CI existente e declarar isso; não registrar GREEN local inexistente.
- [x] Inventariar consumidores de produção e testes; busca remota vazia não prova ausência:

```bash
git grep -nE 'productCatalog\.js|updateCollection|createProduct|updateProduct|deleteProduct' -- src shared worker
git grep -nE 'pages/Products|components/ProductForm|ProductForm|Produto excluído com sucesso' -- src scripts
```

Manter no plano/ledger os caminhos adicionais realmente encontrados e migrá-los na task que remove o respectivo owner. Não ampliar allowlist nem usar `export *` para contornar um consumidor esquecido.

## 2. Mapa de arquivos e contratos

| Arquivo final | Responsabilidade |
|---|---|
| `src/domains/catalog/domain/catalogPresentation.js` | Metadata frontend: ícones, options, fallback de categoria e sugestão de apresentação; consome categorias compartilhadas |
| `src/domains/catalog/domain/catalogList.js` | Projeção pura de busca/filtro/agrupamento administrativo |
| `src/domains/catalog/domain/productDraft.js` | Construção/hidratação/conversão pura do draft, incluindo BRL e fallback legado |
| `src/domains/catalog/infrastructure/catalogApi.js` | POST/PATCH/DELETE via HTTP genérico |
| `src/domains/catalog/application/useCatalogCommands.js` | Request keys, capability/bloqueio, efeitos oficiais, sucesso/erro |
| `src/domains/catalog/application/useProductEditor.js` | Estado transitório e ciclo do editor; não possui coleção oficial |
| `src/domains/catalog/ui/Products.jsx` | Lista, seleção, confirmações e interações já existentes |
| `src/domains/catalog/ui/ProductForm.jsx` | Formulário existente, sem redesign |
| `src/domains/catalog/ui/ProductEditorDialog.jsx` | Modal atual encapsulado, usando o Modal genérico |
| `src/domains/catalog/ui/CatalogWorkspace.jsx` | Composição single-domain; separa lifetime da lista e do editor |
| `src/domains/catalog/ui/catalogSurfaces.js` | Wrappers públicos Node-safe |
| `src/domains/catalog/index.js` | Contrato público deliberado |
| `src/domains/catalog/test-support/harness.js` | Helpers de teste, nunca importados por produção |

**Permanece:** `shared/productCatalog.js` com `PRODUCT_CATEGORIES`, `deriveLegacySize`, `validateProductPresentation`, `formatProductPresentation` e seus helpers privados. Não duplicar validação/formatação do Worker em Catalog.

**Consumidores Orders confirmados pelo RED/inventário:**

- `src/domains/orders/ui/components/OrderProductCatalog.jsx` — categorias, fallback e formatter;
- `src/domains/orders/domain/orderCart.js` — formatter usado por `addCartItem`;
- `src/domains/orders/ui/components/OrderCart.jsx` — ícone da categoria e fallback visual.

Os três passam pelo `src/domains/catalog/index.js`. Não mover esses arquivos nem mudar cálculos, merge de linhas, notas, decremento ou payload de checkout.

**Contrato público final exato:**

```js
export { PRODUCT_CATEGORIES, formatProductPresentation } from '../../../shared/productCatalog.js'
export { CATEGORY_ICON_NAMES, categoryForUi } from './domain/catalogPresentation.js'
export { CatalogWorkspace } from './ui/catalogSurfaces.js'
```

**Exports intermediários deliberados:** `Products` e `ProductForm` na Task 1; `useCatalogCommands` na Task 2; `useProductEditor` e `ProductEditorDialog` na Task 4. App é consumidor real durante a migração. Todos são removidos do public entry na Task 5. Registrar sua remoção prevista no compatibility ledger; não são reexports nos caminhos legados e não autorizam deep imports.

**Interfaces internas estáveis:**

```text
projectCatalogList(products, {search = '', categoryFilter = 'Todos'} = {})
  -> {normalizedSearch, visibleProducts, groupedProducts: [{category, products}]}
createProductDraft() -> draft
productToDraft(product) -> draft
productPayloadFromDraft(draft) -> {category, presentationType, presentationValue, presentationUnit, name, price}
useCatalogCommands({api?, writesBlocked, canManageProducts, applyOfficialEffects,
                    setRequestKey, onSuccess, onError})
  -> {createProduct(payload): Promise<Product|null>,
      updateProduct(id, payload): Promise<Product|null>,
      deleteProduct(id): Promise<boolean>}
useProductEditor({createProduct, updateProduct, writesBlocked, canManageProducts})
  -> {isOpen, editing, draft, replaceDraft, openNewProduct, editProduct,
      submit, cancel, closeIfEditing}
CatalogWorkspace({visible, products, search, queryState, onSearchChange,
                  onQueryChange, currency, writesBlocked, canManageProducts,
                  applyOfficialEffects, setRequestKey, onSuccess, onError})
```

`replaceDraft` recebe o objeto completo emitido por ProductForm; não confundir com patch parcial. `editing` é boolean; o id fica interno ao editor. Bloqueios/erros de create/update retornam `null`, delete retorna `false`; nenhum consumidor deve esperar entidade em delete.

## 3. Protocolo TDD e evidência por task

Para Tasks 1–7: caracterização existente → RED específico da extração → commit/push RED → observar falha esperada no SHA → GREEN mínimo → testes focados → commit/push GREEN → Validate completo no SHA → evidência no ledger.

- Não escrever produção antes de comprovar o RED.
- Falha por `.jsx` em `node --test`, parser, fixture ou path acidental não é RED válido.
- Testes de paths acompanham a movimentação; não apagar cobertura para obter GREEN.
- Cada task termina sem depender de produção de uma task futura.
- Revisar strings, condições, defaults e closures no diff. Se o CI revelar teste obsoleto, separar claramente alinhamento de teste de correção de comportamento.
- Não avançar automaticamente além das tasks autorizadas pelo usuário.

**Evidência mínima por task:** HEAD inicial; RED SHA/run/falha; GREEN SHA/run/conclusão; totais pass/fail/skipped; architecture/lint/build/dry-runs/D1; caminhos alterados; debts intermediários; próxima task. `skipped` e `BLOCKED` nunca contam como PASS.

### Harness comum a criar na Task 1

Arquivo `src/domains/catalog/test-support/harness.js`. Os testes `.test.js` usam `React.createElement`, não JSX cru. Para `.jsx`, usar Vite com o config existente, sem adicionar biblioteca de testes:

```js
import React from 'react'
import { act, create } from 'react-test-renderer'
import { createServer } from 'vite'

export async function mountHook(t, useHook, initialProps) {
  let current
  let renderer
  function Probe(props) { current = useHook(props); return null }
  await act(async () => { renderer = create(React.createElement(Probe, initialProps)) })
  t.after(async () => { await act(async () => renderer.unmount()) })
  return {
    current: () => current,
    rerender: async (props) => {
      await act(async () => renderer.update(React.createElement(Probe, props)))
    },
  }
}

export async function createUiHarness(t) {
  const server = await createServer({
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
  })
  t.after(async () => { await server.close() })
  return { load: (path) => server.ssrLoadModule(path) }
}
```

Validar esse harness primeiro com componente existente: uma falha do harness não prova ausência do novo boundary. Fechar renderer e servidor em todos os caminhos, incluindo falha de assert. Não criar sleeps arbitrários; usar promises controladas e relógio simulado para long press. O Modal existente renderiza sem portal quando não há `document`; testar comportamento sem inventar DOM global. Portal/foco reais permanecem também no gate manual.

---

## Task 1 — Fronteira pública, metadata e realocação mecânica da UI

**Deliverable:** Catalog passa a possuir metadata e UI; App ainda coordena CRUD/editor. A UI de Orders e o carrinho usam o contrato público. Nenhum comportamento administrativo é reescrito nesta task.

**Files:** criar `domain/catalogPresentation.js`, `domain/catalogPresentation.test.js`, `index.js`, `ui/catalogSurfaces.js`, `catalogPublicContract.test.js`, `test-support/harness.js` sob `src/domains/catalog/`; mover `src/pages/Products.jsx` e `src/components/ProductForm.jsx` para `src/domains/catalog/ui/`; modificar `shared/productCatalog.js`, `shared/productCatalog.test.js`, `src/App.jsx`, os três consumidores Orders listados na seção 2 e seus testes. Alinhar/mover as characterizations da seção 4.

**Interfaces:** consome o shared atual; produz os quatro contratos públicos frontend necessários nesta fase (`PRODUCT_CATEGORIES`, `formatProductPresentation`, `CATEGORY_ICON_NAMES`, `categoryForUi`) mais `Products`/`ProductForm` temporários. `PRODUCT_CATEGORY_OPTIONS` e `suggestPresentationType` permanecem internos.

- [x] **Step 1 — RED de ownership e contratos puros.** Em `catalogPublicContract.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import * as catalog from './index.js'
import * as shared from '../../../shared/productCatalog.js'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
test('Catalog owns UI and keeps the Worker contract intact', () => {
  assert.equal(typeof catalog.Products, 'function')
  assert.equal(typeof catalog.ProductForm, 'function')
  assert.strictEqual(catalog.PRODUCT_CATEGORIES, shared.PRODUCT_CATEGORIES)
  assert.strictEqual(catalog.formatProductPresentation, shared.formatProductPresentation)
  assert.equal(catalog.categoryForUi('Categoria antiga'), 'Outros')
  assert.equal(existsSync(new URL('../../pages/Products.jsx', import.meta.url)), false)
  assert.equal(existsSync(new URL('../../components/ProductForm.jsx', import.meta.url)), false)
  for (const name of ['CATEGORY_ICON_NAMES', 'PRODUCT_CATEGORY_OPTIONS', 'categoryForUi', 'suggestPresentationType']) {
    assert.equal(Object.hasOwn(shared, name), false)
  }
  assert.doesNotMatch(read('../orders/domain/orderCart.js'), /shared\/productCatalog\.js/)
  assert.doesNotMatch(read('../orders/ui/components/OrderProductCatalog.jsx'), /shared\/productCatalog\.js/)
})
```

Em `catalogPresentation.test.js`, tabelar as nove categorias, ícones e sugestões exatas do shared atual. Migrar suas assertions frontend do teste shared; manter ali validação/formatter/legacy size. Em `orders/domain/orderCart.test.js`, provar `addCartItem([], unitProduct)[0].size === 'Un'` e volume `1,5 L`, categoria/nome/preço preservados, segundo add aumenta quantidade, decremento mantém regras existentes.

- [x] **Step 2 — Executar e registrar RED.**

```bash
node --test src/domains/catalog/catalogPublicContract.test.js src/domains/catalog/domain/catalogPresentation.test.js
```

Esperado: módulo público/metadata ausente. Comprovar também que os testes antigos permanecem verdes antes da movimentação; não usar falha do Vite como evidência.

- [x] **Step 3 — GREEN mecânico e atômico.**

```bash
mkdir -p src/domains/catalog/ui
git mv src/pages/Products.jsx src/domains/catalog/ui/Products.jsx
git mv src/components/ProductForm.jsx src/domains/catalog/ui/ProductForm.jsx
```

Mover os quatro exports frontend e seus helpers privados de `shared/productCatalog.js` para `domain/catalogPresentation.js`, importando `PRODUCT_CATEGORIES` do shared. Manter valores/ordem exatamente; `categoryForUi` usa o mesmo conjunto e fallback. Não mover formatter/validator para `src` nem fazer shared importar Catalog.

Atualizar imports internos das duas UIs para `../../../components/`, `../../../utils/` e `../domain/catalogPresentation.js`; shared continua acessível internamente por `../../../../shared/productCatalog.js`. Não alterar JSX, loops de exclusão, price effect ou CSS nesta etapa.

Wrapper público Node-safe inicial:

```js
import React from 'react'
const load = (path) => {
  const modules = import.meta.glob(['./Products.jsx', './ProductForm.jsx'], { eager: true })
  return modules[path].default
}
export function Products(props) { return React.createElement(load('./Products.jsx'), props) }
export function ProductForm(props) { return React.createElement(load('./ProductForm.jsx'), props) }
```

O `import.meta.glob` só é chamado ao renderizar pelo Vite, não na importação Node do public entry. App importa esses componentes e `categoryForUi` pelo index. `orderCart.js` passa a `../../catalog/index.js`; `OrderProductCatalog.jsx` passa a `../../../catalog/index.js`. Remover o import shared antigo de App. Nenhuma outra lógica Orders muda.

- [x] **Step 4 — GREEN focado e auditoria.**

```bash
node --test src/domains/catalog/catalogPublicContract.test.js src/domains/catalog/domain/catalogPresentation.test.js shared/productCatalog.test.js worker/productValidation.test.js worker/productPresentationRepository.test.js worker/productPresentationMigration.test.js src/domains/orders/domain/orderCart.test.js
npm run test:architecture
npm run lint
npm run build
```

Provar que index carrega em Node sem avaliar JSX; build prova carregamento real dos wrappers. Executar também as characterizations realocadas. Nenhum owner legado ou reexport nesses paths sobrevive.

- [x] **Step 5 — Commit e gate remoto.** Commits separados `test: define c8 catalog boundary` e `refactor: move catalog presentation and UI ownership`; push normal, Validate em cada SHA, registrar evidência. Registrar exports públicos intermediários com remoção na Task 5.

### Task 1 evidence — COMPLETE / GREEN

- RED: `11e84f3badf1ffcca0fd71bb2ccd46588017e88b`; Validate #1432 / run `35461496338` — **FAIL as intended**, **1,818 tests / 1,810 pass / 7 fail / 1 skipped**.
- Production GREEN candidate: `f8090972de496effa31cc391c3e71f9956021a03`; Validate #1434 reached Test and exposed exactly five stale path/import characterizations after the owner move.
- Test-path alignment: `c868ba99f0f3afdd28237528fb925f9ce99eb5f9`; Validate #1435 passed the full test suite, then architecture correctly rejected the Catalog-located characterization deep-importing Orders internals.
- Architecture test ownership alignment: `bdd73ada270c705e8c739ea785a56b8f5afa7cab`; the characterization moved under Orders ownership with no production change.
- Final Task 1 Validate #1436 / run `35462681394` — **SUCCESS**, **1,818 tests / 1,817 pass / 0 fail / 1 skipped**.
- Architecture, lint, build, production Worker dry-run, staging Worker dry-run, local D1 and Spec B D1 clean-install/upgrade: **all green**.
- Delivered: Catalog public boundary; frontend category metadata moved out of shared; Products/ProductForm owners moved under Catalog; App and all three Orders consumers use the Catalog public entry; legacy UI owner paths removed; no compatibility reexport/allowlist expansion.
- Intentionally still present for later tasks: App product CRUD/editor orchestration, product API exports and `updateCollection('products', ...)`.
- Task 2: **NOT STARTED / NOT AUTHORIZED IN THIS ROUND**.
- Staging/merge/production: **NONE**.

## Task 2 — API, comandos e efeito oficial de exclusão

**Files:** criar `src/domains/catalog/infrastructure/catalogApi.js` e `.test.js`; `src/domains/catalog/application/useCatalogCommands.js` e `.test.js`; modificar `src/app/runtime/data/useOperationalDataRuntime.js` e `.test.js`, `src/api/client.js`, `src/App.jsx`, `src/domains/catalog/index.js` e testes que atribuem sucesso/API ao owner antigo.

**Interfaces:** produz `createCatalogApi({request?, json?})`, `catalogApi`, `useCatalogCommands` com resultados da seção 2 e `{deletedProductId}` no runtime. App usa temporariamente o hook público, mantendo apenas coordenação do editor até Task 4. `updateCollection` continua fisicamente no runtime até Task 6, sem consumidor App depois desta task.

- [x] **Step 1 — RED de rotas, comandos e corrida de sync.** O adapter deve provar encoding de `id = 'p / 1'`, corpos inalterados e erro propagado. Teste representativo:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createCatalogApi } from './catalogApi.js'
test('Catalog API preserves routes and encoded ids', async () => {
  const calls = []
  const api = createCatalogApi({
    request: async (...args) => { calls.push(args); return { deleted: true } },
    json: (method, body) => ({ method, body: JSON.stringify(body) }),
  })
  await api.createProduct({ name: 'Água', price: 3 })
  await api.updateProduct('p / 1', { name: 'Água', price: 4 })
  await api.deleteProduct('p / 1')
  assert.deepEqual(calls.map(([url, options]) => [url, options.method]), [
    ['/api/products', 'POST'], ['/api/products/p%20%2F%201', 'PATCH'],
    ['/api/products/p%20%2F%201', 'DELETE'],
  ])
  assert.deepEqual(JSON.parse(calls[1][1].body), { name: 'Água', price: 4 })
})
```

Commands: testar create/update recebendo objeto oficial diferente do payload e aplicando esse objeto, nunca o draft; delete produz `{deletedProductId: id}` apenas após resolução. Tabelar blocked/capability ausente em todas as operações: 0 chamadas, 0 efeitos, 0 successes, retorno `null/null/false`. Testar rejeições 404, 401 e falha de rede: `onError` recebe erro original, request key termina `null`, nenhum efeito/sucesso, editor não recebe entidade de sucesso.

Adicionar ao teste existente do runtime, reutilizando `mountHarness`, `deferred`, `bootstrapFixture`:

```js
test('C8 accepted product delete survives an older bootstrap', async (t) => {
  const pending = deferred()
  let reads = 0
  const h = await mountHarness(t, { api: {
    getBootstrap: async () => ++reads === 1 ? bootstrapFixture() : pending.promise,
    getOrders: async () => ({ orders: [] }),
  } })
  await act(async () => { await h.getCurrent().refreshBootstrap() })
  let refresh
  await act(async () => { refresh = h.getCurrent().refreshBootstrapSilently() })
  const revision = h.getCurrent().getOfficialRevision()
  await act(async () => { h.getCurrent().applyOfficialEffects({ deletedProductId: 'product-1' }) })
  assert.deepEqual(h.getCurrent().products, [])
  assert.equal(h.getCurrent().getOfficialRevision(), revision)
  const stale = bootstrapFixture()
  stale.clients = [{ id: 'client-2', name: 'Bia' }]
  pending.resolve(stale)
  await act(async () => { await refresh })
  assert.deepEqual(h.getCurrent().products, [])
  assert.deepEqual(h.getCurrent().clients, stale.clients)
})
```

Adicionar caso análogo para upsert de produto, preservação de outras coleções e delete id ausente idempotente local. Produto não pertence a `PAYMENT_COLLECTIONS`; delete isolado não incrementa revision financeira.

- [x] **Step 2 — RED confirmado.**

```bash
node --test src/domains/catalog/infrastructure/catalogApi.test.js src/domains/catalog/application/useCatalogCommands.test.js src/app/runtime/data/useOperationalDataRuntime.test.js
```

Esperado: API/commands ausentes, produto não removido ou ressuscitado por ausência de efeito. Não aceitar regressão das proteções C5/C6/C7 como RED pretendido.

- [x] **Step 3 — GREEN com contratos existentes.** Adapter:

```js
import { apiRequest, withJson } from '../../../infrastructure/api/httpClient.js'
export function createCatalogApi({ request = apiRequest, json = withJson } = {}) {
  return {
    createProduct: (product) => request('/api/products', json('POST', product)),
    updateProduct: (id, product) => request(`/api/products/${encodeURIComponent(id)}`, json('PATCH', product)),
    deleteProduct: (id) => request(`/api/products/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  }
}
export const catalogApi = createCatalogApi()
```

Commands, sem store nem novo protocolo de retry:

```js
import { catalogApi } from '../infrastructure/catalogApi.js'
export function useCatalogCommands({ api = catalogApi, writesBlocked, canManageProducts,
  applyOfficialEffects, setRequestKey, onSuccess, onError }) {
  const run = async (key, operation, effect, message, failure) => {
    if (!canManageProducts || writesBlocked) return failure
    setRequestKey(key)
    try {
      const result = await operation()
      applyOfficialEffects(effect(result))
      onSuccess(message)
      return result
    } catch (error) {
      onError(error)
      return failure
    } finally { setRequestKey(null) }
  }
  return {
    createProduct: (payload) => run('product:create',
      async () => (await api.createProduct(payload)).product,
      (product) => ({ product }), 'Produto adicionado com sucesso', null),
    updateProduct: (id, payload) => run(`product:update:${id}`,
      async () => (await api.updateProduct(id, payload)).product,
      (product) => ({ product }), 'Produto atualizado com sucesso', null),
    deleteProduct: (id) => run(`product:delete:${id}`,
      async () => { await api.deleteProduct(id); return true },
      () => ({ deletedProductId: id }), 'Produto excluído com sucesso', false),
  }
}
```

O adapter mantém `{deleted: true}` do Worker; não inventar payload novo. Preservar serialização global via `setRequestKey`, não criar fila/pending global paralelo. Callback bulk já capturado continua sequencial; não reconsultar `writesBlocked` da própria operação de modo a bloquear os próximos ids indevidamente.

No runtime acrescentar `deletedProductId` ao argumento de `applyOfficialEffects`, `if (product || deletedProductId) changed.push('products')`, e `if (deletedProductId) setProducts(current => removeById(current, deletedProductId))`. Manter `markMutation(changed)` antes dos setters. Não alterar receipts/polling de pagamentos.

App chama commands, trata sucesso pelos resultados e mantém somente reset do editor. Retirar APIs de produto de `src/api/client.js`, seus imports no App, aplicação duplicada de efeitos/sucessos e `updateCollection('products', ...)`. Nenhum reexport de API legado.

- [x] **Step 4 — GREEN focado.** Reexecutar comando RED, testes Customers/Finance/runtime e `npm run test:architecture`, `npm run lint`, `npm run build`. Auditar `finally` e todos os canais de erro.
- [x] **Step 5 — Commit/gate.** `test: define c8 product commands and delete effect`; `refactor: move product mutations to catalog`; Validate por SHA, registrar Task 2 e debt de runtime ainda fisicamente presente.

## Task 3 — Projeção administrativa e regressões de interação

**Files:** criar `src/domains/catalog/domain/catalogList.js`, `.test.js`, `src/domains/catalog/ui/Products.test.js`; modificar `src/domains/catalog/ui/Products.jsx`; characterizations de Produtos realocadas na Task 1.

**Interfaces:** consome metadata Catalog e formatter shared; produz `projectCatalogList`. UI/selection permanecem locais a Products e não são exportados como regra Orders.

- [x] **Step 1 — RED da projeção e caracterizações do comportamento.**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { projectCatalogList } from './catalogList.js'
test('admin search keeps price matching, category fallback and original order', () => {
  const products = [
    { id: 'a', name: 'Suco', category: 'Bebidas', price: 7.5, presentationType: 'volume', presentationValue: '350', presentationUnit: 'ml' },
    { id: 'b', name: 'Item antigo', category: 'Antiga', price: 8, size: 'Família' },
    { id: 'c', name: 'Água', category: 'Bebidas', price: 3, presentationType: 'unit' },
  ]
  const result = projectCatalogList(products, { search: '  7.5 ', categoryFilter: 'Todos' })
  assert.equal(result.normalizedSearch, '7.5')
  assert.deepEqual(result.visibleProducts.map(p => p.id), ['a'])
  assert.equal(projectCatalogList(products, { search: '7,50' }).visibleProducts.length, 0)
  const all = projectCatalogList(products)
  assert.deepEqual(all.groupedProducts.map(g => [g.category, g.products.map(p => p.id)]), [['Bebidas', ['a', 'c']], ['Outros', ['b']]])
  assert.strictEqual(all.visibleProducts[0], products[0])
  assert.deepEqual(products.map(p => p.id), ['a', 'b', 'c'])
})
```

Acrescentar busca por nome/categoria/apresentação, trim/case `pt-BR`, filtro combinado, coleção vazia e zero preço. Não acrescentar remoção de acentos nem busca BRL mais tolerante.

Em `Products.test.js`, usar `createUiHarness` + React renderer para expandir categoria, abrir `Ações de <nome>`, escolher Excluir e confirmar pelo componente `ConfirmationDialog`. Callback `onDelete: async () => false` deve fechar o dialog sem remover o produto por conta própria. Para bulk, fixture com ids a/b/c, segundo callback resolve false, registrar a ordem e máximo de um callback simultâneo, confirmar seleção encerrada após c. Enquanto promise pendente, confirmar pending/disabled atuais e liberação em `finally`. Para throw inesperado, confirmar liberação de pending sem inventar sucesso.

Exemplo executável para o fechamento após falha controlada, em `ui/Products.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act, create } from 'react-test-renderer'
import { createUiHarness } from '../test-support/harness.js'

test('single delete closes confirmation after a controlled false result', async (t) => {
  const h = await createUiHarness(t)
  const [{ default: Products }, { default: ConfirmationDialog }] = await Promise.all([
    h.load('/src/domains/catalog/ui/Products.jsx'),
    h.load('/src/components/ConfirmationDialog.jsx'),
  ])
  const deleted = []
  let renderer
  await act(async () => {
    renderer = create(React.createElement(Products, {
      products: [{ id: 'p1', name: 'Água', category: 'Bebidas', price: 3, size: 'Un' }],
      search: '', queryState: { categoryFilter: 'Todos' }, currency: String,
      onSearchChange() {}, onQueryChange() {}, onAdd() {}, onEdit() {},
      onDelete: async (id) => { deleted.push(id); return false }, canManageProducts: true,
    }))
  })
  t.after(async () => { await act(async () => renderer.unmount()) })
  await act(async () => renderer.root.findByProps({ className: 'product-category-accordion-header' }).props.onClick())
  await act(async () => renderer.root.findByProps({ 'aria-label': 'Ações de Água' }).props.onClick({ stopPropagation() {} }))
  const removeButton = renderer.root.findAllByType('button').find(node => node.props.className === 'danger')
  assert.ok(removeButton)
  await act(async () => removeButton.props.onClick())
  assert.equal(renderer.root.findAllByType(ConfirmationDialog).length, 1)
  await act(async () => renderer.root.findByType(ConfirmationDialog).props.onConfirm())
  assert.deepEqual(deleted, ['p1'])
  assert.equal(renderer.root.findAllByType(ConfirmationDialog).length, 0)
})
```

Testar long press por timers simulados: 549 ms não entra; 550 ms entra; pointer cancel/up/leave antes do limite cancela; clique posterior ao long press não desfaz a seleção inicial. Mouse não inicia timer. Não substituir por atraso real no teste.

- [x] **Step 2 — RED específico.**

```bash
node --test src/domains/catalog/domain/catalogList.test.js src/domains/catalog/ui/Products.test.js
```

A ausência de `catalogList.js` é o RED da extração. Caracterizações de exclusão/long press devem passar no owner movido antes de alterar projeção; não forçar sua falha artificialmente.

- [x] **Step 3 — GREEN mínimo.**

```js
import { categoryForUi } from './catalogPresentation.js'
import { formatProductPresentation } from '../../../../shared/productCatalog.js'
export function projectCatalogList(products, { search = '', categoryFilter = 'Todos' } = {}) {
  const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR')
  const visibleProducts = products.filter((product) => {
    const category = categoryForUi(product.category)
    const text = [product.name, category, formatProductPresentation(product), String(product.price)]
      .join(' ').toLocaleLowerCase('pt-BR')
    return (categoryFilter === 'Todos' || category === categoryFilter)
      && (!normalizedSearch || text.includes(normalizedSearch))
  })
  const groupedProducts = visibleProducts.reduce((groups, product) => {
    const category = categoryForUi(product.category)
    const group = groups.find(item => item.category === category)
    if (group) group.products.push(product)
    else groups.push({ category, products: [product] })
    return groups
  }, [])
  return { normalizedSearch, visibleProducts, groupedProducts }
}
```

Products substitui somente os blocos de filtro/reduce por `projectCatalogList(products, {search, categoryFilter})`. Manter expansão automática quando busca/filtro ativo; `selectedProductIds`, `pendingId`, menus, portals, temporizadores e loops atuais. Não usar a projeção administrativa na busca Orders: naquela tela busca não inclui preço e busca preenchida tem precedência sobre categoria.

- [x] **Step 4 — GREEN.** Reexecutar os dois testes, characterizations e architecture/lint/build. Garantir nenhum sort, mudança de markup ou CSS.
- [x] **Step 5 — Commit/gate.** `test: characterize c8 catalog list and bulk behavior`; `refactor: isolate catalog list projection`; registrar RED/GREEN e os casos de falha controlada.

## Task 4 — Draft, editor e modal de produto

**Files:** criar `src/domains/catalog/domain/productDraft.js` e `.test.js`, `application/useProductEditor.js` e `.test.js`, `ui/ProductEditorDialog.jsx`, `ui/ProductForm.test.js` sob Catalog; modificar `src/App.jsx`, `index.js`, `ui/catalogSurfaces.js` e characterizations de preço/foco.

**Interfaces:** consome commands Task 2; produz editor da seção 2 e `ProductEditorDialog({editor, writesBlocked})`. App mantém temporariamente chamada ao hook público + composição do dialog, mas perde todo state/payload/handler de produto.

- [x] **Step 1 — RED de estado/payload.** Testar novo → editar → cancelar → novo, erro create/update mantendo aberto, sucesso limpando editor, bloqueios e exclusão por id. `closeIfEditing(outroId)` não fecha; id atual fecha. O payload deve ser exatamente o objeto abaixo:

```js
assert.deepEqual(productPayloadFromDraft({
  category: 'Bebidas', presentationType: 'volume', presentationValue: '1,5',
  presentationUnit: 'L', name: '  Suco  ', price: 'R$ 12,50',
}), {
  category: 'Bebidas', presentationType: 'volume', presentationValue: '1,5',
  presentationUnit: 'L', name: 'Suco', price: 12.5,
})
```

O draft envia `1,5` como hoje; o Worker normaliza. Não adicionar `size` ao payload nem antecipar normalização na UI. Tabelar fallback `size: ''`, `Un`, `Unidade`, `P`, `Família`; preservar diferença de `||` e `??` na hidratação estruturada, inclusive `presentationValue: ''`.

`ProductForm.test.js`: novo inicia com zero após mount, segundo render/digitação não zera novamente; edição mantém preço. Validar unit, size P/M/G/Outro (1–24 caracteres), volume/peso positivos, vírgula/ponto e unidades corretas, inválidos bloqueados e erro inline. Troca de categoria/tipo mantém os resets atuais. Input de nome/preço deve conservar identidade entre rerenders, sem nova key por tecla.

- [x] **Step 2 — RED autoritativo.**

```bash
node --test src/domains/catalog/domain/productDraft.test.js src/domains/catalog/application/useProductEditor.test.js src/domains/catalog/ui/ProductForm.test.js
```

Esperado: helpers/hook ausentes. As characterizations do ProductForm já movido não precisam falhar.

- [x] **Step 3 — GREEN, preservando defaults reais.** Helpers de draft:

```js
import { categoryForUi } from './catalogPresentation.js'
import { formatBRLCurrencyValue, parseBRLCurrencyInput } from '../../../utils/formFormatting.js'
export const createProductDraft = () => ({
  category: 'Refeições', presentationType: 'size', presentationValue: 'P',
  presentationUnit: '', name: '', price: formatBRLCurrencyValue(32),
})
export function productToDraft(product) {
  const legacySized = Boolean(product.size && !['Un', 'Unidade'].includes(product.size))
  return {
    category: categoryForUi(product.category),
    presentationType: product.presentationType || (legacySized ? 'size' : 'unit'),
    presentationValue: product.presentationValue ?? (legacySized ? product.size : ''),
    presentationUnit: product.presentationUnit || '',
    name: product.name,
    price: formatBRLCurrencyValue(product.price),
  }
}
export const productPayloadFromDraft = (draft) => ({
  category: draft.category, presentationType: draft.presentationType,
  presentationValue: draft.presentationValue, presentationUnit: draft.presentationUnit,
  name: draft.name.trim(), price: parseBRLCurrencyInput(draft.price),
})
```

O seed 32 é deliberadamente preservado nesta extração; `ProductForm` mantém seu efeito já existente que apresenta **R$ 0,00 uma única vez no cadastro**, nunca na edição. Não apresentar o seed como requisito de preço inicial ao usuário.

Hook:

```js
import { useState } from 'react'
import { createProductDraft, productToDraft, productPayloadFromDraft } from '../domain/productDraft.js'
export function useProductEditor({ createProduct, updateProduct, writesBlocked, canManageProducts }) {
  const [editingId, setEditingId] = useState(null)
  const [isOpen, setOpen] = useState(false)
  const [draft, replaceDraft] = useState(createProductDraft)
  const cancel = () => { setEditingId(null); replaceDraft(createProductDraft()); setOpen(false) }
  const openNewProduct = () => {
    if (!canManageProducts || writesBlocked) return false
    setEditingId(null); replaceDraft(createProductDraft()); setOpen(true); return true
  }
  const editProduct = (product) => {
    if (!canManageProducts || writesBlocked) return false
    setEditingId(product.id); replaceDraft(productToDraft(product)); setOpen(true); return true
  }
  const submit = async () => {
    if (!canManageProducts || writesBlocked || !draft.name.trim()) return false
    const result = editingId !== null
      ? await updateProduct(editingId, productPayloadFromDraft(draft))
      : await createProduct(productPayloadFromDraft(draft))
    if (!result) return false
    cancel(); return true
  }
  const closeIfEditing = (id) => { if (editingId === id) cancel() }
  return { isOpen, editing: editingId !== null, draft, replaceDraft,
    openNewProduct, editProduct, submit, cancel, closeIfEditing }
}
```

Apresentação continua validada no ProductForm + Worker; não introduzir validator divergente. Modal novo encapsula o markup atual, sem nova UX:

```jsx
import Modal from '../../../components/Modal'
import ProductForm from './ProductForm.jsx'
export default function ProductEditorDialog({ editor, writesBlocked }) {
  if (!editor.isOpen) return null
  return <Modal title={editor.editing ? 'Editar produto' : 'Novo produto'} onClose={editor.cancel}>
    <ProductForm value={editor.draft} onChange={editor.replaceDraft} onSubmit={editor.submit}
      onCancel={editor.cancel} disabled={writesBlocked} editing={editor.editing} />
  </Modal>
}
```

App usa hook/dialog públicos temporários, remove `newProduct`, `editingProductId`, `showProductForm`, `emptyProduct`, payload e handlers antigos. Atualizar `clearBusinessData`: até Task 5 ele pode chamar `editor.cancel()` pelo contrato, nunca setters apagados. Remover essa ponte transitória na Task 5.

- [x] **Step 4 — GREEN e regressões.** Rodar os três testes, characterizations de foco/preço e `npm run test:architecture`, lint, build. Verificar nenhuma alteração em `Modal.jsx`/CSS e nenhum reset por tecla.
- [x] **Step 5 — Commit/gate.** `test: define c8 product editor lifecycle`; `refactor: move product editor into catalog`; registrar exports/ponte temporários, todos com remoção Task 5.

## Task 5 — CatalogWorkspace e encerramento do ownership no App

**Files:** criar `src/domains/catalog/ui/CatalogWorkspace.jsx`, `.test.js`, `src/domains/catalog/catalogExtractionContract.test.js`; modificar App, index, wrappers, testes de integração/lista/editor.

**Interfaces:** contrato final da seção 2. `visible` controla só a lista; o workspace permanece montado dentro da árvore autenticada do AppRoot. Isso preserva o lifetime global do editor que existia no App. Não criar state de navegação dentro de Catalog.

- [x] **Step 1 — RED de composição e lifetime.** Testar ausência no App dos estados/handlers/payload/APIs/imports de produto; presença de `CatalogWorkspace` e query/capability/runtime injetados. Em UI, montar workspace com `visible=true`, abrir editor, preencher, alternar `visible=false/true` e confirmar draft/modal preservados; unmount + novo mount começa fechado. Lista desmonta quando invisível, limpando seleção/accordion como o destino anterior. Query controlada por App permanece ao voltar. Contexto read-only não apresenta ações/editor.

```js
const forbidden = /\b(?:editingProductId|showProductForm|newProduct|emptyProduct|productPayload|handleAddProduct|handleEditProduct|handleDeleteProduct|handleCancelProductEdit|useProductEditor|useCatalogCommands)\b/
assert.doesNotMatch(appSource, forbidden)
assert.match(appSource, /CatalogWorkspace/)
assert.match(appSource, /canManageProducts/)
assert.match(appSource, /query\.products/)
```

No final desta task substituir o contrato temporário de exports da Task 1 por conjunto exato de quatro exports: workspace e três helpers. Testes internos importam seus owners relativos; não manter public export apenas para teste.

- [x] **Step 2 — RED.**

```bash
node --test src/domains/catalog/catalogExtractionContract.test.js src/domains/catalog/ui/CatalogWorkspace.test.js src/domains/catalog/catalogPublicContract.test.js
```

Esperado: workspace ausente, App ainda compõe editor/hook e entry intermediário ainda amplo.

- [x] **Step 3 — GREEN da composição.**

```jsx
import { useCatalogCommands } from '../application/useCatalogCommands.js'
import { useProductEditor } from '../application/useProductEditor.js'
import Products from './Products.jsx'
import ProductEditorDialog from './ProductEditorDialog.jsx'
export default function CatalogWorkspace({ visible, products, search, queryState,
  onSearchChange, onQueryChange, currency, writesBlocked, canManageProducts,
  applyOfficialEffects, setRequestKey, onSuccess, onError }) {
  const commands = useCatalogCommands({ writesBlocked, canManageProducts,
    applyOfficialEffects, setRequestKey, onSuccess, onError })
  const editor = useProductEditor({ createProduct: commands.createProduct,
    updateProduct: commands.updateProduct, writesBlocked, canManageProducts })
  const removeProduct = async (id) => {
    const accepted = await commands.deleteProduct(id)
    if (accepted) editor.closeIfEditing(id)
    return accepted
  }
  return <>
    {visible && <Products products={products} search={search} currency={currency}
      queryState={queryState} onQueryChange={onQueryChange} onSearchChange={onSearchChange}
      onAdd={editor.openNewProduct} onEdit={editor.editProduct} onDelete={removeProduct}
      canManageProducts={canManageProducts} />}
    {canManageProducts && <ProductEditorDialog editor={editor} writesBlocked={writesBlocked} />}
  </>
}
```

Substituir o bloco condicional de Products no App por workspace estável com `visible={activeTab === 'products'}` e as props da seção 2. Não montar com `activeTab === 'products' && <CatalogWorkspace>`: isso alteraria o lifetime do editor ao navegar. AppRoot já desmonta children fora da sessão autenticada; cobrir logout/expiração com teste de composição. Não manter reset bridge no App.

Index passa aos quatro exports finais; `catalogSurfaces.js` contém apenas o wrapper de `CatalogWorkspace`, seguindo o padrão Node-safe da Task 1. Remover imports e helpers de produto sobrando no App. CSS continua importado na posição anterior.

- [x] **Step 4 — GREEN.** Reexecutar testes acima, Products/ProductForm/editor/commands e integração Orders. Revisar ciclo completo AppRoot/logout e retorno à tela; zero store/cópia oficial local.
- [x] **Step 5 — Commit/gate.** `test: define c8 catalog workspace boundary`; `refactor: compose catalog workspace from app`; registrar remoção de todos os exports/ponte intermediários.

## Task 6 — Remover fisicamente updateCollection

**Files:** modificar `src/app/runtime/data/useOperationalDataRuntime.js`, `.test.js`, testes de runtime/extração que ainda exijam o método e `docs/superpowers/qa/spec-c-compatibility-facades.md`.

**Interfaces:** `applyOfficialEffects`, `refreshBootstrap`, receipts e getters continuam iguais, com efeito C8 da Task 2; `updateCollection` deixa de existir.

- [x] **Step 1 — RED de ausência real.** Adicionar ao arquivo de teste de runtime existente:

```js
test('C8 removes the collection escape hatch from the runtime contract', async (t) => {
  const h = await mountHarness(t, { api: {
    getBootstrap: async () => bootstrapFixture(), getOrders: async () => ({ orders: [] }),
  } })
  assert.equal(Object.hasOwn(h.getCurrent(), 'updateCollection'), false)
  const source = await readFile(new URL('./useOperationalDataRuntime.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /\bupdateCollection\b/)
})
```

Inventariar toda referência em produção antes de remover. Teste que usava o escape hatch para preparar fixture passa a usar bootstrap/efeitos oficiais correspondentes, sem perder a assertion de proteção de sync.

- [x] **Step 2 — RED confirmado.** `node --test src/app/runtime/data/useOperationalDataRuntime.test.js` deve falhar apenas na ausência exigida, pois o método ainda está no runtime.
- [x] **Step 3 — GREEN de remoção.** Apagar integralmente o bloco `const updateCollection = useCallback`, a propriedade retornada e a dependência no `useMemo`. Não apagar setters nem `removeById`, ainda necessários a outros efeitos oficiais.

```bash
git grep -n 'updateCollection' -- src
```

Depois da remoção, só podem restar assertions negativas em testes; nenhum caller/retorno de produção. Se houver consumidor de produção não inventariado, migrá-lo por efeito oficial existente e teste de equivalência antes de concluir; não ampliar escopo silenciosamente com um setter alternativo.

- [x] **Step 4 — GREEN de todos os runtimes e regressões próximas.** `node --test src/app/runtime/data/useOperationalDataRuntime.test.js`, `npm test`, architecture/lint/build. Verificar especialmente effects de Customers/Finance e receipts de pagamentos.
- [x] **Step 5 — Commit/gate.** `test: require removal of runtime collection escape hatch`; `refactor: remove updateCollection runtime escape hatch`. Só depois de GREEN marcar `REMOVED IN C8` no ledger; enforcement permanente vem na Task 7. Generic/auth e Printing permanecem debts futuros.

## Task 7 — Enforcement arquitetural permanente

**Files:** modificar `scripts/architecture/check-import-boundaries.mjs` e `.test.mjs`; `src/domains/catalog/catalogPublicContract.test.js`, `catalogExtractionContract.test.js`; compatibility ledger. `legacy-import-allowlist.json` deve permanecer inalterado.

**Interfaces:** usar `collectImportEdges`/`findArchitectureViolations({rootDir, allowlist})` existentes. Não criar checker paralelo nem dependência pesada.

- [x] **Step 1 — RED com fixtures negativas e positivas.** Cada violação precisa de teste que injete uma árvore mínima e invoque o checker: App → Catalog internal; Orders → Catalog API/internal; Catalog → Orders public e internal; Catalog → Finance/Table Service/Printing/QZ; owners legados Products/ProductForm; product CRUD reexportado no API legado; handlers/state de produto no App; `updateCollection` de volta em runtime/produção; import shared de produto por frontend fora de Catalog; retorno de metadata frontend ao shared; domain React/UI/infrastructure/browser/fetch. Testes positivos: Orders → Catalog index, Catalog → shared cross-runtime, imports internos Catalog e shared mantido puro.

Exemplo, usando `createFixture(t)` e `write` confirmados no teste existente do checker:

```js
test('C8 forbids Catalog depending on Orders even through its public entry', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/domains/catalog/application/x.js', "import { x } from '../../orders/index.js'\n")
  await write('src/domains/orders/index.js', 'export const x = 1\n')
  const violations = await findArchitectureViolations({ rootDir })
  assert.ok(violations.some(value => value.startsWith('catalog-orders-import:')))
})
```

O helper existente `createFixture` retorna `{rootDir, write}` e registra cleanup com `t.after`; reutilizá-lo sem criar um segundo harness. O RED deve ser a aresta proibida, não um erro de setup.

- [x] **Step 2 — RED.** `node --test scripts/architecture/check-import-boundaries.test.mjs` deve falhar nas novas proteções. Gate normal da árvore real continua válido até inserir fixtures proibidas.
- [x] **Step 3 — GREEN estrutural.** Acrescentar checks no loop de arestas existente:

```js
if (!edge.from.startsWith('src/domains/catalog/')
  && edge.resolvedPath?.startsWith('src/domains/catalog/')
  && edge.resolvedPath !== 'src/domains/catalog/index.js') {
  violations.push(`catalog-deep-import: ${edge.from} -> ${edge.resolvedPath}`)
}
if (edge.from.startsWith('src/domains/catalog/')
  && edge.resolvedPath?.startsWith('src/domains/orders/')) {
  violations.push(`catalog-orders-import: ${edge.from} -> ${edge.resolvedPath}`)
}
if (!isTestFile(edge.from) && !edge.from.startsWith('src/domains/catalog/')
  && edge.resolvedPath === 'shared/productCatalog.js') {
  violations.push(`catalog-shared-bypass: ${edge.from} -> ${edge.resolvedPath}`)
}
```

Completar guards de owners/API/state com os mecanismos já existentes, cobrindo `export const`, `export function` e named reexport, inclusive aliases. Não rejeitar docs/testes só porque citam token proibido. Gate de domínio puro deve rejeitar React/UI/infrastructure/browser/fetch; o shared root pode ser lido explicitamente como o checker C7 já faz, sem fazer Worker importar `src`. Não bloquear os quatro exports cross-runtime permitidos.

`catalogPublicContract.test.js` compara `Object.keys(catalog).sort()` com `['CatalogWorkspace','CATEGORY_ICON_NAMES','PRODUCT_CATEGORIES','categoryForUi','formatProductPresentation'].sort()`. Tests internos acessam arquivos internos; produção externa não. Verificar também wrappers auxiliares sem exports intermediários sobreviventes.

- [x] **Step 4 — GREEN.** Rodar suite do checker, public/extraction contracts, `npm run test:architecture`, lint/build e suite completa. Diff da allowlist deve estar vazio.
- [x] **Step 5 — Commit/gate.** `test: enforce c8 catalog boundaries`; `feat: enforce catalog architecture boundaries`. Marcar debts C8 como removidos/enforced, sem encerrar C9/C10.

## Task 8 — Gate completo e auditoria do candidato

**Files:** atualizar somente evidências no execution ledger/plano após verificar resultados; correções funcionais retornam à task responsável com RED próprio.

**Interfaces:** consome Tasks 1–7 GREEN; produz SHA candidato exato, run Validate SUCCESS e auditoria de diff.

- [x] Executar todos os gates existentes, sem substituir teste completo por focused:

```bash
npm ci
npm test
npm run test:architecture
npm run lint
npm run build
npx --yes wrangler@4.128.0 deploy --dry-run
npx --yes wrangler@4.128.0 deploy --dry-run --env staging
npm run d1:migrate:local
node scripts/infra/spec-b-d1-gate.mjs
```

- [x] Confirmar no GitHub `head_sha`, `conclusion=success`, steps e contagens reais. Para evidência estrita do branch SHA, usar `workflow_dispatch` do `validate.yml` no ref exato; não confundir merge-ref sintético do PR com o SHA executável da feature.
- [x] Auditar diff:

```bash
BASE=a7a8285ee125d90058c739f52daba6c170921adb
git diff --check "$BASE" HEAD
git diff --name-status "$BASE" HEAD
git diff "$BASE" HEAD -- worker migrations .github/workflows package.json package-lock.json
git diff "$BASE" HEAD -- src/product-form.css src/product-selection.css src/components/Modal.jsx
git diff "$BASE" HEAD -- src/domains/orders
```

Worker/migrations/workflows/deps/CSS/Modal sem diff; Orders só imports públicos e testes proporcionais, sem lógica de carrinho/checkout alterada. Shared retira somente metadata frontend; API shape inalterado. Não contar redução de App como prova suficiente.
- [x] Registrar fechamento de exports temporários, ausência de owners/API legados e runtime escape hatch, public entry mínimo e sync guard testado.
- [x] Commits documentais posteriores exigem validar seu próprio HEAD antes de staging/merge; não atribuir run antigo a commit novo. Não executar deploy nesta task.

## Task 9 — Staging e homologação proporcional

**Task 9 status — 2026-09-19:** **IN PROGRESS / BLOCKED BEFORE DEPLOY**. The code candidate `ae4d09d44b1012fadf6cabcbe6eb190ef9ef4bfb` is GREEN. Validate #1460 / run `35469241957` succeeded with 1,860 tests / 1,859 pass / 0 fail / 1 skipped and all workflow gates green. The PR run checked out synthetic merge ref `8ef861e5facb7326b27dcdab120a0e10ffa59cad`; GitHub confirms that ref and the feature HEAD have the identical tree `b2a2376a65270f50f891c06196b9acb7a3637134`. No staging deploy has occurred yet because the available GitHub integration does not expose `workflow_dispatch`, and the isolated execution shell has no GitHub/Cloudflare credentials. Workflow triggers were not modified to bypass this control. QA matrix is created at `docs/superpowers/qa/spec-c8-catalog-qa.md` with all manual cases PENDING until a real staging deployment exists.

**Files:** criar `docs/superpowers/qa/spec-c8-catalog-qa.md`; atualizar plano/execution ledger com evidência real.

**Interfaces:** consome candidato validado; produz staging no mesmo SHA e matriz manual com PASS/FAIL/BLOCKED/PENDING.

- [ ] Confirmar feature HEAD = candidato; dispatch manual `deploy-staging.yml` para `feature/spec-c8-catalog`. Sem alterar triggers nem executar deploy-production. Em ambiente com `gh`, comando equivalente:

```bash
gh workflow run deploy-staging.yml --repo vzaponi-dotcom/sistema-para-delivery --ref feature/spec-c8-catalog
```

O executor via plugin usa o action documentado correspondente. Registrar run real, SHA, readiness, migrations e real login smoke. Se HEAD mudar entre Validate e dispatch, validar o novo SHA; não homologar um executável diferente sem declarar.

- [ ] Executar matriz, inicialmente toda PENDING, sem presumir PASS por CI:

| Nº | Caso | Resultado esperado |
|---|---|---|
| 1 | Produtos desktop claro/escuro | Mesma hierarquia visual, textos e ações |
| 2 | Buscar nome | Trim/case atuais, sem mudança de acentos |
| 3 | Buscar categoria | Categoria visual, inclusive Outros |
| 4 | Buscar apresentação | P/Família/350 ml/localização atual |
| 5 | Buscar preço | Semântica `String(price)`, não busca BRL nova |
| 6 | Filtro Todos | Coleção completa visível |
| 7 | Filtro específico + busca | Interseção correta |
| 8 | Expandir/recolher | Accordion preservado; busca/filtro expande como antes |
| 9 | Criar Unidade | Nome, preço, retorno oficial, mensagem atual |
| 10 | Criar Tamanho P/M/G | Presets e preço preservados |
| 11 | Tamanho Outro | Texto customizado; até 24 caracteres |
| 12 | Volume com vírgula/ponto | ml/L; exibição localizada |
| 13 | Peso | g/kg; decimal positivo |
| 14 | Apresentação inválida | Submit bloqueado, mensagem atual |
| 15 | Editar estruturado | Mantém preço e apresentação; sucesso oficial |
| 16 | Legado | Size/categoria fallback; BLOCKED se não existir fixture adequada |
| 17 | Excluir/cancelar | Sem request ou efeito de remoção |
| 18 | Excluir/confirmar | Remove somente após sucesso; toast atual |
| 19 | Seleção desktop | Marcar/desmarcar/cancelar; contador correto |
| 20 | Bulk | Sequencial, sem perda indevida da seleção durante pending |
| 21 | Long press mobile | 550 ms, sem duplo toggle; scroll/cancel atuais |
| 22 | Toolbar mobile 320–640 px | Portal/fixed/sticky e safe area sem clipping |
| 23 | Formulário mobile | Decimal, digitação/foco contínuo e preview |
| 24 | Offline | Lista/busca/filtro funcionam; writes não são enviados |
| 25 | Novo Pedido: busca | Nome/categoria/apresentação sem preço adicionado à busca |
| 26 | Novo Pedido: categoria | Inicial vazio; categorias disponíveis; busca prevalece como antes |
| 27 | Carrinho | Adicionar, aumentar, diminuir; `Un`/apresentação preservados |
| 28 | Sync oficial | Create/update/delete continuam corretos após refresh |
| 29 | Logout/login | Editor e seleção não ressuscitam |
| 30 | Restricted/read-only | Sem ações de gestão; BLOCKED sem identidade adequada |
| 31 | Preço inicial/foco | Novo zero uma vez; edição mantém valor; digitação não perde foco |
| 32 | Falha de exclusão controlada | Erro global; dialog/seleção encerram conforme baseline, sem falso sucesso |
| 33 | Request lento | Serialização global preservada; sem submissão duplicada pela UI |
| 34 | Retorno ao destino | Query preservada; lista reseta estado local conforme baseline |
| 35 | Smoke operacional | Criar pedido com produto disponível; demais áreas sem regressão evidente |

Para induzir falhas, usar request blocking ou fixture em staging, nunca apagar/alterar dados de produção. Hardware físico fica na rodada proporcional C9; não declarar impressão física testada por ver item na fila.

- [ ] Registrar casos bloqueados separadamente; legacy/capabilities sem fixture não recebem PASS. Nenhum FAIL/PENDING pode ser encerrado por inferência. Correção de código exige RED/GREEN, novo Validate, novo staging e repetição dos casos afetados.
- [ ] Registrar último SHA de código, SHA efetivamente homologado e eventuais commits documentais posteriores. Não iniciar C9.

## Task 10 — Fechamento documental e merge autorizado

**Files:** QA C8, execution ledger, compatibility ledger, rollout e este plano. PR da própria C8.

**Interfaces:** consome homologação concluída sem FAIL/PENDING; produz handoff de merge e, só com autorização específica, master pós-C8 validada.

- [ ] Atualizar documentos com cada evidência RED/GREEN, último SHA funcional, staging, matriz e bloqueios aceitos; estado de C7 fechado e C8 correto. Preservar histórico e não falsificar testes não executados.
- [ ] Comitar docs de fechamento, push normal e executar Validate no **HEAD final exato**. Revalidar SHA/CI/estado draft do PR imediatamente antes do merge.
- [ ] Pedir autorização explícita de merge da C8. Aprovação da spec, do plano, de uma task ou de teste manual não é autorização de merge.
- [ ] Somente após autorização + gates verdes, merge sem force-push; registrar merge SHA e confirmar Validate pós-merge nesse SHA. Se o run ainda estiver em andamento, registrar pendência real e parar, sem promessa de acompanhamento em background.
- [ ] Não executar deploy de produção. Não iniciar C9 automaticamente. Handoff C9 usa somente o novo master realmente mergeado/validado.

---

## 4. Migração de testes e ausência de facades

| Teste atual | Destino/ação |
|---|---|
| `shared/productCatalog.test.js` | Manter contrato Worker; mover assertions frontend para `src/domains/catalog/domain/catalogPresentation.test.js` |
| `src/productCatalogUi.test.js` | Mover para `src/domains/catalog/ui/productCatalogUi.test.js`; corrigir URLs relativas |
| `src/pages/ProductsUx.test.js` | Mover para `src/domains/catalog/ui/ProductsUx.test.js`; manter todas as assertions de layout/ações |
| `src/productSelectionFeedback.test.js` | Mover para `src/domains/catalog/ui/productSelectionFeedback.test.js`; CSS continua `src/product-form.css` |
| `src/productFormFocusRegression.test.js` | Manter integração com Modal genérico; apontar para novo ProductForm/productDraft |
| `src/pages/ClientsProductsMobile.test.js` | Manter cross-domain; alterar somente caminho do ProductForm |
| `src/catalogLocalOrdersIntegration.test.js` | Manter cross-domain; App compõe CatalogWorkspace e o workspace/editor compõem ProductForm |
| `src/domains/orders/domain/orderCart.test.js` | Acrescentar casos formatter/legacy; manter todos os testes de cart/checkout |
| `worker/productValidation.test.js` | Sem mudança funcional; gate de contrato compartilhado |
| `worker/productPresentationRepository.test.js` | Sem mudança funcional; gate de persistência/mapping |
| `worker/productPresentationMigration.test.js` | Sem mudança funcional; gate de compatibilidade |

Outros consumidores dos paths antigos encontrados pelo inventário são alinhados na mesma task da movimentação; não criar arquivo vazio ou skip para esconder ausência. Assertions positivas sobre o owner anterior tornam-se assertions positivas no owner novo + negativas no legado. Não ampliar o contrato público só para satisfazer testes.

## 5. Cobertura da spec e ordem das tasks

| Seções da spec C8 | Task responsável |
|---|---|
| 1–6, 11–12: ownership/árvore/public entry | 1, 4, 5, 7 |
| 3.1: reconciliação pós-C7 | Preparação documental antes de Task 1 |
| 7–10: shared, categorias, apresentação, legado | 1 e 4 |
| 13–16: API/payload/effects/commands | 2 e 4 |
| 17–18: editor/formulário/defaults | 4 |
| 19–20: lista, bulk, busca/filtro/query | 3 e 5 |
| 21: Orders × Catalog | 1, 3, 9 |
| 22: BRL | 4 e 9 |
| 23–25: capabilities/offline/erros | 2, 3, 4, 9 |
| 26–27: App e logout/reset | 5 |
| 28–29: CSS/Worker/migrations preservados | 1, 8, 9 |
| 30–32: legado/compatibilidade/architecture | 2, 5, 6, 7 |
| 33–36: testes/TDD/gates/staging | 1–9 |
| 37–41: não objetivos/aceite/fechamento | Restrições globais, 8–10 |
| 42–43: aprovação e autorrevisão | Cabeçalho e seção 6 deste plano |

Ordem: ownership mecânico → API/effects → projeção/lista → editor → workspace → remover escape hatch → enforcement → gates → staging → fechamento. Nenhum step precisa importar um módulo futuro não criado. Public exports intermediários têm consumidor real e data de remoção na própria sequência.

## 6. Autorrevisão formal do plano — 2026-09-19

Revisão confrontada com o design C8 aprovado, Spec C, trecho normativo C8 do rollout, estado pós-C7, compatibility ledger disponível, package/workflows, runtime e seus testes, AppRoot, Modal, helpers do checker, UI/shared/Worker auditados no design e consumidores Orders.

**Ajustes incorporados:**

- Incluído o consumidor adicional confirmado `orders/domain/orderCart.js`; sua migração não altera `addCartItem`, snapshots frontend ou checkout.
- Metadata e UI são movimentadas juntas na Task 1 para não deixar import quebrado nem reexport frontend dentro do shared usado pelo Worker.
- Export público de UI usa wrapper Node-safe; o contrato final fica restrito a quatro exports. Exports intermediários e reset bridge têm remoção explícita na Task 5.
- Resultado de commands fixado em `Product|null` / boolean em todas as tasks; sem divergência entre hook, editor e workspace.
- Preço inicial distingue seed interno de 32 do valor efetivo zero apresentado pelo ProductForm; não se altera o efeito durante a extração.
- Busca administrativa não é reutilizada em Orders: preço, filtro combinado e estado inicial diferem.
- Workspace estável mantém lifetime do editor, mas renderiza lista condicionalmente; logout usa desmontagem autenticada, sem novo bridge.
- Delete aplica `deletedProductId` com sync guard; testes cobrem bootstrap atrasado e outras coleções. `updateCollection` só é marcado removido após remoção física e GREEN.
- Bulk mantém sequência e falha controlada, sem endpoint novo nem resumo agregado de erros; mensagens existentes preservadas.
- Gates mantêm Node 22, lockfile e Wrangler fixado; PR draft/dispatch existente, sem editar workflows.
- Matriz manual contém os 30 casos mínimos da spec mais 5 riscos observáveis; casos sem identidade/fixture ficam BLOCKED.
- Aprovação de design não foi confundida com aprovação deste plano, implementação, merge ou produção.

**Limite da validação nesta entrega:** revisão documental, consistência dos contratos/paths e conferência remota da base. Os trechos de código são instruções para futuras tasks, não implementação executada. A aplicação não foi testada localmente nesta rodada de planejamento. O baseline de aplicação citado pertence ao merge C7; não constitui GREEN de C8.

**Estado atual deste plano:** APPROVED. Preparação documental concluída; Task 1 COMPLETE / GREEN em `bdd73ada270c705e8c739ea785a56b8f5afa7cab` / Validate #1436. Tasks 2–10 continuam não executadas e não autorizadas nesta rodada.


---

## Execution checkpoint — after Task 5 — 2026-09-19

- **Tasks 1–5: COMPLETE / GREEN. Task 6: NOT STARTED.**
- Task 2 RED `cd2ed96624b29793d289e5d3405fecb5f8c1d704` / Validate #1438 / run `35463215995`: expected product-command/API/deletion-effect failures. Task 2 final GREEN `8f7cfca4c0a4b03477955d1b3b0646b9ad35b165` / Validate #1440 / run `35463540113`: **SUCCESS**, 1,828 tests / 1,827 pass / 0 fail / 1 skipped.
- Task 3 authoritative RED `6cf21d7a6930f8ba22063ed76fc2c497b6d5f4fd` / Validate #1445 / run `35464412859`: exactly one intended missing-`catalogList.js` failure after correcting the test harness. Task 3 final GREEN `01c10746aa1bf24c406b634d8b53efd5a69aff6f` / Validate #1447 / run `35464678996`: **SUCCESS**, 1,836 tests / 1,835 pass / 0 fail / 1 skipped.
- Task 4 RED `33155835d2105681ee3bd9a826295ff920a04eb2` / Validate #1448 / run `35464932138`: four expected missing editor/draft/public-boundary failures. Task 4 final GREEN `f85a6aa8623f2cf79fdf0a9a8115d69bc5226309` / Validate #1450 / run `35466359982`: **SUCCESS**, 1,848 tests / 1,847 pass / 0 fail / 1 skipped.
- Task 5 RED `26da9d33c316edd1d6a825960bea2fcbe93dc9ac` / Validate #1451 / run `35466813331`: five intended workspace/public-entry/composition failures. Production GREEN `27e8312630736f1ff467cb39c4a7587f4672445e`; final test-ownership alignment `ca26a0f48527a0e8f5371655bec0cc6c59b3a951`; Validate #1453 / run `35467142766`: **SUCCESS**, 1,852 tests / 1,851 pass / 0 fail / 1 skipped.
- Final Catalog public entry after Task 5: `CatalogWorkspace`, `CATEGORY_ICON_NAMES`, `PRODUCT_CATEGORIES`, `categoryForUi`, `formatProductPresentation`. The icon map is intentionally public because Orders/OrderCart is a real consumer discovered in Task 1.
- App now composes Catalog only through the stable `CatalogWorkspace`; product list visibility is controlled by `visible`, so editor lifetime survives navigation within the authenticated tree while list-local selection/accordion state resets when hidden.
- Product CRUD API/commands/editor/list projection/UI owners are under Catalog. Legacy product CRUD exports are absent from `src/api/client.js`.
- Product use of `updateCollection('products', ...)` was removed in Task 2, but the generic `updateCollection` method still physically exists in the operational runtime. **Do not mark this debt removed before Task 6 GREEN.**
- No staging, merge or production deployment occurred. No Worker/schema/migration/CSS/workflow/allowlist functional changes were introduced by Tasks 2–5.


## Execution checkpoint — after Task 6 — 2026-09-19

- **Tasks 1–6: COMPLETE / GREEN. Task 7: NOT STARTED.**
- Task 6 RED: `6e743157df04a584086e693dd284f6fb23cf0be6`; Validate #1455 / run `35468303745` failed on exactly one intended contract assertion because `updateCollection` still existed.
- Task 6 GREEN: `91b60e61064a660ca942ef61d3b2b968ffc654da`; Validate #1456 / run `35468442271` — **SUCCESS**, **1,853 tests / 1,852 pass / 0 fail / 1 skipped**; architecture/lint/build/production+staging Worker dry-runs/local D1/Spec B D1 all green.
- The operational runtime no longer defines or exposes the generic `updateCollection` escape hatch. Official effects remain the only production mutation contract for the migrated collections.
- Compatibility ledger now marks the physical debt **REMOVED IN C8 Task 6**. Permanent C8 architecture enforcement remains Task 7 work; the existing C7 Customers rule remains intact.
- No staging, merge or production deploy occurred. No Worker/schema/migration/CSS/workflow/allowlist change was introduced by Task 6.


## Execution checkpoint — after Task 8 / Task 9 pre-deploy — 2026-09-19

- **Tasks 1–8: COMPLETE / GREEN. Task 9: IN PROGRESS / BLOCKED BEFORE DEPLOY.**
- Task 7 RED: `c242e48dbcae61f72fe5eb5a6ecfccb68a76c474`; Validate #1458 / run `35469069713` — **FAIL as intended**, 1,860 tests / 1,853 pass / 6 fail / 1 skipped. The six failures were the intended missing C8 architecture guards; the positive fixture passed.
- Task 7 GREEN path: enforcement commit `faff34de29eb12a882177d9b7700bbbb9cd1f51c`, followed by normal corrective commit `ae4d09d44b1012fadf6cabcbe6eb190ef9ef4bfb` fixing the shared-catalog guard scope without rewriting history.
- Final candidate `ae4d09d44b1012fadf6cabcbe6eb190ef9ef4bfb`; Validate #1460 / run `35469241957` — **SUCCESS**, **1,860 tests / 1,859 pass / 0 fail / 1 skipped**; architecture/lint/build/production Worker dry-run/staging Worker dry-run/local D1/Spec B D1 all green.
- Permanent C8 checker rules reject Catalog deep imports, Catalog dependencies on Orders/Finance/Table Service/Printing/QZ, legacy Products/ProductForm owners, legacy product CRUD exports, App product ownership, production `updateCollection`, frontend shared-product bypasses, frontend metadata returning to shared, and browser/fetch usage in Catalog domain. Positive public/internal/shared contracts remain allowed. Architecture allowlist was not expanded.
- Task 8 diff audit: no Worker, migrations, workflow, dependency, product CSS, selection CSS or `Modal.jsx` changes. Orders changes are public-entry import rewrites plus proportional characterizations; cart/checkout logic is unchanged.
- The PR-triggered #1460 checked out synthetic merge ref `8ef861e5facb7326b27dcdab120a0e10ffa59cad`; its Git tree is exactly the feature candidate tree `b2a2376a65270f50f891c06196b9acb7a3637134`. This is recorded explicitly rather than claiming a workflow-dispatch branch checkout that did not occur.
- Task 9 staging dispatch remains blocked by tooling: this GitHub connector supports run reads but not workflow dispatch, and the isolated shell has no GitHub/Cloudflare credentials. No workflow trigger was altered. No staging, merge or production deploy occurred in this checkpoint.
