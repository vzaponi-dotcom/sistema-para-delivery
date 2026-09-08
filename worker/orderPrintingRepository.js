import { createTestPrintDocument } from '../shared/orderPrintDocument.js'

export const PRINT_PENDING_MAX_AGE_MS = 10 * 60 * 1000
export const PRINT_PROCESSING_MAX_AGE_MS = 2 * 60 * 1000

const repositoryError = (status, code, message) => Object.assign(new Error(message), { status, code })
const rows = (result) => Array.isArray(result?.results) ? result.results : []
const timestamp = (value = new Date()) => value instanceof Date ? value.toISOString() : String(value)
const clampLimit = (value) => Math.min(200, Math.max(1, Number(value) || 100))
const assertCopies = (copies) => {
  const value = Number(copies)
  if (value !== 1 && value !== 2) throw repositoryError(400, 'INVALID_PRINT_COPIES', 'A quantidade de cópias deve ser 1 ou 2.')
  return value
}

const AUTOMATIC_ORDER_ELIGIBLE_SQL = `EXISTS (
  SELECT 1 FROM orders
  WHERE orders.id = print_jobs.order_id
    AND orders.business_id = print_jobs.business_id
    AND orders.status NOT IN ('Cancelado', 'Finalizado')
)`

const mapStationRow = (row) => row ? ({
  id: row.id,
  name: row.name,
  platform: row.platform,
  isPrimary: Boolean(row.is_primary),
  autoPrintEnabled: Boolean(row.auto_print_enabled),
  defaultCopies: Number(row.default_copies) || 2,
  lastSeenAt: row.last_seen_at ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
}) : null

const mapJobRow = (row) => row ? ({
  id: row.id,
  orderId: row.order_id ?? null,
  type: row.type,
  trigger: row.trigger,
  status: row.status,
  priority: Number(row.priority || 0),
  parentJobId: row.parent_job_id ?? null,
  copiesRequested: Number(row.copies_requested),
  copiesPrinted: Number(row.copies_printed || 0),
  stationId: row.station_id ?? null,
  document: JSON.parse(row.snapshot_json),
  createdAt: row.created_at,
  availableAt: row.available_at ?? row.created_at,
  processingStartedAt: row.processing_started_at ?? null,
  processedAt: row.processed_at ?? null,
  discardedAt: row.discarded_at ?? null,
  attentionReason: row.attention_reason ?? null,
  actionActorLabel: row.action_actor_label ?? null,
  actionAt: row.action_at ?? null,
  lastError: row.last_error_code
    ? { code: row.last_error_code, message: row.last_error_message || '' }
    : null,
}) : null

const loadPrintStation = async (db, businessId, stationId) => {
  const row = await db.prepare(`SELECT id, business_id, name, platform, is_primary, auto_print_enabled,
    default_copies, last_seen_at, created_at, updated_at
    FROM print_stations WHERE id = ? AND business_id = ? LIMIT 1`)
    .bind(stationId, businessId).first()
  return mapStationRow(row)
}

export const listPrintStations = async (db, businessId) => {
  const result = await db.prepare(`SELECT id, business_id, name, platform, is_primary, auto_print_enabled,
    default_copies, last_seen_at, created_at, updated_at
    FROM print_stations WHERE business_id = ? ORDER BY created_at ASC, id ASC`)
    .bind(businessId).all()
  return rows(result).map(mapStationRow)
}

export const loadBusinessPrintSettings = async (db, businessId) => {
  const row = await db.prepare(`SELECT default_copies FROM business_print_settings
    WHERE business_id = ? LIMIT 1`).bind(businessId).first()
  return { defaultCopies: row?.default_copies ?? 2 }
}

export const saveBusinessPrintSettings = async (db, businessId, input, now = new Date()) => {
  const copies = input.defaultCopies
  if (copies !== 1 && copies !== 2) {
    throw repositoryError(400, 'INVALID_PRINT_COPIES', 'defaultCopies deve ser 1 ou 2.')
  }
  const at = timestamp(now)
  await db.prepare(`INSERT INTO business_print_settings (business_id, default_copies, created_at, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(business_id) DO UPDATE SET
      default_copies = excluded.default_copies, updated_at = excluded.updated_at`)
    .bind(businessId, copies, at, at).run()
  return loadBusinessPrintSettings(db, businessId)
}

