import { useCallback, useEffect, useState } from 'react'
import Button from '../../../shared/ui/Button.jsx'
import ConfirmationDialog from '../../../shared/ui/ConfirmationDialog.jsx'
import PageHeader from '../../../shared/ui/PageHeader.jsx'
import { SettingsBackLink } from './components/SettingsBackAndSwitchControls.jsx'
import * as defaultApi from './kitchenTvSettingsApi.js'

const formatDateTime = (value) => value
  ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
  : 'Ainda não registrado'

function KitchenTvSettings({ granted, onNavigateHome, api = defaultApi }) {
  const [status, setStatus] = useState(null)
  const [pairing, setPairing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [confirmingRevoke, setConfirmingRevoke] = useState(false)
  const canManage = granted instanceof Set && granted.has('orders.settings.manage')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try { setStatus(await api.getKitchenTvSettings()) }
    catch (cause) { setError(cause?.message || 'Não foi possível carregar o acesso da TV.') }
    finally { setLoading(false) }
  }, [api])

  useEffect(() => { void load() }, [load])

  const generate = async () => {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result = await api.generateKitchenTvAccess()
      setPairing(result)
      setStatus((current) => ({ ...current, configured: true, waitingPairing: true, paired: false, pairedAt: null, lastSeenAt: null, revokedAt: null }))
    } catch (cause) { setError(cause?.message || 'Não foi possível gerar o acesso da TV.') }
    finally { setBusy(false) }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pairing.pairingUrl)
      setMessage('Link copiado.')
    } catch { setError('Não foi possível copiar o link. Selecione e copie manualmente.') }
  }

  const revoke = async () => {
    setBusy(true)
    setError('')
    try {
      setStatus(await api.revokeKitchenTvAccess())
      setPairing(null)
      setMessage('Acesso revogado.')
      setConfirmingRevoke(false)
    } catch (cause) { setError(cause?.message || 'Não foi possível revogar o acesso da TV.') }
    finally { setBusy(false) }
  }

  return <div className="settings-page kitchen-tv-settings-page">
    <PageHeader
      eyebrow={<SettingsBackLink onClick={onNavigateHome} />}
      title="TV da Cozinha"
      description="Conecte uma TV para acompanhar os pedidos em tempo real."
    />
    {!canManage && <p className="settings-readonly-badge">Somente leitura</p>}
    {loading && <p className="settings-state-message" aria-live="polite">Carregando acesso da TV…</p>}
    {error && <div className="settings-state-message settings-state-error" role="alert"><p>{error}</p><Button type="button" variant="secondary" onClick={load}>Tentar novamente</Button></div>}
    {!loading && !error && <section className="settings-editor-shell" aria-label="Acesso da TV da Cozinha">
      {status?.paired ? <>
        <h2>TV da cozinha ativa</h2>
        <p>Pareada em: {formatDateTime(status.pairedAt)}</p>
        <p>Último acesso: {formatDateTime(status.lastSeenAt)}</p>
        {canManage && <div className="form-actions">
          <Button type="button" variant="secondary" disabled={busy} onClick={generate}>Gerar novo acesso</Button>
          <Button type="button" variant="danger" disabled={busy} onClick={() => setConfirmingRevoke(true)}>Revogar acesso</Button>
        </div>}
      </> : pairing ? <>
        <h2>Link de uso único</h2>
        <p>Abra este link na TV em até 30 minutos. Ele funciona uma única vez.</p>
        <code className="kitchen-tv-pairing-link">{pairing.pairingUrl}</code>
        <p>Expira em: {formatDateTime(pairing.expiresAt)}</p>
        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={copy}>Copiar link</Button>
          <Button type="button" disabled={busy} onClick={generate}>Gerar novo acesso</Button>
        </div>
      </> : <>
        <h2>{status?.revokedAt ? 'Acesso revogado' : 'TV ainda não configurada'}</h2>
        <p>Gere um link temporário para parear o navegador da TV sem usar o PIN administrativo.</p>
        {canManage && <Button type="button" disabled={busy} onClick={generate}>Gerar acesso da TV</Button>}
      </>}
      {message && <p className="settings-state-message" role="status">{message}</p>}
    </section>}
    {confirmingRevoke && <ConfirmationDialog
      title="Revogar acesso da TV"
      message="A fila será removida da TV no próximo refresh."
      confirmLabel="Confirmar revogação"
      onConfirm={revoke}
      onClose={() => setConfirmingRevoke(false)}
      disabled={busy}
    />}
  </div>
}

export default KitchenTvSettings
