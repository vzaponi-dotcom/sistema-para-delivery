import { useState } from 'react'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import Button from '../components/Button'
import Modal from '../components/Modal'
import ConfirmationDialog from '../components/ConfirmationDialog'
import OrderTicketPreview from '../components/OrderTicketPreview'
import SystemSelect from '../components/SystemSelect'
import '../print-queue.css'
import { buildPrintQueueSummary, getPrintStationSummary } from './printQueueSummary.js'
import { getPrintQueueLabel, resolvePrintQueueState } from '../../shared/printQueue.js'
import { formatOrderCustomerIdentity } from '../../shared/orderPrintDocument.js'
import { formatOrderDisplayNumber } from '../../shared/orderDisplayNumber.js'
import {
  filterPrintQueueJobs,
  PRINT_QUEUE_ORIGIN_FILTERS,
  PRINT_QUEUE_STATUS_FILTERS,
} from './printQueueFilters.js'
import { getPrintJobDetails } from './printQueueDetails.js'

const formatJobTime = (createdAt) => {
  if (!createdAt) return null
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return String(createdAt)
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date)
}

const getCustomerOrTable = (document) => {
  const customer = String(document?.customer?.name || '').trim()
  const table = String(document?.tableIdentifier || document?.order?.tableIdentifier || document?.table?.identifier || '').trim()
  return formatOrderCustomerIdentity({ tableIdentifier: table, customerName: customer })
}

