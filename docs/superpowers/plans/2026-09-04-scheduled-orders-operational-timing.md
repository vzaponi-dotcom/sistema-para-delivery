# Scheduled Orders and Operational Timing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar pedidos agendados para Entrega/Retirada, separar automaticamente Agendados de Em preparo, liberar som/impressão na janela de 50 minutos, aplicar tolerância de 15 minutos e exibir métricas confiáveis de tempo operacional sem aumentar os cliques da operação.

**Architecture:** Persistir somente `scheduled_for` e `is_backdated` no pedido; `Agendado` continua sendo um estado operacional derivado do relógio. Centralizar fuso, janela de 50 minutos, tolerância de 15 minutos e cálculos de relógio em `shared/orderTiming.js`, compartilhado por frontend e Worker. A fila de impressão ganha `available_at`, permitindo criar o snapshot oficial no checkout sem tornar o job elegível antes da janela. Métricas são calculadas no frontend a partir dos timestamps oficiais persistidos.

**Tech Stack:** React 19, Vite 8, Cloudflare Worker + D1/SQLite, Node `node:test`, oxlint, Wrangler 4.128.0.

**Spec:** `docs/superpowers/specs/2026-09-04-scheduled-orders-operational-timing-design.md`

## Global Constraints

- Trabalhar somente na branch `feature/scheduled-orders-operational-timing`.
- TDD estrito: para cada comportamento relevante, criar/alterar o teste, executar e confirmar RED antes da implementação GREEN.
- Depois de cada tarefa GREEN, revisar diff e regressões antes do commit.
- Não criar novo status persistido `Agendado`; o `orders.status` continua `Em preparo`, `Finalizado` ou `Cancelado`.
- `created_at` continua sendo a hora real de cadastro; não deve ser reinterpretado como início de preparo em pedido agendado.
- `finished_at` mantém a semântica atual: Entrega = “Saiu para entrega”; Retirada/Local = finalização operacional.
- `scheduled_for` usa ISO/UTC e a validação de dia/hora usa `America/Sao_Paulo`.
- Janela de preparo: `50` minutos. Tolerância de atraso: `15` minutos. Esses valores aparecem somente no módulo central de timing.
- Agendamento permitido apenas para `Entrega` e `Retirada`, somente no mesmo dia operacional, nunca em lançamento retroativo e nunca para horário já passado.
- Pedido criado dentro da janela começa operacionalmente no próprio `created_at`: `operational_start_at = max(created_at, scheduled_for - 50 min)`.
- Pedido agendado fora da janela não toca som, não entra em “Em preparo” e não libera impressão automática.
- Impressão manual continua disponível antes da janela; somente o job automático respeita `available_at`.
- Cancelamento remove somente job **automático pending**; histórico de impressão já processado e jobs manuais são preservados.
- Pedidos cancelados, retroativos, ativos ou com timestamps inválidos não entram nas médias finais de tempo operacional.
- Nenhuma publicação em produção antes de homologação explícita do usuário em staging.

---

## Task 1: Centralizar o relógio operacional e o fuso do negócio

**Files:**
- Create: `shared/orderTiming.js`
- Create: `shared/orderTiming.test.js`
- Modify: `src/utils/orderWorkflow.js`
- Modify: `src/utils/orderWorkflow.test.js`

**Interfaces**

Consumes:
- `FINANCE_TIME_ZONE` e `getBusinessDate` de `shared/finance.js`.
- Pedidos com `createdAt`, `scheduledFor`, `finishedAt`.

Produces:
- `SCHEDULED_PREP_LEAD_MINUTES = 50`
- `SCHEDULED_LATE_GRACE_MINUTES = 15`
- `getBusinessTimeValue(date)`
- `businessDateTimeToIso(dateValue, timeValue)`
- `getOperationalStartAt(order)`
- `getScheduledLateAt(order)`
- `isScheduledWaiting(order, now)`
- `getOperationalElapsedMinutes(order, now)`
- `getOperationalDurationMinutes(order)`
- `orderWorkflow` passa a usar esses helpers para contagem e atraso.

- [ ] **Step 1: Escrever os testes RED do módulo compartilhado**

Criar `shared/orderTiming.test.js` com casos determinísticos:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SCHEDULED_LATE_GRACE_MINUTES,
  SCHEDULED_PREP_LEAD_MINUTES,
  businessDateTimeToIso,
  getOperationalDurationMinutes,
  getOperationalStartAt,
  getOperationalElapsedMinutes,
  getScheduledLateAt,
  isScheduledWaiting,
} from './orderTiming.js'

test('centraliza janela de 50 min e tolerância de 15 min', () => {
  assert.equal(SCHEDULED_PREP_LEAD_MINUTES, 50)
  assert.equal(SCHEDULED_LATE_GRACE_MINUTES, 15)
})

test('converte data e hora do negócio para ISO UTC sem depender do fuso do navegador', () => {
  assert.equal(
    businessDateTimeToIso('2026-09-04', '12:00'),
    '2026-09-04T15:00:00.000Z',
  )
})

test('pedido antecipado começa 50 min antes do horário desejado', () => {
  const order = {
    createdAt: '2026-09-04T12:00:00.000Z', // 09:00 BRT
    scheduledFor: '2026-09-04T15:00:00.000Z', // 12:00 BRT
  }
  assert.equal(getOperationalStartAt(order)?.toISOString(), '2026-09-04T14:10:00.000Z')
  assert.equal(isScheduledWaiting(order, new Date('2026-09-04T14:09:59.000Z')), true)
  assert.equal(isScheduledWaiting(order, new Date('2026-09-04T14:10:00.000Z')), false)
})

test('pedido criado dentro da janela começa no próprio createdAt', () => {
  const order = {
    createdAt: '2026-09-04T14:45:00.000Z', // 11:45 BRT
    scheduledFor: '2026-09-04T15:00:00.000Z',
  }
  assert.equal(getOperationalStartAt(order)?.toISOString(), '2026-09-04T14:45:00.000Z')
  assert.equal(getOperationalElapsedMinutes(order, new Date('2026-09-04T14:55:00.000Z')), 10)
})

test('atraso do agendado começa 15 min depois do desejado', () => {
  const order = { scheduledFor: '2026-09-04T15:00:00.000Z' }
  assert.equal(getScheduledLateAt(order)?.toISOString(), '2026-09-04T15:15:00.000Z')
})

