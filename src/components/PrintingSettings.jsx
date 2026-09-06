import { useEffect, useState } from 'react'
import Button from './Button'
import ConfirmationDialog from './ConfirmationDialog'
import Modal from './Modal'
import '../printing/printing.css'

const CONNECTION_LABELS = {
  connected: 'Conectada',
  disconnected: 'Desconectada',
  unconfigured: 'Não configurada',
  unsupported: 'Navegador incompatível',
  connecting: 'Conectando…',
}

const PLATFORM_LABELS = {
  windows: 'Windows',
  android: 'Android',
  other: 'Outro',
}

function PrintingSettings({ printing, onClose }) {
  const station = printing?.localStation || null
  const [defaultCopies, setDefaultCopies] = useState(2)
  const [autoPrintEnabled, setAutoPrintEnabled] = useState(false)
  const [pendingAction, setPendingAction] = useState(null)
  const [confirmPrimary, setConfirmPrimary] = useState(false)
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    setDefaultCopies(station?.defaultCopies === 1 ? 1 : 2)
    setAutoPrintEnabled(Boolean(station?.autoPrintEnabled))
  }, [station?.id, station?.defaultCopies, station?.autoPrintEnabled])

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
  const testPrint = () => run('test', () => printing.testPrint(), 'Teste enviado para a impressora.')

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
  const connectionLabel = CONNECTION_LABELS[printerState] || 'Desconectada'
  const configured = !['unconfigured', 'unsupported'].includes(printerState)
  const disabled = Boolean(pendingAction) || !station

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

          <div className="printing-info-grid">
            <div className="printing-info-card"><span>Estação</span><strong>{station?.name || 'Preparando estação…'}</strong></div>
            <div className="printing-info-card"><span>Plataforma</span><strong>{PLATFORM_LABELS[station?.platform] || 'Outro'}</strong></div>
            <div className="printing-info-card"><span>Estação principal</span><strong>{station?.isPrimary ? 'Sim' : 'Não'}</strong></div>
            <div className="printing-info-card"><span>Impressão automática</span><strong>{autoPrintEnabled ? 'Ligada' : 'Desligada'}</strong></div>
          </div>

          <div className="printing-actions-row">
            <Button type="button" variant="secondary" onClick={connectPrinter} disabled={disabled || printing?.supported === false}>
              {configured ? 'Trocar impressora' : 'Conectar impressora'}
            </Button>
            <Button type="button" variant="secondary" onClick={testPrint} disabled={disabled || printing?.supported === false}>Testar impressão</Button>
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
            <span>Windows + Chrome com Web Serial disponível.</span>
            <span>Android + Chrome 138+ quando o Web Serial estiver disponível para o dispositivo e a impressora pareada.</span>
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
