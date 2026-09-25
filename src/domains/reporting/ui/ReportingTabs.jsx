const REPORTING_TABS = Object.freeze([
  { id: 'overview', label: 'Visão geral' },
  { id: 'operation', label: 'Operação' },
  { id: 'sales', label: 'Vendas' },
  { id: 'products', label: 'Produtos' },
  { id: 'detail', label: 'Detalhado' },
])

export default function ReportingTabs({ value, onChange }) {
  return (
    <div className="reporting-tabs" role="tablist" aria-label="Áreas dos relatórios">
      {REPORTING_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          className={value === tab.id ? 'reporting-tab active' : 'reporting-tab'}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export { REPORTING_TABS }