test('duração concluída usa o início operacional e nunca fica negativa', () => {
  const order = {
    createdAt: '2026-09-04T12:00:00.000Z',
    scheduledFor: '2026-09-04T15:00:00.000Z',
    finishedAt: '2026-09-04T14:55:00.000Z',
  }
  assert.equal(getOperationalDurationMinutes(order), 45)
})
```

- [ ] **Step 2: Executar e confirmar RED**

Run:

```bash
node --test shared/orderTiming.test.js
```

Expected: FAIL porque `shared/orderTiming.js` ainda não existe.

- [ ] **Step 3: Implementar o mínimo em `shared/orderTiming.js`**

Usar uma única origem para as regras:

```js
import { FINANCE_TIME_ZONE, getBusinessDate } from './finance.js'

export const SCHEDULED_PREP_LEAD_MINUTES = 50
export const SCHEDULED_LATE_GRACE_MINUTES = 15
const MINUTE_MS = 60_000

const parseDate = (value) => {
  const date = value instanceof Date ? new Date(value) : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const zonedParts = (date) => Object.fromEntries(
  new Intl.DateTimeFormat('en-US', {
    timeZone: FINANCE_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map((part) => [part.type, part.value]),
)

const zoneOffsetMs = (date) => {
  const parts = zonedParts(date)
  const wallClockAsUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second),
  )
  return wallClockAsUtc - date.getTime()
}

export const getBusinessTimeValue = (date = new Date()) => {
  const parts = zonedParts(parseDate(date) || new Date())
  return `${parts.hour}:${parts.minute}`
}

export const businessDateTimeToIso = (dateValue, timeValue) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateValue || ''))) return null
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(timeValue || ''))) return null
  const [year, month, day] = dateValue.split('-').map(Number)
  const [hour, minute] = timeValue.split(':').map(Number)
  const targetWallClock = Date.UTC(year, month - 1, day, hour, minute, 0)
  let instant = new Date(targetWallClock)
  for (let attempt = 0; attempt < 2; attempt += 1) {
    instant = new Date(targetWallClock - zoneOffsetMs(instant))
  }
  if (getBusinessDate(instant) !== dateValue || getBusinessTimeValue(instant) !== timeValue) return null
  return instant.toISOString()
}

export const getOperationalStartAt = (order = {}) => {
  const createdAt = parseDate(order.createdAt)
  if (!createdAt) return null
  const scheduledFor = parseDate(order.scheduledFor)
  if (!scheduledFor) return createdAt
  const prepAt = new Date(scheduledFor.getTime() - SCHEDULED_PREP_LEAD_MINUTES * MINUTE_MS)
  return createdAt.getTime() > prepAt.getTime() ? createdAt : prepAt
}

export const getScheduledLateAt = (order = {}) => {
  const scheduledFor = parseDate(order.scheduledFor)
  return scheduledFor
    ? new Date(scheduledFor.getTime() + SCHEDULED_LATE_GRACE_MINUTES * MINUTE_MS)
    : null
}

export const isScheduledWaiting = (order = {}, now = new Date()) => {
  if (!parseDate(order.scheduledFor)) return false
  const operationalStart = getOperationalStartAt(order)
  const reference = parseDate(now)
  return Boolean(operationalStart && reference && reference < operationalStart)
}

export const getOperationalElapsedMinutes = (order = {}, now = new Date()) => {
  const start = getOperationalStartAt(order)
  const reference = parseDate(now)
  if (!start || !reference) return 0
  return Math.max(0, Math.floor((reference.getTime() - start.getTime()) / MINUTE_MS))
}

export const getOperationalDurationMinutes = (order = {}) => {
  const start = getOperationalStartAt(order)
  const finish = parseDate(order.finishedAt)
  if (!start || !finish) return null
  return Math.max(0, Math.floor((finish.getTime() - start.getTime()) / MINUTE_MS))
}
```

- [ ] **Step 4: Adaptar `orderWorkflow` com RED específico para atraso agendado**

Adicionar a `src/utils/orderWorkflow.test.js`:

```js
test('agendado fora da janela não é atrasado e usa tolerância de 15 min após o desejado', () => {
  const order = {
    createdAt: '2026-09-04T12:00:00.000Z',
    scheduledFor: '2026-09-04T15:00:00.000Z',
  }
  assert.equal(getOrderTimingState(order, new Date('2026-09-04T14:00:00.000Z')), 'on-time')
  assert.equal(getOrderTimingState(order, new Date('2026-09-04T15:15:00.000Z')), 'on-time')
  assert.equal(getOrderTimingState(order, new Date('2026-09-04T15:15:01.000Z')), 'late')
  assert.equal(getElapsedMinutes(order, new Date('2026-09-04T14:20:00.000Z')), 10)
})
```

Run:

```bash
node --test src/utils/orderWorkflow.test.js
```

Expected: FAIL porque o fluxo atual usa `createdAt` para tudo.

Depois alterar `src/utils/orderWorkflow.js` para importar `getOperationalElapsedMinutes` e `getScheduledLateAt`; `getElapsedMinutes` vira alias compatível para o relógio operacional. Para pedido com `scheduledFor`, `getOrderTimingState` retorna somente `on-time` ou `late`; para pedido Agora preserva exatamente 30/40 minutos.

- [ ] **Step 5: Executar GREEN**

```bash
node --test shared/orderTiming.test.js src/utils/orderWorkflow.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add shared/orderTiming.js shared/orderTiming.test.js src/utils/orderWorkflow.js src/utils/orderWorkflow.test.js
git commit -m "feat: centralize scheduled order timing rules"
```

---

## Task 2: Criar migration para agendamento, retroatividade e disponibilidade de impressão

**Files:**
- Create: `migrations/0011_scheduled_orders_operational_timing.sql`
- Create: `worker/orderSchedulingMigration.test.js`

**Interfaces**

Produces no D1:
- `orders.scheduled_for TEXT NULL`
- `orders.is_backdated INTEGER NOT NULL DEFAULT 0`
- `print_jobs.available_at TEXT`
- Backfill de `available_at = created_at`.
- Backfill seguro de `is_backdated` apenas para o padrão histórico artificial existente.

- [ ] **Step 1: Escrever teste RED da migration**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sql = readFileSync(new URL('../migrations/0011_scheduled_orders_operational_timing.sql', import.meta.url), 'utf8')

test('migration adiciona scheduling, marca backdated e agenda disponibilidade de impressão', () => {
  assert.match(sql, /ALTER TABLE orders ADD COLUMN scheduled_for TEXT/i)
  assert.match(sql, /ALTER TABLE orders ADD COLUMN is_backdated INTEGER NOT NULL DEFAULT 0/i)
  assert.match(sql, /ALTER TABLE print_jobs ADD COLUMN available_at TEXT/i)
  assert.match(sql, /UPDATE print_jobs SET available_at = created_at/i)
  assert.match(sql, /created_at = order_date \|\| 'T15:00:00\.000Z'/i)
  assert.match(sql, /finished_at = created_at/i)
})
```