export const upsertPrintStation = async (db, businessId, input, now = new Date()) => {
  const id = String(input.id || '')
  if (!id) throw repositoryError(400, 'PRINT_STATION_ID_REQUIRED', 'Identificador da estação é obrigatório.')
  const name = String(input.name || '').trim()
  if (!name) throw repositoryError(400, 'PRINT_STATION_NAME_REQUIRED', 'Nome da estação é obrigatório.')
  const platform = ['windows', 'android', 'other'].includes(input.platform) ? input.platform : 'other'
  const copies = assertCopies(input.defaultCopies ?? 2)
  const at = timestamp(now)

  await db.prepare(`INSERT INTO print_stations (
      id, business_id, name, platform, is_primary, auto_print_enabled, default_copies,
      last_seen_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      platform = excluded.platform,
      auto_print_enabled = excluded.auto_print_enabled,
      default_copies = excluded.default_copies,
      last_seen_at = excluded.last_seen_at,
      updated_at = excluded.updated_at
    WHERE print_stations.business_id = excluded.business_id`)
    .bind(id, businessId, name, platform, input.autoPrintEnabled ? 1 : 0, copies, at, at, at).run()

  const station = await loadPrintStation(db, businessId, id)
  if (!station) throw repositoryError(409, 'PRINT_STATION_ID_CONFLICT', 'Esta estação pertence a outro negócio.')
  return station
}

export const setPrimaryPrintStation = async (db, businessId, stationId, now = new Date()) => {
  const station = await loadPrintStation(db, businessId, stationId)
  if (!station) throw repositoryError(404, 'PRINT_STATION_NOT_FOUND', 'Estação de impressão não encontrada.')
  const at = timestamp(now)
  await db.batch([
    db.prepare(`UPDATE print_stations SET is_primary = 0, updated_at = ?
      WHERE business_id = ? AND is_primary = 1 AND id <> ?`).bind(at, businessId, stationId),
    db.prepare(`UPDATE print_stations SET is_primary = 1, updated_at = ?
      WHERE id = ? AND business_id = ?`).bind(at, stationId, businessId),
  ])
  return loadPrintStation(db, businessId, stationId)
}

export const touchPrintStation = async (db, businessId, stationId, now = new Date()) => {
  const at = timestamp(now)
  const row = await db.prepare(`UPDATE print_stations SET last_seen_at = ?, updated_at = ?
    WHERE id = ? AND business_id = ?
    RETURNING id, business_id, name, platform, is_primary, auto_print_enabled, default_copies,
      last_seen_at, created_at, updated_at`)
    .bind(at, at, stationId, businessId).first()
  return mapStationRow(row)
}

export const loadPrimaryAutomaticPrintStation = async (db, businessId) => {
  const row = await db.prepare(`SELECT id, business_id, name, platform, is_primary, auto_print_enabled,
    default_copies, last_seen_at, created_at, updated_at
    FROM print_stations
    WHERE business_id = ? AND is_primary = 1 AND auto_print_enabled = 1
    LIMIT 1`).bind(businessId).first()
  return mapStationRow(row)
}

export const prepareAutomaticPrintJobStatement = (db, businessId, input) => {
  const id = String(input.id || crypto.randomUUID())
  const copies = assertCopies(input.copies)
  const createdAt = timestamp(input.createdAt || new Date())
  return db.prepare(`INSERT INTO print_jobs (
      id, business_id, order_id, type, trigger, status, copies_requested, copies_printed,
      station_id, snapshot_json, created_at, available_at, processing_started_at, processed_at,
      last_error_code, last_error_message
    ) VALUES (?, ?, ?, 'order', 'automatic', 'pending', ?, 0, NULL, ?, ?, ?, NULL, NULL, NULL, NULL)`)
    .bind(id, businessId, input.orderId, copies, JSON.stringify(input.document), createdAt, timestamp(input.availableAt || input.createdAt || new Date()))
}

export const loadPrintJob = async (db, businessId, jobId) => {
  const row = await db.prepare(`SELECT * FROM print_jobs WHERE id = ? AND business_id = ? LIMIT 1`)
    .bind(jobId, businessId).first()
  return mapJobRow(row)
}

export const loadAutomaticPrintJobForOrder = async (db, businessId, orderId) => {
  const row = await db.prepare(`SELECT * FROM print_jobs
    WHERE business_id = ? AND order_id = ? AND type = 'order' AND trigger = 'automatic'
    LIMIT 1`).bind(businessId, orderId).first()
  return mapJobRow(row)
}

