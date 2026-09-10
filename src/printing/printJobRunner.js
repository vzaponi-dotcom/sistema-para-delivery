export const runClaimedPrintJob = async ({
  job,
  stationId,
  port,
  completeJob,
  failJob,
  renderer,
  transport,
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
    const bytes = renderer(job.document, renderOptions)
    await transport(port, bytes)
    await completeJob(job.id, stationId, copyNumber)
    return { status: 'printed' }
  } catch (error) {
    const uncertain = error?.code === 'SERIAL_WRITE_UNCERTAIN'
    try {
      await failJob(job.id, stationId, {
        code: error?.code || 'PRINT_FAILED',
        message: error?.message || 'Não foi possível imprimir o pedido.',
        uncertain,
      })
    } catch (reportingError) {
      const combined = new AggregateError(
        [error, reportingError],
        error?.message || 'Não foi possível imprimir o pedido.',
        { cause: error },
      )
      combined.code = error?.code || 'PRINT_FAILED'
      combined.operationalError = error
      combined.reportingError = reportingError
      throw combined
    }
    return { status: uncertain ? 'requires_attention' : 'failed', error }
  }
}
