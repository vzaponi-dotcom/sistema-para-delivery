import AreaNavigation from '../../../app/navigation/AreaNavigation.jsx'
import PageHeader from '../../../shared/ui/PageHeader'
import { useReportingSearchParams } from '../application/useReportingSearchParams.js'
import ReportingTabs, { REPORTING_TABS } from './ReportingTabs.jsx'
import { ReportingFilters } from './ReportingFilters.jsx'
import { OverviewReport } from './views/OverviewReport.jsx'
import { OperationReport } from './views/OperationReport.jsx'
import { useReportingData } from '../application/useReportingData.js'
import './reporting.css'

const viewLabel = (view) => REPORTING_TABS.find(({ id }) => id === view)?.label || 'Visão geral'

export function ReportingWorkspace() {
  const { query, patchQuery } = useReportingSearchParams()
  const state = useReportingData({ query })

  return (
    <>
      <AreaNavigation area="finance" />
      <PageHeader
        eyebrow="Financeiro"
        title="Relatórios"
        description="Analise vendas, operação, recebimentos e produtos com filtros consistentes."
      />

      <ReportingFilters query={query} onChange={patchQuery} />

      <ReportingTabs
        value={query.view}
        onChange={(view) => patchQuery({ view })}
      />

      {query.view === 'overview' ? <OverviewReport state={state} /> : query.view === 'operation' ? <OperationReport state={state} /> : <section className="surface-card reporting-shell-state" aria-labelledby="reporting-current-view">
        <span className="section-kicker">Centro de Relatórios</span>
        <h2 id="reporting-current-view">{viewLabel(query.view)}</h2>
        <p>A estrutura de navegação e filtros por URL está pronta. Nenhuma métrica é calculada localmente nesta etapa.</p>
      </section>}
    </>
  )
}
