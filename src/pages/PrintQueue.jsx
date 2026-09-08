import { useState } from 'react'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import Button from '../components/Button'
import '../print-queue.css'
import { buildPrintQueueSummary, getPrintStationSummary } from './printQueueSummary.js'
import { getPrintQueueLabel, resolvePrintQueueState } from '../../shared/printQueue.js'
import {
  filterPrintQueueJobs,
  PRINT_QUEUE_ORIGIN_FILTERS,
  PRINT_QUEUE_STATUS_FILTERS,
} from './printQueueFilters.js'

const formatJobTime = (createdAt) => {
  if (!createdAt) return null
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return String(createdAt)
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date)
}

const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''))

const getOperationalOrderNumber = (order = {}) => {
  const explicitNumber = [order.displayNumber, order.operationalNumber, order.orderNumber]
    .map((value) => String(value || '').trim())
    .find(Boolean)
  if (explicitNumber) return explicitNumber

  const snapshotNumber = String(order.number || '').trim()
  if (!snapshotNumber) return null
  if (isUuid(order.id) && String(order.id).endsWith(snapshotNumber)) return null
  return snapshotNumber
}

const getCustomerOrTable = (document) => {
  const customer = String(document?.customer?.name || '').trim()
  const table = String(document?.tableIdentifier || document?.order?.tableIdentifier || document?.table?.identifier || '').trim()
  if (table && customer && customer !== table && !customer.startsWith(`${table} ·`)) return `${table} · ${customer}`
  return table || customer || null
}

const getPrintJobView = (job, stationReady) => {
  const state = job?.queueState
    ? resolvePrintQueueState(job.queueState)
    : resolvePrintQueueState(job?.status, { stationReady })
  return {
    orderNumber: getOperationalOrderNumber(job?.document?.order),
    customerOrTable: getCustomerOrTable(job?.document),
    origin: job?.trigger === 'automatic' ? 'Automático' : job?.trigger === 'manual' ? 'Manual/Reimpressão' : null,
    copies: `${Number(job?.copiesPrinted) || 0}/${Number(job?.copiesRequested) || 0}`,
    status: getPrintQueueLabel(state),
    state,
    time: formatJobTime(job?.createdAt),
    station: job?.stationId || null,
    attentionReason: state === 'attention' ? job?.attentionReason || null : null,
  }
}

