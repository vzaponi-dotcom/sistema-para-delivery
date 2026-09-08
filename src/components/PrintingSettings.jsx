import { useEffect, useState } from 'react'
import Button from './Button'
import ConfirmationDialog from './ConfirmationDialog'
import Modal from './Modal'
import SystemSelect from './SystemSelect'
import '../printing/printing.css'

const CONNECTION_LABELS = {
  connected: 'Conectada',
  disconnected: 'Desconectada',
  unconfigured: 'Não configurada',
  unsupported: 'Navegador incompatível',
  connecting: 'Conectando…',
  'driver-ready': 'RawBT pronto',
}

const QZ_CONNECTION_LABELS = {
  connected: 'QZ Tray conectado',
  disconnected: 'QZ Tray desconectado',
  unconfigured: 'Impressora QZ não configurada',
  unsupported: 'QZ Tray indisponível',
  connecting: 'Conectando ao QZ Tray…',
}

const PLATFORM_LABELS = {
  windows: 'Windows',
  android: 'Android',
  other: 'Outro',
}

function PrintingSettings({ printing, onClose }) {
  const station = printing?.localStation || null
  const isRawBt = printing?.transportKind === 'rawbt'
  const isQz = printing?.transportKind === 'qz'
  const [defaultCopies, setDefaultCopies] = useState(2)
  const [autoPrintEnabled, setAutoPrintEnabled] = useState(false)
  const [pendingAction, setPendingAction] = useState(null)
  const [confirmPrimary, setConfirmPrimary] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [qzConfiguring, setQzConfiguring] = useState(false)
  const [qzPrinterSelection, setQzPrinterSelection] = useState('')

  useEffect(() => {
    setDefaultCopies(station?.defaultCopies === 1 ? 1 : 2)
    setAutoPrintEnabled(Boolean(station?.autoPrintEnabled))
  }, [station?.id, station?.defaultCopies, station?.autoPrintEnabled])

  useEffect(() => {
    setQzPrinterSelection(printing?.configuredPrinterName || '')
  }, [printing?.configuredPrinterName])

  const run = async (key, action, successMessage = '') => {
    if (pendingAction) return false
    setPendingAction(key)
    setFeedback('')
    try {
      await action()
      if (successMessage) setFeedback(successMessage)
      return true
    } catch (error) {
      setFeedback(error?.message || 'Não foi possível concluir a ação de impressão.')
      return false
    } finally {
      setPendingAction(null)
    }
  }

  const connectPrinter = () => run('connect', () => printing.connectPrinter(), 'Impressora conectada e autorizada neste dispositivo.')
  const testPrint = () => run('test', () => printing.testPrint(), isRawBt ? 'Teste enviado ao RawBT.' : 'Teste enviado para a impressora.')

  const openQzConfiguration = async () => {
    setQzConfiguring(true)
    setQzPrinterSelection(printing?.configuredPrinterName || '')
    await run('qz-discover', () => printing.refreshPrinters())
  }

  const refreshQzPrinters = () => run('qz-discover', () => printing.refreshPrinters())

  const saveQzPrinter = async () => {
    const printerName = String(qzPrinterSelection || '').trim()
    if (!printerName) {
      setFeedback('Selecione uma impressora antes de salvar.')
      return
    }
    const saved = await run(
      'qz-select',
      () => printing.selectPrinter(printerName),
      `Impressora ${printerName} configurada nesta estação.`,
    )
    if (saved) setQzConfiguring(false)
  }

  const saveStationSettings = async (next = {}) => {
    const nextCopies = next.defaultCopies ?? defaultCopies
    const nextAuto = next.autoPrintEnabled ?? autoPrintEnabled
    if (nextCopies !== 1 && nextCopies !== 2) return false
    return run('save', () => printing.saveStationSettings({
      name: station?.name,
      platform: station?.platform,
      autoPrintEnabled: nextAuto,
      defaultCopies: nextCopies,
    }), 'Configuração de impressão salva.')
  }

  const handleAutoPrintChange = async (event) => {
    const next = event.target.checked
    setAutoPrintEnabled(next)
    const saved = await saveStationSettings({ autoPrintEnabled: next })
    if (!saved) setAutoPrintEnabled(Boolean(station?.autoPrintEnabled))
  }

  const handleCopiesChange = async (event) => {
    const next = Number(event.target.value) === 1 ? 1 : 2
    setDefaultCopies(next)
    const saved = await saveStationSettings({ defaultCopies: next })
    if (!saved) setDefaultCopies(station?.defaultCopies === 1 ? 1 : 2)
  }

  const makePrimary = async () => {
    const saved = await run('primary', () => printing.makePrimary(station?.id), 'Esta estação agora é a principal para impressão automática.')
    if (saved) setConfirmPrimary(false)
  }

  const printerState = printing?.supported === false ? 'unsupported' : (printing?.printerState || 'unconfigured')
  const connectionLabel = (isQz ? QZ_CONNECTION_LABELS : CONNECTION_LABELS)[printerState] || 'Desconectada'
  const configured = !['unconfigured', 'unsupported'].includes(printerState)
  const disabled = Boolean(pendingAction) || !station
  const qzPrinters = Array.isArray(printing?.availablePrinters) ? printing.availablePrinters : []
  const qzPrinterOptions = qzPrinters.map((printerName) => ({ value: printerName, label: printerName }))

  return (
    <>
      <Modal title="Impressão" onClose={onClose}>
        <div className="printing-settings form-stack">
          <div className="printing-status-card">
            <div>
              <span className="printing-label">Impressora</span>
              <strong>{connectionLabel}</strong>
            </div>
            <span className={`printing-state printing-state-${printerState}`}>{connectionLabel}</span>
          </div>

          {isRawBt && (
            <p className="printing-feedback">
              RawBT pronto indica que o driver Android será usado. A conexão física com a MPT-II é validada pela impressão de teste.
            </p>
          )}

          <div className="printing-info-grid">
            <div className="printing-info-card"><span>Estação</span><strong>{station?.name || 'Preparando estação…'}</strong></div>
            <div className="printing-info-card"><span>Plataforma</span><strong>{PLATFORM_LABELS[station?.platform] || 'Outro'}</strong></div>
            <div className="printing-info-card"><span>Driver</span><strong>{isRawBt ? 'RawBT' : (isQz ? 'QZ Tray' : 'Web Serial')}</strong></div>
            <div className="printing-info-card"><span>Estação principal</span><strong>{station?.isPrimary ? 'Sim' : 'Não'}</strong></div>
            <div className="printing-info-card"><span>Impressão automática</span><strong>{autoPrintEnabled ? 'Ligada' : 'Desligada'}</strong></div>
          </div>

          {isQz && (
            <div className="printing-settings-section">
              <div className="printing-settings-heading">
                <div>
                  <h3>Impressora do Windows</h3>
                  <p>O QZ Tray deve permanecer aberto no Windows para impressão automática.</p>
                </div>
                <span className={`printing-state printing-state-${printing?.transportReady ? 'connected' : 'unconfigured'}`}>
                  {printing?.transportReady ? 'Pronta' : 'Configuração necessária'}
                </span>
              </div>

              <div className="printing-inline-card">
                <strong>{printing?.configuredPrinterName || 'Nenhuma fila configurada'}</strong>
                <span>Fila local esperada: MPT-II. A escolha fica salva somente nesta estação.</span>
              </div>

              {qzConfiguring ? (
                <div className="form-stack">
                  <SystemSelect
                    value={qzPrinterSelection}
                    onChange={setQzPrinterSelection}
                    options={qzPrinterOptions}
                    placeholder={pendingAction === 'qz-discover' ? 'Buscando impressoras…' : 'Selecione a impressora'}
                    ariaLabel="Impressora QZ"
                    disabled={disabled || pendingAction === 'qz-discover'}
                  />
                  {pendingAction !== 'qz-discover' && qzPrinters.length === 0 && (
                    <p className="printing-feedback">Nenhuma fila foi encontrada. Confirme que o QZ Tray está aberto e atualize a lista.</p>
                  )}
                  <div className="printing-actions-row">
                    <Button type="button" variant="secondary" onClick={refreshQzPrinters} disabled={disabled}>
                      Atualizar lista
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => setQzConfiguring(false)} disabled={disabled}>
                      Cancelar
                    </Button>
                    <Button type="button" onClick={saveQzPrinter} disabled={disabled || !qzPrinterSelection}>
                      Salvar impressora
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="printing-actions-row">
                  <Button type="button" variant="secondary" onClick={openQzConfiguration} disabled={disabled || printing?.supported === false}>
                    {printing?.configuredPrinterName ? 'Trocar impressora' : 'Configurar impressora'}
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="printing-actions-row">
            {!isRawBt && !isQz && (
              <Button type="button" variant="secondary" onClick={connectPrinter} disabled={disabled || printing?.supported === false}>
                {configured ? 'Trocar impressora' : 'Conectar impressora'}
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              onClick={testPrint}
              disabled={disabled || printing?.supported === false || (isQz && !printing?.transportReady)}
            >
              Testar impressão
            </Button>
          </div>

          <label className="printing-toggle-row">
            <span><strong>Imprimir novos pedidos automaticamente</strong><small>Somente a estação principal consome a fila automática.</small></span>
            <input type="checkbox" checked={autoPrintEnabled} onChange={handleAutoPrintChange} disabled={disabled} />
          </label>

          <fieldset className="printing-copy-options" disabled={disabled}>
            <legend>Cópias por pedido</legend>
            <label><input type="radio" name="defaultCopies" value={1} checked={defaultCopies === 1} onChange={handleCopiesChange} />1 cópia</label>
            <label><input type="radio" name="defaultCopies" value={2} checked={defaultCopies === 2} onChange={handleCopiesChange} />2 cópias</label>
          </fieldset>

          {!station?.isPrimary && (
            <div className="printing-primary-card">
              <div><strong>Tornar estação principal</strong><span>Necessário para receber automaticamente os novos pedidos.</span></div>
              <Button type="button" variant="secondary" onClick={() => setConfirmPrimary(true)} disabled={disabled}>Tornar estação principal</Button>
            </div>
          )}

          <div className="printing-compatibility">
            <strong>Compatibilidade</strong>
            <span>Windows usa o QZ Tray para enviar o mesmo ticket ESC/POS diretamente à fila configurada.</span>
            <span>Android usa o RawBT para enviar o mesmo ticket ESC/POS à impressora.</span>
            <span>Outras plataformas compatíveis continuam usando Web Serial como fallback.</span>
            {isRawBt && <span>Configure a MPT-II no RawBT antes de testar a impressão.</span>}
          </div>

          {printing?.lastError?.message && <p className="printing-feedback printing-feedback-error">{printing.lastError.message}</p>}
          {feedback && <p className="printing-feedback" role="status">{feedback}</p>}
        </div>
      </Modal>

      {confirmPrimary && (
        <ConfirmationDialog
          title="Tornar estação principal"
          message="Esta será a única estação responsável pela impressão automática. As outras estações continuam disponíveis para ações manuais."
          confirmLabel="Tornar principal"
          confirmVariant="primary"
          onClose={() => setConfirmPrimary(false)}
          onConfirm={makePrimary}
          disabled={Boolean(pendingAction)}
        />
      )}
    </>
  )
}

export default PrintingSettings