# Gestão Delivery — Pagamento dividido em múltiplas formas — Implementation Plan

> Execution mode: executar task por task, sempre RED → GREEN, com evidência remota por SHA exato quando a PR estiver aberta. Nenhuma implementação começa antes da aprovação explícita deste plano.

Status: plano consolidado e auto-revisado; aguardando aprovação do usuário
Feature: Issue #30 — Permitir pagamento dividido em múltiplas formas na baixa
Spec aprovada: docs/superpowers/specs/2026-09-21-split-payments-design.md
Implementation branch: feature/split-payments
Master baseline: 56c693ee505631191d4b09926fb6237d865910f5
Spec checkpoint: 04b7319775cafb2571c3ddb221473d5cc776caf3
Produção: proibida nesta execução sem autorização separada

---

## 1. Goal

Implementar pagamento integral composto por uma ou várias formas, preservando:

- um pagamento/quitação por pedido;
- um receipt por ato de recebimento;
- uma ou várias allocations por receipt;
- movimentos financeiros equivalentes às allocations;
- pagamento integral de comanda com um único receipt;
- checkout Salvar e receber;
- A Receber;
- Cozinha/Histórico;
- read model estruturado;
- Dashboard/Financeiro corretos;
- estorno integral atual;
- boundaries da Spec C;
- impressão/QZ sem alteração funcional.

Pagamento dividido não vira pagamento parcial.

---

## 2. Global constraints

- Não trabalhar diretamente em master.
- Não fazer deploy de produção.
- Não criar novo store oficial de pagamentos no frontend.
- Não reintroduzir payment bridge no runtime.
- Não mover lógica de pagamento para App.jsx.
- Não fazer Finance importar internals de Orders ou Table Service.
- Não fazer Orders importar internals de app/workflows.
- Não criar método sintético persistido como Dinheiro + Pix, Múltiplas formas ou equivalente.
- Não usar float como unidade autoritativa de mutação; usar centavos inteiros.
- Não confiar no total enviado pelo frontend.
- Não permitir pagamento parcial.
- Não permitir a mesma forma duas vezes no mesmo receipt.
- Não duplicar receita por pedido em pagamento de comanda.
- Não inventar distribuição de métodos entre pedidos de uma comanda.
- Não alterar QZ, print queue, recovery, segunda via ou pipeline físico.
- Não enfraquecer testes antigos apenas para acomodar o novo modelo.
- Compatibilidade temporária durante a sequência de implementação deve ser explícita e removida até Task 6.
- payments.order_id UNIQUE permanece uma invariante.
- Métodos inativos históricos continuam legíveis, mas não podem ser usados em nova mutação.
- Capabilities/offline/races da C6 permanecem.
- Todo SQL novo deve ser business-scoped.
- Toda migration deve passar clean install, upgrade realista e PRAGMA foreign_key_check.

---

## 3. Baseline confirmed

Na base atual:

- migrations existentes: 0001 até 0025;
- payments.order_id é UNIQUE;
- payments.method é NOT NULL;
- movements.payment_method existe;
- order payment cria 1 payment + 1 movement;
- table-tab payment cria 1 payment + 1 movement por pedido pendente;
- checkout pago cria payment/movement dentro do batch de criação;
- paymentApi envia { method };
- standalone payment é owned por app/workflows/payments/order;
- table-tab payment é owned por app/workflows/payments/table-tab;
- A Receber chama o standalone workflow;
- OrderCheckoutSummary ainda seleciona uma única forma;
- buildOrderPayload ainda aceita paymentMethod;
- worker/orderCheckout.js ainda valida paymentMethod;
- Order read model ainda seleciona p.method AS payment_method;
- order.paymentMethod ainda aparece em UI/analytics/refund;
- Dashboard já recebe movements, mas getPaymentMix ainda usa orders + paymentMethod + valor integral;
- applyOfficialEffects já suporta movement e movements;
- table-tab reconciliation já suporta array de movimentos;
- runtime não possui mais payment-receipt bridge.

O último Validate documentado no PR #55 antes do merge passou com 1.975 testes / 1.974 pass / 0 fail / 1 skipped. Antes de código, a nova PR deve estabelecer baseline próprio no HEAD documental desta feature.

---

## 4. Target schema

### 4.1 Migration 0026 — additive/backfill foundation

Criar:

migrations/0026_split_payments.sql

A migration deve permitir implementação incremental sem quebrar temporariamente os writers ainda não migrados.

### 4.2 payment_receipts

Shape alvo:

~~~sql
CREATE TABLE payment_receipts (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  table_tab_id TEXT REFERENCES table_tabs(id) ON DELETE SET NULL,
  total_cents INTEGER NOT NULL CHECK (
    typeof(total_cents) = 'integer' AND total_cents > 0
  ),
  paid_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (business_id, id)
);
~~~

Índices mínimos:

- business_id, paid_at DESC;
- business_id, table_tab_id quando não-null.

table_tab_id só identifica um recebimento de comanda quando conhecido com certeza. O backfill legado por payment não tenta reconstruir agrupamentos históricos de comanda.

### 4.3 payment_allocations

Shape alvo:

~~~sql
CREATE TABLE payment_allocations (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  receipt_id TEXT NOT NULL,
  method_code TEXT,
  method_label TEXT NOT NULL CHECK (length(trim(method_label)) BETWEEN 1 AND 80),
  amount_cents INTEGER NOT NULL CHECK (
    typeof(amount_cents) = 'integer' AND amount_cents > 0
  ),
  created_at TEXT NOT NULL,
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, receipt_id)
    REFERENCES payment_receipts(business_id, id) ON DELETE CASCADE,
  FOREIGN KEY (business_id, method_code)
    REFERENCES business_payment_methods(business_id, code)
);
~~~