const routeIneligibleAutomaticJobsToAttention = async (db, businessId, now = new Date()) => {
  const at = timestamp(now)
  await db.prepare(`UPDATE print_jobs SET
      status = 'requires_attention', processed_at = ?,
      last_error_code = 'ORDER_NOT_PRINTABLE',
      last_error_message = 'O pedido foi finalizado ou cancelado antes da impressão automática.'
    WHERE business_id = ? AND type = 'order' AND trigger = 'automatic' AND status = 'pending'
      AND NOT ${AUTOMATIC_ORDER_ELIGIBLE_SQL}`)
    .bind(at, businessId).run()
}

const agePrintJobs = async (db, businessId, now = new Date()) => {
  const at = now instanceof Date ? now : new Date(now)
  const processedAt = at.toISOString()
  const pendingCutoff = new Date(at.getTime() - PRINT_PENDING_MAX_AGE_MS).toISOString()
  const processingCutoff = new Date(at.getTime() - PRINT_PROCESSING_MAX_AGE_MS).toISOString()

  await routeIneligibleAutomaticJobsToAttention(db, businessId, at)
  await db.batch([
    db.prepare(`UPDATE print_jobs SET
      status = 'requires_attention', processed_at = ?,
      last_error_code = 'PENDING_TOO_OLD',
      last_error_message = 'Impressão automática aguardou mais de 10 minutos.'
      WHERE business_id = ? AND trigger = 'automatic' AND status = 'pending' AND available_at <= ? AND available_at <= ?`)
      .bind(processedAt, businessId, pendingCutoff, processedAt),
    db.prepare(`UPDATE print_jobs SET
      status = 'requires_attention', processed_at = ?,
      last_error_code = 'PROCESSING_OUTCOME_UNKNOWN',
      last_error_message = 'A estação não confirmou o resultado da impressão.'
      WHERE business_id = ? AND status = 'processing' AND processing_started_at <= ?`)
      .bind(processedAt, businessId, processingCutoff),
  ])
}

export const listPrintJobs = async (db, businessId, options = {}) => {
  await agePrintJobs(db, businessId, options.now || new Date())
  const limit = clampLimit(options.limit)
  const result = options.orderId
    ? await db.prepare(`SELECT * FROM print_jobs WHERE business_id = ? AND order_id = ?
      ORDER BY priority DESC, COALESCE(available_at, created_at) ASC, created_at ASC, id ASC
      LIMIT ?`).bind(businessId, options.orderId, limit).all()
    : await db.prepare(`SELECT * FROM print_jobs WHERE business_id = ?
      ORDER BY priority DESC, COALESCE(available_at, created_at) ASC, created_at ASC, id ASC
      LIMIT ?`).bind(businessId, limit).all()
  return rows(result).map(mapJobRow)
}

export const createManualOrderPrintJob = async (db, businessId, input, now = new Date()) => {
  const copies = assertCopies(input.copies)
  const at = timestamp(now)
  const id = String(input.id || crypto.randomUUID())
  await db.prepare(`INSERT INTO print_jobs (
      id, business_id, order_id, type, trigger, status, copies_requested, copies_printed,
      station_id, snapshot_json, created_at, available_at, processing_started_at, processed_at,
      last_error_code, last_error_message
    ) VALUES (?, ?, ?, 'order', 'manual', 'pending', ?, 0, NULL, ?, ?, ?, NULL, NULL, NULL, NULL)`)
    .bind(id, businessId, input.orderId, copies, JSON.stringify(input.document), at, at).run()
  return loadPrintJob(db, businessId, id)
}

export const createTestPrintJob = async (db, businessId, input, now = new Date()) => {
  const station = await loadPrintStation(db, businessId, input.stationId)
  if (!station) throw repositoryError(404, 'PRINT_STATION_NOT_FOUND', 'Estação de impressão não encontrada.')
  const at = timestamp(now)
  const id = String(input.id || crypto.randomUUID())
  const document = input.document || createTestPrintDocument({ businessName: input.businessName, createdAt: at })
  await db.prepare(`INSERT INTO print_jobs (
      id, business_id, order_id, type, trigger, status, copies_requested, copies_printed,
      station_id, snapshot_json, created_at, available_at, processing_started_at, processed_at,
      last_error_code, last_error_message
    ) VALUES (?, ?, NULL, 'test', 'manual', 'pending', 1, 0, NULL, ?, ?, ?, NULL, NULL, NULL, NULL)`)
    .bind(id, businessId, JSON.stringify(document), at, at).run()
  return loadPrintJob(db, businessId, id)
}