- [ ] **Step 2: Confirmar RED**

```bash
node --test worker/orderSchedulingMigration.test.js
```

Expected: FAIL por arquivo de migration inexistente.

- [ ] **Step 3: Implementar migration mínima**

`migrations/0011_scheduled_orders_operational_timing.sql`:

```sql
PRAGMA foreign_keys = ON;

ALTER TABLE orders ADD COLUMN scheduled_for TEXT;
ALTER TABLE orders ADD COLUMN is_backdated INTEGER NOT NULL DEFAULT 0 CHECK (is_backdated IN (0, 1));

UPDATE orders
SET is_backdated = 1
WHERE status = 'Finalizado'
  AND finished_at = created_at
  AND created_at = order_date || 'T15:00:00.000Z';

ALTER TABLE print_jobs ADD COLUMN available_at TEXT;
UPDATE print_jobs SET available_at = created_at WHERE available_at IS NULL;

CREATE INDEX orders_business_schedule_idx
  ON orders (business_id, scheduled_for);

CREATE INDEX print_jobs_available_idx
  ON print_jobs (business_id, status, trigger, available_at);
```

- [ ] **Step 4: Executar migration local e teste**

```bash
node --test worker/orderSchedulingMigration.test.js
npm run d1:migrate:local
```

Expected: ambos PASS.

- [ ] **Step 5: Commit**

```bash
git add migrations/0011_scheduled_orders_operational_timing.sql worker/orderSchedulingMigration.test.js
git commit -m "feat: add scheduled order timing schema"
```

---

## Task 3: Validar oficialmente `scheduledFor` no checkout do Worker

**Files:**
- Modify: `worker/orderCheckout.js`
- Modify: `worker/orderCheckout.test.js`
- Modify: `worker/index.js`
- Modify: `worker/orderRoutes.test.js`

**Interfaces**

Consumes API JSON:
- `scheduledFor?: string | null`.

Produces checkout normalizado:
- `scheduledFor: ISO string | null`.

Rejeita:
- timestamp inválido;
- `Local` agendado;
- horário `<= now`;
- dia de `scheduledFor` diferente do dia operacional atual;
- `orderDate` diferente do dia atual quando existe agendamento.

- [ ] **Step 1: Escrever RED de domínio**

Adicionar a `worker/orderCheckout.test.js`:

```js
const scheduledNow = new Date('2026-09-04T13:00:00.000Z') // 10:00 BRT
const scheduledBase = {
  type: 'Entrega',
  orderDate: '2026-09-04',
  customerIdentity: { type: 'registered_client', clientId: 'c1' },
  items: [{ productId: 'p1', quantity: 1, note: '' }],
  deliveryFee: 0,
  adjustment: { type: 'none' },
}

test('aceita agendamento futuro no mesmo dia operacional', () => {
  const input = validateCheckoutInput(
    { ...scheduledBase, scheduledFor: '2026-09-04T15:00:00.000Z' },
    'schedule-ok',
    scheduledNow,
  )
  assert.equal(input.scheduledFor, '2026-09-04T15:00:00.000Z')
})

test('rejeita Local, horário passado e lançamento retroativo agendados', () => {
  assert.throws(
    () => validateCheckoutInput({ ...scheduledBase, type: 'Local', scheduledFor: '2026-09-04T15:00:00.000Z' }, 'local', scheduledNow),
    (error) => error.field === 'scheduledFor',
  )
  assert.throws(
    () => validateCheckoutInput({ ...scheduledBase, scheduledFor: '2026-09-04T12:59:00.000Z' }, 'past', scheduledNow),
    (error) => error.field === 'scheduledFor',
  )
  assert.throws(
    () => validateCheckoutInput({ ...scheduledBase, orderDate: '2026-09-03', scheduledFor: '2026-09-04T15:00:00.000Z' }, 'backdated', scheduledNow),
    (error) => error.field === 'scheduledFor',
  )
})
```

- [ ] **Step 2: Confirmar RED**

```bash
node --test worker/orderCheckout.test.js
```

Expected: FAIL porque `validateCheckoutInput` ainda ignora `scheduledFor` e não recebe `now`.

- [ ] **Step 3: Implementar validação mínima**

Alterar assinatura para:

```js
export const validateCheckoutInput = (body = {}, idempotencyKey, now = new Date()) => {
```

Adicionar helper local:

```js
import { getBusinessDate } from '../shared/finance.js'

const validateScheduledFor = (value, type, orderDate, now) => {
  if (value === undefined || value === null || value === '') return null
  if (type === 'Local') throw checkoutError('scheduledFor', 'Consumo no local não pode ser agendado nesta versão.')
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) throw checkoutError('scheduledFor', 'Horário agendado inválido.')
  const today = getBusinessDate(now)
  if (orderDate !== today || getBusinessDate(parsed) !== today) {
    throw checkoutError('scheduledFor', 'O agendamento deve ser para hoje.')
  }
  if (parsed.getTime() <= now.getTime()) {
    throw checkoutError('scheduledFor', 'Escolha um horário futuro para o pedido agendado.')
  }
  return parsed.toISOString()
}
```

Incluir `scheduledFor` no retorno do checkout normalizado.

- [ ] **Step 4: Contrato HTTP RED/GREEN**

Em `worker/orderRoutes.test.js`, adicionar um POST com `scheduledFor` válido e confirmar que o valor chega ao repositório/retorno sem ser removido. Ajustar `worker/index.js` apenas se necessário para permitir injeção de `now` nos testes; em runtime a assinatura default continua usando `new Date()`.

Run:

```bash
node --test worker/orderCheckout.test.js worker/orderRoutes.test.js
```

Expected final: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/orderCheckout.js worker/orderCheckout.test.js worker/index.js worker/orderRoutes.test.js
git commit -m "feat: validate same-day scheduled checkout"
```

---

## Task 4: Tornar a fila de impressão consciente de `available_at` e cancelamento

**Files:**
- Modify: `worker/orderPrintingRepository.js`
- Modify: `worker/orderPrintingRepository.test.js`
- Modify: `worker/orderCancellation.js`
- Modify: `worker/orderCancellation.test.js`
- Modify: `worker/orderAutomaticPrintJob.test.js`

**Interfaces**

`prepareAutomaticPrintJobStatement` passa a aceitar:

```js
{
  orderId,
  copies,
  document,
  createdAt,
  availableAt, // default = createdAt
}
```

`mapJobRow` passa a expor `availableAt`.

Claim automático exige:
- `status = 'pending'`
- `trigger = 'automatic'`
- `available_at <= now`
- pedido relacionado não cancelado.

Aging automático usa `available_at`, não `created_at`.

- [ ] **Step 1: Escrever RED de disponibilidade futura**

Atualizar o schema SQLite de `worker/orderPrintingRepository.test.js` com `orders.status` e `print_jobs.available_at`, e adicionar:

```js
test('job automático futuro não pode ser assumido nem envelhece antes de availableAt', async () => {
  const db = makeDb()
  await addStation(db, 'primary')
  await setPrimaryPrintStation(db, businessA, 'primary', baseNow)
  const availableAt = new Date(baseNow.getTime() + 60 * 60_000)
  await addAutomaticJob(db, { id: 'scheduled-job', orderId: 'o1', availableAt })

  assert.equal(await claimNextAutomaticPrintJob(db, businessA, 'primary', baseNow), null)
  assert.equal((await loadPrintJob(db, businessA, 'scheduled-job')).status, 'pending')

  const claimed = await claimNextAutomaticPrintJob(db, businessA, 'primary', availableAt)
  assert.equal(claimed.id, 'scheduled-job')
})

