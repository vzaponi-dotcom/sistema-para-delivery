import Button from '../../../shared/ui/Button'
import ConfirmationDialog from '../../../shared/ui/ConfirmationDialog'
import Modal from '../../../shared/ui/Modal'
import { usePrintingOverlays } from '../application/usePrintingOverlays.js'
import './printing-overlays.css'

function PrintingOverlays(props) {
  const {
    printing,
    authenticated,
    canExecutePrinting,
    canDiscardPrinting,
    onOpenPrintQueue,
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

  const recoveryJobId = printing?.localStation?.recoveryJobId ?? null
  const recoveryJob = Array.isArray(printing?.jobs)
    ? printing.jobs.find((job) => job?.id === recoveryJobId) ?? null
    : null
  const recoveryNeedsReview = recoveryJob?.status === 'requires_attention'
    || recoveryJob?.lastError?.code === 'PRINT_OUTCOME_UNKNOWN'
  const showRecoveryNotice = recoveryState !== 'normal'
    && (recoveryPendingCount > 0 || Boolean(recoveryJobId))
  const recoveryNoticeText = recoveryNeedsReview
    ? 'Uma impressão precisa ser revisada antes de continuar a recuperação.'
    : recoveryState === 'active'
      ? 'Recuperação de impressão em andamento.'
      : recoveryPendingCount > 0
        ? `${recoveryPendingCount} ${recoveryPendingCount === 1 ? 'trabalho pendente' : 'trabalhos pendentes'} na recuperação de impressão.`
        : 'A recuperação de impressão está pausada.'

  const handleGlobalRecoveryAction = () => {
    if (recoveryNeedsReview) {
      onOpenPrintQueue?.()
      return
    }
    if (recoveryState === 'pending') {
      void handleStartRecovery()
      return
    }
    if (recoveryState === 'deferred') void handleNextRecovery()
  }

  return <>
    {showRecoveryNotice && (
      <aside className="printing-recovery-global-notice" role="status" aria-live="polite">
        <div className="printing-recovery-global-copy">
          <strong>Impressão requer atenção</strong>
          <span>{recoveryNoticeText}</span>
        </div>
        {recoveryNeedsReview && onOpenPrintQueue ? (
          <Button type="button" variant="secondary" onClick={handleGlobalRecoveryAction}>Revisar impressão</Button>
        ) : recoveryState !== 'active' ? (
          <Button
            type="button"
            onClick={handleGlobalRecoveryAction}
            disabled={recoveryBusy || !physicalPrinterReady || !canExecutePrinting}
          >
            Retomar recuperação
          </Button>
        ) : null}
      </aside>
    )}
    {recoveryPromptEligible && physicalPrinterReady && recoveryDialogMode === 'prompt' && (
      <Modal title="Impressora disponível novamente" onClose={() => { void handleDeferRecovery() }}>
        <div className="form-stack">
          <p>{`Há ${recoveryPendingCount} trabalhos aguardando impressão.`}</p>
          <p>Os trabalhos serão recuperados um por vez. Pedidos configurados com duas vias imprimirão as duas em sequência.</p>
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
        title="Trabalho concluído"
        message="Pronto para continuar com o próximo trabalho pendente."
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
