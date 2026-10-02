export function seedTenantResources(sqlite, businessId, suffix) {
  const id = prefix => `${prefix}-${suffix}`, at = '2026-10-02T12:00:00.000Z'
  const insert = (table, data) => sqlite.prepare(`INSERT INTO ${table}(${Object.keys(data).join(',')}) VALUES(${Object.keys(data).map(() => '?').join(',')})`).run(...Object.values(data))
  const base = { business_id: businessId, created_at: at, updated_at: at }
  insert('clients', { id: id('client'), ...base, name: `Private client ${suffix}` })
  insert('products', { id: id('product'), ...base, name: `Private product ${suffix}`, category: 'Bebidas', price_cents: 100 })
  insert('tables', { id: id('table'), ...base, name: `Table ${suffix}`, name_key: `TABLE ${suffix}`, sort_order: 0 })
  insert('table_tabs', { id: id('tab'), ...base, table_id: id('table'), table_identifier: `Table ${suffix}`, tab_number: 1, opened_at: at })
  insert('orders', { id: id('order'), business_id: businessId, created_at: at, order_number: 1, client_id: id('client'), client_name_snapshot: `Private client ${suffix}`, type: 'Local', order_date: '2026-10-02', status: 'Em preparo', subtotal_cents: 100, total_cents: 100 })
  insert('order_items', { id: id('item'), business_id: businessId, created_at: at, order_id: id('order'), product_id: id('product'), name_snapshot: `Private product ${suffix}`, quantity: 1, catalog_price_cents: 100, unit_price_cents: 100 })
  insert('payment_receipts', { id: id('receipt'), business_id: businessId, created_at: at, paid_at: at, total_cents: 100 })
  insert('payment_allocations', { id: id('allocation'), business_id: businessId, created_at: at, receipt_id: id('receipt'), method_label: 'Pix', amount_cents: 100 })
  insert('payments', { id: id('payment'), business_id: businessId, created_at: at, paid_at: at, order_id: id('order'), receipt_id: id('receipt'), amount_cents: 100 })
  insert('movements', { id: id('movement'), ...base, type: 'entrada', category: 'other_income', description: `Private movement ${suffix}`, value_cents: 100, movement_date: '2026-10-02' })
  insert('table_reservations', { id: id('reservation'), ...base, order_id: id('order'), table_id: id('table'), table_name_snapshot: `Table ${suffix}`, status: 'reserved', scheduled_for: '2026-10-03T15:00:00Z', ends_at: '2026-10-03T16:00:00Z', duration_minutes: 60 })
  insert('print_stations', { id: id('station'), ...base, name: `Station ${suffix}`, platform: 'windows' })
  insert('print_jobs', { id: id('job'), business_id: businessId, created_at: at, order_id: id('order'), type: 'order', trigger: 'manual', status: 'pending', copies_requested: 1, snapshot_json: '{}' })
  insert('print_job_attempts', { id: id('attempt'), ...base, job_id: id('job'), station_id: id('station'), copy_number: 1, attempt_number: 1, spool_job_name: `spool-${suffix}`, status: 'prepared' })
  return Object.fromEntries(['client', 'product', 'table', 'tab', 'order', 'item', 'receipt', 'payment', 'movement', 'reservation', 'station', 'job', 'attempt'].map(prefix => [prefix, id(prefix)]))
}
