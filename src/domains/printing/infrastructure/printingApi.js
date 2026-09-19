import { apiRequest, apiTextRequest, withJson } from '../../../infrastructure/api/httpClient.js'

export const getTableTabPrintDocument = (id) => apiRequest(`/api/table-tabs/${encodeURIComponent(id)}/print-document`)
export const createManualTableTabPrintJob = (id, copies) => apiRequest(`/api/table-tabs/${encodeURIComponent(id)}/print-jobs`, withJson('POST', { copies }))


export const getPrintSettings = () => apiRequest('/api/printing/settings')
export const savePrintSettings = (settings) => apiRequest('/api/printing/settings', withJson('PUT', settings))
export const getPrintStations = () => apiRequest('/api/printing/stations')
export const upsertPrintStation = (id, station) => apiRequest(`/api/printing/stations/${encodeURIComponent(id)}`, withJson('PUT', station))
export const heartbeatPrintStation = (id, health = {}) => apiRequest(
  `/api/printing/stations/${encodeURIComponent(id)}/heartbeat`,
  withJson('POST', {
    qzReady: Boolean(health.qzReady),
    printerReady: Boolean(health.printerReady),
    ...(health.physicalState ? { physicalState: health.physicalState } : {}),
    ...(health.physicalStatusText ? { physicalStatusText: health.physicalStatusText } : {}),
    ...(health.physicalStatusCode != null ? { physicalStatusCode: health.physicalStatusCode } : {}),
  }),
)
export const makePrimaryPrintStation = (id) => apiRequest(`/api/printing/stations/${encodeURIComponent(id)}/make-primary`, { method: 'POST' })
export const getPrintJobs = (options = {}) => {
  const params = new URLSearchParams()
  for (const key of ['orderId', 'limit', 'scope', 'page', 'pageSize', 'sortBy', 'sortDir', 'status', 'trigger', 'search']) {
    if (options[key] != null && String(options[key]).trim() !== '') params.set(key, String(options[key]))
  }
  return apiRequest(`/api/printing/jobs${params.size ? `?${params}` : ''}`)
}
export const getPrintQueueSummary = () => apiRequest('/api/printing/jobs/summary')
export const createPrintAttempt = (jobId, stationId, copyNumber) => apiRequest(
  `/api/printing/jobs/${encodeURIComponent(jobId)}/attempts`, withJson('POST', { stationId, copyNumber }),
)
export const markPrintAttemptSubmitting = (attemptId, stationId) => apiRequest(
  `/api/printing/attempts/${encodeURIComponent(attemptId)}/submitting`, withJson('POST', { stationId }),
)
export const recordPrintAttemptEvent = (attemptId, stationId, event) => apiRequest(
  `/api/printing/attempts/${encodeURIComponent(attemptId)}/events`, withJson('POST', { stationId, event }),
)
export const resolvePrintOutcome = (jobId, attemptId, resolution, actorLabel = 'Operador') => apiRequest(
  `/api/printing/jobs/${encodeURIComponent(jobId)}/resolve-outcome`, withJson('POST', { attemptId, resolution, actorLabel }),
)
export const setPrintStationRecovery = (stationId, state) => apiRequest(
  `/api/printing/stations/${encodeURIComponent(stationId)}/recovery`, withJson('POST', { state }),
)
export const claimNextRecoveryPrintJob = (stationId) => apiRequest('/api/printing/jobs/claim-recovery-next', withJson('POST', { stationId }))
export const discardPendingPrintJobs = (actorLabel = 'Sistema') => apiRequest('/api/printing/jobs/discard-pending', withJson('POST', { actorLabel }))
export const createManualPrintJob = (orderId, copies) => apiRequest(`/api/orders/${encodeURIComponent(orderId)}/print-jobs`, withJson('POST', { copies }))
export const createTestPrintJob = (stationId) => apiRequest('/api/printing/test-jobs', withJson('POST', { stationId }))
export const claimNextPrintJob = (stationId) => apiRequest('/api/printing/jobs/claim-next', withJson('POST', { stationId }))
export const claimPrintJob = (jobId, stationId) => apiRequest(`/api/printing/jobs/${encodeURIComponent(jobId)}/claim`, withJson('POST', { stationId }))
export const acknowledgeSecondCopyPrompt = (jobId, stationId) => apiRequest(`/api/printing/jobs/${encodeURIComponent(jobId)}/second-copy-prompt`, withJson('POST', { stationId }))
export const requestSecondCopy = (jobId, actorLabel = 'Sistema') => apiRequest(`/api/printing/jobs/${encodeURIComponent(jobId)}/request-second-copy`, withJson('POST', { actorLabel }))
export const skipSecondCopy = (jobId, actorLabel = 'Sistema') => apiRequest(`/api/printing/jobs/${encodeURIComponent(jobId)}/skip-second-copy`, withJson('POST', { actorLabel }))
export const completePrintJob = (jobId, stationId, copiesPrinted) => apiRequest(`/api/printing/jobs/${encodeURIComponent(jobId)}/complete`, withJson('POST', { stationId, copiesPrinted }))
export const failPrintJob = (jobId, stationId, failure) => apiRequest(`/api/printing/jobs/${encodeURIComponent(jobId)}/fail`, withJson('POST', { stationId, ...failure }))
export const retryPrintJob = (jobId, stationId) => apiRequest(`/api/printing/jobs/${encodeURIComponent(jobId)}/retry`, withJson('POST', { stationId }))
export const discardPrintJob = (jobId, actorLabel = 'Sistema') => apiRequest(`/api/printing/jobs/${encodeURIComponent(jobId)}/discard`, withJson('POST', { actorLabel }))
export const prioritizePrintJob = (jobId) => apiRequest(`/api/printing/jobs/${encodeURIComponent(jobId)}/prioritize`, { method: 'POST' })
export const forcePrintJob = (jobId, actorLabel = 'Sistema') => apiRequest(`/api/printing/jobs/${encodeURIComponent(jobId)}/force-print`, withJson('POST', { actorLabel }))
export const reprintPrintJob = (jobId, copies) => apiRequest(`/api/printing/jobs/${encodeURIComponent(jobId)}/reprint`, withJson('POST', { copies }))
export const getOrderPrintDocument = (orderId) => apiRequest(`/api/orders/${encodeURIComponent(orderId)}/print-document`)
export const getQzCertificate = () => apiTextRequest('/api/printing/qz/certificate')
export const signQzPayload = (toSign) => apiTextRequest('/api/printing/qz/sign', withJson('POST', { toSign }))
