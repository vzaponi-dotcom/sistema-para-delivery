import test from 'node:test'
import assert from 'node:assert/strict'
import { createSettingsDb } from '../test-support/settingsDb.js'

test('critical reporting reads use business/date indexes rather than cross-business table scans', (t) => {
  const { sqlite, close } = createSettingsDb()
  t.after(close)
  const plan = (sql, ...values) => sqlite.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...values).map((row) => row.detail).join(' | ')
  const business = 'amor-e-sabor'
  const cases = {
    overviewSales: plan('SELECT SUM(total_cents) FROM orders WHERE business_id = ? AND order_date BETWEEN ? AND ? AND status <> ?', business, '2026-09-01', '2026-09-30', 'Cancelado'),
    receipts: plan('SELECT SUM(total_cents) FROM payment_receipts WHERE business_id = ? AND paid_at >= ? AND paid_at < ?', business, '2026-09-01T03:00:00Z', '2026-10-01T03:00:00Z'),
    paymentAllocations: plan('SELECT pa.amount_cents FROM payment_allocations pa JOIN payment_receipts r ON r.business_id = pa.business_id AND r.id = pa.receipt_id WHERE r.business_id = ? AND r.paid_at >= ? AND r.paid_at < ?', business, '2026-09-01T03:00:00Z', '2026-10-01T03:00:00Z'),
    products: plan('SELECT oi.quantity FROM orders o JOIN order_items oi ON oi.business_id = o.business_id AND oi.order_id = o.id WHERE o.business_id = ? AND o.order_date BETWEEN ? AND ? AND o.status <> ?', business, '2026-09-01', '2026-09-30', 'Cancelado'),
    detailCount: plan('SELECT count(*) FROM orders o WHERE o.business_id = ? AND o.order_date BETWEEN ? AND ?', business, '2026-09-01', '2026-09-30'),
    detailPage: plan('SELECT o.id FROM orders o WHERE o.business_id = ? AND o.order_date BETWEEN ? AND ? ORDER BY o.order_date DESC, o.order_number DESC, o.id DESC LIMIT ? OFFSET ?', business, '2026-09-01', '2026-09-30', 25, 0),
  }
  for (const [name, detail] of Object.entries(cases)) {
    assert.match(detail, /SEARCH .* (INDEX|COVERING INDEX)/i, `${name}: ${detail}`)
    assert.doesNotMatch(detail, /SCAN orders\b|SCAN payment_receipts\b|SCAN payment_allocations\b|SCAN order_items\b/i, `${name}: ${detail}`)
    if (name === 'detailPage') assert.doesNotMatch(detail, /TEMP B-TREE/i, `${name}: ${detail}`)
    t.diagnostic(`${name}: ${detail}`)
  }
})
