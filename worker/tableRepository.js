const TABLE_NAME_MAX_LENGTH = 60

const domainError = (status, code, message, field) => Object.assign(new Error(message), {
  status,
  code,
  ...(field ? { field } : {}),
})

const tableNameExistsError = () => domainError(
  409,
  'TABLE_NAME_EXISTS',
  'Já existe uma mesa com esse nome.',
)

const tableOccupiedError = () => domainError(
  409,
  'TABLE_OCCUPIED',
  'A mesa está ocupada e não pode ser alterada.',
)

const tableDestinationOccupiedError = () => domainError(
  409,
  'TABLE_DESTINATION_OCCUPIED',
  'A mesa de destino está ocupada.',
)

const isTableNameCollision = (error) => {
  const message = String(error?.message || '')
  return /idx_tables_business_name_key|UNIQUE constraint failed:\s*tables\.business_id,\s*tables\.name_key/i.test(message)
}

const isOpenTableTabCollision = (error) => {
  const message = String(error?.message || '')
  return /idx_table_tabs_one_open_per_table_id|UNIQUE constraint failed:\s*table_tabs\.business_id,\s*table_tabs\.table_id/i.test(message)
}

const runWithTableNameCollision = async (operation) => {
  try {
    return await operation()
  } catch (error) {
    if (isTableNameCollision(error)) throw tableNameExistsError()
    throw error
  }
}

export const normalizeTableName = (value) => {
  if (typeof value !== 'string') {
    throw domainError(400, 'VALIDATION_ERROR', 'Informe o nome da mesa.', 'name')
  }

  const name = value.trim().replace(/\s+/g, ' ')
  if (!name) throw domainError(400, 'VALIDATION_ERROR', 'Informe o nome da mesa.', 'name')
  if (name.length > TABLE_NAME_MAX_LENGTH) {
    throw domainError(
      400,
      'VALIDATION_ERROR',
      `O nome da mesa aceita no máximo ${TABLE_NAME_MAX_LENGTH} caracteres.`,
      'name',
    )
  }

  return { name, nameKey: name.toLocaleUpperCase('pt-BR') }
}

export const mapTableRow = (row) => row ? ({
  id: row.id,
  name: row.name,
  sortOrder: Number(row.sort_order),
  isActive: Boolean(row.is_active),
  occupancy: row.open_table_tab_id ? 'occupied' : 'free',
  openTableTabId: row.open_table_tab_id ?? null,
}) : null

const tableSelect = `SELECT
  tables.id,
  tables.name,
  tables.sort_order,
  tables.is_active,
  open_tabs.id AS open_table_tab_id
FROM tables
LEFT JOIN table_tabs open_tabs
  ON open_tabs.business_id = tables.business_id
 AND open_tabs.table_id = tables.id
 AND open_tabs.status = 'open'`

export const listTables = async (db, businessId) => {
  const result = await db.prepare(`${tableSelect}
    WHERE tables.business_id = ?
    ORDER BY tables.sort_order, tables.name, tables.id`).bind(businessId).all()
  return (result.results || []).map(mapTableRow)
}

export const loadTableById = async (db, businessId, tableId) => {
  const row = await db.prepare(`${tableSelect}
    WHERE tables.business_id = ? AND tables.id = ?
    LIMIT 1`).bind(businessId, tableId).first()
  return mapTableRow(row)
}

const mapOpenTableTabRow = (row) => ({
  id: row.id,
  tableId: row.table_id,
  tableIdentifier: row.table_identifier,
  status: row.status,
  openedAt: row.opened_at,
  closedAt: row.closed_at ?? null,
})

