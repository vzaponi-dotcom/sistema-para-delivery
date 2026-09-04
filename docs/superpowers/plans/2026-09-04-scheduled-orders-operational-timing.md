# Scheduled Orders and Operational Timing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar pedidos agendados para Entrega/Retirada, separar automaticamente Agendados de Em preparo, liberar som/impressão na janela de 50 minutos, aplicar tolerância de 15 minutos e gerar métricas confiáveis de tempo operacional sem criar cliques extras.

**Architecture:** Persistir `scheduled_for` e `is_backdated` no pedido; `Agendado` continua derivado pelo relógio. Centralizar fuso e cálculos em `shared/orderTiming.js`. `print_jobs.available_at` controla quando o auto-print pode ser assumido. Relatórios usam timestamps oficiais, não o tempo desde cadastro em pedidos antecipados.

**Tech Stack:** React 19, Vite 8, Cloudflare Worker + D1/SQLite, Node `node:test`, oxlint, Wrangler 4.128.0.

**Spec:** `docs/superpowers/specs/2026-09-04-scheduled-orders-operational-timing-design.md`

## Global Constraints

- Branch única: `feature/scheduled-orders-operational-timing`.
- TDD estrito: RED confirmado antes de cada GREEN relevante.
- `orders.status` não ganha `Agendado`; continua `Em preparo`, `Finalizado`, `Cancelado`.
- `created_at` = cadastro real; `finished_at` = saiu para entrega/finalização operacional.
- `scheduled_for` = ISO/UTC; fuso operacional = `America/Sao_Paulo`.
- Constantes centralizadas: 50 min de antecedência e 15 min de tolerância.
- `operational_start_at = max(created_at, scheduled_for - 50 min)`.
- Agendamento apenas Entrega/Retirada, mesmo dia e horário futuro.
- Auto-print/som só quando entra na janela; manual print continua permitido.
- Cancelados, retroativos, ativos, timestamps inválidos e duração negativa ficam fora das médias.
- Produção somente após staging homologado e aprovação explícita.

---

## Task 1: Centralizar relógio operacional e fuso

**Files:**
- Create: `shared/orderTiming.js`
- Create: `shared/orderTiming.test.js`
- Modify: `src/utils/orderWorkflow.js`
- Modify: `src/utils/orderWorkflow.test.js`

**Produces:** `SCHEDULED_PREP_LEAD_MINUTES`, `SCHEDULED_LATE_GRACE_MINUTES`, `businessDateTimeToIso`, `isFutureSameDaySchedule`, `getOperationalStartAt`, `getScheduledLateAt`, `isScheduledWaiting`, `getOperationalElapsedMinutes`, `getOperationalDurationMinutes`.

- [ ] **RED:** criar `shared/orderTiming.test.js`:

```js
test('aplica janela 50 e tolerância 15', () => {
  assert.equal(SCHEDULED_PREP_LEAD_MINUTES, 50)
  assert.equal(SCHEDULED_LATE_GRACE_MINUTES, 15)
})

test('12:00 São Paulo vira 15:00Z', () => {
  assert.equal(businessDateTimeToIso('2026-09-04', '12:00'), '2026-09-04T15:00:00.000Z')
})

test('09:00 criado para 12:00 começa 11:10', () => {
  const order = { createdAt: '2026-09-04T12:00:00.000Z', scheduledFor: '2026-09-04T15:00:00.000Z' }
  assert.equal(getOperationalStartAt(order).toISOString(), '2026-09-04T14:10:00.000Z')
})

test('criado 11:45 para 12:00 começa 11:45', () => {
  const order = { createdAt: '2026-09-04T14:45:00.000Z', scheduledFor: '2026-09-04T15:00:00.000Z' }
  assert.equal(getOperationalStartAt(order).toISOString(), '2026-09-04T14:45:00.000Z')
})

test('duração negativa é inválida', () => {
  assert.equal(getOperationalDurationMinutes({ createdAt: '2026-09-04T15:00:00Z', finishedAt: '2026-09-04T14:59:00Z' }), null)
})
```

