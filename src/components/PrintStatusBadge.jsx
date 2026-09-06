const STATUS_LABELS = {
  pending: 'Pendente de impressão',
  processing: 'Imprimindo',
  printed: 'Enviado para impressão',
  failed: 'Falha na impressão',
  requires_attention: 'Requer atenção',
}

function PrintStatusBadge({ job }) {
  if (!job?.status || !STATUS_LABELS[job.status]) return null
  const awaitingSecondCopy = job.status === 'printed'
    && Number(job.copiesRequested) === 2
    && Number(job.copiesPrinted) === 1
  const label = awaitingSecondCopy ? 'Aguardando 2ª via' : STATUS_LABELS[job.status]
  const title = job.lastError?.message || label
  return <span className={`print-status-badge print-status-${job.status}`} title={title}>{label}</span>
}

export default PrintStatusBadge
