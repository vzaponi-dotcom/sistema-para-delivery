import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const app = fs.readFileSync(new URL('../../App.jsx', import.meta.url), 'utf8')
const runtime = fs.readFileSync(new URL('../../app/runtime/data/useOperationalDataRuntime.js', import.meta.url), 'utf8')

test('App no longer owns C6 finance/payment implementation', () => {
  for (const token of [
    'paymentDialogRef',
    'paymentAttemptRef',
    'paymentSequenceRef',
    'tableTabPaymentRef',
    'paymentSyncRef',
    'settleAcceptedPayment',
    'reconcileTableTabPayment',
    'handleRegisterTableTabPayment',
    'handleRegisterPayment',
    'handleSaveMovement',
    'handleDeleteMovement',
    'handleSaveFinanceSettings',
    'handleUpdatePaymentPromise',
    'handleRegisterRefund',
  ]) assert.equal(app.includes(token), false, token)
})

test('operational runtime is payment agnostic', () => {
  for (const token of ['legacyBridges', 'capturePaymentOwners', 'settlePaymentOwners']) {
    assert.equal(runtime.includes(token), false, token)
  }
})

test('C6 legacy owners and utility facades remain physically absent', () => {
  for (const path of [
    '../../pages/Finance.jsx',
    '../../pages/Receivables.jsx',
    '../../components/MovementDialog.jsx',
    '../../components/OpeningBalanceDialog.jsx',
    '../../components/PaymentPromiseDialog.jsx',
    '../../components/ReceivableDetail.jsx',
    '../../components/ReceivablesForecastDialog.jsx',
    '../../components/ReceivablesQuickPaymentDialog.jsx',
    '../../components/RegisterRefundDialog.jsx',
    '../../components/TableTabPaymentDialog.jsx',
    '../../utils/paymentMethodOptions.js',
    '../../utils/financeCategoryOptions.js',
    '../../utils/finance.js',
    '../../utils/receivables.js',
    '../../utils/paymentWorkflow.js',
  ]) assert.equal(fs.existsSync(new URL(path, import.meta.url)), false, path)
})
