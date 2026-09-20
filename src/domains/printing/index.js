// Transitional C9 public entry. Task 8 removes helper exports that no longer have external consumers.
export {
  getPrintingTransportKind, getRendererCompatibilityMode, isPrintingTransportSupported,
  canConsumeAutomaticPrintJob, canExecuteSecondCopy, canPresentSecondCopyPrompt,
  canKeepSecondCopyPromptOpen, canInitializeBackgroundPhysicalTransport, canSendPrintStationHeartbeat,
} from './domain/printingEligibility.js'
export { deriveRecoveryView, nextRecoveryState, canRunSingleRecoveryCopy, runSingleRecoveryCopy } from './domain/printRecovery.js'
export {
  isSecondCopyPromptEligible, getSecondCopyPromptTitle,
  acknowledgeAndOpenSecondCopyPrompt, findOriginSecondCopyPrompt,
} from './domain/secondCopy.js'
export { getDefaultPrintStationName, isQzPrintStationEligible } from './domain/stationPolicy.js'
export { renderEscPos58mm } from './domain/rendering/escpos58mm.js'

export { usePrintingManager } from './application/usePrintingManager.js'

export { printingPolicy, stationConfigurationPolicy, stationPrimaryPolicy } from './infrastructure/printingPolicy.js'

export { PrintQueue, PrintingSettingsContent } from './ui/printingSurfaces.js'
export { DEFAULT_PRINT_QUEUE_QUERY } from './ui/printQueueQuery.js'
