const repositoryError = (status, code, message) => Object.assign(new Error(message), { status, code })
const timestamp = (value = new Date()) => value instanceof Date ? value.toISOString() : String(value)
const rows = (result) => Array.isArray(result?.results) ? result.results : []

const mapAttemptRow = (row) => row ? ({
  id: row.id,
  jobId: row.job_id,
  copyNumber: Number(row.copy_number),
  attemptNumber: Number(row.attempt_number),
  stationId: row.station_id ?? null,
  spoolJobName: row.spool_job_name,
  spoolJobId: row.spool_job_id ?? null,
  status: row.status,
  submissionStartedAt: row.submission_started_at ?? null,
  submittedAt: row.submitted_at ?? null,
  lastEventAt: row.last_event_at ?? null,
  completedAt: row.completed_at ?? null,
  resolution: row.resolution ?? null,
  resolutionActorLabel: row.resolution_actor_label ?? null,
  resolvedAt: row.resolved_at ?? null,
  lastError: row.last_error_code
    ? { code: row.last_error_code, message: row.last_error_message || '' }
    : null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
}) : null

const loadAttempt = async (db, businessId, attemptId) => {
  const row = await db.prepare(`SELECT * FROM print_job_attempts
    WHERE id = ? AND business_id = ? LIMIT 1`).bind(attemptId, businessId).first()
  return mapAttemptRow(row)
}

const loadJob = async (db, businessId, jobId) => db.prepare(`SELECT * FROM print_jobs
  WHERE id = ? AND business_id = ? LIMIT 1`).bind(jobId, businessId).first()

const requireAttempt = async (db, businessId, attemptId) => {
  const attempt = await loadAttempt(db, businessId, attemptId)
  if (!attempt) throw repositoryError(404, 'PRINT_ATTEMPT_NOT_FOUND', 'Tentativa de impressão não encontrada.')
  return attempt
}

const requireStation = async (db, businessId, stationId) => {
  const station = await db.prepare(`SELECT id FROM print_stations
    WHERE id = ? AND business_id = ? LIMIT 1`).bind(stationId, businessId).first()
  if (!station) throw repositoryError(404, 'PRINT_STATION_NOT_FOUND', 'Estação de impressão não encontrada.')
  return station
}

const requireAttemptStation = async (db, businessId, attemptId, stationId) => {
  const attempt = await requireAttempt(db, businessId, attemptId)
  await requireStation(db, businessId, stationId)
  if (attempt.stationId !== stationId) {
    throw repositoryError(409, 'PRINT_ATTEMPT_STATION_MISMATCH', 'A tentativa pertence a outra estação.')
  }
  return attempt
}

const requireSubmittingJob = async (db, businessId, attempt, stationId) => {
  const job = await loadJob(db, businessId, attempt.jobId)
  if (!job) throw repositoryError(404, 'PRINT_JOB_NOT_FOUND', 'Trabalho de impressão não encontrado.')
  if (job.station_id !== stationId || !['processing', 'awaiting_confirmation', 'requires_attention'].includes(job.status)) {
    throw repositoryError(409, 'PRINT_ATTEMPT_JOB_NOT_ACTIVE', 'O trabalho não está ativo nesta estação.')
  }
  return job
}

const eventName = (event) => String(
  typeof event === 'string' ? event : event?.type ?? event?.status ?? event?.name ?? '',
).trim().toUpperCase()

const eventDetails = (event) => ({
  spoolJobId: Number.isInteger(event?.spoolJobId) ? event.spoolJobId : null,
  message: typeof event?.message === 'string' ? event.message : null,
})

export const createPrintJobAttempt = async (db, businessId, input, now = new Date()) => {
  const jobId = String(input?.jobId || '')
  const stationId = String(input?.stationId || '')
  const copyNumber = Number(input?.copyNumber)
  if (!jobId || !stationId) {
    throw repositoryError(400, 'PRINT_ATTEMPT_INPUT_REQUIRED', 'Trabalho e estação são obrigatórios para a tentativa.')
  }

  const job = await loadJob(db, businessId, jobId)
  if (!job) throw repositoryError(404, 'PRINT_JOB_NOT_FOUND', 'Trabalho de impressão não encontrado.')
  await requireStation(db, businessId, stationId)
  const expectedCopy = Number(job.copies_printed) + 1
  if (copyNumber !== expectedCopy || copyNumber > Number(job.copies_requested)) {
    throw repositoryError(409, 'PRINT_ATTEMPT_COPY_NOT_EXPECTED', 'A tentativa não corresponde à próxima via esperada.')
  }
  if (job.status !== 'processing' || job.station_id !== stationId) {
    throw repositoryError(409, 'PRINT_ATTEMPT_JOB_NOT_PROCESSING', 'O trabalho não está sendo processado por esta estação.')
  }

  const previous = await db.prepare(`SELECT COALESCE(MAX(attempt_number), 0) AS attempt_number
    FROM print_job_attempts WHERE job_id = ? AND copy_number = ?`).bind(jobId, copyNumber).first()
  const attemptNumber = Number(previous?.attempt_number || 0) + 1
  const id = crypto.randomUUID()
  const at = timestamp(now)
  const spoolJobName = `GESTAO-DELIVERY:${jobId}:COPY:${copyNumber}:ATTEMPT:${attemptNumber}`
  await db.prepare(`INSERT INTO print_job_attempts (
    id, business_id, job_id, copy_number, attempt_number, station_id, spool_job_name,
    status, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, 'prepared', ?, ?)`)
    .bind(id, businessId, jobId, copyNumber, attemptNumber, stationId, spoolJobName, at, at).run()
  return requireAttempt(db, businessId, id)
}