method_code é nullable somente para eventual dado histórico que não possa ser canonicalizado com segurança. Nova mutação nunca aceita null.

Adicionar unique parcial:

~~~sql
CREATE UNIQUE INDEX payment_allocations_receipt_method_idx
ON payment_allocations (receipt_id, method_code)
WHERE method_code IS NOT NULL;
~~~

Índices para:

- receipt;
- business/method/created_at.

### 4.4 payments rebuild in 0026

O schema atual tem method TEXT NOT NULL; portanto não basta adicionar receipt_id.

A migration deve reconstruir payments preservando IDs e bytes históricos:

~~~text
payments
- id
- business_id
- order_id UNIQUE
- receipt_id nullable durante Tasks 1–5
- amount_cents
- method nullable, LEGACY ONLY
- paid_at
- created_at
~~~

Regras:

- rows históricos mantêm method byte-for-byte;
- nova escrita receipt-based usa method = NULL;
- nenhum consumidor novo usa payments.method;
- receipt_id será hard-enforced na Task 6.

### 4.5 movements rebuild in 0026

Preservar todas as colunas existentes e adicionar:

- receipt_id;
- payment_allocation_id.

Recriar exatamente:

- idx_movements_one_order_refund;
- movements_business_date_active_idx;
- demais índices atuais encontrados no audit do schema.

Para movimentos novos source = order-payment, receipt/allocation serão obrigatórios após hardening.

### 4.6 Backfill 1:1 histórico

Para cada payment antigo:

- deterministic receipt id, por exemplo legacy-receipt:<payment-id>;
- deterministic allocation id, por exemplo legacy-allocation:<payment-id>;
- receipt.total_cents = payment.amount_cents;
- allocation.amount_cents = payment.amount_cents;
- allocation.method_label = payment.method exato;
- method_code = canonical code quando o valor é reconhecido;
- unknown histórico => method_code null, sem converter para Outro;
- payment.receipt_id = receipt;
- movement order-payment correspondente recebe receipt/allocation IDs;
- nenhum novo movement é criado;
- nenhum refund é modificado.

Known mappings de migration devem cobrir pelo menos:

- pix / Pix;
- cash / Dinheiro;
- debit_card / Cartão de débito / legado débito quando existir;
- credit_card / Cartão de crédito / legado crédito quando existir;
- transfer / Transferência;
- other / Outro.

### 4.7 Migration 0027 — final hardening

Criar somente na Task 6:

migrations/0027_split_payments_hardening.sql

Adicionar guards para impedir reintrodução dos writers antigos:

- INSERT em payments com receipt_id IS NULL => abort;
- INSERT em payments com method IS NOT NULL => abort;
- INSERT de source=order-payment sem receipt_id => abort;
- INSERT de source=order-payment sem payment_allocation_id => abort.

Rows históricos já existentes com method não-null permanecem válidos porque os guards são para nova escrita.

---

## 5. Target runtime contracts

### 5.1 Mutation allocation

Frontend/HTTP:

~~~js
{
  methodCode: 'cash',
  amountCents: 3000,
}
~~~

Backend never trusts method label from client.

### 5.2 Resolved allocation

Server-side only:

~~~js
{
  methodCode: 'cash',
  methodLabel: 'Dinheiro',
  amountCents: 3000,
}
~~~

### 5.3 Receipt response

~~~js
{
  id,
  totalCents,
  total,
  tableTabId,
  paidAt,
  createdAt,
  allocations: [...]
}
~~~

### 5.4 Order read model

~~~js
{
  paymentStatus: 'Pago',
  paymentId,
  paymentReceiptId,
  paidAmount,
  paidAt,
  paymentAllocations: [
    {
      id,
      receiptId,
      methodCode,
      methodLabel,
      amountCents,
      amount,
    },
  ],
  paymentMethod: 'Pix'
}
~~~

paymentMethod é compatibility projection somente quando allocations.length === 1.

Para múltiplas allocations:

~~~js
paymentMethod: null
~~~

Nenhum consumidor relevante pode depender desse fallback ao final da Task 6.

### 5.5 Movement read model

Adicionar:

- receiptId;
- paymentAllocationId.

Preservar paymentMethod como snapshot da allocation para filtros/Financeiro.

---

## 6. Backend validation contract

Create:

- worker/paymentValidation.js
- worker/paymentValidation.test.js

Required API:

~~~js
validatePaymentAllocations(rawAllocations)
assertPaymentAllocationTotal(allocations, authoritativeTotalCents)
~~~

Structural validation must reject:

- non-array;
- empty;
- missing methodCode;
- unknown/noncanonical methodCode;
- amount zero;
- amount negative;
- non-integer;
- unsafe integer;
- duplicate methodCode.

Total validation rejects:

- below authoritative total;
- above authoritative total.

Error is 400 validation/domain error, not 409 policy error.

Policy race remains 409 POLICY_CHANGED.

---

## 7. Policy validation for N methods

Modify:

- worker/operationalPolicyGuards.js
- worker/operationalPolicyGuards.test.js

Add a multi-method expectation, conceptually:

~~~js
readPaymentMethodExpectations(db, businessId, methodCodes)
// => { revision, methods: [{ code, label }, ...] }
~~~

