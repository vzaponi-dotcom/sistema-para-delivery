import { executeQzPrintAttempt } from './qzPrintAttemptController.js'

export const runClaimedPrintJob = async ({
  job,
  stationId,
  port,
  completeJob,
  failJob,
  renderer,
  transport,
  qzAttempt,
}) => {
  try {
    const totalCopies = Number(job?.copiesRequested)
    const copiesPrinted = Number(job?.copiesPrinted || 0)
    if (![1, 2].includes(totalCopies)) throw new RangeError('copiesRequested must be 1 or 2')
    if (!Number.isInteger(copiesPrinted) || copiesPrinted < 0 || copiesPrinted >= totalCopies) {
      throw new RangeError('copiesPrinted must identify a remaining copy')
    }

    const copyNumber = copiesPrinted + 1
    const renderOptions = job?.document?.type === 'order'
      ? { copies: 1, copyNumber, totalCopies }
      : { copies: 1 }
    if (qzAttempt) {
      const result = await executeQzPrintAttempt({ job, stationId, renderer, ...qzAttempt })
      if (result.status === 'confirmed') return { status: 'printed', attempt: result.attempt }
      if (result.status === 'unknown') return { status: 'requires_attention', attempt: result.attempt, error: result.error }
      throw result.error
    }

    const bytes = renderer(job.document, renderOptions)
    await transport(port, bytes)
    await completeJob(job.id, stationId, copyNumber)
    return { status: 'printed' }
  } catch (error) {
    const code = error?.code || 'PRINT_FAILED'
    const uncertain = code === 'SERIAL_WRITE_UNCERTAIN'
    const requiresAttention = uncertain || String(code).toUpperCase().startsWith('QZ_')
    await failJob(job.id, stationId, {
      code,
      message: error?.message || 'Não foi possível imprimir o pedido.',
      uncertain,
    })
    return { status: requiresAttention ? 'requires_attention' : 'failed', error }
  }
}