export const markPrintAttemptSubmitting = async (db, businessId, attemptId, stationId, now = new Date()) => {
  const attempt = await requireAttemptStation(db, businessId, attemptId, stationId)
  const job = await requireSubmittingJob(db, businessId, attempt, stationId)
  if (attempt.submissionStartedAt) return attempt
  if (attempt.status !== 'prepared' || job.status !== 'processing') {
    throw repositoryError(409, 'PRINT_ATTEMPT_NOT_PREPARED', 'A tentativa não pode iniciar uma nova submissão.')
  }

  const at = timestamp(now)
  await db.batch([
    db.prepare(`UPDATE print_job_attempts SET
      status = 'submitting', submission_started_at = ?, updated_at = ?
      WHERE id = ? AND business_id = ? AND station_id = ? AND status = 'prepared'`)
      .bind(at, at, attemptId, businessId, stationId),
    db.prepare(`UPDATE print_jobs SET status = 'awaiting_confirmation'
      WHERE id = ? AND business_id = ? AND station_id = ? AND status = 'processing'`)
      .bind(attempt.jobId, businessId, stationId),
  ])
  return requireAttempt(db, businessId, attemptId)
}

const markComplete = async (db, businessId, attempt, stationId, event, now) => {
  if (attempt.status === 'complete' || attempt.resolution) return attempt
  if (!attempt.submissionStartedAt) {
    throw repositoryError(409, 'PRINT_ATTEMPT_NOT_SUBMITTED', 'A confirmação exige uma submissão persistida.')
  }
  const at = timestamp(now)
  const details = eventDetails(event)
  await db.batch([
    db.prepare(`UPDATE print_job_attempts SET
      status = 'complete', spool_job_id = COALESCE(?, spool_job_id),
      last_event_at = ?, completed_at = ?, updated_at = ?
      WHERE id = ? AND business_id = ? AND station_id = ?
        AND status <> 'complete' AND resolution IS NULL`)
      .bind(details.spoolJobId, at, at, at, attempt.id, businessId, stationId),
    db.prepare(`UPDATE print_jobs SET
      copies_printed = MIN(copies_requested, copies_printed + 1),
      status = CASE WHEN copies_printed + 1 >= copies_requested THEN 'printed' ELSE 'awaiting_second_copy' END,
      processed_at = ?, last_error_code = NULL, last_error_message = NULL
      WHERE id = ? AND business_id = ? AND station_id = ?
        AND status IN ('awaiting_confirmation', 'requires_attention')
        AND EXISTS (
          SELECT 1 FROM print_job_attempts
          WHERE id = ? AND business_id = ? AND status = 'complete'
            AND completed_at = ? AND resolution IS NULL
        )`)
      .bind(at, attempt.jobId, businessId, stationId, attempt.id, businessId, at),
  ])
  return requireAttempt(db, businessId, attempt.id)
}

export const markPrintAttemptUnknown = async (db, businessId, attemptId, stationId, _reason, now = new Date()) => {
  const attempt = await requireAttemptStation(db, businessId, attemptId, stationId)
  await requireSubmittingJob(db, businessId, attempt, stationId)
  if (attempt.status === 'complete' || attempt.resolution) return attempt
  if (!attempt.submissionStartedAt) {
    throw repositoryError(409, 'PRINT_ATTEMPT_NOT_SUBMITTED', 'O resultado só pode ficar incerto depois da submissão.')
  }

  const at = timestamp(now)
  const code = 'PRINT_OUTCOME_UNKNOWN'
  const message = 'O resultado físico da impressão não foi confirmado.'
  await db.batch([
    db.prepare(`UPDATE print_job_attempts SET
      status = 'unknown', last_event_at = ?, last_error_code = ?, last_error_message = ?, updated_at = ?
      WHERE id = ? AND business_id = ? AND station_id = ? AND status <> 'complete' AND resolution IS NULL`)
      .bind(at, code, message, at, attemptId, businessId, stationId),
    db.prepare(`UPDATE print_jobs SET
      status = 'requires_attention', processed_at = ?, last_error_code = ?, last_error_message = ?
      WHERE id = ? AND business_id = ? AND station_id = ? AND status IN ('awaiting_confirmation', 'processing')`)
      .bind(at, code, message, attempt.jobId, businessId, stationId),
  ])
  return requireAttempt(db, businessId, attemptId)
}