Rules:

- read payment-settings revision;
- every code exists;
- every code active;
- labels come from server;
- codes remain unique;
- final batch assertion proves same revision and all selected methods still active.

preparePolicyGuards must preserve existing single-method callers used by:

- refund;
- manual movement.

Do not break those contracts while adding multi-method support.

---

# Execution preparation — only after this plan is approved

- [ ] Re-fetch master and feature/split-payments.
- [ ] Confirm master is still 56c693ee... or investigate drift before code.
- [ ] If master advanced, compare and explicitly rebase/merge only after analysis.
- [ ] Confirm feature branch contains only approved design/plan docs.
- [ ] Create/reuse one draft PR to master.
- [ ] Do not create duplicate PR.
- [ ] Record PR number and documentary HEAD.
- [ ] Observe Validate application on exact documentary HEAD.
- [ ] Baseline must be green or unrelated failure investigated before RED Task 1.
- [ ] No staging deploy during preparation.
- [ ] No production action.

---

# Task 1 — Schema foundation, historical backfill and payment validation primitives

Purpose: Introduzir o modelo normalizado e provar migração sem alterar ainda os fluxos de mutação existentes.

## Files

Create:

- migrations/0026_split_payments.sql
- worker/splitPaymentsMigration.test.js
- worker/paymentValidation.js
- worker/paymentValidation.test.js

Modify only if needed for migration harness:

- worker/test-support/settingsDb.js
- scripts/infra/spec-b-d1-gate.mjs

Do not migrate endpoint/UI writers yet.

## Interfaces

Produces:

- payment_receipts;
- payment_allocations;
- nullable legacy payments.method;
- nullable payments.receipt_id during migration sequence;
- movements.receipt_id;
- movements.payment_allocation_id;
- pure structural allocation validation.

## RED

### Step 1 — migration tests

Write tests that apply 0001–0025, seed realistic historical rows, then require 0026 behavior.

Cases:

1. simple historical Pix payment becomes 1 receipt + 1 allocation;
2. Dinheiro preserves exact label;
3. old payment id/order/value/paid_at/created_at unchanged;
4. payment.method historical bytes unchanged;
5. movement id/value/source/payment_method unchanged;
6. movement gains receipt/allocation link;
7. refund movement unchanged and receives no fake allocation;
8. table-tab historical payments remain separate receipts rather than guessed grouping;
9. unknown legacy method keeps method_label and null method_code;
10. indexes survive/recreated;
11. payment order uniqueness survives;
12. refund unique index survives;
13. foreign_key_check empty;
14. rollback leaves no partial reconstructed schema/data if migration fails.

Run:

~~~bash
node --test worker/splitPaymentsMigration.test.js
~~~

Expected RED: migration missing.

### Step 2 — payment validation RED

Write:

- one allocation passes;
- two allocations pass structurally;
- duplicate code fails;
- zero/negative/noninteger/unsafe fails;
- empty/malformed fails;
- exact total passes;
- below/above fails.

Run:

~~~bash
node --test worker/paymentValidation.test.js
~~~

Expected RED: module missing.

### Step 3 — commit/push authoritative RED

Commit only tests:

test: define split payment persistence

Push branch and record intended Validate failure.

## GREEN

### Step 4 — implement 0026 carefully

Migration order:

1. create receipt/allocation tables;
2. backfill receipts/allocations from current payments;
3. create replacement payments table with nullable method + receipt_id;
4. copy all payments preserving bytes;
5. create replacement movements with existing columns + new IDs;
6. copy all movements;
7. drop child movements old table;
8. replace payments;
9. replace movements;
10. recreate indexes;
11. leave writer-enforcement triggers for 0027, not yet;
12. foreign key check.

Do not use random UUID generation in SQL backfill.

### Step 5 — implement validation primitives

No DB access in structural validator.

Use safe integer arithmetic only.

### Step 6 — full migration gates

Run:

~~~bash
node --test worker/splitPaymentsMigration.test.js worker/paymentValidation.test.js
npm run d1:migrate:local
node scripts/infra/spec-b-d1-gate.mjs
npm test
npm run test:architecture
~~~

Expected: all green.

### Step 7 — commit GREEN + exact-SHA Validate

feat: add split payment persistence foundation

Stop if Validate is not SUCCESS.

## Task 1 acceptance

- Existing behavior observationally unchanged.
- Existing writers still function because method is nullable but accepted and receipt_id is not hard-required yet.
- Historical bytes preserved.
- New normalized data exists for historical payments.
- No production UI changed.
- No QZ/Printing changes.

---

# Task 2 — Migrate standalone order payment end-to-end and introduce reusable composition editor

Purpose: Primeiro fluxo real de pagamento dividido, reused later by comanda/checkout.

## Files

Create:

- worker/paymentRepository.js
- worker/paymentRepository.test.js
- src/app/workflows/payments/paymentComposition.js
- src/app/workflows/payments/paymentComposition.test.js
- src/app/workflows/payments/PaymentCompositionEditor.jsx
- src/app/workflows/payments/PaymentCompositionEditor.test.js

Modify:

- worker/operationalPolicyGuards.js
- worker/operationalPolicyGuards.test.js
- worker/repositories.js
- worker/orderRepositories.test.js
- worker/businessPolicyIntegration.test.js
- worker/index.js
- src/app/workflows/payments/paymentApi.js
- src/app/workflows/payments/paymentApi.test.js
- src/app/workflows/payments/order/useOrderPaymentWorkflow.js
- src/app/workflows/payments/order/useOrderPaymentWorkflow.test.js
- src/app/workflows/payments/order/OrderPaymentDialog.jsx
- order-payment dialog tests/characterizations
- src/businessPaymentOptions.test.js
- src/operationalPayment.test.js

