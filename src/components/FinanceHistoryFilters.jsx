import { PAYMENT_METHODS } from '../../shared/finance.js'
import Icon from './Icon'
import SystemSelect from './SystemSelect'

const TYPE_OPTIONS = [
  { value: '', label: 'Todos os tipos' },
  { value: 'entrada', label: 'Entradas' },
  { value: 'saida', label: 'Saídas' },
]

const PAYMENT_OPTIONS = [
  { value: '', label: 'Todos os pagamentos' },
  ...PAYMENT_METHODS.map((method) => ({ value: method, label: method })),
  { value: '__missing__', label: 'Não informado' },
]

function FinanceHistoryFilters({
  value,
  categoryOptions,
  onChange,
  showSearch = true,
  showSecondary = true,
}) {
  const update = (field, nextValue) => onChange({ ...value, [field]: nextValue })
  const categories = [{ value: '', label: 'Todas as categorias' }, ...categoryOptions]

  return (
    <div className="finance-history-filters">
      {showSearch && (
        <label className="search-control finance-history-search">
          <Icon name="search" size={17} />
          <input
            type="search"
            value={value.search}
            placeholder="Buscar por descrição, categoria ou pedido"
            aria-label="Buscar movimentações"
            onChange={(event) => update('search', event.target.value)}
          />
        </label>
      )}

      {showSecondary && (
        <>
          <SystemSelect value={value.type} options={TYPE_OPTIONS} label="Filtrar por tipo" onChange={(next) => update('type', next)} />
          <SystemSelect value={value.category} options={categories} label="Filtrar por categoria" onChange={(next) => update('category', next)} />
          <SystemSelect value={value.paymentMethod} options={PAYMENT_OPTIONS} label="Filtrar por forma de pagamento" onChange={(next) => update('paymentMethod', next)} />
        </>
      )}
    </div>
  )
}

export default FinanceHistoryFilters