export const recordPrintAttemptEvent = async (db, businessId, attemptId, stationId, event, now = new Date()) => {
  const attempt = await requireAttemptStation(db, businessId, attemptId, stationId)
  const name = eventName(event)
  if (name === 'COMPLETE') return markComplete(db, businessId, attempt, stationId, event, now)
  if (['OFFLINE', 'DELETED', 'CANCELED', 'ABORTED', 'ERROR', 'FAILED', 'PAPER_OUT', 'INTERVENTION'].includes(name)) {
    return markPrintAttemptUnknown(db, businessId, attemptId, stationId, 'PRINT_OUTCOME_UNKNOWN', now)
  }
  if (!['SCHEDULED', 'SENT', 'SPOOLING', 'PRINTING', 'RETAINED'].includes(name)) {
    throw repositoryError(400, 'PRINT_ATTEMPT_EVENT_INVALID', 'Evento de impressão não reconhecido.')
  }
  await requireSubmittingJob(db, businessId, attempt, stationId)
  if (attempt.status === 'complete' || attempt.resolution) return attempt

  const at = timestamp(now)
  const details = eventDetails(event)
  const status = ['SCHEDULED', 'SENT', 'SPOOLING'].includes(name) ? 'spooling' : 'printing'
  await db.prepare(`UPDATE print_job_attempts SET
    status = ?, spool_job_id = COALESCE(?, spool_job_id),
    submitted_at = COALESCE(submitted_at, ?), last_event_at = ?, updated_at = ?
    WHERE id = ? AND business_id = ? AND station_id = ? AND status <> 'complete' AND resolution IS NULL`)
    .bind(status, details.spoolJobId, at, at, at, attemptId, businessId, stationId).run()
  return requireAttempt(db, businessId, attemptId)
}

export const resolveUnknownPrintAttempt = async (db, businessId, jobId, attemptId, resolution, actorLabel, now = new Date()) => {
  if (!['manual_printed', 'manual_not_printed'].includes(resolution)) {
    throw repositoryError(400, 'PRINT_ATTEMPT_RESOLUTION_INVALID', 'A resolução manual é inválida.')
  }
  const attempt = await requireAttempt(db, businessId, attemptId)
  if (attempt.jobId !== jobId) throw repositoryError(409, 'PRINT_ATTEMPT_JOB_MISMATCH', 'A tentativa não pertence a este trabalho.')
  if (attempt.resolution) {
    if (attempt.resolution !== resolution) throw repositoryError(409, 'PRINT_ATTEMPT_ALREADY_RESOLVED', 'A tentativa já foi resolvida.')
    return attempt
  }
  if (attempt.status !== 'unknown') {
    throw repositoryError(409, 'PRINT_ATTEMPT_NOT_UNKNOWN', 'A tentativa não requer confirmação manual.')
  }

  const job = await loadJob(db, businessId, jobId)
  if (!job || job.status !== 'requires_attention') {
    throw repositoryError(409, 'PRINT_ATTEMPT_JOB_NOT_ATTENTION', 'O trabalho não requer confirmação manual.')
  }
  const at = timestamp(now)
  const actor = String(actorLabel || '').trim() || 'Operador'
  const nextStatus = resolution === 'manual_printed'
    ? (Number(job.copies_printed) + 1 >= Number(job.copies_requested) ? 'printed' : 'awaiting_second_copy')
    : 'pending'
  const nextCopies = resolution === 'manual_printed'
    ? Math.min(Number(job.copies_requested), Number(job.copies_printed) + 1)
    : Number(job.copies_printed)
  await db.batch([
    db.prepare(`UPDATE print_job_attempts SET
      resolution = ?, resolution_actor_label = ?, resolved_at = ?, updated_at = ?
      WHERE id = ? AND business_id = ? AND status = 'unknown' AND resolution IS NULL`)
      .bind(resolution, actor, at, at, attemptId, businessId),
    db.prepare(`UPDATE print_jobs SET
      status = ?, copies_printed = ?, station_id = CASE WHEN ? = 'manual_not_printed' THEN NULL ELSE station_id END,
      processing_started_at = CASE WHEN ? = 'manual_not_printed' THEN NULL ELSE processing_started_at END,
      processed_at = ?, available_at = CASE WHEN ? = 'manual_not_printed' THEN ? ELSE available_at END,
      last_error_code = NULL, last_error_message = NULL, action_actor_label = ?, action_at = ?
      WHERE id = ? AND business_id = ? AND status = 'requires_attention'
        AND EXISTS (
          SELECT 1 FROM print_job_attempts
          WHERE id = ? AND business_id = ? AND resolution = ? AND resolved_at = ?
        )`)
      .bind(nextStatus, nextCopies, resolution, resolution, at, resolution, at, actor, at,
        jobId, businessId, attemptId, businessId, resolution, at),
  ])
  return requireAttempt(db, businessId, attemptId)
}

export const listPrintJobAttempts = async (db, businessId, jobId) => {
  const result = await db.prepare(`SELECT * FROM print_job_attempts
    WHERE business_id = ? AND job_id = ? ORDER BY copy_number ASC, attempt_number ASC, created_at ASC, id ASC`)
    .bind(businessId, jobId).all()
  return rows(result).map(mapAttemptRow)
}