## Backend interfaces

Move standalone payment ownership from repositories.js to paymentRepository.js.

Target:

~~~js
registerOrderPayment(db, businessId, orderId, allocations, now)
~~~

Shared server helpers in paymentRepository may include:

~~~js
resolvePaymentAllocations(...)
preparePaymentReceiptWrite(...)
mapPaymentReceipt(...)
mapPaymentAllocation(...)
~~~

Keep these cohesive; do not expose unnecessary internals.

## Frontend composition interface

paymentComposition.js should own React-free UI model rules:

- initial line = default method + full total;
- sum informed;
- remaining;
- overage;
- duplicate detection;
- method availability/review;
- add empty line without silently modifying prior amounts;
- remove line;
- conversion to API allocations only when valid.

PaymentCompositionEditor:

- receives totalCents;
- receives active paymentOptions;
- receives defaultPaymentMethod;
- receives controlled allocations/onChange;
- displays total/entered/remaining;
- select uses canonical code internally;
- amount input is accessible and mobile-friendly;
- filters duplicate method choices;
- exposes remove action with accessible label;
- contains no API call;
- contains no order/table business logic.

## RED

### Step 1 — backend repository RED

Required cases:

1. order R$80 cash 3000 + pix 5000;
2. one receipt total 8000;
3. two allocations exact values;
4. one payment row for order;
5. payment.method null for new receipt-based write;
6. two movements, 3000 and 5000;
7. both movements same receipt;
8. each movement points to its allocation;
9. both movements may point to same payment for standalone order;
10. order becomes Pago;
11. duplicate payment gives 409;
12. cancelled order gives 409;
13. sum below/above rejected before writes;
14. inactive method 409 POLICY_CHANGED;
15. policy changes inside batch => zero partial receipt/allocation/payment/movement;
16. existing close-table-tab-if-settled behavior preserved.

### Step 2 — policy multi-method RED

Prove:

- two active codes return one revision + server labels;
- one inactive rejects;
- revision race rejects entire batch.

### Step 3 — frontend composition RED

Pure tests:

- initial cash R$80;
- add Pix line does not mutate cash automatically;
- cash 3000 + pix 5000 valid;
- remaining 5000 after cash 3000;
- duplicate invalid;
- 0 invalid;
- overage invalid;
- method disappears from effective options => review invalid;
- removing row recalculates.

Editor render tests:

- Add form;
- remove;
- summary text;
- mobile input attributes;
- error via role/status/alert as appropriate;
- not color-only.

### Step 4 — workflow race RED

Adapt existing tests to allocations while preserving:

- double submit => 1 POST;
- A cannot close B;
- stale session ignored;
- 409 refresh;
- network/5xx refresh;
- no optimistic paid;
- A Receber source bypass remains;
- operational eligibility remains.

### Step 5 — authoritative RED commit

Commit/push tests only.

Expected failures must be missing/new contract, not parser/test harness.

## GREEN

### Step 6 — implement multi-policy support

Preserve single-method callers.

### Step 7 — implement order payment repository

Transaction/batch includes:

1. policy assertions;
2. receipt insert;
3. N allocation inserts;
4. payment insert with receipt_id and method NULL;
5. N movement inserts;
6. settings assertion cleanup.

Movement description can remain existing order-payment description.

### Step 8 — change HTTP

POST /api/orders/:id/payment reads:

~~~js
{ allocations }
~~~

No method fallback in this endpoint.

Return:

~~~js
{
  receipt,
  allocations,
  payment,
  order,
  movements,
  tableTab,
}
~~~

### Step 9 — change paymentApi

~~~js
registerOrderPayment(id, allocations)
~~~

registerTableTabPayment remains old signature until Task 3 only because its endpoint has not migrated yet. This is sequencing, not a permanent compatibility facade.

### Step 10 — change order workflow/dialog

Owner stores allocation composition, not owner.method.

Success copy:

- one allocation: Pagamento recebido via Pix;
- multiple: Pagamento recebido em 2 formas.

Apply:

~~~js
applyOfficialEffects({ order, movements, tableTab })
~~~

### Step 11 — focused/full GREEN

Run focused payment/backend/UI tests, then:

~~~bash
npm test
npm run test:architecture
npm run lint
npm run build
~~~

### Step 12 — commit GREEN + Validate

feat: support split standalone payments

## Task 2 acceptance

- Cozinha/Histórico/A Receber standalone payment supports split.
- Simple payment remains one-line fast path.
- Order payment creates one receipt.
- Revenue equals receipt total.
- Existing races remain.
- Table-tab and checkout are intentionally still legacy writers until next tasks.

---

# Task 3 — Migrate whole-table-tab payment to one receipt

Purpose: Fazer comanda refletir um único ato de recebimento, sem distribuir formas artificialmente por pedido.

## Files

Modify:

- worker/paymentRepository.js
- worker/paymentRepository.test.js
- worker/repositories.js
- worker/tableTabPayment.test.js
- worker/businessPolicyIntegration.test.js
- worker/index.js
- src/app/workflows/payments/paymentApi.js
- src/app/workflows/payments/paymentApi.test.js
- src/app/workflows/payments/table-tab/TableTabPaymentDialog.jsx
- moved dialog tests
- src/app/workflows/payments/table-tab/useTableTabPaymentWorkflow.js
- src/app/workflows/payments/table-tab/useTableTabPaymentWorkflow.test.js
- src/app/workflows/payments/table-tab/tableTabPaymentReconciliation.js
- reconciliation tests
- src/comandasAppWiring.test.js

No Table Service domain ownership migration.

## Target backend

~~~js
registerTableTabPayment(db, businessId, tableTabId, allocations, now)
~~~

Algorithm:

1. require open tab;
2. read all noncancelled unpaid orders;
3. authoritative total = sum pending order totals;
4. reject no payable balance;
5. validate allocations exact total;
6. validate all methods/current revision;
7. one receipt with table_tab_id;
8. N allocations;
9. one payment per pending order, all same receipt_id, method NULL;
10. one movement per allocation;
11. table-tab movement must have order_id/payment_id NULL rather than inventing a specific order;
12. close tab;
13. clear assertions.

## RED

Cases:

1. 3 orders, 1 already paid, 2 pending;
2. receipt total only pending sum;
3. cash + Pix allocations exact;
4. one receipt total;
5. exactly 2 new payments, one per pending order;
6. both new payments same receipt;
7. exactly 2 movements because 2 allocations, not 2 orders;
8. movement values equal allocation values;
9. movement order_id/payment_id null;
10. no fake allocation distribution among orders;
11. already paid order untouched;
12. table tab closes;
13. conflicting changed tab => zero partial writes;
14. duplicate payment race => conflict and no receipt leakage;
15. policy race => no partial writes.

Frontend:

- dialog uses same PaymentCompositionEditor;
- totalCents = detail.totalCents authoritative display;
- onConfirm gets allocations;
- invalid composition cannot call API.

Workflow:

- owner records composition summary;
- accepted owner/result preserves receipt/movements;
- reconciliation still proves authoritative orders/movements/tab/tables;
- retry never posts again.

## GREEN

Change table endpoint/API to allocations; no { method } fallback.

Apply official effects remains orders + movements + tableTab + tables.

Do not add receipt collection to runtime.

Run focused tests plus:

~~~bash
npm test
npm run test:architecture
~~~

Commit:

feat: support split table tab payments

Require Validate SUCCESS.

## Task 3 acceptance

- One comanda receipt.
- N order payments.
- N allocations = selected forms.
- N movements = allocations, not orders.
- Reconciliation/races unchanged.
- Table Service still emits intent only.

---

# Task 4 — Migrate New Order “Salvar e receber” atomically

Purpose: Usar o mesmo modelo no checkout sem violar Orders → app boundary.

## Files

Modify:

- src/domains/orders/domain/orderCart.js
- src/domains/orders/domain/orderCart.test.js
- src/orderIdentityPayload.test.js
- src/domains/orders/ui/NewOrder.jsx
- src/domains/orders/ui/NewOrder.test.js
- src/domains/orders/ui/components/OrderCheckoutSummary.jsx
- checkout summary tests
- worker/orderCheckout.js
- worker/orderCheckout.test.js
- worker/repositories.js
- worker/multiItemCheckoutRepository.test.js
- worker/businessPolicyIntegration.test.js
- worker/orderTimingSnapshot.test.js where legacy payment fields are characterized
- worker/index.js
- src/App.jsx
- App/NewOrder wiring tests
- src/realtimeSyncRegression.test.js

Reuse PaymentCompositionEditor through injected rendering/composition, not direct import from Orders domain.

## Boundary rule

domains/orders must not import app/workflows/payments.

App-level composition passes a render contract to NewOrderRoute, conceptually:

~~~jsx
renderPaymentComposition={(props) => (
  <PaymentCompositionEditor
    {...props}
    paymentOptions={paymentOptions}
    defaultPaymentMethod={defaultPaymentMethod}
  />
)}
~~~

The exact prop name may be refined, but the direction is normative:

~~~text
app -> Orders public UI + payment workflow UI
Orders -> no app import
~~~

## Payload target

buildOrderPayload(draft, allocations):

- pending save => no paymentAllocations;
- paid save => paymentAllocations: [{ methodCode, amountCents }, ...].

Remove new production use of paymentMethod from checkout payload.

## Backend validation

validateCheckoutInput:

- optional paymentAllocations;
- uses structural validation;
- Local/table customer rejects immediate payment as today;
- total sum cannot be validated until server prices items.

createOrder:

1. resolve idempotency replay first as today;
2. load/price official products;
3. calculate official total;
4. if paid:
   - assert allocation total exact;
   - validate policy methods;
   - prepare receipt/allocation/payment/movement statements;
5. include all in same existing atomic order batch;
6. print job stays same batch;
7. replay returns original already accepted order/effects without new receipt.

## RED

Backend:

1. pending checkout unchanged;
2. paid simple allocation;
3. paid cash+Pix;
4. sum below/above official price rejects;
5. client cannot manipulate total;
6. table/local immediate payment rejects;
7. policy race leaves no order/items/payment/receipt/allocation/movement/print job;
8. idempotent replay creates exactly one receipt;
9. replay after method deactivation still returns original accepted result;
10. automatic print job count unchanged.

Frontend:

1. Salvar pedido never sends allocations;
2. Salvar e receber opens shared composition;
3. initial default + total;
4. split can be submitted;
5. invalid split blocks;
6. failure preserves review step/draft;
7. policy changed preserves/reviews data;
8. Orders code contains no import from app/workflows.