Run: `node --test shared/orderTiming.test.js` → **FAIL** por módulo inexistente.

- [ ] **GREEN:** implementar em `shared/orderTiming.js` usando `FINANCE_TIME_ZONE/getBusinessDate`; `isFutureSameDaySchedule` aceita somente Entrega/Retirada, mesmo dia e `scheduledFor > now`. `getOperationalDurationMinutes` retorna `null` se finish < start.

Core:

```js
export const SCHEDULED_PREP_LEAD_MINUTES = 50
export const SCHEDULED_LATE_GRACE_MINUTES = 15

export const getOperationalStartAt = (order) => {
  const created = validDate(order?.createdAt)
  if (!created) return null
  const scheduled = validDate(order?.scheduledFor)
  if (!scheduled) return created
  const prep = new Date(scheduled.getTime() - SCHEDULED_PREP_LEAD_MINUTES * 60_000)
  return created > prep ? created : prep
}
```

- [ ] **RED/GREEN `orderWorkflow`:** adicionar teste em `src/utils/orderWorkflow.test.js` confirmando 12:15 ainda `on-time`, 12:15:01 `late`, e contador começando em 11:10. Alterar `getElapsedMinutes` para delegar a `getOperationalElapsedMinutes`; pedidos Agora preservam faixas atuais 30/40.

Run: `node --test shared/orderTiming.test.js src/utils/orderWorkflow.test.js` → **PASS**.

- [ ] Commit: `git commit -m "feat: centralize scheduled order timing rules"`.

---

## Task 2: Criar migration D1

**Files:**
- Create: `migrations/0011_scheduled_orders_operational_timing.sql`
- Create: `worker/orderSchedulingMigration.test.js`

- [ ] **RED:** teste exige `orders.scheduled_for`, `orders.is_backdated`, `print_jobs.available_at`, backfill de `available_at`, e marcação do padrão legado `created_at = order_date || 'T15:00:00.000Z' AND finished_at = created_at`.

Run: `node --test worker/orderSchedulingMigration.test.js` → **FAIL**.

- [ ] **GREEN:** migration:

```sql
ALTER TABLE orders ADD COLUMN scheduled_for TEXT;
ALTER TABLE orders ADD COLUMN is_backdated INTEGER NOT NULL DEFAULT 0 CHECK (is_backdated IN (0,1));
UPDATE orders SET is_backdated = 1
WHERE status = 'Finalizado'
  AND finished_at = created_at
  AND created_at = order_date || 'T15:00:00.000Z';
ALTER TABLE print_jobs ADD COLUMN available_at TEXT;
UPDATE print_jobs SET available_at = created_at WHERE available_at IS NULL;
CREATE INDEX orders_business_schedule_idx ON orders (business_id, scheduled_for);
CREATE INDEX print_jobs_available_idx ON print_jobs (business_id, status, trigger, available_at);
```

Run: `node --test worker/orderSchedulingMigration.test.js && npm run d1:migrate:local` → **PASS**.

- [ ] Commit: `git commit -m "feat: add scheduled order timing schema"`.

---

## Task 3: Validar `scheduledFor` no checkout oficial

**Files:**
- Modify: `worker/orderCheckout.js`
- Modify: `worker/orderCheckout.test.js`

- [ ] **RED:** testar `validateCheckoutInput(body, key, now)` com futuro válido, Local inválido, `scheduledFor <= now` inválido e `orderDate` retroativo inválido.

```js
const now = new Date('2026-09-04T13:00:00Z')
const result = validateCheckoutInput({ ...base, scheduledFor: '2026-09-04T15:00:00Z' }, 'k', now)
assert.equal(result.scheduledFor, '2026-09-04T15:00:00.000Z')
```

Run: `node --test worker/orderCheckout.test.js` → **FAIL**.