const getPrintJobView = (job, stationReady, order) => {
  const state = job?.queueState
    ? resolvePrintQueueState(job.queueState)
    : resolvePrintQueueState(job?.status, { stationReady })
  return {
    orderNumber: order ? formatOrderDisplayNumber(order) : 'Pedido',
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

function PrintQueue({ orders = [], printing, onOpenPrintingSettings, onToast }) {
  const station = printing?.localStation ?? null
  const jobs = Array.isArray(printing?.jobs) ? printing.jobs : []
  const stationSummary = getPrintStationSummary(station)
  const stationReady = station?.health?.ready
  const summary = buildPrintQueueSummary(jobs, { stationReady })
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [origin, setOrigin] = useState('all')
  const [selectedJob, setSelectedJob] = useState(null)
  const [confirmation, setConfirmation] = useState(null)
  const [actionPending, setActionPending] = useState(false)
  const [reprintCopies, setReprintCopies] = useState(null)
  const [showReprint, setShowReprint] = useState(false)
  const [showTicket, setShowTicket] = useState(false)
  const ordersById = new Map(orders.map((order) => [String(order.id), order]))
  const filteredJobs = filterPrintQueueJobs(jobs, { search, status, origin, stationReady, orders })
  const jobRows = filteredJobs.map((job) => getPrintJobView(job, stationReady, ordersById.get(String(job.orderId))))
  const hasActiveFilters = Boolean(search.trim()) || status !== 'all' || origin !== 'all'
  const selectedDetails = selectedJob ? getPrintJobDetails(selectedJob, {
    order: ordersById.get(String(selectedJob.orderId)),
    stations: printing?.stations,
    stationReady,
  }) : null

  const closeDetails = () => {
    setSelectedJob(null)
    setShowReprint(false)
    setShowTicket(false)
    setReprintCopies(null)
  }
  const runAction = async (action) => {
    if (!selectedJob || actionPending) return
    setActionPending(true)
    try {
      if (action === 'printNow') await printing?.requestPrintNow?.(selectedJob)
      if (action === 'retry') await printing?.requestRetry?.(selectedJob)
      if (action === 'discard') await printing?.requestDiscard?.(selectedJob)
      if (action === 'forcePrint') await printing?.requestForcePrint?.(selectedJob)
      if (action === 'requestSecondCopy') await printing?.requestSecondCopy?.(selectedJob)
      if (action === 'skipSecondCopy') await printing?.skipSecondCopy?.(selectedJob)
      onToast?.({ printNow: 'Pedido priorizado na fila', retry: 'Nova tentativa enviada para a fila', discard: 'Trabalho de impressão descartado', forcePrint: 'Impressão autorizada e enviada para a fila', requestSecondCopy: '2ª via enviada para a fila', skipSecondCopy: '2ª via dispensada' }[action])
      closeDetails()
    } catch (error) {
      onToast?.(error?.message || 'Não foi possível concluir a operação.')
    } finally {
      setActionPending(false)
      setConfirmation(null)
    }
  }
  const requestAction = (action) => {
    if (action === 'discard' || action === 'forcePrint' || action === 'requestSecondCopy' || action === 'skipSecondCopy') setConfirmation(action)
    else if (action === 'reprint') {
      setReprintCopies(null)
      setShowReprint(true)
    }
    else void runAction(action)
  }
  const confirmReprint = async () => {
    if (!selectedJob || !reprintCopies || actionPending) return
    setActionPending(true)
    try {
      await printing?.requestReprint?.(selectedJob, reprintCopies)
      onToast?.('Reimpressão adicionada à fila')
      closeDetails()
    } catch (error) {
      onToast?.(error?.message || 'Não foi possível concluir a reimpressão.')
    } finally {
      setActionPending(false)
    }
  }
  const orderNumber = selectedDetails?.title || 'este pedido'

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
            <input
              type="search"
              aria-label="Buscar pedido, cliente ou mesa"
              placeholder="Buscar pedido, cliente ou mesa"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label className="print-queue-filter-control">
            <span>Status</span>
            <SystemSelect value={status} options={PRINT_QUEUE_STATUS_FILTERS} onChange={setStatus} label="Filtrar por status" />
          </label>
          <label className="print-queue-filter-control">
            <span>Origem</span>
            <SystemSelect value={origin} options={PRINT_QUEUE_ORIGIN_FILTERS} onChange={setOrigin} label="Filtrar por origem" />
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
                    <tr key={filteredJobs[index]?.id || `${job.orderNumber || 'job'}-${index}`} onClick={() => setSelectedJob(filteredJobs[index])} className="print-queue-job-row">
                      <td>{job.orderNumber}</td>
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
                <article className="print-queue-job-card" key={filteredJobs[index]?.id || `${job.orderNumber || 'job'}-card-${index}`} onClick={() => setSelectedJob(filteredJobs[index])}>
                  <div className="print-queue-job-card-header">
                    <strong>{job.orderNumber}</strong>
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
      {selectedDetails && (
          <Modal title={selectedDetails.title} onClose={closeDetails} footer={<div className="print-queue-detail-actions">
            <Button type="button" variant="secondary" className="print-queue-detail-close" onClick={closeDetails} disabled={actionPending}>Fechar</Button>
            {selectedJob?.type === 'order' && selectedJob?.document?.type === 'order' && <Button type="button" variant="secondary" className="print-queue-detail-ticket" onClick={() => setShowTicket(true)} disabled={actionPending}>Ver ticket</Button>}
            {selectedDetails.actions.filter((action) => ['discard', 'skipSecondCopy'].includes(action.key)).map((action) => <Button key={action.key} type="button" variant="secondary" className="print-queue-detail-destructive" onClick={() => requestAction(action.key)} disabled={actionPending}>{action.label}</Button>)}
            {selectedDetails.actions.filter((action) => !['discard', 'skipSecondCopy'].includes(action.key)).map((action) => <Button key={action.key} type="button" className="print-queue-detail-primary" onClick={() => requestAction(action.key)} disabled={actionPending}>{action.label}</Button>)}
          </div>}>
          {selectedDetails.identity && <p className="print-queue-detail-identity">{selectedDetails.identity}</p>}
          <div className="print-queue-detail-sections">
            <section aria-labelledby="print-detail-status"><h3 id="print-detail-status">Status</h3><p>{selectedDetails.status}</p></section>
            <section aria-labelledby="print-detail-print"><h3 id="print-detail-print">Impressão</h3>
              {selectedDetails.origin && <p><span>Origem</span>{selectedDetails.origin}</p>}
              {selectedDetails.copies && <p><span>Vias</span>{selectedDetails.copies}</p>}
              {selectedDetails.priority && <p><span>Prioridade</span>{selectedDetails.priority}</p>}
              {selectedDetails.station && <p><span>Estação responsável</span>{selectedDetails.station}</p>}
              <p><span>Estado atual</span>{selectedDetails.status}</p>
            </section>
            {Object.keys(selectedDetails.times).length > 0 && <section aria-labelledby="print-detail-times"><h3 id="print-detail-times">Horários</h3>{Object.values(selectedDetails.times).map((time) => <p key={time.label}><span>{time.label}</span>{time.value}</p>)}</section>}
            {(selectedDetails.attentionReason || selectedDetails.error) && <section aria-labelledby="print-detail-attention"><h3 id="print-detail-attention">Erro / atenção</h3>{selectedDetails.attentionReason && <p><span>Motivo</span>{selectedDetails.attentionReason}</p>}{selectedDetails.error?.code && <p><span>Código</span>{selectedDetails.error.code}</p>}{selectedDetails.error?.message && <p><span>Mensagem</span>{selectedDetails.error.message}</p>}</section>}
            {selectedDetails.reprintOf && <section aria-labelledby="print-detail-link"><h3 id="print-detail-link">Vínculo</h3><p>{selectedDetails.reprintOf}</p></section>}
            {selectedDetails.audit && <section aria-labelledby="print-detail-audit"><h3 id="print-detail-audit">Auditoria</h3><p><span>Ação</span>{selectedDetails.audit.action}</p>{selectedDetails.audit.at && <p><span>Horário</span>{selectedDetails.audit.at}</p>}{selectedDetails.audit.actor && <p><span>Ator/solicitante</span>{selectedDetails.audit.actor}</p>}</section>}
            {selectedDetails.secondCopySkipped && <section aria-labelledby="print-detail-second-copy"><h3 id="print-detail-second-copy">{selectedDetails.secondCopySkipped.label}</h3><p>{selectedDetails.secondCopySkipped.message}</p>{selectedDetails.secondCopySkipped.at && <p>{selectedDetails.secondCopySkipped.at}</p>}</section>}
          </div>
        </Modal>
      )}
      {showReprint && selectedDetails && <Modal title={`Reimprimir ${selectedDetails.title}`} onClose={() => setShowReprint(false)} footer={<div className="print-queue-reprint-actions">
        <Button type="button" variant="secondary" onClick={() => setShowReprint(false)} disabled={actionPending}>Cancelar</Button>
        <Button type="button" onClick={() => void confirmReprint()} disabled={!reprintCopies || actionPending}>Confirmar reimpressão</Button>
      </div>}>
        <p className="print-queue-reprint-copy">Escolha a quantidade de vias para o novo trabalho.</p>
        <div className="print-queue-reprint-options" role="group" aria-label="Quantidade de vias">
          {[1, 2].map((copies) => <Button key={copies} type="button" variant={reprintCopies === copies ? 'primary' : 'secondary'} className="print-queue-reprint-option" aria-pressed={reprintCopies === copies} onClick={() => setReprintCopies(copies)} disabled={actionPending}>{copies} {copies === 1 ? 'via' : 'vias'}</Button>)}
        </div>
      </Modal>}
      {showTicket && selectedJob?.document?.type === 'order' && selectedDetails && <Modal title={`Ticket do ${selectedDetails.title}`} onClose={() => setShowTicket(false)} footer={<div className="print-queue-ticket-actions"><Button type="button" variant="secondary" onClick={() => setShowTicket(false)}>Fechar</Button></div>}>
        <OrderTicketPreview document={selectedJob.document} />
      </Modal>}
      {confirmation && <ConfirmationDialog
        title={confirmation === 'requestSecondCopy' ? 'Imprimir 2ª via?' : confirmation === 'skipSecondCopy' ? 'Não imprimir a 2ª via?' : confirmation === 'discard' ? 'Descartar trabalho de impressão?' : 'Imprimir mesmo assim?'}
        message={confirmation === 'requestSecondCopy' ? `A 2ª via do ${orderNumber} será enviada para a fila da cozinha.` : confirmation === 'skipSecondCopy' ? `A pendência da 2ª via do ${orderNumber} será encerrada.` : confirmation === 'discard' ? `O trabalho de impressão de ${orderNumber} será descartado.` : `${orderNumber} já foi finalizado ou cancelado. Autorizar a impressão original?`}
        confirmLabel={confirmation === 'requestSecondCopy' ? 'Imprimir 2ª via' : confirmation === 'skipSecondCopy' ? 'Não imprimir 2ª via' : confirmation === 'discard' ? 'Descartar' : 'Imprimir mesmo assim'}
        cancelLabel="Cancelar"
        confirmVariant={confirmation === 'requestSecondCopy' ? 'primary' : confirmation === 'skipSecondCopy' ? 'danger' : confirmation === 'discard' ? 'secondary' : undefined}
        onClose={() => setConfirmation(null)}
        onConfirm={() => void runAction(confirmation)}
        disabled={actionPending}
      />}
    </div>
  )
}

export default PrintQueue