export const getOrCreateOpenTableTabByTableId = async (db, businessId, tableId, now = new Date()) => {
  const table = await db.prepare(`SELECT id, name, is_active
    FROM tables
    WHERE id = ? AND business_id = ?
    LIMIT 1`).bind(tableId, businessId).first()
  if (!table) throw domainError(404, 'TABLE_NOT_FOUND', 'Mesa não encontrada.')
  if (!table.is_active) throw domainError(409, 'TABLE_INACTIVE', 'A mesa está inativa.')

  const selectOpen = () => db.prepare(`SELECT id, table_id, table_identifier, status, opened_at, closed_at
    FROM table_tabs
    WHERE business_id = ? AND table_id = ? AND status = 'open'
    LIMIT 1`).bind(businessId, table.id).first()

  let row = await selectOpen()
  if (row) return mapOpenTableTabRow(row)

  const id = crypto.randomUUID()
  const timestamp = now.toISOString()
  await db.prepare(`INSERT OR IGNORE INTO table_tabs (
    id, business_id, table_id, table_identifier, status, opened_at, closed_at, created_at, updated_at
  ) VALUES (?, ?, ?, ?, 'open', ?, NULL, ?, ?)`).bind(
    id,
    businessId,
    table.id,
    table.name,
    timestamp,
    timestamp,
    timestamp,
  ).run()

  row = await selectOpen()
  if (!row) throw domainError(500, 'TABLE_TAB_CREATE_FAILED', 'Não foi possível abrir a comanda da mesa.')
  return mapOpenTableTabRow(row)
}

export const transferOpenTableTab = async (
  db,
  businessId,
  sourceTableId,
  destinationTableId,
  now = new Date(),
) => {
  if (sourceTableId === destinationTableId) {
    throw domainError(409, 'TABLE_TRANSFER_SAME_TABLE', 'A mesa de destino deve ser diferente da origem.')
  }

  const sourceTab = await db.prepare(`SELECT id
    FROM table_tabs
    WHERE business_id = ? AND table_id = ? AND status = 'open'
    LIMIT 1`).bind(businessId, sourceTableId).first()
  if (!sourceTab) {
    throw domainError(409, 'TABLE_SOURCE_FREE', 'A mesa de origem não possui comanda aberta.')
  }

  const destination = await db.prepare(`SELECT
      tables.id,
      tables.name,
      tables.is_active,
      open_tabs.id AS open_table_tab_id
    FROM tables
    LEFT JOIN table_tabs open_tabs
      ON open_tabs.business_id = tables.business_id
     AND open_tabs.table_id = tables.id
     AND open_tabs.status = 'open'
    WHERE tables.business_id = ? AND tables.id = ?
    LIMIT 1`).bind(businessId, destinationTableId).first()
  if (!destination) {
    throw domainError(404, 'TABLE_DESTINATION_NOT_FOUND', 'Mesa de destino não encontrada.')
  }
  if (!destination.is_active) {
    throw domainError(409, 'TABLE_DESTINATION_INACTIVE', 'A mesa de destino está inativa.')
  }
  if (destination.open_table_tab_id) throw tableDestinationOccupiedError()

  let result
  try {
    result = await db.prepare(`UPDATE table_tabs
      SET table_id = ?, table_identifier = ?, updated_at = ?
      WHERE business_id = ?
        AND table_id = ?
        AND status = 'open'
        AND NOT EXISTS (
          SELECT 1 FROM table_tabs
          WHERE business_id = ? AND table_id = ? AND status = 'open'
        )`).bind(
      destination.id,
      destination.name,
      now.toISOString(),
      businessId,
      sourceTableId,
      businessId,
      destination.id,
    ).run()
  } catch (error) {
    if (isOpenTableTabCollision(error)) throw tableDestinationOccupiedError()
    throw error
  }

  if (result?.meta?.changes !== 1) {
    const occupiedDestination = await db.prepare(`SELECT id
      FROM table_tabs
      WHERE business_id = ? AND table_id = ? AND status = 'open'
      LIMIT 1`).bind(businessId, destination.id).first()
    if (occupiedDestination) throw tableDestinationOccupiedError()

    const currentSource = await db.prepare(`SELECT id
      FROM table_tabs
      WHERE business_id = ? AND table_id = ? AND status = 'open'
      LIMIT 1`).bind(businessId, sourceTableId).first()
    if (!currentSource) {
      throw domainError(409, 'TABLE_SOURCE_FREE', 'A mesa de origem não possui comanda aberta.')
    }
    throw domainError(409, 'TABLE_TRANSFER_CONFLICT', 'Não foi possível transferir a comanda.')
  }

  const transferred = await db.prepare(`SELECT id, table_id, table_identifier, status, opened_at, closed_at
    FROM table_tabs
    WHERE id = ? AND business_id = ?
    LIMIT 1`).bind(sourceTab.id, businessId).first()
  return mapOpenTableTabRow(transferred)
}

