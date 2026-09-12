import { useState } from 'react'
import Button from './Button'
import SystemSelect from './SystemSelect'
import { formatBRLCurrencyInput } from '../utils/formFormatting.js'

const ADJUSTMENT_OPTIONS = [
  { value: 'none', label: 'Nenhum' },
  { value: 'discount', label: 'Desconto' },
  { value: 'surcharge', label: 'Acréscimo' },
]
const ADJUSTMENT_MODE_OPTIONS = [
  { value: 'fixed', label: 'R$' },
  { value: 'percentage', label: '%' },
]
const PAYMENT_METHOD_OPTIONS = ['Pix', 'Dinheiro', 'Cartão de débito', 'Cartão de crédito', 'Transferência', 'Outro']
  .map((method) => ({ value: method, label: method }))

function OrderCheckoutSummary({
  draft,
  preview,
  currency,
  disabled = false,
  canSubmit = false,
  canAdjustOrders = true,
  allowImmediatePayment = true,
  onDeliveryFeeChange,
  onAdjustmentChange,
  onSavePending,
  onSavePaid,
}) {
  const [showPayment, setShowPayment] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('Pix')
  const adjustment = draft.adjustment
  const changeAdjustment = (patch) => {
    if (!canAdjustOrders) return false
    onAdjustmentChange?.(patch)
    return true
  }
  const adjustmentTypeField = (
    <div className="form-field">
      <span>Ajuste do pedido</span>
      <SystemSelect
        value={adjustment.type}
        options={ADJUSTMENT_OPTIONS}
        onChange={(type) => changeAdjustment({ type })}
        disabled={disabled}
        label="Ajuste do pedido"
      />
    </div>
  )

  return (
    <section className="surface-card new-order-checkout">
      <div className="section-heading">
        <div>
          <span className="section-kicker">Fechamento</span>
          <h2>Resumo da venda</h2>
        </div>
      </div>

      {draft.type === 'Entrega' && (
        <div className="new-order-checkout-fields">
          <label className="form-field">
          <span>Taxa de entrega</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="R$ 0,00"
            value={draft.deliveryFee}
            onChange={(event) => onDeliveryFeeChange(formatBRLCurrencyInput(event.target.value))}
            disabled={disabled}
          />
          <small className="form-hint">Deixe R$ 0,00 quando não houver taxa.</small>
          </label>
          {canAdjustOrders && adjustmentTypeField}
        </div>
      )}

      <div className="new-order-adjustment">
        {canAdjustOrders && draft.type !== 'Entrega' && adjustmentTypeField}

        {canAdjustOrders && adjustment.type !== 'none' && (
          <div className="new-order-adjustment-fields">
            <div className="form-field">
              <span>Modo</span>
              <SystemSelect
                value={adjustment.mode}
                options={ADJUSTMENT_MODE_OPTIONS}
                onChange={(mode) => changeAdjustment({ mode })}
                disabled={disabled}
                label="Modo"
              />
            </div>
            <label className="form-field">
              <span>Valor</span>
              {adjustment.mode === 'fixed' ? (
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="R$ 0,00"
                  value={adjustment.value}
                  onChange={(event) => changeAdjustment({ value: formatBRLCurrencyInput(event.target.value) })}
                  disabled={disabled}
                />
              ) : (
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="100"
                  step="0.01"
                  value={adjustment.value}
                  onChange={(event) => changeAdjustment({ value: event.target.value })}
                  disabled={disabled}
                />
              )}
            </label>
          </div>
        )}

        {canAdjustOrders && adjustment.type !== 'none' && (
          <label className="form-field">
            <span>Motivo (opcional)</span>
            <input
              type="text"
              maxLength={200}
              value={adjustment.reason}
              placeholder="Ex: cliente fidelidade"
              onChange={(event) => changeAdjustment({ reason: event.target.value })}
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

      {allowImmediatePayment && showPayment && (
        <div className="new-order-payment-choice">
          <div className="form-field">
            <span>Forma de pagamento</span>
            <SystemSelect
              value={paymentMethod}
              options={PAYMENT_METHOD_OPTIONS}
              onChange={setPaymentMethod}
              disabled={disabled}
              label="Forma de pagamento"
            />
          </div>
          <div className="form-actions">
            <Button type="button" variant="secondary" onClick={() => setShowPayment(false)} disabled={disabled}>Voltar</Button>
            <Button type="button" onClick={() => onSavePaid(paymentMethod)} disabled={disabled || !canSubmit}>Confirmar recebimento</Button>
          </div>
        </div>
      )}

      {!showPayment && (
        <div className="new-order-checkout-actions">
          <Button type="button" variant="secondary" onClick={onSavePending} disabled={disabled || !canSubmit}>Salvar pedido</Button>
          {allowImmediatePayment && <Button type="button" onClick={() => setShowPayment(true)} disabled={disabled || !canSubmit}>Salvar e receber</Button>}
        </div>
      )}
    </section>
  )
}

export default OrderCheckoutSummary
