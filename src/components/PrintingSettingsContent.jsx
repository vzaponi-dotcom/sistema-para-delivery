import { useRef, useState } from 'react'
import Button from './Button'
import ConfirmationDialog from './ConfirmationDialog'
import SystemSelect from './SystemSelect'
import '../printing/printing.css'
import { hasCapability } from '../app/access.js'

const PLATFORM_LABELS = {
  windows: 'Windows',
  android: 'Android',
  other: 'Outro',
}

const PHYSICAL_HEALTH_LABELS = {
  ready: 'Pronta para imprimir',
  verifying: 'Verificando impressora…',
  printer_offline: 'Impressora desligada ou desconectada',
  printer_attention: 'Atenção necessária na impressora',
}

const countLabel = (count, singular, plural) => `${count} ${count === 1 ? singular : plural}`

function PrintingSettingsContent({ printing, settings, granted }) {
  const policyState = settings?.policyState?.()
  const stationState = settings?.stationState?.()
  const primaryState = settings?.primaryState?.()
  const confirmedStation = stationState?.confirmed?.data || {}
  const station = { ...(printing?.localStation || {}), ...confirmedStation }
  const primaryStationId = primaryState?.draft?.primaryStationId || primaryState?.confirmed?.data?.primaryStationId
  const stationIsPrimary = primaryStationId ? primaryStationId === station.id : Boolean(station.isPrimary)
  const policyDraft = policyState?.draft || policyState?.confirmed?.data || null
  const stationDraft = stationState?.draft || {
    name: station.name || '', platform: station.platform || 'other', autoPrintEnabled: Boolean(station.autoPrintEnabled),
  }
  const [printerSelection, setPrinterSelection] = useState(null)
  const [confirmPrimary, setConfirmPrimary] = useState(false)
  const busyRef = useRef(new Set())
  const [busyKeys, setBusyKeys] = useState(() => new Set())
  const [feedback, setFeedback] = useState('')
  const canEditPolicy = hasCapability(granted, 'printing.settings')
  const canConfigureStation = hasCapability(granted, 'printing.station.configure')
  const canExecutePrinting = hasCapability(granted, 'printing.execute')
  const canViewPolicy = canEditPolicy || hasCapability(granted, 'printing.settings.view')
  const canViewStation = canConfigureStation || hasCapability(granted, 'printing.station.view')
  const isQz = printing?.transportKind === 'qz'

  const run = async (key, action, success) => {
    if (busyRef.current.has(key)) return false
    busyRef.current.add(key)
    setBusyKeys(new Set(busyRef.current))
    setFeedback('')
    try {
      const result = await action()
      if (result && success) setFeedback(success)
      return Boolean(result)
    } catch (error) {
      setFeedback(error?.message || 'Não foi possível concluir esta ação de impressão.')
      return false
    } finally {
      busyRef.current.delete(key)
      setBusyKeys(new Set(busyRef.current))
    }
  }
  const updatePolicy = (field, value) => {
    const next = { ...(policyDraft || {}), [field]: Number(value) }
    settings?.editPolicy?.(next)
  }
  const updateStation = (patch) => {
    const next = { ...stationDraft, ...patch }
    settings?.editStation?.(next)
  }
  const operationalLabel = !isQz
    ? 'Fila central'
    : !printing?.qzConnected
      ? 'QZ Tray indisponível'
      : !printing?.configuredPrinterName
        ? 'Impressora não configurada'
        : !printing?.printerQueueFound
          ? 'Impressora não encontrada'
          : PHYSICAL_HEALTH_LABELS[printing?.printerHealth?.state] || PHYSICAL_HEALTH_LABELS.verifying
  const printerOptions = (printing?.availablePrinters || []).map((name) => ({ value: name, label: name }))
  const selectedPrinter = printerSelection ?? printing?.configuredPrinterName ?? ''
  const jobs = Array.isArray(printing?.jobs) ? printing.jobs : []
  const pendingCount = jobs.filter((job) => job?.status === 'pending').length
  const awaitingConfirmationCount = jobs.filter((job) => job?.status === 'awaiting_confirmation').length
  const localBusy = ['discover', 'printer', 'test'].some((key) => busyKeys.has(key))
  const blockedStatuses = ['loading', 'saving', 'unconfirmed', 'conflict']
  const policyBlocked = !policyDraft || blockedStatuses.includes(policyState?.status)
  const stationBlocked = !station.id || !stationState || blockedStatuses.includes(stationState.status)
  const primaryBlocked = !station.id || !primaryState || blockedStatuses.includes(primaryState.status)

  return <>
    <div className="printing-settings form-stack">
      {canViewPolicy && <section className="printing-settings-section" aria-labelledby="printing-policy-title">
        <div className="printing-settings-heading"><div><p className="section-kicker">Para todo o negócio</p><h2 id="printing-policy-title">Política do negócio</h2><p>Defina quantas vias serão solicitadas em cada contexto.</p></div></div>
        {policyDraft ? <div className="printing-info-grid">
          <fieldset className="printing-copy-options" disabled={!canEditPolicy || policyBlocked}>
            <legend>Pedidos avulsos</legend>
            {[1, 2].map((copies) => <label key={copies}><input type="radio" name="orderDefaultCopies" value={copies} checked={policyDraft.orderDefaultCopies === copies} onChange={(event) => updatePolicy('orderDefaultCopies', event.target.value)} />{copies} {copies === 1 ? 'via' : 'vias'}</label>)}
          </fieldset>
          <fieldset className="printing-copy-options" disabled={!canEditPolicy || policyBlocked}>
            <legend>Mesas e comandas</legend>
            {[1, 2].map((copies) => <label key={copies}><input type="radio" name="tableTabDefaultCopies" value={copies} checked={policyDraft.tableTabDefaultCopies === copies} onChange={(event) => updatePolicy('tableTabDefaultCopies', event.target.value)} />{copies} {copies === 1 ? 'via' : 'vias'}</label>)}
          </fieldset>
        </div> : <p role="status">Carregando política de impressão…</p>}
        <p className="settings-effective-notice">Apenas novas solicitações de impressão. A fila existente mantém suas vias.</p>
        {policyState?.error && <div className="printing-feedback printing-feedback-error" role="alert"><p>{policyState.error}</p><Button type="button" variant="secondary" onClick={() => policyState.status === 'unconfirmed' ? settings.reconcilePolicy() : settings.reloadPolicy()}>{policyState.status === 'unconfirmed' ? 'Reconsultar' : 'Tentar novamente'}</Button></div>}
        {canEditPolicy && <div className="printing-actions-row">
          <Button type="button" variant="secondary" onClick={() => settings?.discardPolicy?.()} disabled={policyBlocked || !policyState?.dirty}>Descartar</Button>
          <Button type="button" onClick={() => run('policy', () => settings.savePolicy(), 'Política de impressão salva.')} disabled={policyBlocked || !policyState?.dirty}>Salvar política</Button>
        </div>}
      </section>}

      {canViewStation && <section className="printing-settings-section" aria-labelledby="printing-station-title">
        <div className="printing-settings-heading"><div><p className="section-kicker">Neste equipamento</p><h2 id="printing-station-title">Esta estação</h2><p>Identidade administrativa e impressão automática desta estação.</p></div>{stationIsPrimary && <span className="printing-state printing-state-ready">Principal</span>}</div>
        <div className="printing-info-grid">
          <div className="printing-info-card"><span>Nome real da estação</span><strong>{station.name || 'Preparando estação…'}</strong></div>
          <div className="printing-info-card"><span>Plataforma</span><strong>{PLATFORM_LABELS[station.platform] || 'Outro'}</strong></div>
        </div>
        {isQz && canConfigureStation && <label className="printing-toggle-row"><span><strong>Imprimir novos pedidos automaticamente</strong><small>Somente a estação principal consome a fila automática.</small></span><input type="checkbox" checked={Boolean(stationDraft.autoPrintEnabled)} onChange={(event) => updateStation({ autoPrintEnabled: event.target.checked })} disabled={stationBlocked} /></label>}
        {stationState?.error && <div className="printing-feedback printing-feedback-error" role="alert"><p>{stationState.error}</p><Button type="button" variant="secondary" onClick={() => stationState.status === 'unconfirmed' ? settings.reconcileStation() : settings.reloadStation()}>{stationState.status === 'unconfirmed' ? 'Reconsultar' : 'Tentar novamente'}</Button></div>}
        {isQz && canConfigureStation && <div className="printing-actions-row">
          <Button type="button" onClick={() => run('station', () => settings.saveStation(), 'Estação salva.')} disabled={stationBlocked || !stationState?.dirty}>Salvar estação</Button>
          {!stationIsPrimary && <Button type="button" variant="secondary" onClick={() => setConfirmPrimary(true)} disabled={primaryBlocked}>Tornar principal</Button>}
        </div>}
      </section>}

      {canViewStation && <section className="printing-settings-section" aria-labelledby="printing-local-title">
        <div className="printing-settings-heading"><div><p className="section-kicker">Somente neste equipamento</p><h2 id="printing-local-title">Impressora local / QZ</h2><p>A fila selecionada não é sincronizada com outras máquinas.</p></div><span className="printing-state">{operationalLabel}</span></div>
        {!isQz && <p className="printing-feedback">Esta estação acompanha a fila central; a execução física ocorre na estação Windows principal.</p>}
        {isQz && canConfigureStation && <SystemSelect value={selectedPrinter} onChange={setPrinterSelection} options={printerOptions} placeholder="Selecione a impressora" ariaLabel="Impressora QZ" disabled={localBusy} />}
        {isQz && (canConfigureStation || canExecutePrinting) && <div className="printing-actions-row">
          {canConfigureStation && <Button type="button" variant="secondary" onClick={() => run('discover', () => settings.refreshPrinters())} disabled={localBusy}>Atualizar lista</Button>}
          {canConfigureStation && <Button type="button" onClick={() => run('printer', () => settings.savePrinter(selectedPrinter), 'Impressora local salva.')} disabled={localBusy || !selectedPrinter}>Salvar impressora</Button>}
          {canExecutePrinting && <Button type="button" variant="secondary" onClick={() => run('test', () => settings.testPrint(), 'Teste enviado com 1 via.')} disabled={localBusy || !printing?.transportReady || printing?.printerHealth?.state !== 'ready'}>Testar impressão</Button>}
        </div>}
        <div className="printing-inline-card"><strong>{printing?.configuredPrinterName || 'Nenhuma fila configurada'}</strong><span>Fila encontrada não confirma que a impressora física está pronta.</span></div>
        {(pendingCount > 0 || awaitingConfirmationCount > 0) && <div className="printing-queue-summary" aria-live="polite">
          {pendingCount > 0 && <span>Há {countLabel(pendingCount, 'trabalho aguardando impressão', 'trabalhos aguardando impressão')}</span>}
          {awaitingConfirmationCount > 0 && <span>{countLabel(awaitingConfirmationCount, 'via enviada à impressora aguardando confirmação', 'vias enviadas à impressora aguardando confirmação')}</span>}
        </div>}
        {printing?.lastError?.message && <p className="printing-feedback printing-feedback-error" role="alert">{printing.lastError.message}</p>}
      </section>}
      {feedback && <p className="printing-feedback" role="status">{feedback}</p>}
    </div>
    {confirmPrimary && <ConfirmationDialog title="Tornar estação principal" message="Esta estação passará a ser a única responsável pela impressão automática. Confirme para continuar." confirmLabel="Tornar principal" confirmVariant="primary" onClose={() => setConfirmPrimary(false)} onConfirm={async () => { const saved = await run('primary', () => settings.makePrimary(), 'Esta estação agora é a principal.'); if (saved) setConfirmPrimary(false) }} disabled={primaryBlocked || busyKeys.has('primary')} />}
  </>
}

export default PrintingSettingsContent