- [ ] **GREEN:** assinatura passa a `validateCheckoutInput(body = {}, idempotencyKey, now = new Date())`; validar timestamp, tipo, `getBusinessDate`, mesmo dia e futuro; retornar `scheduledFor: ISO|null`.

Run: `node --test worker/orderCheckout.test.js worker/orderCustomerIdentityCheckout.test.js` → **PASS**.

- [ ] Commit: `git commit -m "feat: validate same-day scheduled checkout"`.

---

## Task 4: Tornar impressão automática consciente de `available_at`

**Files:**
- Modify: `worker/orderPrintingRepository.js`
- Modify: `worker/orderPrintingRepository.test.js`
- Modify: `worker/orderPrintingHttp.test.js`
- Modify: `worker/orderCancellation.js`
- Modify: `worker/orderCancellation.test.js`
- Modify: `worker/orderAutomaticPrintJob.test.js`

**Contract:** `mapJobRow` expõe `availableAt`; auto job recebe `availableAt`; manual/test usam `available_at = created_at`.

- [ ] **RED:** job criado 3h atrás mas `availableAt` 5 min atrás continua pending; job futuro não pode ser claimado; ao chegar `availableAt`, claim funciona.

Run: `node --test worker/orderPrintingRepository.test.js` → **FAIL**.

- [ ] **GREEN:** `agePrintJobs` usa `available_at`; `claimNextAutomaticPrintJob` exige `available_at <= now` e `orders.status <> 'Cancelado'`, ordenando `available_at ASC`. `claimPrintJob` também bloqueia auto job futuro/cancelado. HTTP list/create deve retornar `availableAt`.

- [ ] **RED cancelamento:** auto pending + manual pending; após cancelar, auto = inexistente, manual permanece; auto já `printed` permanece.

- [ ] **GREEN cancelamento:** executar atômico:

```js
const deletePendingAutomaticPrint = db.prepare(`DELETE FROM print_jobs
 WHERE business_id = ? AND order_id = ?
 AND trigger = 'automatic' AND status = 'pending'`)
```

Sem estorno: `db.batch([update, deletePendingAutomaticPrint])`; com estorno: incluir `refund.statement`.

Run: `node --test worker/orderPrintingRepository.test.js worker/orderPrintingHttp.test.js worker/orderCancellation.test.js worker/orderAutomaticPrintJob.test.js` → **PASS**.

- [ ] Commit: `git commit -m "feat: schedule automatic print availability"`.

---

## Task 5: Persistir e ler metadata do agendamento

**Files:**
- Modify: `worker/repositories.js`
- Modify: `worker/orderReadSql.js`
- Modify: `worker/orderReadRepository.test.js`
- Create: `worker/orderSchedulingRepository.test.js`
- Modify: `worker/multiItemCheckoutRepository.test.js`

- [ ] **RED:** criar pedido 09:00 para 12:00; esperar `scheduledFor`, `isBackdated=false`, auto job `availableAt=11:10`. Criar histórico; esperar `isBackdated=true`, `scheduledFor=null`, sem auto job.

Run: `node --test worker/orderSchedulingRepository.test.js worker/orderReadRepository.test.js` → **FAIL**.

- [ ] **GREEN:** mapear:

```js
scheduledFor: row.scheduled_for ?? null,
isBackdated: Boolean(row.is_backdated),
```

Adicionar colunas aos SELECTs de `repositories.js` e `orderReadSql.js`, e ao INSERT. Para auto-print:

```js
const availableAt = getOperationalStartAt({ createdAt, scheduledFor })?.toISOString() || createdAt
prepareAutomaticPrintJobStatement(db, businessId, { orderId, copies, document, createdAt, availableAt })
```

Run: `node --test worker/orderSchedulingRepository.test.js worker/orderReadRepository.test.js worker/multiItemCheckoutRepository.test.js worker/orderRepositories.test.js worker/repositories.test.js` → **PASS**.

- [ ] Commit: `git commit -m "feat: persist scheduled order metadata"`.

---