test('aging conta dez minutos desde availableAt e não desde createdAt', async () => {
  const db = makeDb()
  const createdAt = new Date(baseNow.getTime() - 3 * 60 * 60_000)
  const availableAt = new Date(baseNow.getTime() - 5 * 60_000)
  await addAutomaticJob(db, { id: 'not-old-yet', createdAt, availableAt })
  await listPrintJobs(db, businessA, { now: baseNow })
  assert.equal((await loadPrintJob(db, businessA, 'not-old-yet')).status, 'pending')
})
```

- [ ] **Step 2: Confirmar RED**

```bash
node --test worker/orderPrintingRepository.test.js
```

Expected: FAIL porque não existe `available_at` no repositório atual.

- [ ] **Step 3: Implementar `available_at` no repository**

Alterações mínimas:

```js
const mapJobRow = (row) => row ? ({
  // campos existentes
  createdAt: row.created_at,
  availableAt: row.available_at || row.created_at,
  // ...
}) : null
```

Na criação:

```js
const availableAt = timestamp(input.availableAt || createdAt)
// INSERT inclui available_at e bind availableAt
```

No aging:

```sql
... WHERE business_id = ?
AND trigger = 'automatic'
AND status = 'pending'
AND available_at <= ?
```

No `claimNextAutomaticPrintJob`, selecionar com join defensivo:

```sql
SELECT pj.id
FROM print_jobs pj
JOIN orders o ON o.id = pj.order_id AND o.business_id = pj.business_id
WHERE pj.business_id = ?
  AND pj.type = 'order'
  AND pj.trigger = 'automatic'
  AND pj.status = 'pending'
  AND pj.available_at <= ?
  AND o.status <> 'Cancelado'
ORDER BY pj.available_at ASC, pj.created_at ASC, pj.id ASC
LIMIT 1
```

`claimPrintJob` também deve impedir claim explícito de job `automatic` antes de `available_at`; jobs `manual` continuam imediatamente elegíveis.

- [ ] **Step 4: Escrever RED de cancelamento**

Em `worker/orderCancellation.test.js`, criar um pedido com um job automático pending e um manual pending; cancelar e afirmar:

```js
assert.equal(autoJobAfterCancel, null)
assert.equal(manualJobAfterCancel.status, 'pending')
```

Também cobrir que um automático já `printed` permanece como histórico.

- [ ] **Step 5: Implementar cancelamento atômico do pending automático**

Criar statement:

```js
const deletePendingAutomaticPrint = db.prepare(`DELETE FROM print_jobs
  WHERE business_id = ? AND order_id = ?
    AND trigger = 'automatic' AND status = 'pending'`)
  .bind(businessId, orderId)
```

No caminho sem estorno usar `db.batch([update, deletePendingAutomaticPrint])`; no caminho com estorno usar `db.batch([update, deletePendingAutomaticPrint, refund.statement])`.

- [ ] **Step 6: Executar GREEN**

```bash
node --test worker/orderPrintingRepository.test.js worker/orderCancellation.test.js worker/orderAutomaticPrintJob.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add worker/orderPrintingRepository.js worker/orderPrintingRepository.test.js worker/orderCancellation.js worker/orderCancellation.test.js worker/orderAutomaticPrintJob.test.js
git commit -m "feat: schedule automatic print availability"
```

---

## Task 5: Persistir `scheduled_for`/`is_backdated` e devolver o contrato completo do pedido

**Files:**
- Modify: `worker/repositories.js`
- Modify: `worker/orderReadSql.js`
- Modify: `worker/orderReadRepository.test.js`
- Create: `worker/orderSchedulingRepository.test.js`
- Modify: `worker/multiItemCheckoutRepository.test.js`

**Interfaces**

D1 → frontend:

```js
{
  scheduledFor: row.scheduled_for ?? null,
  isBackdated: Boolean(row.is_backdated),
}
```

Create order:
- histórico: `is_backdated = 1`, `scheduled_for = NULL`, sem job automático;
- hoje/Agora: `is_backdated = 0`, `scheduled_for = NULL`, auto-print `availableAt = createdAt`;
- hoje/Agendado: `is_backdated = 0`, `scheduled_for = ISO`, auto-print `availableAt = operationalStartAt`.

- [ ] **Step 1: RED do mapeamento e criação**

Criar `worker/orderSchedulingRepository.test.js` cobrindo os três casos. O teste agendado deve fixar:

```js
const now = new Date('2026-09-04T12:00:00.000Z') // 09:00 BRT
const scheduledFor = '2026-09-04T15:00:00.000Z' // 12:00 BRT
const order = await createOrder(db, businessId, {
  ...validInput,
  orderDate: '2026-09-04',
  scheduledFor,
}, now)