## GREEN

Route POST /api/orders returns plural movements for paid checkout when multiple allocations.

useNewOrderDraft needs no payment semantics; it continues committing server result.

Run focused tests, full tests, architecture, lint and build.

Commit:

feat: support split paid checkout

Require Validate SUCCESS.

## Task 4 acceptance

- All payment writers are now receipt-based:
  - standalone order;
  - whole comanda;
  - paid checkout.
- No Orders → app workflow import.
- Printing behavior unchanged.

---

# Task 5 — Switch official read model and migrate payment presentation/search consumers

Purpose: Tornar allocations a fonte de verdade de leitura e remover dependência visual de uma única paymentMethod.

## Files

Modify:

- worker/orderReadSql.js
- worker/repositories.js
- worker/repositories.test.js
- worker/orderCancellation.js
- cancellation/repository tests
- src/domains/finance/domain/paymentMethods.js or create focused paymentPresentation.js
- tests for public payment presentation
- src/domains/finance/index.js only for justified public helper exports
- src/domains/orders/ui/PaymentBadge.jsx
- PaymentBadge tests
- src/domains/orders/ui/components/OrderDetail.jsx
- OrderDetail tests
- src/domains/finance/ui/Receivables.jsx
- Receivables paid/search tests
- order/history search helpers wherever audit finds direct paymentMethod dependency
- src/businessPaymentOptions.test.js

## Read SQL

Avoid row multiplication.

Use correlated allocation JSON/subquery keyed by p.receipt_id, not a direct many-row join that duplicates the order.

Order mapper parses allocations safely.

Target behavior:

- paid with 1 allocation => paymentMethod compatibility projection equals allocation label;
- paid with >1 => paymentMethod null;
- paymentAllocations always structured for receipt-based rows;
- legacy backfilled payment reads exactly like simple payment plus structured allocation.

## Presentation helpers

Create cohesive functions such as:

~~~js
formatPaymentSummary(allocations)
paymentSearchText(allocations)
hasMixedPayment(allocations)
~~~

Examples:

- one: Pix;
- two compact: 2 formas;
- detail: rows with label + value;
- search text: labels/codes, never persisted concatenation.

## RED

1. mapper one allocation;
2. mapper two allocations;
3. multi => paymentMethod null;
4. legacy backfill reads structured;
5. malformed JSON fails safely without inventing payment data;
6. badge simple = Pago · Pix;
7. badge mixed = Pago · 2 formas;
8. detail lists both values + total;
9. A Receber paid meta shows mixed summary;
10. search by Dinheiro finds cash+Pix order;
11. search by Pix finds same order;
12. no UI persists/assumes Dinheiro + Pix.

## GREEN

Migrate all intended consumers.

Audit all production paymentMethod references and classify each. Do not mechanically delete legitimate settings/refund input names; remove assumptions that an order has exactly one method.

Run focused + full tests.

Commit:

refactor: read payment allocations as source of truth

Require Validate SUCCESS.

## Task 5 acceptance

- Order read model structured.
- Badge/detail/A Receber/search handle mixed.
- No synthetic persisted string.
- Historical simple display unchanged.

---

# Task 6 — Finance/Dashboard/refund correctness, hardening migration and permanent architecture gates

Purpose: Fechar todos os consumidores financeiros e impedir regressão ao contrato antigo.

## Files

Create:

- migrations/0027_split_payments_hardening.sql
- migration hardening tests
- optional focused split-payment extraction/source contract test

Modify:

- src/app/surfaces/dashboard/dashboardAnalytics.js
- src/utils/dashboardAnalytics.test.js
- src/pages/DashboardAnalytics.test.js
- src/app/surfaces/dashboard/DashboardSurface.jsx
- Dashboard tests
- src/app/workflows/refunds/RegisterRefundDialog.jsx
- src/app/workflows/refunds/RegisterRefundDialog.test.js
- src/domains/orders/ui/components/CancelOrderDialog.jsx
- cancellation integration tests
- worker/orderCancellation.js
- refund backend tests if read model context changes
- scripts/architecture/check-import-boundaries.mjs
- scripts/architecture/check-import-boundaries.test.mjs
- final architecture audit tests as necessary
- D1 migration/gate tests

## Dashboard rule

Formas de pagamento must stop using:

~~~js
order.paymentMethod + order.paidAmount/order.total
~~~

Use actual sale movements:

- type entrada;
- source order-payment;
- active movement;
- period by movement financial date;
- group by movement.paymentMethod;
- sum movement.value once.

Since table-tab split creates one movement per allocation, this naturally avoids order multiplication.

Update Dashboard copy if necessary from Pedidos pagos to wording aligned with receipts, without redesign.

## Refund rule

### Simple receipt

If exactly one allocation:

- preserve current original-method suggestion/review semantics.

### Mixed receipt

- show original receipt composition;
- no automatic refund method;
- require explicit active method;
- amount = full payment amount for that order;
- do not claim an allocation belongs to that order when receipt was whole-comanda.

Cancellation dialog with refundNow follows same rule.

Backend refund still receives one explicit refundMethod in V1.

No split refund.

## Migration hardening RED

Before 0027:

- old writer INSERT with null receipt can succeed;
- old writer payment method can be written.

After 0027 tests require rejection.

Also require order-payment movement without receipt/allocation to reject.

## Permanent source/architecture rules

Add tests/checker rules that prevent:

