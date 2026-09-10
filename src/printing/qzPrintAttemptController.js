const attemptValue = (value) => value?.attempt || value

const copyDetails = (job) => {
  const totalCopies = Number(job?.copiesRequested)
  const copiesPrinted = Number(job?.copiesPrinted || 0)
  if (![1, 2].includes(totalCopies) || !Number.isInteger(copiesPrinted) || copiesPrinted < 0 || copiesPrinted >= totalCopies) {
    throw new RangeError('copiesPrinted must identify a remaining copy')
  }
  return { copyNumber: copiesPrinted + 1, totalCopies }
}

const completeEvent = (outcome, attempt) => ({
  type: 'COMPLETE',
  jobName: attempt.spoolJobName,
  ...(outcome?.jobId != null ? { spoolJobId: outcome.jobId } : {}),
})

export const executeQzPrintAttempt = async ({
  job, stationId, renderer, createAttempt, markSubmitting, sendBytes, awaitOutcome, recordEvent, markUnknown, refresh, trackAttempt, untrackAttempt,
}) => {
  let attempt = null
  let riskPersisted = false
  try {
    const { copyNumber, totalCopies } = copyDetails(job)
    const renderOptions = job?.document?.type === 'order' ? { copies: 1, copyNumber, totalCopies } : { copies: 1 }
    const bytes = renderer(job.document, renderOptions)
    attempt = attemptValue(await createAttempt(job.id, stationId, copyNumber))
    trackAttempt?.(attempt, stationId)
    attempt = attemptValue(await markSubmitting(attempt.id, stationId)) || attempt
    riskPersisted = true
    const outcome = awaitOutcome(attempt.spoolJobName)
    await sendBytes(bytes, { jobName: attempt.spoolJobName })
    const completed = attemptValue(await recordEvent(attempt.id, stationId, completeEvent(await outcome, attempt)))
    const refreshed = typeof refresh === 'function' ? await refresh() : null
    return { status: 'confirmed', job: refreshed?.job, attempt: completed || attempt }
  } catch (error) {
    if (!riskPersisted) return { status: 'failed', attempt, error }
    try { await markUnknown(attempt, stationId, error) } catch { /* retain the original uncertain outcome */ }
    return { status: 'unknown', attempt, error }
  } finally {
    if (attempt) untrackAttempt?.(attempt)
  }
}
