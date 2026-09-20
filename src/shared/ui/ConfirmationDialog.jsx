import Button from './Button'
import Modal from './Modal'

function ConfirmationDialog({
  title,
  message,
  details,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Voltar',
  confirmVariant = 'danger',
  onConfirm,
  onClose,
  disabled = false,
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="form-stack confirmation-dialog-content">
        {message && <p>{message}</p>}
        {details && <div className="payment-summary-card">{details}</div>}
        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={onClose} disabled={disabled}>{cancelLabel}</Button>
          <Button type="button" variant={confirmVariant} onClick={onConfirm} disabled={disabled}>{confirmLabel}</Button>
        </div>
      </div>
    </Modal>
  )
}

export default ConfirmationDialog
