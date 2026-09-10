import { loadPrintJob, resolvePrintStationHealth } from './orderPrintingRepository.js'

const repositoryError = (status, code, message) => Object.assign(new Error(message), { status, code })
const timestamp = (value = new Date()) => value instanceof Date ? value.toISOString() : String(value)

const AUTOMATIC_ORDER_ELIGIBLE_SQL = `EXISTS (
  SELECT 1 FROM orders
  WHERE orders.id = print_jobs.order_id
    AND orders.business_id = print_jobs.business_id
    AND orders.status NOT IN ('Cancelado', 'Finalizado')
)`

const loadQzExecutor = async (db, businessId, stationId, now) => {
  const row = await db.prepare(`SELECT * FROM print_stations WHERE id = ? AND business_id = ? LIMIT 1`)
    .bind(stationId, businessId).first()
  if (!row) throw repositoryError(404, 'PRINT_STATION_NOT_FOUND', 'Estação de impressão não encontrada.')

  const station = {
    id: row.id,
    platform: row.platform,
    isPrimary: Boolean(row.is_primary),
    autoPrintEnabled: Boolean(row.auto_print_enabled),
    lastSeenAt: row.last_seen_at ?? null,
    qzReady: Boolean(row.qz_ready),
    printerReady: Boolean(row.printer_ready),
    physicalState: row.physical_state ?? 'ready',
    recoveryState: row.recovery_state ?? 'normal',
  }
  if (!station.isPrimary) {
    throw repositoryError(409, 'PRINT_STATION_NOT_PRIMARY', 'Somente a estação principal pode executar trabalhos de impressão.')
  }
  if (station.platform !== 'windows') {
    throw repositoryError(409, 'PRINT_STATION_NOT_QZ_EXECUTOR', 'Somente a estação principal Windows com QZ pode executar trabalhos de impressão.')
  }
  station.health = resolvePrintStationHealth(station, now)
  if (!station.health.ready) {
    throw repositoryError(409, 'PRINT_STATION_NOT_READY', 'A estação principal QZ não está pronta para imprimir.')
  }
  return station
}

export const claimNextPrintJob = async (db, businessId, stationId, now = new Date()) => {
  const station = await loadQzExecutor(db, businessId, stationId, now)
  if (station.recoveryState !== 'normal') return null
  const at = timestamp(now)
  const automaticEnabled = station.autoPrintEnabled ? 1 : 0
  const row = await db.prepare(`UPDATE print_jobs SET
      status = 'processing', station_id = ?, processing_started_at = ?, processed_at = NULL,
      last_error_code = NULL, last_error_message = NULL
    WHERE id = (
      SELECT id FROM print_jobs
      WHERE business_id = ? AND type = 'order' AND status = 'pending' AND available_at <= ?
        AND (
          (copies_requested = 2 AND copies_printed = 1 AND second_copy_requested_at IS NOT NULL AND second_copy_skipped_at IS NULL)
          OR
          trigger = 'manual'
          OR last_error_code = 'FORCE_PRINT_AUTHORIZED'
          OR (trigger = 'automatic' AND ? = 1 AND ${AUTOMATIC_ORDER_ELIGIBLE_SQL})
        )
      ORDER BY CASE WHEN second_copy_requested_at IS NOT NULL AND copies_requested = 2 AND copies_printed = 1 THEN 1 ELSE 0 END DESC,
        priority DESC, COALESCE(available_at, created_at) ASC, created_at ASC, id ASC LIMIT 1
    ) AND business_id = ? AND type = 'order' AND status = 'pending'
    RETURNING id`)
    .bind(stationId, at, businessId, at, automaticEnabled, businessId).first()

  if (!row?.id) return null
  return loadPrintJob(db, businessId, row.id)
}
