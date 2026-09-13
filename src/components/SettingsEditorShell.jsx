import Button from './Button'
import '../settings.css'

const stateMessage = (state) => ({
  saving: 'Salvando alterações…',
  unconfirmed: 'O resultado do salvamento ainda precisa de confirmação.',
  conflict: 'Há alterações concorrentes para revisar.',
}[state?.status])

function SettingsEditorShell({ title, description, scope, effectiveNotice, state, readOnly, onSave, onDiscard, onReconcile, onReload, onReviewConflict, children }) {
  const status = state?.status || 'ready'
  const message = stateMessage(state)
  const errorMessage = typeof state?.error === 'string' ? state.error : state?.error?.message
  const readFailed = status === 'error' && !state?.draft && !state?.confirmed?.data
  const discardDisabled = ['saving', 'loading', 'unconfirmed'].includes(status) || readFailed
  const saveDisabled = discardDisabled || status === 'conflict'
  return <section className="settings-editor-shell" aria-labelledby="settings-editor-title">
    <header className="settings-editor-header">
      <div><p className="section-kicker">{scope}</p><h1 id="settings-editor-title">{title}</h1><p>{description}</p></div>
      {readOnly && <span className="settings-readonly-badge">Somente leitura</span>}
    </header>
    {effectiveNotice && <p className="settings-effective-notice">{effectiveNotice}</p>}
    {status === 'loading' && <p className="settings-state-message" aria-live="polite">Carregando configurações…</p>}
    {status === 'error' && <p className="settings-state-message settings-state-error" role="alert">{errorMessage || 'Não foi possível carregar estas configurações.'}</p>}
    {message && <p className={status === 'conflict' ? 'settings-state-message settings-state-error' : 'settings-state-message'} {...(status === 'conflict' ? { role: 'alert' } : { 'aria-live': 'polite' })}>{message}</p>}
    {state?.dirty && <p className="settings-state-message" role="status">Há alterações pendentes no rascunho.</p>}
    {(status === 'unconfirmed' || readFailed) && <div><Button type="button" variant="secondary" onClick={status === 'unconfirmed' ? onReconcile : onReload}>Reconsultar</Button></div>}
    {status === 'conflict' && !readOnly && <div><Button type="button" variant="secondary" onClick={onReviewConflict}>Revisar alterações</Button></div>}
    <div className="settings-editor-content">{children}</div>
    {!readOnly && status !== 'loading' && <footer className="settings-editor-footer">
      <div className="settings-editor-footer-actions">
        <Button type="button" variant="secondary" onClick={onDiscard} disabled={discardDisabled}>Descartar</Button>
        <Button type="button" onClick={onSave} disabled={saveDisabled}>Salvar alterações</Button>
      </div>
    </footer>}
  </section>
}

export default SettingsEditorShell