assert.equal(order.scheduledFor, scheduledFor)
assert.equal(order.isBackdated, false)
const job = await loadAutomaticPrintJobForOrder(db, businessId, order.id)
assert.equal(job.availableAt, '2026-09-04T14:10:00.000Z')
```

Para histórico:

```js
assert.equal(historical.isBackdated, true)
assert.equal(historical.scheduledFor, null)
assert.equal(await loadAutomaticPrintJobForOrder(db, businessId, historical.id), null)
```

- [ ] **Step 2: Confirmar RED**

```bash
node --test worker/orderSchedulingRepository.test.js worker/orderReadRepository.test.js
```

Expected: FAIL por colunas/mapeamento ausentes.

- [ ] **Step 3: Implementar mapeamento e INSERT**

Em `mapOrderRow`:

```js
scheduledFor: row.scheduled_for ?? null,
isBackdated: Boolean(row.is_backdated),
```

Atualizar tanto `orderSelect` interno em `worker/repositories.js` quanto `ORDER_SELECT` de `worker/orderReadSql.js` para selecionar:

```sql
o.scheduled_for, o.is_backdated
```

No create:

```js
const historical = input.orderDate < today
const scheduledFor = historical ? null : (input.scheduledFor || null)
const isBackdated = historical ? 1 : 0
```

Adicionar as duas colunas/binds no `INSERT INTO orders`.

Para auto-print:

```js
const operationalStartAt = getOperationalStartAt({ createdAt, scheduledFor })?.toISOString() || createdAt
prepareAutomaticPrintJobStatement(db, businessId, {
  orderId,
  copies: primaryPrintStation.defaultCopies,
  document: printDocument,
  createdAt,
  availableAt: operationalStartAt,
})
```

- [ ] **Step 4: Regressão de checkout multi-item**

Garantir que a inclusão de novos binds não altera itens, pagamentos, ajustes nem idempotência:

```bash
node --test worker/orderSchedulingRepository.test.js worker/orderReadRepository.test.js worker/multiItemCheckoutRepository.test.js worker/orderRepositories.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/repositories.js worker/orderReadSql.js worker/orderReadRepository.test.js worker/orderSchedulingRepository.test.js worker/multiItemCheckoutRepository.test.js
git commit -m "feat: persist scheduled order metadata"
```

---

## Task 6: Adicionar “Agora / Agendado” ao fluxo Nova venda

**Files:**
- Modify: `src/pages/NewOrder.jsx`
- Modify: `src/pages/NewOrder.test.js`
- Modify: `src/pages/NewOrderWizard.test.js`
- Modify: `src/components/NewOrderCustomerStep.jsx`
- Modify: `src/utils/orderCart.js`
- Modify: `src/utils/orderCart.test.js`
- Modify: `src/utils/newOrderStepFlow.js`
- Modify: `src/utils/newOrderStepFlow.test.js`
- Modify: `src/new-order.css`

**Interfaces**

Estado local da UI:

```js
scheduleMode: 'now' | 'scheduled'
scheduledTime: 'HH:mm' | ''
```

Payload persistido:

```js
scheduledFor?: 'ISO-UTC'
```

Não persistir `scheduleMode`.

- [ ] **Step 1: RED do payload**

Adicionar a `src/utils/orderCart.test.js`:

```js
test('buildOrderPayload inclui scheduledFor somente quando a venda é agendada', () => {
  const scheduled = buildOrderPayload({
    customerIdentity: { type: 'registered_client', clientId: 'c1' },
    type: 'Entrega', orderDate: '2026-09-04', items: [], deliveryFee: 0,
    adjustment: { type: 'none' },
    scheduledFor: '2026-09-04T15:00:00.000Z',
  })
  assert.equal(scheduled.scheduledFor, '2026-09-04T15:00:00.000Z')

  const immediate = buildOrderPayload({ ...scheduled, scheduledFor: null })
  assert.equal(Object.hasOwn(immediate, 'scheduledFor'), false)
})
```

Confirmar RED:

```bash
node --test src/utils/orderCart.test.js
```

- [ ] **Step 2: Implementar payload mínimo**

Em `buildOrderPayload`:

```js
if (draft.scheduledFor) payload.scheduledFor = draft.scheduledFor
```

Run novamente e confirmar PASS.

- [ ] **Step 3: RED da validade da Etapa Cliente e dirty draft**

Estender `newOrderStepFlow` para receber `scheduleValid` e incluir `scheduleMode/scheduledTime` no snapshot sujo:

```js
assert.equal(getNewOrderStepAccess({
  identityValid: true,
  orderDate: '2026-09-04',
  itemCount: 0,
  scheduleValid: false,
}).products, false)
```

Também testar que trocar `scheduledTime` torna o draft dirty.

Run:

```bash
node --test src/utils/newOrderStepFlow.test.js
```

Expected: FAIL.

Implementar `scheduleValid = true` como default compatível e adicioná-lo à condição de `products/review`.

- [ ] **Step 4: RED da UI contratual**

Em `src/pages/NewOrder.test.js`/`NewOrderWizard.test.js`, exigir:

```js
assert.match(customerStep, /Quando preparar\?/)
assert.match(customerStep, />Agora</)
assert.match(customerStep, />Agendado</)
assert.match(customerStep, /Horário desejado pelo cliente/)
assert.match(customerStep, /Esse horário é uma referência de atendimento\./)
assert.match(customerStep, /type="time"/)
assert.match(page, /businessDateTimeToIso/)
assert.match(page, /setScheduleMode\('now'\)/)
```

- [ ] **Step 5: Implementar estado e regras da Nova venda**

Em `NewOrder.jsx`:

```js
const [scheduleMode, setScheduleMode] = useState('now')
const [scheduledTime, setScheduledTime] = useState('')
const todayValue = getBusinessDate()
const scheduledFor = scheduleMode === 'scheduled'
  ? businessDateTimeToIso(orderDate, scheduledTime)
  : null
const scheduledDate = scheduledFor ? new Date(scheduledFor) : null
const scheduleValid = scheduleMode === 'now'
  || Boolean(
    type !== 'Local'
    && orderDate === todayValue
    && scheduledDate
    && scheduledDate.getTime() > Date.now()
  )
```

Para testabilidade, não espalhar `Date.now()` pelo componente: extrair a validação para helper testado em `shared/orderTiming.js`, por exemplo `isFutureSameDaySchedule({ type, orderDate, scheduledFor, now })`. O componente apenas consome o resultado.

No `changeType('Local')`:

```js
setScheduleMode('now')
setScheduledTime('')
```

Ao mudar `orderDate` para data histórica, também resetar para Agora.

No draft/numericDraft incluir `scheduledFor`; dirty snapshot inclui `scheduleMode`/`scheduledTime`.

Passar ao `NewOrderCustomerStep`:

```jsx
scheduleMode={scheduleMode}
scheduledTime={scheduledTime}
scheduleEnabled={type !== 'Local' && orderDate === todayValue}
onScheduleModeChange={setScheduleMode}
onScheduledTimeChange={setScheduledTime}
```

No customer step, usar grupo de botões `aria-pressed`; mostrar `<input type="time">` apenas em Agendado. Local não renderiza o grupo.

- [ ] **Step 6: CSS responsivo mínimo**

Adicionar classes dedicadas sem duplicar padrões existentes:

```css
.new-order-schedule-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.new-order-schedule-option {
  min-height: var(--mobile-touch-target, 44px);
}
```

Reusar estados `.selected`/tokens do design existente.

- [ ] **Step 7: Executar GREEN focado**

```bash
node --test src/utils/orderCart.test.js src/utils/newOrderStepFlow.test.js src/pages/NewOrder.test.js src/pages/NewOrderWizard.test.js src/pages/NewOrderMobile.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/pages/NewOrder.jsx src/pages/NewOrder.test.js src/pages/NewOrderWizard.test.js src/components/NewOrderCustomerStep.jsx src/utils/orderCart.js src/utils/orderCart.test.js src/utils/newOrderStepFlow.js src/utils/newOrderStepFlow.test.js src/new-order.css
git commit -m "feat: add same-day order scheduling controls"
```

---

## Task 7: Disparar som/destaque somente quando o pedido entra operacionalmente em preparo

**Files:**
- Modify: `src/utils/orderRealtime.js`
- Create: `src/utils/orderRealtime.test.js`
- Modify: `src/App.jsx`
- Modify: `src/kitchenLiveRefresh.test.js`
- Modify: `src/realtimeSyncRegression.test.js`

**Interfaces**

Produces:
- `operationalOrderIdSet(orders, now)` = IDs ativos que **não** estão aguardando janela.
- `getNewOperationalOrderIds(previousIds, orders, now)` = IDs que acabaram de entrar na operação.

Behavior:
- pedido Agora novo → alerta normalmente;
- pedido Agendado fora da janela novo → sem alerta;
- mesma ordem cruzando `operational_start_at` → um alerta;
- abrir a tela quando ele já está operacional → inicializa como conhecido, sem alerta histórico.

- [ ] **Step 1: Escrever RED puro de realtime**

`src/utils/orderRealtime.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { getNewOperationalOrderIds, operationalOrderIdSet } from './orderRealtime.js'

