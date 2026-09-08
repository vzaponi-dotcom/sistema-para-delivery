import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import Button from '../components/Button'
import '../print-queue.css'
import { buildPrintQueueSummary, getPrintStationSummary } from './printQueueSummary.js'

function PrintQueue({ printing, onOpenPrintingSettings }) {
  const station = printing?.localStation ?? null
  const stationSummary = getPrintStationSummary(station)
  const summary = buildPrintQueueSummary(printing?.jobs, { stationReady: station?.health?.ready })

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

      <section aria-label="Conteúdo da fila de impressão">
        <p>Os trabalhos de impressão aparecerão aqui.</p>
      </section>
    </div>
  )
}

export default PrintQueue
