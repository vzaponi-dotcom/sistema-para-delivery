import { useCallback, useEffect, useState } from 'react'
import Button from '../../../shared/ui/Button.jsx'
import ConfirmationDialog from '../../../shared/ui/ConfirmationDialog.jsx'
import PageHeader from '../../../shared/ui/PageHeader.jsx'
import { SettingsBackLink } from './components/SettingsBackAndSwitchControls.jsx'
import * as defaultApi from './kitchenTvSettingsApi.js'
import './kitchenTvSettings.css'

const formatDateTime = (value) => value
  ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
  : 'Ainda não registrado'

const rawCode = (value) => String(value ?? '').replace(/\D/g, '').slice(0, 6)
const formatCode = (value) => {
  const digits = rawCode(value)
  return digits.length > 3 ? `${digits.slice(0, 3)} ${digits.slice(3)}` : digits
}

function KitchenTvSettings({ granted, onNavigateHome, api = defaultApi }) {
  const [status, setStatus] = useState(null)
  const [code, setCode] = useState('')
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

  useEffect(() => {
    if (!status?.waitingPairing) return undefined
    let active = true
    const poll = globalThis.setInterval(async () => {
      try {
        const next = await api.getKitchenTvSettings()
        if (active) setStatus(next)
      } catch {
        // Keep the last useful state while the page is waiting for the TV.
      }
    }, 2000)
    return () => {
      active = false
      globalThis.clearInterval(poll)
    }
  }, [api, status?.waitingPairing])

  const connect = async (event) => {
    event?.preventDefault?.()
    const normalized = rawCode(code)
    if (normalized.length !== 6) {
      setError('Digite os 6 números exibidos na TV.')
      return
    }
    setBusy(true)
    setError('')
    setMessage('')
    try {
      setStatus(await api.approveKitchenTvPairing(normalized))
      setCode('')
      setMessage('Código autorizado. A TV concluirá a conexão automaticamente.')
    } catch (cause) { setError(cause?.message || 'Não foi possível conectar esta TV.') }
    finally { setBusy(false) }
  }

  const revoke = async () => {
    setBusy(true)
    setError('')
    try {
      setStatus(await api.revokeKitchenTvAccess())
      setMessage('Acesso revogado.')
      setConfirmingRevoke(false)
    } catch (cause) { setError(cause?.message || 'Não foi possível revogar o acesso da TV.') }
    finally { setBusy(false) }
  }

  const tvAddress = globalThis.location?.origin ? `${globalThis.location.origin}/cozinha-tv` : '/cozinha-tv'

  return <div className="settings-page kitchen-tv-settings-page">
    <PageHeader
      eyebrow={<SettingsBackLink onClick={onNavigateHome} />}
      title="TV da Cozinha"
      description="Conecte uma TV para acompanhar os pedidos em tempo real."
    />
    {!canManage && <p className="settings-readonly-badge">Somente leitura</p>}
    {loading && <p className="settings-state-message" aria-live="polite">Carregando acesso da TV…</p>}
    {error && <div className="settings-state-message settings-state-error" role="alert"><p>{error}</p></div>}
    {!loading && <section className="settings-editor-shell kitchen-tv-access-card" aria-label="Acesso da TV da Cozinha">
      {status?.paired ? <>
        <div className="kitchen-tv-state-heading">
          <span className="kitchen-tv-status-dot is-active" aria-hidden="true" />
          <div><p className="kitchen-tv-kicker">Painel conectado</p><h2>TV da cozinha ativa</h2></div>
        </div>
        <dl className="kitchen-tv-status-list">
          <div><dt>Pareada em</dt><dd>{formatDateTime(status.pairedAt)}</dd></div>
          <div><dt>Último acesso</dt><dd>{formatDateTime(status.lastSeenAt)}</dd></div>
        </dl>
        {canManage && <div className="kitchen-tv-actions">
          <Button type="button" variant="danger" disabled={busy} onClick={() => setConfirmingRevoke(true)}>Revogar acesso</Button>
        </div>}
      </> : status?.waitingPairing ? <>
        <div className="kitchen-tv-state-heading">
          <span className="kitchen-tv-status-dot is-pending" aria-hidden="true" />
          <div><p className="kitchen-tv-kicker">Código autorizado</p><h2>Aguardando a TV concluir a conexão</h2></div>
        </div>
        <p className="kitchen-tv-intro">Mantenha a tela de código aberta na TV. A conexão será concluída automaticamente em poucos segundos.</p>
        {status.pairingExpiresAt && <div className="kitchen-tv-expiry"><span>Código válido até</span><strong>{formatDateTime(status.pairingExpiresAt)}</strong></div>}
      </> : <>
        <div className="kitchen-tv-state-heading">
          <span className="kitchen-tv-status-dot" aria-hidden="true" />
          <div><p className="kitchen-tv-kicker">Configuração inicial</p><h2>{status?.revokedAt ? 'Conectar outra TV' : 'Conectar uma TV'}</h2></div>
        </div>
        <div className="kitchen-tv-setup-steps">
          <p><strong>1.</strong> Na TV, abra este endereço:</p>
          <code className="kitchen-tv-fixed-address">{tvAddress}</code>
          <p><strong>2.</strong> A TV mostrará um código de 6 dígitos. Digite-o abaixo.</p>
        </div>
        {canManage ? <form className="kitchen-tv-code-form" onSubmit={connect}>
          <label htmlFor="kitchen-tv-code">Código exibido na TV</label>
          <input
            id="kitchen-tv-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000 000"
            value={formatCode(code)}
            onChange={(event) => setCode(rawCode(event.target.value))}
            maxLength={7}
            aria-describedby="kitchen-tv-code-help"
          />
          <small id="kitchen-tv-code-help">O código é temporário e não dá acesso ao sistema administrativo.</small>
          <Button type="submit" disabled={busy || rawCode(code).length !== 6}>Conectar TV</Button>
        </form> : <p className="kitchen-tv-intro">Solicite a uma pessoa com permissão de gerenciamento para autorizar o código exibido na TV.</p>}
      </>}
      {message && <p className="settings-state-message kitchen-tv-feedback" role="status">{message}</p>}
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
