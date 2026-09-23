const emptySummary = () => ({ pending: 0, awaitingConfirmation: 0, waitingSecondCopy: 0, attention: 0, discardable: 0 })

const count = (value) => Math.max(0, Number(value) || 0)

export const normalizePrintQueueSummary = (summary = {}) => ({
  pending: count(summary.pending),
  awaitingConfirmation: count(summary.awaitingConfirmation),
  waitingSecondCopy: count(summary.waitingSecondCopy ?? summary.awaitingSecondCopy),
  attention: count(summary.attention),
  discardable: count(summary.discardable),
})

export const buildPrintQueueSummary = (jobs = []) => normalizePrintQueueSummary(jobs.reduce((summary, job) => {
  if (job?.status === 'pending') summary.pending += 1
  if (job?.status === 'awaiting_confirmation') summary.awaitingConfirmation += 1
  if (job?.status === 'awaiting_second_copy') summary.waitingSecondCopy += 1
  if (['failed', 'requires_attention'].includes(job?.status)) summary.attention += 1
  const unresolvedAttempt = job?.attempt?.status === 'unknown' && !job?.attempt?.resolution
  if (['pending', 'queued', 'failed', 'requires_attention', 'awaiting_second_copy'].includes(job?.status) && !unresolvedAttempt) {
    summary.discardable += 1
  }
  return summary
}, emptySummary()))