function PrintQueue({ printing, onOpenPrintingSettings }) {
  const station = printing?.localStation ?? null
  const jobs = Array.isArray(printing?.jobs) ? printing.jobs : []
  const stationSummary = getPrintStationSummary(station)
  const stationReady = station?.health?.ready
  const summary = buildPrintQueueSummary(jobs, { stationReady })
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [origin, setOrigin] = useState('all')
  const filteredJobs = filterPrintQueueJobs(jobs, { search, status, origin, stationReady })
  const jobRows = filteredJobs.map((job) => getPrintJobView(job, stationReady))
  const hasActiveFilters = Boolean(search.trim()) || status !== 'all' || origin !== 'all'

  return (
    <div className="print-queue-page">
      <PageHeader
        eyebrow="Operação"
        title="Fila de impressão"
        description="Acompanhe e gerencie as impressões da cozinha"
        actions={(
          <Button
            type="button"
            variant="secondary"
            icon="settings"
            className="print-queue-settings-button"
            aria-label="Configurações de impressão"
            title="Configurações de impressão"
            onClick={onOpenPrintingSettings}
          >
            Configurações
          </Button>
        )}
      />
      <section className="print-queue-station-card" aria-label="Status da estação de impressão">
        <div className="print-queue-station-copy">
          <strong>Cozinha PC</strong>
          <span>{station?.name || 'Estação não identificada'}</span>
        </div>
        <div className="print-queue-station-health">
          <strong>{stationSummary.onlineLabel}</strong>
          {stationSummary.qzLabel && <span>{stationSummary.qzLabel}</span>}
          {stationSummary.printerLabel && <span>{stationSummary.printerLabel}</span>}
        </div>
      </section>

      <section className="stats-grid print-queue-summary" aria-label="Resumo da fila de impressão">
        <StatCard label="Na fila" value={summary.queued} icon="printer" />
        <StatCard label="Aguardando estação" value={summary.waitingStation} icon="clock" />
        <StatCard label="Aguardando 2ª via" value={summary.waitingSecondCopy} icon="receipt" />
        <StatCard label="Requer atenção" value={summary.attention} icon="alert" tone={summary.attention ? 'danger' : 'neutral'} />
      </section>

      <section className="print-queue-jobs-section" aria-label="Trabalhos da fila de impressão">
        <div className="print-queue-jobs-heading">
          <div>
            <p className="section-kicker">Execução</p>
            <h2>Trabalhos de impressão</h2>
          </div>
        </div>
        <div className="print-queue-filters" aria-label="Filtros da fila de impressão">
          <label className="print-queue-search">
            <span className="sr-only">Buscar pedido, cliente ou mesa</span>
            <input
              type="search"
              placeholder="Buscar pedido, cliente ou mesa"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label className="print-queue-filter-control">
            <span>Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filtrar por status">
              {PRINT_QUEUE_STATUS_FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="print-queue-filter-control">
            <span>Origem</span>
            <select value={origin} onChange={(event) => setOrigin(event.target.value)} aria-label="Filtrar por origem">
              {PRINT_QUEUE_ORIGIN_FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>
        {jobs.length === 0 ? (
          <p className="print-queue-empty">Os trabalhos de impressão aparecerão aqui.</p>
        ) : filteredJobs.length === 0 && hasActiveFilters ? (
          <p className="print-queue-empty print-queue-filtered-empty">Nenhum trabalho encontrado com os filtros atuais.</p>
        ) : (
          <>
            <div className="print-queue-jobs-table-wrap">
              <table className="print-queue-jobs-table">
                <thead>
                  <tr>
                    <th>Pedido</th>
                    <th>Cliente ou mesa</th>
                    <th>Origem</th>
                    <th>Vias</th>
                    <th>Status</th>
                    <th>Horário</th>
                    <th>Estação</th>
                  </tr>
                </thead>
                <tbody>
                  {jobRows.map((job, index) => (
                    <tr key={filteredJobs[index]?.id || `${job.orderNumber || 'job'}-${index}`}>
                      <td>{job.orderNumber ? `Pedido #${job.orderNumber}` : 'Pedido'}</td>
                      <td>{job.customerOrTable || '—'}</td>
                      <td>{job.origin || '—'}</td>
                      <td>{job.copies} vias</td>
                      <td><span className={`print-queue-status print-queue-status-${job.state}`}>{job.status}</span>{job.attentionReason && <small className="print-queue-attention-reason">{job.attentionReason}</small>}</td>
                      <td>{job.time || '—'}</td>
                      <td>{job.station || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="print-queue-job-cards" aria-label="Trabalhos de impressão em cards">
              {jobRows.map((job, index) => (
                <article className="print-queue-job-card" key={filteredJobs[index]?.id || `${job.orderNumber || 'job'}-card-${index}`}>
                  <div className="print-queue-job-card-header">
                    <strong>{job.orderNumber ? `Pedido #${job.orderNumber}` : 'Pedido'}</strong>
                    <span className={`print-queue-status print-queue-status-${job.state}`}>{job.status}</span>
                  </div>
                  <strong className="print-queue-job-customer">{job.customerOrTable || '—'}</strong>
                  <div className="print-queue-job-meta">
                    <span>{job.origin || '—'}</span>
                    <span>Vias {job.copies}</span>
                    <span>{job.time || '—'}</span>
                    {job.station && <span>{job.station}</span>}
                  </div>
                  {job.attentionReason && <p className="print-queue-attention-reason">{job.attentionReason}</p>}
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}

export default PrintQueue
