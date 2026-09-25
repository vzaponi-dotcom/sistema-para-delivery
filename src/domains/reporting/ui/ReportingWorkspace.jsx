import AreaNavigation from '../../../app/navigation/AreaNavigation.jsx'
import PageHeader from '../../../shared/ui/PageHeader'
import { useReportingSearchParams } from '../application/useReportingSearchParams.js'
import ReportingTabs, { REPORTING_TABS } from './ReportingTabs.jsx'
import './reporting.css'

const viewLabel = (view) => REPORTING_TABS.find(({ id }) => id === view)?.label || 'Visão geral'

export function ReportingWorkspace() {
  const { query, patchQuery } = useReportingSearchParams()

  return (
    <>
      <AreaNavigation area="finance" />
      <PageHeader
        eyebrow="Financeiro"
        title="Relatórios"
        description="Analise vendas, operação, recebimentos e produtos com filtros consistentes."
      />

      <section className="reporting-filter-shell" aria-label="Filtros de relatórios">
        <div>
          <span className="section-kicker">Período</span>
          <strong>{query.from} até {query.to}</strong>
        </div>
        <p>Filtros avançados e dados oficiais serão conectados nas próximas etapas.</p>
      </section>

      <ReportingTabs
        value={query.view}
        onChange={(view) => patchQuery({ view })}
      />

      <section className="surface-card reporting-shell-state" aria-labelledby="reporting-current-view">
        <span className="section-kicker">Centro de Relatórios</span>
        <h2 id="reporting-current-view">{viewLabel(query.view)}</h2>
        <p>A estrutura de navegação e filtros por URL está pronta. Nenhuma métrica é calculada localmente nesta etapa.</p>
      </section>
    </>
  )
}
