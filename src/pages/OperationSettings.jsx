import { useEffect, useMemo, useRef } from 'react'
import Icon from '../components/Icon.jsx'
import '../operation-settings.css'
import Button from '../components/Button.jsx'
import SettingsEditorShell from '../components/SettingsEditorShell.jsx'
import { SettingsBackLink, SettingsSwitch } from '../components/SettingsControls.jsx'

const MODALITIES = ['Entrega', 'Retirada', 'Local']

const modalityDescriptions = {
  Entrega: 'Pedidos com entrega no endereço do cliente',
  Retirada: 'Pedidos para retirada no balcão',
  Local: 'Consumo no local (mesa)',
}

function ModalityIcon({ modality }) {
  if (modality === 'Entrega') return <Icon name="package" size={24} />
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {modality === 'Retirada' ? <><path d="M5 8h14l1 13H4L5 8Z" /><path d="M8 9V6a4 4 0 0 1 8 0v3" /></> : <><path d="M3 3v11h5v7M21 3v11h-5v7M3 21v-7M21 21v-7M7 10h10M12 10v11" /></>}
  </svg>
}

const timingFields = [
  { key: 'scheduledPrepLeadMinutes', label: 'Preparo antecipado do agendado', help: '0 a 240 minutos', min: 0, max: 240 },
  { key: 'scheduledLateGraceMinutes', label: 'Tolerância de atraso do agendado', help: '0 a 120 minutos', min: 0, max: 120 },
  { key: 'immediateLateAfterMinutes', label: 'Pedido imediato fica atrasado', help: '1 a 180 minutos', min: 1, max: 180 },
  { key: 'immediateVeryLateAfterMinutes', label: 'Pedido imediato fica muito atrasado', help: 'Maior que o limite de atraso (máx. 240)', min: 1, max: 240 },
]

const numberValue = (value) => /^\d+$/.test(value) ? Number(value) : value

function validate(data) {
  const errors = { timing: {}, modalities: [] }
  if (!data) return errors
  for (const field of timingFields) {
    const value = data.timing?.[field.key]
    if (!Number.isInteger(value) || value < field.min || value > field.max) {
      errors.timing[field.key] = `Informe um número inteiro entre ${field.min} e ${field.max} minutos.`
    }
  }
  const late = data.timing?.immediateLateAfterMinutes
  const veryLate = data.timing?.immediateVeryLateAfterMinutes
  if (Number.isInteger(late) && Number.isInteger(veryLate) && veryLate <= late) {
    errors.timing.immediateVeryLateAfterMinutes = 'Muito atraso deve ser maior que Atraso de pedido imediato.'
  }
  const enabled = Array.isArray(data.enabledModalities) ? data.enabledModalities : []
  if (!enabled.length) errors.modalities.push('Mantenha pelo menos uma modalidade ativa.')
  if (!enabled.includes(data.defaultModality)) errors.modalities.push('Escolha uma modalidade padrão ativa.')
  return errors
}

