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

const formatPairingLinkPreview = (value) => {
  try {
    const url = new URL(value)
    return `${url.origin}${url.pathname}#token=••••••••`
  } catch {
    return 'Link protegido da TV'
  }
}

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
      setMessage('Link copiado. Abra-o no navegador da TV.')
    } catch { setError('Não foi possível copiar o link. Gere um novo acesso e tente novamente.') }
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
    {!loading && !error && <section className="settings-editor-shell kitchen-tv-access-card" aria-label="Acesso da TV da Cozinha">
      {status?.paired ? <>
        <div className="kitchen-tv-state-heading">
          <span className="kitchen-tv-status-dot is-active" aria-hidden="true" />
          <div>
            <p className="kitchen-tv-kicker">Painel conectado</p>
            <h2>TV da cozinha ativa</h2>
          </div>
        </div>
        <dl className="kitchen-tv-status-list">
          <div><dt>Pareada em</dt><dd>{formatDateTime(status.pairedAt)}</dd></div>
          <div><dt>Último acesso</dt><dd>{formatDateTime(status.lastSeenAt)}</dd></div>
        </dl>
        {canManage && <>
          <div className="kitchen-tv-actions">
            <Button type="button" variant="secondary" disabled={busy} onClick={generate}>Gerar novo link</Button>
            <Button type="button" variant="danger" disabled={busy} onClick={() => setConfirmingRevoke(true)}>Revogar acesso</Button>
          </div>
          <p className="kitchen-tv-action-help">Gerar um novo link substitui o acesso atual da TV.</p>
        </>}
      </> : pairing ? <>
        <div className="kitchen-tv-state-heading">
          <span className="kitchen-tv-status-dot is-pending" aria-hidden="true" />
          <div>
            <p className="kitchen-tv-kicker">Uso único</p>
            <h2>Link pronto para pareamento</h2>
          </div>
        </div>
        <p className="kitchen-tv-intro">Abra este link no navegador da TV em até 30 minutos. Depois do primeiro pareamento ele deixa de funcionar.</p>
        <div className="kitchen-tv-link-box">
          <span className="kitchen-tv-link-label">Link da TV</span>
          <code aria-label="Prévia protegida do link da TV">{formatPairingLinkPreview(pairing.pairingUrl)}</code>
          <small>O segredo completo fica protegido e é copiado somente pelo botão abaixo.</small>
        </div>
        <div className="kitchen-tv-expiry">
          <span>Expira em</span>
          <strong>{formatDateTime(pairing.expiresAt)}</strong>
        </div>
        <div className="kitchen-tv-actions is-pairing">
          <Button type="button" onClick={copy}>Copiar link</Button>
          <Button type="button" variant="secondary" disabled={busy} onClick={generate}>Gerar novo link</Button>
        </div>
        <p className="kitchen-tv-action-help">Gerar outro link invalida este acesso antes do uso.</p>
      </> : status?.waitingPairing ? <>
        <div className="kitchen-tv-state-heading">
          <span className="kitchen-tv-status-dot is-pending" aria-hidden="true" />
          <div>
            <p className="kitchen-tv-kicker">Aguardando conexão</p>
            <h2>Aguardando pareamento</h2>
          </div>
        </div>
        <p className="kitchen-tv-intro">Um link de uso único já foi gerado. Por segurança, o segredo não pode ser exibido novamente.</p>
        {canManage && <Button type="button" variant="secondary" disabled={busy} onClick={generate}>Gerar novo link</Button>}
      </> : <>
        <div className="kitchen-tv-state-heading">
          <span className="kitchen-tv-status-dot" aria-hidden="true" />
          <div>
            <p className="kitchen-tv-kicker">Configuração inicial</p>
            <h2>{status?.revokedAt ? 'Acesso revogado' : 'TV ainda não configurada'}</h2>
          </div>
        </div>
        <p className="kitchen-tv-intro">Gere um link temporário para parear o navegador da TV sem usar o PIN administrativo.</p>
        {canManage && <div className="kitchen-tv-actions"><Button type="button" disabled={busy} onClick={generate}>Gerar acesso da TV</Button></div>}
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
