import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const readFinanceSource = () => readFile(new URL('./Finance.jsx', import.meta.url), 'utf8')
const readAppSource = () => readFile(new URL('../App.jsx', import.meta.url), 'utf8')

test('Finance exposes edit and delete actions only for manual movements', async () => {
  const source = await readFinanceSource()

  assert.match(source, /movement\.source === 'manual'/)
  assert.match(source, />Editar</)
  assert.match(source, />Excluir</)
  assert.match(source, /ConfirmationDialog/)
  assert.match(source, /onDeleteMovement/)

  const manualActions = source.match(/movement\.source === 'manual'[\s\S]{0,1200}>Editar<[\s\S]{0,1200}>Excluir</)
  assert.ok(manualActions, 'Editar/Excluir devem estar dentro da proteção source === manual')
  assert.doesNotMatch(manualActions[0], /order-payment|order-refund/)
})

test('Finance owns transient movement and opening-balance dialog state', async () => {
  const [finance, app] = await Promise.all([readFinanceSource(), readAppSource()])

  assert.match(finance, /const \[editingMovement, setEditingMovement\] = useState/)
  assert.match(finance, /const \[deletingMovement, setDeletingMovement\] = useState/)
  assert.match(finance, /const \[openingDialogOpen, setOpeningDialogOpen\] = useState/)
  assert.match(finance, /MovementDialog/)
  assert.match(finance, /OpeningBalanceDialog/)

  assert.doesNotMatch(app, /const \[movementDialogOpen, setMovementDialogOpen\] = useState/)
  assert.doesNotMatch(app, /const \[editingMovement, setEditingMovement\] = useState/)
  assert.doesNotMatch(app, /const \[openingBalanceDialogOpen, setOpeningBalanceDialogOpen\] = useState/)
  assert.match(app, /onCreateMovement=\{handleCreateMovement\}/)
  assert.match(app, /onUpdateMovement=\{handleUpdateMovement\}/)
  assert.match(app, /onSaveFinanceSettings=\{handleSaveFinanceSettings\}/)
})

test('manual deletion uses a destructive confirmation with identifying details', async () => {
  const source = await readFinanceSource()

  assert.match(source, /title="Excluir movimentação"/)
  assert.match(source, /Esta movimentação manual deixará de compor o fluxo de caixa\./)
  assert.match(source, /deletingMovement\.description/)
  assert.match(source, /currency\(deletingMovement\.value\)/)
  assert.match(source, /deletingMovement\.movementDate\s*\|\|\s*deletingMovement\.date/)
  assert.match(source, /confirmLabel="Excluir movimentação"/)
  assert.match(source, /confirmVariant="danger"/)
})

test('opening balance action changes label after configuration and uses reviewed dialog', async () => {
  const source = await readFinanceSource()

  assert.match(source, /financeSettings\s*\?\s*'Editar saldo inicial'\s*:\s*'Configurar saldo inicial'/)
  assert.match(source, /OpeningBalanceDialog/)
  assert.match(source, /settings=\{financeSettings\}/)
  assert.match(source, /onSubmit=\{onSaveFinanceSettings\}/)
})

test('Finance defaults to today and renders the four cash-flow indicators', async () => {
  const source = await readFinanceSource()

  assert.match(source, /key:\s*'today'/)
  assert.match(source, /FinancePeriodSelector/)
  assert.match(source, /label="Entradas"/)
  assert.match(source, /label="Saídas"/)
  assert.match(source, /label="Resultado"/)
  assert.match(source, /label="Saldo atual"/)
  assert.doesNotMatch(source, /label="Saldo"/)
  assert.match(source, /Configure o saldo inicial/)
})

test('period summary is calculated before secondary history filters', async () => {
  const source = await readFinanceSource()

  assert.match(source, /summarizeFinancePeriod/)
  assert.match(source, /filterFinanceHistory/)
  assert.match(source, /periodMovements/)
  assert.match(source, /filteredMovements/)
  assert.match(source, /summary\s*=\s*summarizeFinancePeriod\(movements,\s*periodRange\)/)
  assert.match(source, /filteredMovements\s*=\s*filterFinanceHistory\(periodMovements,\s*filters\)/)
})

test('pending refunds stay global and automatic movements can open their order', async () => {
  const source = await readFinanceSource()

  assert.match(source, /pendingRefundOrders\.map/)
  assert.match(source, /OrderDetail/)
  assert.match(source, /movement\.orderId/)
  assert.match(source, /Ver pedido/)
})

test('App delegates finance calculations to Finance instead of owning period totals', async () => {
  const [finance, app] = await Promise.all([readFinanceSource(), readAppSource()])

  assert.doesNotMatch(app, /const financialTotals = useMemo/)
  assert.doesNotMatch(app, /totals=\{financialTotals\}/)
  assert.doesNotMatch(finance, /\btotals\b/)
  assert.match(app, /orders=\{orders\}/)
})
