const printerError = (code, message) => Object.assign(new Error(message), { code })

export const runExclusivePrintOperation = async ({ acquire, release, operation }) => {
  const owner = acquire()
  if (!owner) throw printerError('PRINT_OPERATION_BUSY', 'Outra impressão física já está em andamento.')
  try {
    return await operation()
  } finally {
    release(owner)
  }
}

const PHYSICAL_JOB_FAILURE_STATES = new Set(['failed', 'requires_attention'])

export const createPhysicalJobFailureNotifier = () => {
  const notified = new Set()
  const keyFor = (jobId, status) => `${jobId}:${status}`
  return {
    notify({ job, status, error, onNotify }) {
      if (!job?.id || !PHYSICAL_JOB_FAILURE_STATES.has(status) || typeof onNotify !== 'function') return false
      const key = keyFor(job.id, status)
      if (notified.has(key)) return false
      notified.add(key)
      onNotify(error, { jobId: job.id, status })
      return true
    },
    synchronize(currentJobs = []) {
      const currentFailureKeys = new Set(currentJobs
        .filter((job) => job?.id && PHYSICAL_JOB_FAILURE_STATES.has(job.status))
        .map((job) => keyFor(job.id, job.status)))
      for (const key of notified) if (!currentFailureKeys.has(key)) notified.delete(key)
    },
  }
}