## Task 6: Adicionar “Agora / Agendado” na Nova venda

**Files:**
- Modify: `src/pages/NewOrder.jsx`
- Modify: `src/pages/NewOrder.test.js`
- Modify: `src/pages/NewOrderWizard.test.js`
- Modify: `src/pages/NewOrderMobile.test.js`
- Modify: `src/components/NewOrderCustomerStep.jsx`
- Modify: `src/utils/orderCart.js`
- Modify: `src/utils/orderCart.test.js`
- Modify: `src/utils/newOrderStepFlow.js`
- Modify: `src/utils/newOrderStepFlow.test.js`
- Modify: `src/new-order.css`

- [ ] **RED payload:** `buildOrderPayload` inclui `scheduledFor` somente quando não-null.
- [ ] **RED step/dirty:** `scheduleValid=false` bloqueia Produtos; mudar modo/hora marca dirty.
- [ ] **RED UI:** source deve conter `Quando preparar?`, `Agora`, `Agendado`, `Horário desejado pelo cliente`, helper aprovado e `type="time"`.

Run: `node --test src/utils/orderCart.test.js src/utils/newOrderStepFlow.test.js src/pages/NewOrder.test.js src/pages/NewOrderWizard.test.js` → **FAIL**.

- [ ] **GREEN:** estado local:

```js
const [scheduleMode, setScheduleMode] = useState('now')
const [scheduledTime, setScheduledTime] = useState('')
const todayValue = getBusinessDate()
const scheduledFor = scheduleMode === 'scheduled'
  ? businessDateTimeToIso(orderDate, scheduledTime)
  : null
const scheduleValid = scheduleMode === 'now'
  || isFutureSameDaySchedule({ type, orderDate, scheduledFor, now: new Date() })
```

`Local` ou data histórica resetam modo para `now` e hora vazia. `NewOrderCustomerStep` só mostra seletor para Entrega/Retirada de hoje. `Agora` default. Usar `aria-pressed` e touch target ≥44px.

CSS mínimo:

```css
.new-order-schedule-options { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
.new-order-schedule-option { min-height:var(--mobile-touch-target,44px); }
```

Run: `node --test src/utils/orderCart.test.js src/utils/newOrderStepFlow.test.js src/pages/NewOrder.test.js src/pages/NewOrderWizard.test.js src/pages/NewOrderMobile.test.js` → **PASS**.

- [ ] Commit: `git commit -m "feat: add same-day order scheduling controls"`.

---

## Task 7: Fazer som/destaque seguir entrada operacional

**Files:**
- Modify: `src/utils/orderRealtime.js`
- Create: `src/utils/orderRealtime.test.js`
- Modify: `src/App.jsx`
- Modify: `src/kitchenLiveRefresh.test.js`
- Modify: `src/realtimeSyncRegression.test.js`

- [ ] **RED:** fora da janela não pertence a `operationalOrderIdSet`; ao cruzar 11:10 aparece uma vez em `getNewOperationalOrderIds`.

```js
const before = operationalOrderIdSet([order], new Date('2026-09-04T14:09:00Z'))
assert.deepEqual(getNewOperationalOrderIds(before, [order], new Date('2026-09-04T14:10:00Z')), ['scheduled-1'])
```

Run: `node --test src/utils/orderRealtime.test.js` → **FAIL**.

- [ ] **GREEN:** usar `isOrderActive` + `isScheduledWaiting`. Em `App.jsx`, trocar `knownActiveOrderIdsRef` por `knownOperationalOrderIdsRef`; inicializar ao abrir a aba com os IDs já operacionais para não tocar alertas históricos. Polling compara set anterior com set operacional atual e preserva mecanismo de áudio/highlight.

Run: `node --test src/utils/orderRealtime.test.js src/kitchenLiveRefresh.test.js src/realtimeSyncRegression.test.js` → **PASS**.

- [ ] Commit: `git commit -m "feat: alert when scheduled orders enter preparation"`.

---

