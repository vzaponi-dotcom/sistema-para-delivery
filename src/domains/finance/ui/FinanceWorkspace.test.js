import test from 'node:test'
import assert from 'node:assert/strict'
import { act } from 'react-test-renderer'
import { buttonNamed, nodeText, renderWithNavigation, workspaceHarness } from '../../../test-support/renderWorkspace.js'

test('FinanceWorkspace renders the finance surface and owns the movement dialog flow', async (t) => {
  const h = await workspaceHarness(t)
  const { default: FinanceWorkspace } = await h.load('/src/domains/finance/ui/FinanceWorkspace.jsx')
  const screen = await renderWithNavigation(h, FinanceWorkspace, {
    movements: [],
    financeSettings: null,
    today: '2026-09-18',
    currency: (value) => `R$ ${Number(value).toFixed(2)}`,
    pendingRefundOrders: [],
    paymentOptions: [],
    categoryOptions: [],
    categoryRevision: 1,
    writesBlocked: false,
    canManageMovements: true,
    canRefundPayments: true,
    applyOfficialEffects() {},
    setRequestKey() {},
    onSuccess() {},
    onError(error) { assert.fail(error?.message || 'unexpected error') },
    formatCancellationDate: () => '18/09/2026',
    onRequestRefund() {},
  }, {
    granted: new Set(['finance.view', 'finance.movements.manage']),
    implemented: new Set(['finance']),
  })

  assert.match(nodeText(screen.root), /Fluxo de caixa/)
  const newMovement = buttonNamed(screen.root, 'Novo movimento')
  assert.ok(newMovement)

  await act(async () => newMovement.props.onClick())
  assert.match(nodeText(screen.root), /Registrar movimento/)

  const openingBalance = buttonNamed(screen.root, 'Saldo inicial')
  assert.ok(openingBalance)

  await act(async () => openingBalance.props.onClick())
  assert.match(nodeText(screen.root), /Configurar saldo inicial/)
})
