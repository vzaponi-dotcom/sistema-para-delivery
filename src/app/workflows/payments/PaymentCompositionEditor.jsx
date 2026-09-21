import Button from '../../shared/ui/Button.jsx'
import SystemSelect from '../../shared/ui/SystemSelect.jsx'
import { formatBRLCurrencyInput, formatBRLCurrencyValue, parseBRLCurrencyInput } from '../../shared/utils/formFormatting.js'\nimport { paymentLabel } from '../../../../shared/businessPolicies.js'
import {
  addPaymentAllocation,
  paymentMethodCode,
  paymentOptionsForAllocation,
  removePaymentAllocation,
  summarizePaymentComposition,
  updatePaymentAllocation,
} from './paymentComposition.js'

const centsToDisplay = (cents) => formatBRLCurrencyValue((Number(cents) || 0) / 100)
const optionValue = (paymentOptions, methodCode) => paymentOptions.find((option) => option.code === methodCode)?.value || paymentLabel(methodCode) || methodCode || ''

export default function PaymentCompositionEditor({
  totalCents,
  allocations = [],
  onChange,
  paymentOptions = [],
  disabled = false,
}) {
  const summary = summarizePaymentComposition(allocations, totalCents, paymentOptions)
  const changeRow = (index, patch) => onChange?.(updatePaymentAllocation(allocations, index, patch))
  const add = () => onChange?.(addPaymentAllocation(allocations))
  const remove = (index) => onChange?.(removePaymentAllocation(allocations, index))

  return (
    <div className="payment-composition-editor">
      <div className="payment-composition-lines">
        {allocations.map((allocation, index) => {
          const available = paymentOptionsForAllocation(paymentOptions, allocations, index)
          const selectOptions = available.map((option) => ({ value: option.value, label: option.label, code: option.code }))
          const currentValue = optionValue(paymentOptions, allocation.methodCode)
          const currentInactive = allocation.methodCode && !paymentOptions.some((option) => option.code === allocation.methodCode)
          if (currentInactive) selectOptions.unshift({ value: currentValue, label: `${currentValue} (inativo)`, code: null, inactive: true })
          const label = index === 0 ? 'Forma de pagamento' : `Forma de pagamento ${index + 1}`
          return (
            <div className="payment-composition-line" key={`${index}:${allocation.methodCode}`}>
              <div className="form-field">
                <span>{label}</span>
                <SystemSelect
                  value={currentValue}
                  options={selectOptions}
                  onChange={(value) => changeRow(index, { methodCode: paymentMethodCode(paymentOptions, value) || allocation.methodCode })}
                  disabled={disabled}
                  label={label}
                />
              </div>
              <label className="form-field">
                <span>Valor</span>
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label={`Valor da forma de pagamento ${index + 1}`}
                  value={centsToDisplay(allocation.amountCents)}
                  onChange={(event) => changeRow(index, {
                    amountCents: Math.round(parseBRLCurrencyInput(formatBRLCurrencyInput(event.target.value)) * 100),
                  })}
                  disabled={disabled}
                />
              </label>
              {allocations.length > 1 && (
                <Button
                  type="button"
                  variant="secondary"
                  aria-label={`Remover forma de pagamento ${index + 1}`}
                  onClick={() => remove(index)}
                  disabled={disabled}
                >
                  Remover
                </Button>
              )}
            </div>
          )
        })}
      </div>

      <Button
        type="button"
        variant="secondary"
        onClick={add}
        disabled={disabled || allocations.length >= paymentOptions.length}
      >
        Adicionar forma de pagamento
      </Button>

      <div className="payment-composition-summary" aria-label="Resumo do pagamento">
        <div><span>Total a receber</span><strong>{centsToDisplay(summary.totalCents)}</strong></div>
        <div><span>Total informado</span><strong>{centsToDisplay(summary.enteredCents)}</strong></div>
        <div><span>Restante</span><strong>{centsToDisplay(summary.remainingCents)}</strong></div>
      </div>

      {summary.overageCents > 0 && <p className="form-error" role="alert">O valor informado ultrapassa o total em {centsToDisplay(summary.overageCents)}.</p>}
      {summary.hasDuplicateMethods && <p className="form-error" role="alert">Cada forma de pagamento pode ser usada apenas uma vez.</p>}
      {summary.needsReview && <p className="form-error" role="alert">Uma forma escolhida não está mais ativa. Revise a composição antes de confirmar.</p>}
    </div>
  )
}
