import { useEffect, useState } from 'react'
import Button from '../../../../shared/ui/Button'
import '../../../../settings.css'
import '../../../../settings-table-polish.css'
import '../../../../settings-save-feedback.css'

const stateMessage = (state) => ({
  saving: 'Salvando alterações…',
  unconfirmed: 'O resultado do salvamento ainda precisa de confirmação.',
  conflict: 'Há alterações concorrentes para revisar.',
}[state?.status])

function SettingsEditorShell({ title, description, scope, effectiveNotice, state, readOnly, onSave, onDiscard, onReconcile, onReload, onReviewConflict, className = '', discardLabel = 'Descartar', footerNote, headerAction, children }) {
  const [saveFeedback, setSaveFeedback] = useState('')
  const status = state?.status || 'ready'
  const message = stateMessage(state)
  const errorMessage = typeof state?.error === 'string' ? state.error : state?.error?.message
  const readFailed = status === 'error' && !state?.draft && !state?.confirmed?.data
  const discardDisabled = ['saving', 'loading', 'unconfirmed'].includes(status) || readFailed
  const saveDisabled = discardDisabled || status === 'conflict'

  useEffect(() => {
    if (!saveFeedback) return undefined
    const timer = setTimeout(() => setSaveFeedback(''), 2600)
    return () => clearTimeout(timer)
  }, [saveFeedback])

  useEffect(() => {
    if (state?.dirty) setSaveFeedback('')
  }, [state?.dirty])

  const handleSave = () => {
    if (state?.dirty === false) {
      setSaveFeedback('Não há alterações para salvar.')
      return false
    }
    setSaveFeedback('')
    return onSave?.()
  }

  return <section className={['settings-editor-shell', className].filter(Boolean).join(' ')} aria-labelledby="settings-editor-title">
    <header className="settings-editor-header">
      <div><p className="section-kicker">{scope}</p><h1 id="settings-editor-title">{title}</h1><p>{description}</p></div>
      {(readOnly || headerAction) && <div className="settings-editor-header-actions">
        {readOnly && <span className="settings-readonly-badge">Somente leitura</span>}
        {!readOnly && headerAction}
      </div>}
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
      {footerNote && <small className="settings-editor-footer-note">{footerNote}</small>}
      <div className="settings-editor-footer-actions">
        <Button type="button" variant="secondary" onClick={onDiscard} disabled={discardDisabled}>{discardLabel}</Button>
        <Button type="button" onClick={handleSave} disabled={saveDisabled}>Salvar alterações</Button>
      </div>
    </footer>}
    {saveFeedback && <div className="settings-save-feedback" role="status" aria-live="polite">{saveFeedback}</div>}
  </section>
}

export default SettingsEditorShell