const requireStation = async (db, businessId, stationId) => {
  const station = await loadPrintStation(db, businessId, stationId)
  if (!station) throw repositoryError(404, 'PRINT_STATION_NOT_FOUND', 'Estação de impressão não encontrada.')
  return station
}

export const claimNextAutomaticPrintJob = async (db, businessId, stationId, now = new Date()) => {
  await agePrintJobs(db, businessId, now)
  const station = await requireStation(db, businessId, stationId)
  if (!station.isPrimary || !station.autoPrintEnabled) {
    throw repositoryError(409, 'PRINT_STATION_NOT_PRIMARY', 'Somente a estação principal com impressão automática ativa pode assumir novos trabalhos.')
  }
  const at = timestamp(now)
  const row = await db.prepare(`UPDATE print_jobs SET
      status = 'processing', station_id = ?, processing_started_at = ?, processed_at = NULL,
      last_error_code = NULL, last_error_message = NULL
    WHERE id = (
      SELECT id FROM print_jobs
      WHERE business_id = ? AND type = 'order' AND trigger = 'automatic' AND status = 'pending' AND available_at <= ?
        AND ${AUTOMATIC_ORDER_ELIGIBLE_SQL}
      ORDER BY priority DESC, COALESCE(available_at, created_at) ASC, created_at ASC, id ASC LIMIT 1
    ) AND business_id = ? AND type = 'order' AND trigger = 'automatic' AND status = 'pending' AND available_at <= ?
    RETURNING *`)
    .bind(stationId, at, businessId, at, businessId, at).first()
  return mapJobRow(row)
}

export const claimPrintJob = async (db, businessId, jobId, stationId, now = new Date()) => {
  await requireStation(db, businessId, stationId)
  await routeIneligibleAutomaticJobsToAttention(db, businessId, now)
  const at = timestamp(now)
  const row = await db.prepare(`UPDATE print_jobs SET
      status = 'processing', station_id = ?, processing_started_at = ?, processed_at = NULL,
      last_error_code = NULL, last_error_message = NULL
    WHERE id = ? AND business_id = ?
      AND ((status = 'pending' AND available_at <= ?)
        OR (status = 'printed' AND copies_printed > 0 AND copies_printed < copies_requested))
      AND (trigger <> 'automatic' OR ${AUTOMATIC_ORDER_ELIGIBLE_SQL})
    RETURNING *`).bind(stationId, at, jobId, businessId, at).first()
  if (row) return mapJobRow(row)
  const existing = await loadPrintJob(db, businessId, jobId)
  if (!existing) throw repositoryError(404, 'PRINT_JOB_NOT_FOUND', 'Trabalho de impressão não encontrado.')
  throw repositoryError(409, 'PRINT_JOB_NOT_PENDING', 'Este trabalho de impressão não está pendente.')
}

export const markPrintJobPrinted = async (db, businessId, jobId, stationId, copiesPrinted, now = new Date()) => {
  const copies = assertCopies(copiesPrinted)
  const at = timestamp(now)
  const row = await db.prepare(`UPDATE print_jobs SET
      status = 'printed', copies_printed = ?, processed_at = ?,
      last_error_code = NULL, last_error_message = NULL
    WHERE id = ? AND business_id = ? AND status = 'processing' AND station_id = ?
      AND ? > copies_printed AND ? <= copies_requested
    RETURNING *`).bind(copies, at, jobId, businessId, stationId, copies, copies).first()
  if (row) return mapJobRow(row)
  const existing = await loadPrintJob(db, businessId, jobId)
  if (!existing) throw repositoryError(404, 'PRINT_JOB_NOT_FOUND', 'Trabalho de impressão não encontrado.')
  throw repositoryError(409, 'PRINT_JOB_NOT_PROCESSING', 'Este trabalho não está sendo processado por esta estação.')
}

