import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import Button from '../components/Button'
import '../print-queue.css'
import { buildPrintQueueSummary, getPrintStationSummary } from './printQueueSummary.js'
import { getPrintQueueLabel, resolvePrintQueueState } from '../../shared/printQueue.js'

const formatJobTime = (createdAt) => {
  if (!createdAt) return null
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return String(createdAt)
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date)
}

const getPrintJobView = (job, stationReady) => {
  const state = job?.queueState
    ? resolvePrintQueueState(job.queueState)
    : resolvePrintQueueState(job?.status, { stationReady })
  return {
    orderNumber: job?.document?.order?.number || null,
    customerOrTable: job?.document?.customer?.name || null,
    origin: job?.trigger === 'automatic' ? 'Automático' : job?.trigger === 'manual' ? 'Manual' : null,
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
  const jobRows = jobs.map((job) => getPrintJobView(job, stationReady))

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
        {jobs.length === 0 ? (
          <p className="print-queue-empty">Os trabalhos de impressão aparecerão aqui.</p>
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
                    <tr key={jobs[index]?.id || `${job.orderNumber || 'job'}-${index}`}>
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
                <article className="print-queue-job-card" key={jobs[index]?.id || `${job.orderNumber || 'job'}-card-${index}`}>
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
