const RECOVERY_STATES = new Set(['normal', 'pending', 'active', 'deferred'])

const normalizeState = (value) => (RECOVERY_STATES.has(value) ? value : 'normal')
const normalizeBacklog = (value) => Math.max(0, Math.floor(Number(value) || 0))

export const deriveRecoveryView = ({ recoveryState, physicalReady, safeBacklog } = {}) => {
  const state = normalizeState(recoveryState)
  const recoveryPendingCount = normalizeBacklog(safeBacklog)
  return {
    recoveryState: state,
    recoveryPendingCount,
    recoveryPromptEligible: state === 'pending' && physicalReady === true && recoveryPendingCount > 0,
  }
}

export const nextRecoveryState = ({ recoveryState, action, wasPhysicalReady, physicalReady, safeBacklog } = {}) => {
  const state = normalizeState(recoveryState)
  if (action === 'start' && state === 'pending') return 'active'
  if (action === 'resume' && state === 'deferred') return 'active'
  if (action === 'defer' && (state === 'pending' || state === 'active')) return 'deferred'
  if (action === 'complete' && state === 'active') return 'deferred'
  if (!action && state === 'normal' && wasPhysicalReady === false && physicalReady === true && normalizeBacklog(safeBacklog) > 0) return 'pending'
  return state
}

export const canRunSingleRecoveryCopy = ({ recoveryState, physicalReady, busyJobId } = {}) => (
  normalizeState(recoveryState) === 'active'
  && physicalReady === true
  && !busyJobId
)

export const runSingleRecoveryCopy = async ({ recoveryState, physicalReady, busyJobId, claimNext, executeJob } = {}) => {
  if (!canRunSingleRecoveryCopy({ recoveryState, physicalReady, busyJobId })) return null
  const claimed = await claimNext()
  if (!claimed?.job) return null
  return executeJob(claimed.job)
}
