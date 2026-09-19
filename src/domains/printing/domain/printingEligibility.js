export const getPrintingTransportKind = (platform) => {
  if (platform === 'windows') return 'qz'
  if (platform === 'android') return 'queue-only'
  return 'queue-only'
}

export const getRendererCompatibilityMode = (transportKind) => (
  transportKind === 'qz' ? 'mpt2-bitmap' : null
)

export const isPrintingTransportSupported = (platform) => getPrintingTransportKind(platform) === 'qz'

export const canConsumeAutomaticPrintJob = ({
  authenticated, isOnline, supported, visible, browserOnline: browserIsOnline,
  busyJobId, printerBlocked, transportReady, qzConnected = true,
  physicalReady = true, isQz = true, allowManual = false, station,
}) => Boolean(
  authenticated && isOnline && supported && visible && browserIsOnline
  && !busyJobId && !printerBlocked && transportReady
  && (!isQz || qzConnected) && physicalReady && isQz
  && station?.isPrimary
  && (station?.recoveryState ?? 'normal') === 'normal'
  && (allowManual || station?.autoPrintEnabled)
)

export const canExecuteSecondCopy = ({ isQz, station, job }) => Boolean(
  isQz && station?.isPrimary && station?.platform === 'windows'
  && job?.status === 'awaiting_second_copy'
  && Number(job?.copiesRequested) === 2
  && Number(job?.copiesPrinted) === 1
)

const isRecoveryAffinityJob = (station, job) => (
  ['active', 'deferred'].includes(station?.recoveryState)
  && Boolean(station?.recoveryJobId)
  && station.recoveryJobId === job?.id
)

export const canPresentSecondCopyPrompt = ({ isQz, transportReady, printerBlocked, station, job }) => (
  Boolean(transportReady) && !printerBlocked
  && ((station?.recoveryState ?? 'normal') === 'normal' || isRecoveryAffinityJob(station, job))
  && canExecuteSecondCopy({ isQz, station, job })
  && (!job?.secondCopyPromptedAt || isRecoveryAffinityJob(station, job))
)

export const canKeepSecondCopyPromptOpen = ({ isQz, transportReady, printerBlocked, station, job }) => (
  Boolean(transportReady) && !printerBlocked
  && ((station?.recoveryState ?? 'normal') === 'normal' || isRecoveryAffinityJob(station, job))
  && canExecuteSecondCopy({ isQz, station, job })
)

export const canInitializeBackgroundPhysicalTransport = ({ authenticated, isOnline, isQz, station }) => Boolean(
  authenticated && isOnline && isQz && station?.isPrimary && station?.platform === 'windows'
)

export const canSendPrintStationHeartbeat = ({
  authenticated, isOnline, browserOnline: browserIsOnline, isQz, station,
}) => Boolean(
  authenticated && isOnline && browserIsOnline && isQz
  && station?.id && station?.isPrimary && station?.platform === 'windows'
)
