import Button from '../../../shared/ui/Button'
import ConfirmationDialog from '../../../shared/ui/ConfirmationDialog'
import Modal from '../../../shared/ui/Modal'
import { usePrintingOverlays } from '../application/usePrintingOverlays.js'

function PrintingOverlays(props) {
  const {
    printing,
    authenticated,
    canExecutePrinting,
    canDiscardPrinting,
  } = props
  const state = usePrintingOverlays(props)

  if (!authenticated) return null

  const {
    physicalPrinterReady,
    recoveryPromptEligible,
    recoveryPendingCount,
    recoveryState,
    recoveryDialogMode,
    recoveryBusy,
    recoveryDiscardConfirmation,
    dismissRecoveryDiscardConfirmation,
    openRecoveryDiscardConfirmation,
    secondCopyPromptJob,
    secondCopyPromptTitle,
    secondCopyPromptBusy,
    originSecondCopyPromptJob,
    originSecondCopyPromptTitle,
    originSecondCopyPromptBusy,
    dismissSecondCopyPrompt,
    handleGlobalSecondCopy,
    handleStartRecovery,
    handleDeferRecovery,
    handleNextRecovery,
    handleDiscardRecoveryBacklog,
    dismissOriginSecondCopyPrompt,
    handleOriginSecondCopyRequest,
  } = state

  return <>
    {recoveryPromptEligible && physicalPrinterReady && recoveryDialogMode === 'prompt' && (
      <Modal title="Impressora disponível novamente" onClose={() => { void handleDeferRecovery() }}>
        <div className="form-stack">
          <p>{`Há ${recoveryPendingCount} trabalhos aguardando impressão.`}</p>
          <p>Como a impressora não possui corte automático, as vias serão impressas uma de cada vez.</p>
          <div className="form-actions">
            <Button type="button" variant="secondary" onClick={() => { void handleDeferRecovery() }} disabled={recoveryBusy}>Agora não</Button>
            <Button type="button" variant="secondary" onClick={openRecoveryDiscardConfirmation} disabled={recoveryBusy || !canDiscardPrinting}>Descartar todas</Button>
            <Button type="button" onClick={() => { void handleStartRecovery() }} disabled={recoveryBusy || !canExecutePrinting}>Imprimir agora</Button>
          </div>
        </div>
      </Modal>
    )}

    {recoveryDialogMode === 'progress' && physicalPrinterReady && recoveryState === 'deferred' && recoveryPendingCount > 0 && (
      <ConfirmationDialog
        title="Via impressa"
        message="Separe o papel antes de continuar."
        confirmLabel="Imprimir próxima"
        cancelLabel="Parar por agora"
        confirmVariant="secondary"
        onClose={() => { void handleDeferRecovery() }}
        onConfirm={() => { void handleNextRecovery() }}
        disabled={recoveryBusy || Boolean(printing?.busyJobId)}
      />
    )}

    {recoveryDiscardConfirmation && physicalPrinterReady && (
      <ConfirmationDialog
        title={`Descartar ${recoveryPendingCount} trabalhos?`}
        message="Somente trabalhos pendentes sem envio físico serão descartados."
        confirmLabel="Descartar todas"
        cancelLabel="Voltar"
        onClose={dismissRecoveryDiscardConfirmation}
        onConfirm={() => { void handleDiscardRecoveryBacklog() }}
        disabled={recoveryBusy || !canDiscardPrinting}
      />
    )}

    {secondCopyPromptJob && (
      <ConfirmationDialog
        title={`${secondCopyPromptTitle} · 1ª via impressa`}
        message="Destaque o papel na serrilha antes de continuar."
        confirmLabel="Imprimir 2ª via"
        cancelLabel={recoveryState !== 'normal' && printing?.localStation?.recoveryJobId === secondCopyPromptJob.id ? 'Parar por agora' : 'Depois'}
        onClose={dismissSecondCopyPrompt}
        onConfirm={handleGlobalSecondCopy}
        disabled={secondCopyPromptBusy || Boolean(printing?.busyJobId) || !canExecutePrinting}
      />
    )}

    {originSecondCopyPromptJob && (
      <ConfirmationDialog
        title={`${originSecondCopyPromptTitle} · 1ª via impressa`}
        message="A segunda via será solicitada para a fila da cozinha."
        confirmLabel="Solicitar 2ª via"
        cancelLabel="Depois"
        onClose={dismissOriginSecondCopyPrompt}
        onConfirm={handleOriginSecondCopyRequest}
        disabled={originSecondCopyPromptBusy || !canExecutePrinting}
      />
    )}
  </>
}

export default PrintingOverlays
