import fs from 'node:fs'

const path = 'worker/repositories.js'
let source = fs.readFileSync(path, 'utf8')

const replaceOnce = (before, after, label) => {
  const count = source.split(before).length - 1
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`)
  source = source.replace(before, after)
}

replaceOnce(
  "import { formatClientPhone, normalizeClientPhone } from '../shared/clientIdentity.js'\n",
  "import { formatClientPhone, normalizeClientPhone } from '../shared/clientIdentity.js'\nimport { formatProductPresentation } from '../shared/productCatalog.js'\n",
  'product catalog import',
)

replaceOnce(
  "    client: row.client_name_snapshot,\n    type: row.type,",
  "    client: row.client_name_snapshot,\n    customerIdentityType: row.customer_identity_type || (row.client_id ? 'registered_client' : 'guest_name'),\n    type: row.type,",
  'order identity mapping',
)

replaceOnce(
  "const orderSelect = `SELECT o.id, o.client_id, o.client_name_snapshot, o.type,",
  "const orderSelect = `SELECT o.id, o.client_id, o.client_name_snapshot, o.customer_identity_type, o.type,",
  'order select identity column',
)

replaceOnce(
  "const itemSelect = `SELECT id, order_id, product_id, name_snapshot, category_snapshot, size_snapshot, quantity, catalog_price_cents, unit_price_cents, price_reason, note, created_at FROM order_items`\n",
  "const itemSelect = `SELECT id, order_id, product_id, name_snapshot, category_snapshot, size_snapshot, quantity, catalog_price_cents, unit_price_cents, price_reason, note, created_at FROM order_items`\nconst productSnapshotSize = (row) => {\n  const presentation = formatProductPresentation(mapProductRow(row))\n  return presentation === 'Unidade' ? 'Un' : presentation\n}\n",
  'product snapshot formatter',
)

replaceOnce(
  "const legacyCheckoutInput = (input) => ({\n  ...input,\n  items:",
  "const legacyCheckoutInput = (input) => ({\n  ...input,\n  customerIdentity: input.customerIdentity ?? { type: 'registered_client', clientId: input.clientId },\n  items:",
  'legacy identity bridge',
)

replaceOnce(
  "  const client = await db.prepare('SELECT id, name FROM clients WHERE id = ? AND business_id = ? LIMIT 1').bind(input.clientId, businessId).first()\n  if (!client) throw repositoryError(404, 'CLIENT_NOT_FOUND', 'Cliente não encontrado.')\n",
  "  const customerIdentity = input.customerIdentity ?? { type: 'registered_client', clientId: input.clientId }\n  let clientId = null\n  let clientSnapshot = ''\n  if (customerIdentity.type === 'registered_client') {\n    const client = await db.prepare('SELECT id, name FROM clients WHERE id = ? AND business_id = ? LIMIT 1').bind(customerIdentity.clientId, businessId).first()\n    if (!client) throw repositoryError(404, 'CLIENT_NOT_FOUND', 'Cliente não encontrado.')\n    clientId = client.id\n    clientSnapshot = client.name\n  } else if (customerIdentity.type === 'guest_name') {\n    clientSnapshot = customerIdentity.value\n  } else if (customerIdentity.type === 'table') {\n    clientSnapshot = `Mesa ${customerIdentity.value}`\n  } else {\n    throw repositoryError(400, 'INVALID_CUSTOMER_IDENTITY', 'Identificação do pedido inválida.')\n  }\n",
  'customer identity resolution',
)

replaceOnce(
  "  const orderStatement = db.prepare(`INSERT INTO orders (id, business_id, client_id, client_name_snapshot, type, order_date, status, subtotal_cents, delivery_fee_cents, adjustment_type, adjustment_mode, adjustment_value, adjustment_amount_cents, adjustment_reason, total_cents, created_at, finished_at, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(\n    orderId,\n    businessId,\n    client.id,\n    client.name,\n    input.type,",
  "  const orderStatement = db.prepare(`INSERT INTO orders (id, business_id, client_id, client_name_snapshot, customer_identity_type, type, order_date, status, subtotal_cents, delivery_fee_cents, adjustment_type, adjustment_mode, adjustment_value, adjustment_amount_cents, adjustment_reason, total_cents, created_at, finished_at, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(\n    orderId,\n    businessId,\n    clientId,\n    clientSnapshot,\n    customerIdentity.type,\n    input.type,",
  'order identity insert',
)

replaceOnce(
  "      item.product.size || '',\n      item.quantity,",
  "      productSnapshotSize(item.product),\n      item.quantity,",
  'server presentation snapshot',
)

replaceOnce(
  "    const description = `Pagamento pedido #${String(orderId).slice(-4)} · ${client.name}`",
  "    const description = `Pagamento pedido #${String(orderId).slice(-4)} · ${clientSnapshot}`",
  'payment snapshot description',
)

fs.writeFileSync(path, source)