export const markPrintJobFailed = async (db, businessId, jobId, stationId, failure = {}, now = new Date()) => {
  const at = timestamp(now)
  const code = String(failure.code || 'PRINT_FAILED').slice(0, 100)
  const message = String(failure.message || 'Não foi possível imprimir o pedido.').slice(0, 500)
  const qzFailure = String(failure.transport || '').toLowerCase() === 'qz' || code.toUpperCase().startsWith('QZ_')
  const nextStatus = failure.uncertain || qzFailure ? 'requires_attention' : 'failed'
  const row = await db.prepare(`UPDATE print_jobs SET
      status = ?, processed_at = ?, last_error_code = ?, last_error_message = ?
    WHERE id = ? AND business_id = ? AND status = 'processing' AND station_id = ?
    RETURNING *`).bind(nextStatus, at, code, message, jobId, businessId, stationId).first()
  if (row) return mapJobRow(row)
  const existing = await loadPrintJob(db, businessId, jobId)
  if (!existing) throw repositoryError(404, 'PRINT_JOB_NOT_FOUND', 'Trabalho de impressão não encontrado.')
  throw repositoryError(409, 'PRINT_JOB_NOT_PROCESSING', 'Este trabalho não está sendo processado por esta estação.')
}

export const discardPrintJob = async (db, businessId, jobId, actorLabel = 'Sistema', now = new Date()) => {
  const existing = await loadPrintJob(db, businessId, jobId)
  if (!existing) throw repositoryError(404, 'PRINT_JOB_NOT_FOUND', 'Trabalho de impressão não encontrado.')
  if (existing.status === 'discarded') return existing

  const partialPrinted = existing.status === 'printed'
    && existing.copiesPrinted > 0
    && existing.copiesPrinted < existing.copiesRequested
  const discardable = ['pending', 'queued', 'failed', 'requires_attention', 'awaiting_second_copy'].includes(existing.status)
    || partialPrinted
  if (!discardable) {
    throw repositoryError(409, 'PRINT_JOB_DISCARD_NOT_ALLOWED', 'Este trabalho de impressão não pode ser descartado neste estado.')
  }

  const at = timestamp(now)
  const actor = String(actorLabel || '').trim().slice(0, 100) || 'Sistema'
  const row = await db.prepare(`UPDATE print_jobs SET
      status = 'discarded', discarded_at = ?, action_actor_label = ?, action_at = ?
    WHERE id = ? AND business_id = ?
      AND (status IN ('pending', 'queued', 'failed', 'requires_attention', 'awaiting_second_copy')
        OR (status = 'printed' AND copies_printed > 0 AND copies_printed < copies_requested))
    RETURNING *`).bind(at, actor, at, jobId, businessId).first()
  if (row) return mapJobRow(row)

  const current = await loadPrintJob(db, businessId, jobId)
  if (current?.status === 'discarded') return current
  throw repositoryError(409, 'PRINT_JOB_DISCARD_NOT_ALLOWED', 'Este trabalho de impressão não pode ser descartado neste estado.')
}

export const prioritizePrintJob = async (db, businessId, jobId) => {
  const row = await db.prepare(`UPDATE print_jobs SET priority = 1
    WHERE id = ? AND business_id = ? AND status = 'pending'
    RETURNING *`).bind(jobId, businessId).first()
  if (row) return mapJobRow(row)

  const existing = await loadPrintJob(db, businessId, jobId)
  if (!existing) throw repositoryError(404, 'PRINT_JOB_NOT_FOUND', 'Trabalho de impressão não encontrado.')
  throw repositoryError(409, 'PRINT_JOB_PRIORITIZE_NOT_ALLOWED', 'Este trabalho de impressão não pode ser priorizado neste estado.')
}

export const retryPrintJob = async (db, businessId, jobId, now = new Date()) => {
  const row = await db.prepare(`UPDATE print_jobs SET
      status = CASE
        WHEN copies_printed > 0 AND copies_printed < copies_requested THEN 'printed'
        ELSE 'pending'
      END,
      station_id = NULL, processing_started_at = NULL, processed_at = NULL,
      last_error_code = NULL, last_error_message = NULL
    WHERE id = ? AND business_id = ? AND status IN ('failed', 'requires_attention')
      AND (trigger <> 'automatic' OR ${AUTOMATIC_ORDER_ELIGIBLE_SQL})
    RETURNING *`).bind(jobId, businessId).first()
  if (row) return mapJobRow(row)
  const existing = await loadPrintJob(db, businessId, jobId)
  if (!existing) throw repositoryError(404, 'PRINT_JOB_NOT_FOUND', 'Trabalho de impressão não encontrado.')
  throw repositoryError(409, 'PRINT_JOB_RETRY_NOT_ALLOWED', 'Este trabalho não pode ser tentado novamente neste estado.')
}