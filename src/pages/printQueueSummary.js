const emptySummary = () => ({ pending: 0, awaitingConfirmation: 0, waitingSecondCopy: 0, attention: 0 })

export const buildPrintQueueSummary = (jobs = []) => jobs.reduce((summary, job) => {
  if (job?.status === 'pending') summary.pending += 1
  if (job?.status === 'awaiting_confirmation') summary.awaitingConfirmation += 1
  if (job?.status === 'awaiting_second_copy') summary.waitingSecondCopy += 1
  if (['failed', 'requires_attention'].includes(job?.status)) summary.attention += 1
  return summary
}, emptySummary())

export const getPrintStationSummary = (station) => {
  const health = station?.health
  if (!health || typeof health.online !== 'boolean') {
    return { onlineLabel: 'Status indisponível', qzLabel: null, printerLabel: null }
  }
  return {
    onlineLabel: health.online ? 'Online' : 'Offline',
    qzLabel: typeof health.qzReady === 'boolean' ? (health.qzReady ? 'QZ conectado' : 'QZ desconectado') : null,
    printerLabel: typeof health.printerReady === 'boolean' ? (health.printerReady ? 'Fila encontrada' : 'Fila indisponível') : null,
  }
}