export const createTable = async (db, businessId, input, now = new Date()) => {
  const { name, nameKey } = normalizeTableName(input?.name)
  const orderRow = await db.prepare(`SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
    FROM tables
    WHERE business_id = ?`).bind(businessId).first()
  const id = crypto.randomUUID()
  const timestamp = now.toISOString()
  const sortOrder = Number(orderRow?.max_sort_order || 0) + 1

  await runWithTableNameCollision(() => db.prepare(`INSERT INTO tables (
    id, business_id, name, name_key, sort_order, is_active, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, 1, ?, ?)`).bind(
    id,
    businessId,
    name,
    nameKey,
    sortOrder,
    timestamp,
    timestamp,
  ).run())

  return loadTableById(db, businessId, id)
}

export const renameTable = async (db, businessId, tableId, value, now = new Date()) => {
  const current = await loadTableById(db, businessId, tableId)
  if (!current) return null
  if (current.occupancy === 'occupied') throw tableOccupiedError()

  const { name, nameKey } = normalizeTableName(value)
  await runWithTableNameCollision(() => db.prepare(`UPDATE tables
    SET name = ?, name_key = ?, updated_at = ?
    WHERE id = ? AND business_id = ?`).bind(
    name,
    nameKey,
    now.toISOString(),
    tableId,
    businessId,
  ).run())

  return loadTableById(db, businessId, tableId)
}

export const setTableActive = async (db, businessId, tableId, isActive, now = new Date()) => {
  if (typeof isActive !== 'boolean') {
    throw domainError(400, 'VALIDATION_ERROR', 'O estado da mesa é inválido.', 'isActive')
  }

  const current = await loadTableById(db, businessId, tableId)
  if (!current) return null
  if (!isActive && current.occupancy === 'occupied') throw tableOccupiedError()

  await db.prepare(`UPDATE tables
    SET is_active = ?, updated_at = ?
    WHERE id = ? AND business_id = ?`).bind(
    isActive ? 1 : 0,
    now.toISOString(),
    tableId,
    businessId,
  ).run()

  return loadTableById(db, businessId, tableId)
}

export const reorderTables = async (db, businessId, orderedIds, now = new Date()) => {
  if (!Array.isArray(orderedIds) || new Set(orderedIds).size !== orderedIds.length) {
    throw domainError(400, 'INVALID_TABLE_ORDER', 'A ordem das mesas é inválida.')
  }

  const current = await db.prepare(`SELECT id
    FROM tables
    WHERE business_id = ?`).bind(businessId).all()
  const currentIds = new Set((current.results || []).map((row) => row.id))
  if (orderedIds.length !== currentIds.size || orderedIds.some((id) => !currentIds.has(id))) {
    throw domainError(400, 'INVALID_TABLE_ORDER', 'A ordem deve conter todas as mesas do estabelecimento uma única vez.')
  }

  const timestamp = now.toISOString()
  const statements = orderedIds.map((id, index) => db.prepare(`UPDATE tables
    SET sort_order = ?, updated_at = ?
    WHERE id = ? AND business_id = ?`).bind(index + 1, timestamp, id, businessId))
  await db.batch(statements)

  return listTables(db, businessId)
}
