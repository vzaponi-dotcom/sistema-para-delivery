import { NEW_ORDER_STEPS, NEW_ORDER_STEP_ORDER } from '../utils/newOrderStepFlow.js'

const STEPS = [
  { id: NEW_ORDER_STEPS.CUSTOMER, number: 1, label: 'Cliente' },
  { id: NEW_ORDER_STEPS.PRODUCTS, number: 2, label: 'Produtos' },
  { id: NEW_ORDER_STEPS.REVIEW, number: 3, label: 'Finalizar' },
]

function NewOrderStepIndicator({ currentStep, maxReachedStep, access, onNavigate }) {
  const maxReachedIndex = NEW_ORDER_STEP_ORDER.indexOf(maxReachedStep)

  return (
    <nav className="new-order-step-indicator" aria-label="Etapas da nova venda">
      {STEPS.map((step, index) => {
        const active = currentStep === step.id
        const accessible = Boolean(access?.[step.id])
        const reached = index <= maxReachedIndex
        const completed = reached && !active
        return (
          <button
            key={step.id}
            type="button"
            className={active ? 'new-order-step-tab active' : (completed ? 'new-order-step-tab completed' : 'new-order-step-tab')}
            aria-current={active ? 'step' : undefined}
            disabled={!accessible}
            onClick={() => onNavigate(step.id)}
          >
            <span className="new-order-step-number" aria-hidden="true">{completed ? '✓' : step.number}</span>
            <span>{step.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

export default NewOrderStepIndicator
