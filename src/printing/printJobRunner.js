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
    const bytes = renderer(job.document, { copies: job.copiesRequested })
    await transport(port, bytes)
    await completeJob(job.id, stationId, job.copiesRequested)
    return { status: 'printed' }
  } catch (error) {
    const uncertain = error?.code === 'SERIAL_WRITE_UNCERTAIN'
    await failJob(job.id, stationId, {
      code: error?.code || 'PRINT_FAILED',
      message: error?.message || 'Não foi possível imprimir o pedido.',
      uncertain,
    })
    return { status: uncertain ? 'requires_attention' : 'failed', error }
  }
}