## Task 8: Separar Agendados e Em preparo na cozinha

**Files:**
- Modify: `src/pages/Orders.jsx`
- Create: `src/pages/OrdersScheduled.test.js`
- Modify: `src/order-operations.css`
- Modify: `src/order-operations-compact.css`
- Modify: `src/orderTimerRefresh.test.js`
- Modify: `src/pages/OrdersMobile.test.js`

- [ ] **RED:** exigir `scheduledOrders`, `preparingOrders`, “Agendados”, “Desejado”, `isScheduledWaiting`, `getOperationalStartAt`.

Run: `node --test src/pages/OrdersScheduled.test.js src/orderTimerRefresh.test.js` → **FAIL**.

- [ ] **GREEN:** derivar listas:

```js
const scheduledOrders = active.filter((o) => isScheduledWaiting(o, now))
  .sort((a,b) => new Date(a.scheduledFor) - new Date(b.scheduledFor))
const preparingOrders = active.filter((o) => !isScheduledWaiting(o, now))
  .sort((a,b) => getOperationalStartAt(a) - getOperationalStartAt(b))
```

Stats: Em preparo, Agendados, Com atraso, Finalizados hoje. Scheduled waiting não mostra contador de preparo e não oferece Finalizar/Saiu para entrega; mantém detalhes/cancelar. Dentro da janela, card mostra `Desejado HH:mm`.

Responsivo: 4 stats sem overflow; touch ≥44px; bloco Agendados não fica sob nav inferior.

Run: `node --test src/pages/OrdersScheduled.test.js src/orderTimerRefresh.test.js src/pages/OrdersMobile.test.js src/pages/OrdersMultiItem.test.js src/operationsUxRound.test.js` → **PASS**.

- [ ] Commit: `git commit -m "feat: split scheduled and preparing kitchen queues"`.

---

## Task 9: Mostrar timing e impressão programada nos detalhes

**Files:**
- Modify: `src/components/OrderDetail.jsx`
- Create: `src/components/OrderDetailTiming.test.js`
- Modify: `src/pages/OrderHistory.test.js`
- Modify: `src/printing/printingUi.test.js`

- [ ] **RED:** exigir “Horário desejado”, “Início operacional”, “Tempo até sair para entrega”, “Tempo até finalização”, “Impressão programada para”, `availableAt`, “Imprimir agora”.

Run: `node --test src/components/OrderDetailTiming.test.js src/printing/printingUi.test.js` → **FAIL**.

- [ ] **GREEN:** usar `getOperationalStartAt/getOperationalDurationMinutes`. Se auto job está pending e `availableAt > now`, mostrar programação e botão manual “Imprimir agora” chamando `printing.printOrder(order.id, defaultCopies)`; não claimar o auto job futuro.

Run: `node --test src/components/OrderDetailTiming.test.js src/pages/OrderHistory.test.js src/printing/printingUi.test.js` → **PASS**.

- [ ] Commit: `git commit -m "feat: show scheduled timing in order details"`.

---

## Task 10: Adicionar métricas de tempo operacional ao Dashboard

**Files:**
- Modify: `src/utils/dashboardAnalytics.js`
- Modify: `src/utils/dashboardAnalytics.test.js`
- Modify: `src/pages/Dashboard.jsx`
- Modify: `src/pages/DashboardAnalytics.test.js`
- Modify: `src/dashboard.css`
- Modify: `src/dashboardResponsive.test.js`

**Produces:** `calculateOperationalMetrics` com sampleSize, média, mais rápido, mais demorado, faixas ≤20/21–30/31–40/>40 e média por Entrega/Retirada/Local.

- [ ] **RED analytics:** fixtures imediato 20 min + agendado 45 min + cancelado + backdated + ativo. Esperar sample=2, avg=32.5, min=20, max=45, bandas `[1,0,0,1]`.

Run: `node --test src/utils/dashboardAnalytics.test.js` → **FAIL**.