test('agendado fora da janela não é nova chegada operacional', () => {
  const order = {
    id: 'scheduled-1', status: 'Em preparo',
    createdAt: '2026-09-04T12:00:00.000Z',
    scheduledFor: '2026-09-04T15:00:00.000Z',
  }
  assert.deepEqual([...operationalOrderIdSet([order], new Date('2026-09-04T14:00:00.000Z'))], [])
})

test('cruzar 11:10 torna o agendado uma nova chegada uma única vez', () => {
  const order = {
    id: 'scheduled-1', status: 'Em preparo',
    createdAt: '2026-09-04T12:00:00.000Z',
    scheduledFor: '2026-09-04T15:00:00.000Z',
  }
  const before = operationalOrderIdSet([order], new Date('2026-09-04T14:09:00.000Z'))
  assert.deepEqual(getNewOperationalOrderIds(before, [order], new Date('2026-09-04T14:10:00.000Z')), ['scheduled-1'])
})
```

- [ ] **Step 2: Confirmar RED**

```bash
node --test src/utils/orderRealtime.test.js
```

Expected: FAIL por exports inexistentes.

- [ ] **Step 3: Implementar helpers e migrar App**

`orderRealtime.js` deve usar `isOrderActive`/estado terminal existente e `isScheduledWaiting`.

No `App.jsx`, substituir a semântica de `knownActiveOrderIdsRef` por `knownOperationalOrderIdsRef`. Na entrada da aba Pedidos:

```js
knownOperationalOrderIdsRef.current = operationalOrderIdSet(currentOrdersRef.current, new Date())
```

Em cada polling:

```js
const now = new Date()
const detectedIds = getNewOperationalOrderIds(
  knownOperationalOrderIdsRef.current,
  latestOrders,
  now,
).filter((id) => !alertedOrderIdsRef.current.has(id))
knownOperationalOrderIdsRef.current = operationalOrderIdSet(latestOrders, now)
```

Manter o mesmo mecanismo de áudio e highlight já existente.

- [ ] **Step 4: Executar regressões**

```bash
node --test src/utils/orderRealtime.test.js src/kitchenLiveRefresh.test.js src/realtimeSyncRegression.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/orderRealtime.js src/utils/orderRealtime.test.js src/App.jsx src/kitchenLiveRefresh.test.js src/realtimeSyncRegression.test.js
git commit -m "feat: alert when scheduled orders enter preparation"
```

---

## Task 8: Separar visualmente Agendados e Em preparo na cozinha

**Files:**
- Modify: `src/pages/Orders.jsx`
- Create: `src/pages/OrdersScheduled.test.js`
- Modify: `src/order-operations.css`
- Modify: `src/order-operations-compact.css`
- Modify: `src/orderTimerRefresh.test.js`
- Modify: `src/pages/OrdersMobile.test.js`

**Interfaces**

Derived lists:

```js
const searchableActiveOrders = orders.filter(isOrderActive).filter(searchPredicate)
const scheduledOrders = searchableActiveOrders
  .filter((order) => isScheduledWaiting(order, now))
  .sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor))
const preparingOrders = searchableActiveOrders
  .filter((order) => !isScheduledWaiting(order, now))
  .sort((a, b) => getOperationalStartAt(a) - getOperationalStartAt(b))