1. paymentApi.registerOrderPayment posting { method };
2. paymentApi.registerTableTabPayment posting { method };
3. checkout payload field paymentMethod from reappearing;
4. registerOrderPayment production owner under worker/repositories.js;
5. registerTableTabPayment production owner under worker/repositories.js;
6. new split writes to payments.method;
7. synthetic Dinheiro + Pix / Múltiplas formas storage logic;
8. Orders deep importing app/workflows/payments;
9. runtime payment bridges returning;
10. QZ imports outside allowed infrastructure.

Do not ban paymentMethod globally because:

- refund input still has one method;
- manual movement still has one paymentMethod;
- payment settings projection still uses payment terminology;
- legacy row compatibility may remain.

Rules must target obsolete split-payment owners/contracts precisely.

## RED/GREEN

Write RED checker fixtures before checker implementation.

Then implement:

- Dashboard movement mix;
- refund/cancel presentation;
- backend read consistency;
- 0027 guards;
- architecture enforcement.

Run focused tests plus:

~~~bash
npm test
npm run test:architecture
npm run lint
npm run build
npm run d1:migrate:local
node scripts/infra/spec-b-d1-gate.mjs
npx --yes wrangler@4.128.0 deploy --dry-run
npx --yes wrangler@4.128.0 deploy --dry-run --env staging
~~~

Commit:

test: harden split payment architecture

Require exact-SHA Validate SUCCESS.

## Task 6 acceptance

- Dashboard totals by method reconcile with sale movements.
- Refund mixed requires explicit method.
- All new payment writes require receipt.
- All sale movements require allocation.
- Old payment endpoint payload cannot reappear.
- No App/runtime ownership regression.
- No Printing/QZ changes.

---

# Task 7 — Full gates, staging deployment, manual homologation, documentation and merge handoff

Purpose: Provar o feature candidate inteiro antes de solicitar merge.

## Files

Create:

- docs/superpowers/qa/split-payments-qa.md

Modify as applicable:

- Issue #30 body/checklist only after actual evidence, if desired;
- this plan status/checkmarks;
- project QA/release docs only where this feature genuinely changes release truth.

Do not rewrite Spec C historical ledgers unless required by a real architecture fact.

## Step 1 — final diff audit

Run:

~~~bash
git status --short
git diff --check origin/master...HEAD
git diff --name-status origin/master...HEAD
git log --oneline origin/master..HEAD
~~~

Require:

- clean tree;
- no unrelated printing/QZ diff;
- migrations exactly 0026/0027 for this feature;
- no production secret/config changes;
- no accidental compatibility facade.

## Step 2 — source audits

Run targeted searches for:

- registerOrderPayment/registerTableTabPayment owners;
- order.paymentMethod production use;
- checkout paymentMethod legacy payload;
- synthetic mixed labels;
- qz-tray imports.

Interpret results; zero-match is not blindly required for generic legitimate tokens.

## Step 3 — full automated gates

~~~bash
npm test
npm run test:architecture
npm run lint
npm run build
npx --yes wrangler@4.128.0 deploy --dry-run
npx --yes wrangler@4.128.0 deploy --dry-run --env staging
npm run d1:migrate:local
node scripts/infra/spec-b-d1-gate.mjs
~~~

Record exact totals and statuses.

## Step 4 — Validate exact executable HEAD

Push and require Validate application SUCCESS on exact SHA.

Any failure blocks staging.

## Step 5 — Deploy exact SHA to staging

Manual Deploy staging only after Validate green.

Require:

- exact SHA checkout;
- staging migrations 0026/0027 applied successfully;
- deploy success;
- readiness;
- login smoke;
- no production.

## Step 6 — manual QA matrix

Record each PASS / FAIL / BLOCKED.

### Simple + split order

1. 100% Pix;
2. 100% Dinheiro;
3. Dinheiro + Pix;
4. three forms;
5. remove second form;
6. below total blocks;
7. above total blocks;
8. zero blocks;
9. duplicate method blocks;
10. method deactivated while modal open requires review;
11. double click does not duplicate;
12. offline disables.

### Entry points

13. Cozinha;
14. Histórico;
15. A Receber.

### Checkout

16. Salvar pedido pending;
17. Salvar e receber simple;
18. Salvar e receber mixed;
19. paid checkout automatic print job still queued according to existing rules.

### Comanda

20. one-order comanda;
21. multi-order comanda;
22. comanda with one already paid order;
23. mixed payment creates correct Finance values;
24. tab closes;
25. table becomes free;
26. reoccupied table is not cleared by old reconciliation;
27. sync retry does not POST again.

### Read/presentation/finance

28. PaymentBadge simple;
29. PaymentBadge mixed;
30. Order detail allocation breakdown;
31. A Receber paid summary;
32. search Dinheiro finds mixed;
33. search Pix finds mixed;
34. Finance shows each allocation separately;
35. total received equals receipt total once;
36. Dashboard payment mix matches Finance movements.

### Refund

37. simple original method suggestion;
38. inactive simple method review;
39. mixed receipt displays composition;
40. mixed receipt begins without invented refund method;
41. full refund can be confirmed with active selected method.

### Themes/responsive/safety

42. mobile light;
43. mobile dark;
44. desktop light;
45. desktop dark;
46. no horizontal overflow in composition editor;
47. keyboard/focus/add/remove line usable;
48. console has no new errors;
49. print queue/settings unaffected in software behavior.

Capability case without suitable restricted identity remains BLOCKED, never inferred PASS.

## Step 7 — migration verification on staging