- [ ] **GREEN analytics:** filtrar período existente, `status === 'Finalizado'`, `!isBackdated`, duração finita via `getOperationalDurationMinutes`.

- [ ] **RED/GREEN UI:** exigir “Tempo operacional”, “Tempo médio”, “Mais rápido”, “Mais demorado”, “Por faixa de tempo”, “Por tipo de atendimento”. Reusar `DashboardBarChart`. Formatter:

```js
const formatOperationalMinutes = (value) => Number.isFinite(value)
  ? `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} min`
  : '—'
```

Sem amostra: “Sem pedidos concluídos elegíveis neste período”. Atualizar helper de `Pedidos ativos` para “Em preparo e agendados”.

Run: `node --test src/utils/dashboardAnalytics.test.js src/pages/DashboardAnalytics.test.js src/dashboardResponsive.test.js src/dashboardCharts.test.js` → **PASS**.

- [ ] Commit: `git commit -m "feat: report operational preparation timing"`.

---

## Task 11: Validação integrada, Draft PR e staging

**Files:** No planned source changes. Se houver falha, voltar à tarefa que introduziu o comportamento, executar novo ciclo RED/GREEN e então retornar aqui.

**Acceptance:**
- Agora: Em preparo + som/auto-print imediato.
- Agendado 12:00 criado 09:00: Agendados até 11:10; sem som/auto-print.
- Agendado 12:00 criado 11:45: Em preparo imediato; som/auto-print.
- Exatamente 12:15 ainda no prazo; depois disso Atrasado.
- Cancelado antes da janela nunca auto-imprime.
- Manual print antes da janela funciona.
- Backdated fica fora das métricas.

- [ ] Run `npm test` → PASS.
- [ ] Run `npm run lint` → 0 errors.
- [ ] Run `npm run build` → PASS.
- [ ] Run `npx --yes wrangler@4.128.0 deploy --dry-run` → PASS.
- [ ] Run `npx --yes wrangler@4.128.0 deploy --dry-run --env staging` → PASS.
- [ ] Run `npm run d1:migrate:local` → PASS.
- [ ] Revisar diff: migration aditiva; sem `DELETE FROM orders`; único delete novo é auto print pending cancelado; sem cron; sem credenciais; 50/15 centralizados.
- [ ] Criar Draft PR `Draft: pedidos agendados e tempo operacional` para `master`.
- [ ] Aguardar workflow `Validate application` totalmente verde.
- [ ] Disparar workflow oficial `Deploy staging` para o commit aprovado.
- [ ] Homologar: Agora; agendado fora/dentro da janela; ordenação; transição automática; som uma vez; auto-print na janela; cancelamento antes da janela; manual print; detalhes; Dashboard Hoje/7d/30d; mobile.
- [ ] **Parar após staging e pedir aprovação explícita para produção.**

## Final Review Checklist

- [ ] Sem placeholders/ambiguidades.
- [ ] `scheduledFor` ↔ `scheduled_for` em create/read/bootstrap/list.
- [ ] `isBackdated` ↔ `is_backdated` com backfill restrito ao legado artificial.
- [ ] `availableAt` ↔ `available_at` em create/map/list/claim/aging.
- [ ] Manual/test print usam `available_at = created_at`.
- [ ] Auto claim direto e claim-next bloqueiam future/cancelled.
- [ ] Local nunca carrega scheduling oculto.
- [ ] Pedido dentro da janela usa `createdAt`.
- [ ] 12:15 exato ainda é no prazo; somente depois fica late.
- [ ] Som usa entrada operacional, não criação do registro.
- [ ] Cancelamento não apaga manual/histórico processado.
- [ ] Métricas excluem Cancelado/backdated/ativo/inválido/negativo.
- [ ] Entrega usa “Tempo até sair para entrega”, nunca “tempo de entrega”.
- [ ] Dashboard não chama todo ativo de “na fila de preparo”.
- [ ] Testes, lint, build, dry-runs, migration e staging verdes antes de produção.