```

Stats:
- Em preparo = `preparingOrders` sem filtro textual para o total global.
- Agendados = ativos waiting.
- Com atraso = apenas ativos operacionais atrasados.
- Finalizados hoje = atual.

- [ ] **Step 1: RED da estrutura da tela**

Criar `src/pages/OrdersScheduled.test.js` como teste contratual de source + helpers puros:

```js
assert.match(ordersPage, /Agendados/)
assert.match(ordersPage, /scheduledOrders/)
assert.match(ordersPage, /preparingOrders/)
assert.match(ordersPage, /Desejado/)
assert.match(ordersPage, /isScheduledWaiting/)
assert.match(ordersPage, /getOperationalStartAt/)
```

Adicionar teste puro em `orderWorkflow.test.js` ou `orderTiming.test.js` garantindo que `getElapsedMinutes` retorna 0 antes da janela e começa em 0 no instante da entrada.

- [ ] **Step 2: Confirmar RED**

```bash
node --test src/pages/OrdersScheduled.test.js src/orderTimerRefresh.test.js
```

- [ ] **Step 3: Implementar listas, contadores e cards**

Em `Orders.jsx`:
- manter `now` atualizando a cada 60s/focus/visibility;
- substituir `activeOrders` único por `preparingOrders` e `scheduledOrders`;
- renderizar 4 StatCards;
- fila “Em preparo” usa contador operacional;
- para agendado que já entrou na janela, exibir `Desejado ${formatOrderTime(order.scheduledFor)}`;
- bloco “Agendados” não renderiza `há X min`; mostra horário desejado, cliente, tipo, resumo/itens, detalhes e cancelar;
- não oferecer “Saiu para entrega/Finalizar” enquanto estiver waiting, para evitar encerrar algo que ainda não entrou na cozinha.

O card de agendado pode reutilizar estrutura visual, mas deve ter classe própria `scheduled-order-card` e badge textual “Agendado” sem alterar `order.status`.

- [ ] **Step 4: Responsividade**

No compact CSS, garantir que:
- 4 stats quebram sem overflow;
- horário desejado fica legível;
- ações de detalhes/cancelamento mantêm alvo touch ≥44px;
- lista Agendados não fica atrás da navegação inferior.

- [ ] **Step 5: Executar GREEN**

```bash
node --test src/pages/OrdersScheduled.test.js src/orderTimerRefresh.test.js src/pages/OrdersMobile.test.js src/pages/OrdersMultiItem.test.js src/operationsUxRound.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Orders.jsx src/pages/OrdersScheduled.test.js src/order-operations.css src/order-operations-compact.css src/orderTimerRefresh.test.js src/pages/OrdersMobile.test.js
git commit -m "feat: split scheduled and preparing kitchen queues"
```

---

## Task 9: Exibir horários agendados e impressão programada nos detalhes/histórico

**Files:**
- Modify: `src/components/OrderDetail.jsx`
- Create: `src/components/OrderDetailTiming.test.js`
- Modify: `src/pages/OrderHistory.test.js`
- Modify: `src/printing/printingUi.test.js`

**Interfaces**

Quando `order.scheduledFor` existe, detalhes mostram:
- Criado às `HH:mm`;
- Desejado `HH:mm`;
- Início operacional `HH:mm`;
- para finalizado, duração operacional formatada;
- para Entrega, label “Tempo até sair para entrega”;
- para Retirada/Local, “Tempo até finalização”.

Print job future:
- `printJob.availableAt > now` + trigger automatic/pending → “Impressão programada para HH:mm”.
- Isso não é erro nem `requires_attention`.

- [ ] **Step 1: RED da UI de detalhe**

`src/components/OrderDetailTiming.test.js`:

```js
assert.match(detailSource, /Horário desejado/)
assert.match(detailSource, /Início operacional/)
assert.match(detailSource, /Tempo até sair para entrega/)
assert.match(detailSource, /Tempo até finalização/)
assert.match(detailSource, /Impressão programada para/)
assert.match(detailSource, /availableAt/)
```

- [ ] **Step 2: Confirmar RED**

```bash
node --test src/components/OrderDetailTiming.test.js src/printing/printingUi.test.js
```

- [ ] **Step 3: Implementar detalhe**

Importar de `shared/orderTiming.js`:

```js
getOperationalDurationMinutes,
getOperationalStartAt,
```

Usar `formatOrderTime`/`formatElapsedDuration` para apresentação. Não duplicar cálculo em JSX.

Para impressão futura:

```js
const automaticPrintScheduled = printJob?.trigger === 'automatic'
  && printJob?.status === 'pending'
  && new Date(printJob.availableAt).getTime() > Date.now()