Verify with safe evidence:

- no pending migration;
- receipts exist for staged new payments;
- allocations sum to receipt totals;
- split payment payment.method is null;
- movement sum equals receipt total;
- table-tab split movements are allocation-scoped and not duplicated per order.

Do not expose business-sensitive raw data in documentation.

## Step 8 — QA document

split-payments-qa.md includes:

- master base;
- branch;
- executable SHA;
- final docs SHA;
- Validate run;
- staging deploy run;
- migrations;
- automated totals;
- manual matrix totals;
- every BLOCKED reason;
- source audits;
- production = NO.

## Step 9 — exact final docs HEAD Validate

After QA/docs commit, Validate exact docs HEAD.

If a final status-only commit is created afterward, validate/report it without infinite self-reference.

## Step 10 — stop at explicit merge authorization

Present:

- PR;
- final HEAD;
- final Validate;
- staging run;
- migrations;
- manual QA totals;
- BLOCKED items;
- mergeability;
- production untouched.

Do not merge until explicit user authorization.

---

## 8. TDD evidence rules

For Tasks 1–6:

1. RED test must prove intended missing/wrong behavior.
2. Commit/push RED before production implementation of that boundary.
3. Remote Validate failure must correspond to intended RED when runner is available.
4. GREEN implementation follows.
5. Focused tests pass.
6. Full relevant gates pass.
7. Commit/push GREEN.
8. Exact SHA Validate success before next task.

If a RED fails because of test syntax/harness rather than missing behavior:

- fix the RED;
- preserve history with normal commits;
- do not claim the invalid RED as evidence.

---

## 9. Migration safety review

Before implementing 0026, re-audit actual current schema.

The plan assumes only movements.payment_id references payments. Confirm before SQL.

If another FK exists, adjust rebuild plan before writing migration.

Migration must preserve:

- payment IDs;
- movement IDs;
- order IDs;
- refund IDs/index;
- timestamps;
- amounts;
- historical method bytes;
- soft-delete metadata;
- finance category;
- movement dates;
- business isolation.

No destructive history rewrite.

---

## 10. Money correctness review

All mutation-side allocations use integer cents.

Frontend may display BRL strings, but conversion occurs deterministically before API payload.

Required invariants:

~~~text
for every allocation:
  amountCents is safe integer > 0

method codes unique

sum(amountCents) === authoritativeTotalCents
~~~

No epsilon/tolerance.

---

## 11. Whole-tab accounting review

Example:

Orders pending:

- A 2000
- B 3000
- C 3000

Allocations:

- cash 3000
- pix 5000

Expected DB semantic counts:

~~~text
receipts:    +1
allocations: +2
payments:    +3
movements:   +2
revenue:     +8000 cents
~~~

Never movements/revenue multiplied by order count.

This exact regression must exist.

---

## 12. Refund semantic review

For a mixed whole-tab receipt, every order payment references the same receipt.

Therefore a specific order cannot claim paymentMethod = cash or pix.

The refund UI must present:

~~~text
Recebimento original da comanda:
- Dinheiro R$30
- Pix R$50

Valor deste pedido a estornar: R$20
Forma utilizada no estorno: explicit selection
~~~

No allocation is assigned to the order.

---

## 13. Reporting readiness

This feature is a dependency of #34.

At final state:

- payment_allocations is authoritative composition;
- movements are authoritative cash effects;
- receipts link one operation;
- payments link quit orders;
- no report must infer method from order total.

Do not implement Reporting in this slice.

---

## 14. Plan self-review checklist

### Spec coverage

- [x] split ≠ partial;
- [x] one receipt / N allocations;
- [x] one payment per order;
- [x] table-tab one receipt;
- [x] no allocation-per-order fiction;
- [x] movements by allocation;
- [x] checkout included;
- [x] A Receber included;
- [x] read model included;
- [x] search included;
- [x] Dashboard included;
- [x] refund included;
- [x] migration included;
- [x] historical unknown method strategy included;
- [x] integer cents included;
- [x] policy races included;
- [x] idempotency included;
- [x] offline/capabilities included;
- [x] themes/mobile/accessibility included;
- [x] Printing non-regression included.

### Architecture review

- [x] App remains composition;
- [x] runtime remains payment-agnostic;
- [x] payment workflows remain app-owned;
- [x] Finance does not import Orders/Table Service;
- [x] Orders does not import app/workflows; checkout editor is injected;
- [x] Table Service does not own payment workflow;
- [x] backend payment logic moves out of repositories.js;
- [x] no permanent old {method} API facade.

### Migration review

- [x] 0026 allows incremental writer migration;
- [x] method becomes nullable without losing old bytes;
- [x] historical payments backfilled;
- [x] historical movements linked without duplicate revenue;
- [x] 0027 blocks reintroduction of legacy writes;
- [x] old rows with historical method remain readable;
- [x] clean install/upgrade/foreign-key gates included.

### TDD review

- [x] every behavioral task has explicit RED;
- [x] remote RED/GREEN evidence required;
- [x] focused + full gates;
- [x] final exact-SHA staging;
- [x] final exact-docs validation;
- [x] manual QA matrix;
- [x] no production.

---

## 15. Stop condition

This plan is documentation only.

After this file is committed:

- do not create implementation RED yet;
- do not create migrations yet;
- do not change source code yet;
- do not deploy staging yet;
- do not deploy production;
- wait for explicit user approval of this plan.

After approval, begin only with Execution preparation and Task 1.