function OperationSettings({ resourceState, readOnly = false, initialSection = 'timing', onEdit, onSave, onDiscard, onReconcile, onReload, onReviewConflict, onNavigateHome }) {
  const timingRef = useRef(null)
  const modalitiesRef = useRef(null)
  const timingInputsRef = useRef({})
  const data = resourceState?.draft || resourceState?.confirmed?.data || null
  const hasData = Boolean(data)
  const errors = useMemo(() => validate(data), [data])
  const timingIssueCount = Object.keys(errors.timing).length
  const modalitiesIssueCount = errors.modalities.length
  const timingIssues = timingIssueCount > 0
  const modalitiesIssues = modalitiesIssueCount > 0
  const locked = readOnly || !data || ['loading', 'saving', 'unconfirmed', 'conflict'].includes(resourceState?.status)

  const focusSection = (section) => {
    const target = section === 'modalities' ? modalitiesRef.current : timingRef.current
    target?.focus?.()
    target?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
  }

  useEffect(() => {
    if (initialSection === 'modalities' && hasData) focusSection('modalities')
  }, [initialSection, hasData])

  const editTiming = (key, value) => {
    if (locked) return
    onEdit?.({ ...data, timing: { ...data.timing, [key]: numberValue(value) } })
  }
  const setModalityActive = (modality, active) => {
    if (locked) return
    const enabled = data.enabledModalities || []
    if (!active && (data.defaultModality === modality || enabled.length === 1)) return
    const enabledModalities = active
      ? MODALITIES.filter((item) => item === modality || enabled.includes(item))
      : enabled.filter((item) => item !== modality)
    onEdit?.({ ...data, enabledModalities })
  }
  const setDefaultModality = (modality) => {
    if (locked || !data.enabledModalities.includes(modality)) return
    onEdit?.({ ...data, defaultModality: modality })
  }
  const save = () => {
    if (locked) return false
    if (timingIssues) {
      const firstInvalid = timingFields.find((field) => errors.timing[field.key])
      timingInputsRef.current[firstInvalid?.key]?.focus?.()
      return false
    }
    if (modalitiesIssues) {
      focusSection('modalities')
      return false
    }
    return onSave?.()
  }

  return <SettingsEditorShell
    className="operation-editor"
    title="Operação"
    description="Defina os tempos e regras operacionais da sua cozinha"
    scope={<SettingsBackLink onClick={onNavigateHome} />}
    discardLabel="Cancelar"
    footerNote="Gestão Delivery · v1.0.0"
    effectiveNotice={<><span className="operation-info-icon" aria-hidden="true">i</span><span>Essas configurações organizam a fila da cozinha e definem as regras de atrasos dos pedidos.<small>Ajuste os tempos de acordo com sua operação para manter uma boa experiência para seus clientes.</small></span></>}
    state={resourceState}
    readOnly={readOnly}
    onSave={save}
    onDiscard={onDiscard}
    onReconcile={onReconcile}
    onReload={onReload}
    onReviewConflict={onReviewConflict}
  >
    {!data ? <p className="settings-empty-state">Os valores confirmados aparecerão quando esta configuração estiver disponível.</p> : <div className="operation-settings-content">
      {initialSection === 'modalities' && timingIssues && <Button type="button" variant="secondary" className="operation-section-jump" onClick={() => focusSection('timing')}>Ver {timingIssueCount} {timingIssueCount === 1 ? 'pendência' : 'pendências'} em Tempos e regras operacionais</Button>}
      {initialSection !== 'modalities' && modalitiesIssues && <Button type="button" variant="secondary" className="operation-section-jump" onClick={() => focusSection('modalities')}>Ver {modalitiesIssueCount} {modalitiesIssueCount === 1 ? 'pendência' : 'pendências'} em Modalidades de pedido</Button>}

      <section id="settings-timing" ref={timingRef} tabIndex={-1} className={initialSection === 'modalities' ? 'operation-settings-section' : 'operation-settings-section is-selected'} aria-labelledby="timing-title">
        <div className="operation-section-heading"><div><h2 id="timing-title">Tempos e regras operacionais</h2><p>Configure os tempos de preparo e os limites de atraso para os pedidos.</p></div>{timingIssues && <span className="operation-pending-badge">{timingIssueCount} {timingIssueCount === 1 ? 'pendência' : 'pendências'}</span>}</div>
        {readOnly ? <dl className="operation-timing-readonly">{timingFields.map((field) => <div key={field.key}><dt>{field.label}</dt><dd>{data.timing[field.key]} min</dd></div>)}</dl> : <div className="operation-timing-grid">
          {timingFields.map((field) => <label key={field.key} className="operation-timing-field">
            <span>{field.label}</span>
            <span className="operation-minute-input"><input ref={(element) => { timingInputsRef.current[field.key] = element }} name={field.key} aria-label={field.label} type="number" inputMode="numeric" min={field.min} max={field.max} step={1} disabled={locked} value={String(data.timing[field.key] ?? '')} aria-invalid={errors.timing[field.key] ? true : undefined} aria-describedby={`${field.key}-help${errors.timing[field.key] ? ` ${field.key}-error` : ''}`} onChange={(event) => editTiming(field.key, event.target.value)} /><small>min</small></span>
            <small id={`${field.key}-help`}>{field.help}</small>
            {errors.timing[field.key] && <small id={`${field.key}-error`} className="operation-field-error" role="alert">{errors.timing[field.key]}</small>}
          </label>)}
        </div>}
      </section>

      <section id="settings-modalities" ref={modalitiesRef} tabIndex={-1} className={initialSection === 'modalities' ? 'operation-settings-section is-selected' : 'operation-settings-section'} aria-labelledby="modalities-title">
        <div className="operation-section-heading"><div><h2 id="modalities-title">Modalidades de pedido</h2><p>Ative ou desative as modalidades disponíveis na sua loja.</p></div>{modalitiesIssues && <span className="operation-pending-badge">{modalitiesIssueCount} {modalitiesIssueCount === 1 ? 'pendência' : 'pendências'}</span>}</div>
        {modalitiesIssues && <div className="operation-field-error" role="alert">{errors.modalities.map((message) => <p key={message}>{message}</p>)}</div>}
        <div className="operation-modality-list" aria-label="Modalidades de pedido">
          {MODALITIES.map((modality) => {
            const enabled = data.enabledModalities || []
            const active = enabled.includes(modality)
            const isDefault = data.defaultModality === modality
            const disabledReason = active && (isDefault || enabled.length === 1)
              ? isDefault ? 'Defina outra modalidade ativa como padrão antes de desativar esta.' : 'Mantenha pelo menos uma modalidade ativa.'
              : ''
            const reasonId = `modality-${modality.toLowerCase()}-disabled-reason`

            return <div key={modality} data-modality={modality} className="operation-modality-row">
              <span className="operation-modality-icon"><ModalityIcon modality={modality} /></span>
              <div className="operation-modality-copy"><strong>{modality}</strong><span>{modalityDescriptions[modality]}</span></div>
              <SettingsSwitch
                id={modality}
                className="operation-switch"
                checked={active}
                disabled={locked || Boolean(disabledReason)}
                title={disabledReason || undefined}
                describedBy={disabledReason ? reasonId : undefined}
                label={modality}
                onChange={(nextActive) => setModalityActive(modality, nextActive)}
              />
              {disabledReason && <span id={reasonId} className="operation-accessible-reason">{disabledReason}</span>}
              <div className="operation-modality-badges"><span className={active ? 'operation-status-badge is-active' : 'operation-status-badge'}>{active ? 'Ativo' : 'Inativo'}</span>{isDefault && <span className="operation-default-badge">Padrão</span>}</div>
              {!readOnly && <details className="operation-modality-menu" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false }} onKeyDown={(event) => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus() } }}>
                <summary aria-label={`Ações de ${modality}`}><span aria-hidden="true">···</span></summary>
                <div className="operation-modality-menu-content"><button type="button" disabled={locked || !active || isDefault} onClick={(event) => { setDefaultModality(modality); const menu = event.currentTarget.closest('details'); if (menu) { menu.open = false; menu.querySelector('summary')?.focus() } }}>Definir como padrão</button></div>
              </details>}
            </div>
          })}
        </div>
      </section>
    </div>}
  </SettingsEditorShell>
}

export default OperationSettings