```

Idealmente extrair essa decisão para helper testável de printing, evitando `Date.now()` inline; passar `now` quando necessário em testes.

- [ ] **Step 4: Executar GREEN**

```bash
node --test src/components/OrderDetailTiming.test.js src/pages/OrderHistory.test.js src/printing/printingUi.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/OrderDetail.jsx src/components/OrderDetailTiming.test.js src/pages/OrderHistory.test.js src/printing/printingUi.test.js
git commit -m "feat: show scheduled timing in order details"
```

---

## Task 10: Adicionar métricas de tempo operacional ao Dashboard

**Files:**
- Modify: `src/utils/dashboardAnalytics.js`
- Modify: `src/utils/dashboardAnalytics.test.js`
- Modify: `src/pages/Dashboard.jsx`
- Modify: `src/pages/DashboardAnalytics.test.js`
- Modify: `src/dashboard.css`
- Modify: `src/dashboardResponsive.test.js`

**Interfaces**

Adicionar:

```js
calculateOperationalMetrics(orders, period, now) => {
  sampleSize,
  averageMinutes,
  fastestMinutes,
  slowestMinutes,
  bands: [
    { label: 'Até 20 min', value },
    { label: '21–30 min', value },
    { label: '31–40 min', value },
    { label: 'Acima de 40 min', value },
  ],
  byType: [
    { type: 'Entrega', sampleSize, averageMinutes },
    ...
  ],
}
```

Elegibilidade:
- `status === 'Finalizado'`;
- `isBackdated !== true`;
- `finishedAt` válido;
- `createdAt`/operational start válido;
- nunca Cancelado/ativo.

- [ ] **Step 1: Escrever RED analítico**

Adicionar a `src/utils/dashboardAnalytics.test.js` fixtures incluindo:
- imediato finalizado em 20 min;
- agendado criado 09:00, desejado 12:00, finalizado 11:55 → 45 min;
- cancelado → excluído;
- backdated → excluído;
- ativo → excluído.

Teste:

```js
const metrics = calculateOperationalMetrics(orders, 'today', new Date('2026-09-04T18:00:00.000Z'))
assert.equal(metrics.sampleSize, 2)
assert.equal(metrics.averageMinutes, 32.5)
assert.equal(metrics.fastestMinutes, 20)
assert.equal(metrics.slowestMinutes, 45)
assert.deepEqual(metrics.bands.map((item) => item.value), [1, 0, 0, 1])
```

- [ ] **Step 2: Confirmar RED**

```bash
node --test src/utils/dashboardAnalytics.test.js
```

Expected: FAIL por função inexistente.

- [ ] **Step 3: Implementar analytics mínimo**

Reusar `filterOrdersByPeriod` e `getOperationalDurationMinutes`; não recalcular timestamps na camada de dashboard.

```js
export const calculateOperationalMetrics = (orders, period = '30d', now = new Date()) => {
  const durations = filterOrdersByPeriod(orders, period, now)
    .filter((order) => order.status === 'Finalizado' && !order.isBackdated)
    .map((order) => ({ order, minutes: getOperationalDurationMinutes(order) }))
    .filter(({ minutes }) => Number.isFinite(minutes))
  // agregação determinística das faixas e tipos
}
```

- [ ] **Step 4: RED/GREEN da UI**

Em `DashboardAnalytics.test.js`, exigir os textos:

```js
assert.match(page, /Tempo operacional/)
assert.match(page, /Tempo médio/)
assert.match(page, /Mais rápido/)
assert.match(page, /Mais demorado/)
assert.match(page, /Por faixa de tempo/)
assert.match(page, /Por tipo de atendimento/)
```

Em `Dashboard.jsx`, dentro do período já selecionado, adicionar seção operacional com três `StatCard` e reutilizar `DashboardBarChart` para distribuição e comparação por tipo. Usar `formatElapsedDuration` para minutos.

Quando `sampleSize === 0`, mostrar `—` e texto “Sem pedidos concluídos elegíveis neste período”, não `0 min` como se fosse uma medição real.

- [ ] **Step 5: Responsividade e regressão**

```bash
node --test src/utils/dashboardAnalytics.test.js src/pages/DashboardAnalytics.test.js src/dashboardResponsive.test.js src/dashboardCharts.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/utils/dashboardAnalytics.js src/utils/dashboardAnalytics.test.js src/pages/Dashboard.jsx src/pages/DashboardAnalytics.test.js src/dashboard.css src/dashboardResponsive.test.js
git commit -m "feat: report operational preparation timing"
```

---

## Task 11: Fechar contratos, executar validação completa e preparar staging

**Files:**
- Modify if regression requires: `src/api/client.test.js`
- Modify if regression requires: `worker/index.test.js`
- Modify if regression requires: `worker/orderPrintingHttp.test.js`
- Modify if regression requires: `worker/orderPrintDocumentRepository.test.js`
- Modify if needed: `docs/release-and-migration-runbook.md` only if the new migration introduces a runbook step not already covered.
- No functional change merely to silence unrelated warnings.

**Interfaces / acceptance matrix**

| Scenario | Expected |
|---|---|
| Entrega Agora | entra Em preparo, alerta/imprime imediatamente |
| Retirada Agora | idem |
| Local | sem opção Agendado |
| Agendado 12:00 criado 09:00 | Agendados até 11:10; sem som/auto-print antes |
| Agendado 12:00 criado 11:45 | Em preparo imediatamente; alerta e auto-print disponíveis |
| Agendado ativo 12:15 | ainda no prazo |
| Agendado ativo após 12:15 | Atrasado |
| Agendado cancelado 10:00 | nunca auto-imprime às 11:10 |
| Manual print antes da janela | permitido |
| Backdated | Finalizado, `isBackdated=true`, fora das métricas |
| Dashboard | usa `finishedAt - operationalStartAt` |

- [ ] **Step 1: Rodar todos os testes**

```bash
npm test
```

Expected: PASS, zero failures.

Se houver failure, tratar cada uma com ciclo RED/GREEN sem alterar comportamento aprovado para “fazer o teste passar”.

- [ ] **Step 2: Rodar lint**

```bash
npm run lint
```

Expected: 0 errors. Warnings preexistentes podem permanecer somente se não forem introduzidos por esta branch.

- [ ] **Step 3: Build frontend**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Validar os dois bundles Worker exatamente como CI**

```bash
npx --yes wrangler@4.128.0 deploy --dry-run
npx --yes wrangler@4.128.0 deploy --dry-run --env staging
```

Expected: PASS.

- [ ] **Step 5: Reaplicar migrations em D1 local**

```bash
npm run d1:migrate:local
```

Expected: `0011_scheduled_orders_operational_timing.sql` aplicada/confirmada sem erro.

- [ ] **Step 6: Revisão de segurança de dados antes do PR**

Confirmar no diff:
- migration 0011 é somente aditiva/backfill;
- nenhum `DELETE FROM orders` foi introduzido;
- cancelamento só deleta `print_jobs` automáticos `pending` do pedido cancelado;
- `scheduled_for` não altera pagamentos/totais;
- nenhum cron desnecessário foi adicionado;
- nenhuma credencial/URL de ambiente foi hardcoded.

- [ ] **Step 7: Commit de integração, se houver ajustes de contrato**

```bash
git add -A
git commit -m "test: cover scheduled order operational flow"
```

Se não houver mudanças desde Task 10, não criar commit vazio.

- [ ] **Step 8: Criar Draft PR para `master`**

Título sugerido:

```text
Draft: pedidos agendados e tempo operacional
```

Descrição deve listar:
- Agora/Agendado;
- janela 50 min;
- tolerância 15 min;
- `available_at` da impressão;
- cancelamento seguro;
- métricas operacionais;
- migration 0011;
- comandos de validação executados.

- [ ] **Step 9: Aguardar CI do PR**

O workflow `Validate application` deve aprovar:
- `npm test`;
- `npm run lint`;
- `npm run build`;
- dry-run Worker produção;
- dry-run Worker staging;
- migrations locais.

Não seguir para staging com CI vermelho.

- [ ] **Step 10: Deploy em staging e homologação manual**

Disparar o workflow oficial `Deploy staging` para a branch/commit aprovado pelo CI. Homologar manualmente no staging:

1. criar Entrega Agora e confirmar alerta/impressão imediata;
2. criar Retirada Agendada fora da janela e confirmar bloco Agendados sem alerta/impressão;
3. usar horário dentro dos próximos 50 min e confirmar entrada imediata em preparo;
4. confirmar ordenação de múltiplos agendados pelo horário desejado;
5. confirmar transição automática ao alcançar a janela (pode usar fixture/teste controlado em staging se esperar 50 min não for prático; não alterar regra de produção);
6. cancelar agendado antes da janela e confirmar que não aparece auto-print depois;
7. confirmar detalhes com Criado/Desejado/Início operacional;
8. confirmar Dashboard Hoje/7d/30d e exclusão de cancelados/backdated;
9. confirmar mobile sem overflow e ações touch.

- [ ] **Step 11: Gate obrigatório de produção**

Parar aqui e pedir aprovação explícita do usuário após homologação em staging. **Não fazer merge/deploy production como parte automática deste plano.** A publicação segue o runbook existente somente após “aprovado para produção”.

---

## Final Review Checklist

Antes de declarar o plano implementado:

- [ ] Nenhum `TODO`, `TBD`, placeholder ou regra duplicada de 50/15 min.
- [ ] `scheduledFor` (API/JS) ↔ `scheduled_for` (D1) mapeado em create/read/bootstrap/list.
- [ ] `isBackdated` ↔ `is_backdated` mapeado e backfill restrito ao padrão artificial histórico.
- [ ] `availableAt` ↔ `available_at` usado em create, map, claim e aging.
- [ ] `Agora` continua 100% compatível com comportamento existente.
- [ ] `Local` nunca carrega scheduling oculto no payload.
- [ ] Agendado criado dentro da janela usa `createdAt`, não horário anterior.
- [ ] Atraso Agendado usa `scheduledFor + 15`, não tempo decorrido desde cadastro.
- [ ] Som é baseado em entrada **operacional**, não mera chegada do registro no polling.
- [ ] Job automático futuro não é aged/claimed antes de `availableAt`.
- [ ] Cancelamento não apaga job manual nem histórico de impressão processado.
- [ ] Métricas excluem Cancelado, Backdated, ativos e timestamps inválidos.
- [ ] Métrica de Entrega é chamada “Tempo até sair para entrega”, nunca “tempo de entrega”.
- [ ] Testes, lint, build, Worker dry-runs e migration local verdes.
- [ ] Staging homologado antes de qualquer produção.
