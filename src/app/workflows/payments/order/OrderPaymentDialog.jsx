import Button from '../../../../components/Button.jsx'
import Modal from '../../../../components/Modal.jsx'
import SystemSelect from '../../../../components/SystemSelect.jsx'
import { formatOrderDisplayNumber } from '../../../../../shared/orderDisplayNumber.js'

export default function OrderPaymentDialog({ dialog, currency }) {
  if (!dialog?.order) return null

  return (
    <Modal title="Registrar pagamento" onClose={dialog.onClose}>
      <form
        className="form-stack"
        onSubmit={(event) => {
          event.preventDefault()
          return dialog.submit()
        }}
      >
        <div className="payment-summary-card">
          <span>{dialog.order.client} · {formatOrderDisplayNumber(dialog.order)}</span>
          <strong>{currency(dialog.order.total)}</strong>
          <small>O pagamento será lançado automaticamente como entrada no Financeiro.</small>
        </div>
        <div className="form-field">
          <span>Forma de pagamento</span>
          <SystemSelect
            value={dialog.method}
            options={dialog.visibleOptions}
            onChange={dialog.setMethod}
            disabled={dialog.writesBlocked || dialog.submitting}
            label="Forma de pagamento"
          />
        </div>
        {dialog.needsReview && (
          <p className="form-error" role="alert">
            A forma escolhida não está mais ativa. Revise a seleção antes de confirmar.
          </p>
        )}
        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={dialog.onClose}>Cancelar</Button>
          <Button
            type="submit"
            disabled={dialog.writesBlocked || dialog.submitting || !dialog.method || dialog.needsReview}
          >
            Confirmar pagamento
          </Button>
        </div>
      </form>
    </Modal>
  )
}
