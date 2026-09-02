import { useState } from 'react'
import Button from './Button'

const PAYMENT_METHODS = ['Pix', 'Dinheiro', 'Cartão de débito', 'Cartão de crédito', 'Transferência', 'Outro']

function OrderCheckoutSummary({
  draft,
  preview,
  currency,
  disabled = false,
  canSubmit = false,
  onDeliveryFeeChange,
  onAdjustmentChange,
  onSavePending,
  onSavePaid,
}) {
  const [showPayment, setShowPayment] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('Pix')
  const adjustment = draft.adjustment

  return (
    <section className="surface-card new-order-checkout">
      <div className="section-heading">
        <div>
          <span className="section-kicker">Fechamento</span>
          <h2>Resumo da venda</h2>
        </div>
      </div>

      {draft.type === 'Entrega' && (
        <label className="form-field">
          <span>Taxa de entrega</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={draft.deliveryFee}
            onChange={(event) => onDeliveryFeeChange(event.target.value)}
            disabled={disabled}
          />
          <small className="form-hint">Deixe 0 quando não houver taxa.</small>
        </label>
      )}

      <div className="new-order-adjustment">
        <label className="form-field">
          <span>Ajuste do pedido</span>
          <select
            value={adjustment.type}
            onChange={(event) => onAdjustmentChange({ type: event.target.value })}
            disabled={disabled}
          >
            <option value="none">Nenhum</option>
            <option value="discount">Desconto</option>
            <option value="surcharge">Acréscimo</option>
          </select>
        </label>

        {adjustment.type !== 'none' && (
          <div className="form-grid two-columns">
            <label className="form-field">
              <span>Modo</span>
              <select
                value={adjustment.mode}
                onChange={(event) => onAdjustmentChange({ mode: event.target.value })}
                disabled={disabled}
              >
                <option value="fixed">R$</option>
                <option value="percentage">%</option>
              </select>
            </label>
            <label className="form-field">
              <span>Valor</span>
              <input
                type="number"
                min="0"
                max={adjustment.mode === 'percentage' ? '100' : undefined}
                step="0.01"
                value={adjustment.value}
                onChange={(event) => onAdjustmentChange({ value: event.target.value })}
                disabled={disabled}
              />
            </label>
          </div>
        )}

        {adjustment.type !== 'none' && (
          <label className="form-field">
            <span>Motivo (opcional)</span>
            <input
              type="text"
              maxLength={200}
              value={adjustment.reason}
              placeholder="Ex: cliente fidelidade"
              onChange={(event) => onAdjustmentChange({ reason: event.target.value })}
              disabled={disabled}
            />
          </label>
        )}
      </div>

      <div className="new-order-totals">
        <div><span>Produtos</span><strong>{currency(preview.subtotal)}</strong></div>
        {draft.type === 'Entrega' && <div><span>Taxa de entrega</span><strong>{currency(preview.deliveryFee)}</strong></div>}
        {adjustment.type !== 'none' && (
          <div>
            <span>{adjustment.type === 'discount' ? 'Desconto' : 'Acréscimo'}</span>
            <strong>{adjustment.type === 'discount' ? '− ' : '+ '}{currency(preview.adjustmentAmount)}</strong>
          </div>
        )}
        <div className="new-order-total-final"><span>Total</span><strong>{currency(preview.total)}</strong></div>
      </div>

      {showPayment && (
        <div className="new-order-payment-choice">
          <label className="form-field">
            <span>Forma de pagamento</span>
            <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} disabled={disabled}>
              {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}
            </select>
          </label>
          <div className="form-actions">
            <Button type="button" variant="secondary" onClick={() => setShowPayment(false)} disabled={disabled}>Voltar</Button>
            <Button type="button" onClick={() => onSavePaid(paymentMethod)} disabled={disabled || !canSubmit}>Confirmar recebimento</Button>
          </div>
        </div>
      )}

      {!showPayment && (
        <div className="new-order-checkout-actions">
          <Button type="button" variant="secondary" onClick={onSavePending} disabled={disabled || !canSubmit}>Salvar pedido</Button>
          <Button type="button" onClick={() => setShowPayment(true)} disabled={disabled || !canSubmit}>Salvar e receber</Button>
        </div>
      )}
    </section>
  )
}

export default OrderCheckoutSummary
