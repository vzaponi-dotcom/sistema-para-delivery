const emptySummary = () => ({ pending: 0, awaitingConfirmation: 0, waitingSecondCopy: 0, attention: 0 })

export const buildPrintQueueSummary = (jobs = []) => jobs.reduce((summary, job) => {
  if (job?.status === 'pending') summary.pending += 1
  if (job?.status === 'awaiting_confirmation') summary.awaitingConfirmation += 1
  if (job?.status === 'awaiting_second_copy') summary.waitingSecondCopy += 1
  if (['failed', 'requires_attention'].includes(job?.status)) summary.attention += 1
  return summary
}, emptySummary())
