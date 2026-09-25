import AreaNavigation from '../../../app/navigation/AreaNavigation.jsx'
import { useState } from 'react'
import PageHeader from '../../../shared/ui/PageHeader'
import { useReportingSearchParams } from '../application/useReportingSearchParams.js'
import ReportingTabs from './ReportingTabs.jsx'
import { ReportingFilters } from './ReportingFilters.jsx'
import { OverviewReport } from './views/OverviewReport.jsx'
import { OperationReport } from './views/OperationReport.jsx'
import { SalesReport } from './views/SalesReport.jsx'
import { ProductsReport } from './views/ProductsReport.jsx'
import { DetailReport, DEFAULT_DETAIL_COLUMNS } from './views/DetailReport.jsx'
import { ReportingExportMenu } from './ReportingExportMenu.jsx'
import { ReportingMobileSummary } from './mobile/ReportingMobileSummary.jsx'
import { useMediaQuery } from '../../../shared/hooks/useMediaQuery.js'
import { useReportingData } from '../application/useReportingData.js'
import './reporting.css'

export function ReportingWorkspace({ granted }) {
  const { query, patchQuery } = useReportingSearchParams()
  const state = useReportingData({ query })
  const [columns, setColumns] = useState(DEFAULT_DETAIL_COLUMNS)
  const isMobile = useMediaQuery('(max-width: 820px)')

  return (
    <>
      <AreaNavigation area="finance" />
      <div className="reporting-page">
        <PageHeader
          eyebrow="Financeiro"
          title="Relatórios"
          description="Acompanhe o desempenho do negócio, compare períodos e investigue cada indicador sem sair do fluxo financeiro."
          actions={<ReportingExportMenu query={query} columns={columns} granted={granted} />}
        />

        <ReportingFilters query={query} onChange={patchQuery} />

        <ReportingTabs
          value={query.view}
          onChange={(view) => patchQuery({ view })}
        />

        <main className="reporting-view">
          {isMobile ? <ReportingMobileSummary query={query} detailState={state} onDrilldown={(product) => patchQuery({ view: 'detail', product, productName: null })} /> : query.view === 'overview' ? <OverviewReport state={state} onDrilldown={patchQuery} /> : query.view === 'operation' ? <OperationReport state={state} onDrilldown={patchQuery} /> : query.view === 'sales' ? <SalesReport state={state} onDrilldown={patchQuery} /> : query.view === 'products' ? <ProductsReport state={state} onDrilldown={(product) => patchQuery({ view: 'detail', product, productName: null })} /> : <DetailReport state={state} query={query} onChange={patchQuery} selectedColumns={columns} onColumnsChange={setColumns} />}
        </main>
      </div>
    </>
  )
}
