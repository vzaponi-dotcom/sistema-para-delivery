import { useEffect, useMemo, useRef } from 'react'
import Button from '../components/Button.jsx'
import SettingsEditorShell from '../components/SettingsEditorShell.jsx'

const MODALITIES = ['Entrega', 'Retirada', 'Local']

const timingFields = [
  { key: 'scheduledPrepLeadMinutes', label: 'Antecipação de preparo agendado', min: 0, max: 240 },
  { key: 'scheduledLateGraceMinutes', label: 'Tolerância de atraso agendado', min: 0, max: 120 },
  { key: 'immediateLateAfterMinutes', label: 'Atraso de pedido imediato', min: 1, max: 180 },
  { key: 'immediateVeryLateAfterMinutes', label: 'Muito atraso de pedido imediato', min: 1, max: 240 },
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

function OperationSettings({ resourceState, readOnly = false, initialSection = 'timing', onEdit, onSave, onDiscard, onReconcile, onReload, onReviewConflict }) {
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
    title="Operação"
    description="Defina os tempos de acompanhamento e as modalidades aceitas pelo negócio."
    scope="Todo o negócio"
    effectiveNotice="Os tempos afetam pedidos ativos. Modalidades valem para novos pedidos."
    state={resourceState}
    readOnly={readOnly}
    onSave={save}
    onDiscard={onDiscard}
    onReconcile={onReconcile}
    onReload={onReload}
    onReviewConflict={onReviewConflict}
  >
    {!data ? <p className="settings-empty-state">Os valores confirmados aparecerão quando esta configuração estiver disponível.</p> : <div className="operation-settings-content">
      {initialSection === 'modalities' && timingIssues && <Button type="button" variant="secondary" className="operation-section-jump" onClick={() => focusSection('timing')}>Ver {timingIssueCount} {timingIssueCount === 1 ? 'pendência' : 'pendências'} em Tempos da cozinha</Button>}
      {initialSection !== 'modalities' && modalitiesIssues && <Button type="button" variant="secondary" className="operation-section-jump" onClick={() => focusSection('modalities')}>Ver {modalitiesIssueCount} {modalitiesIssueCount === 1 ? 'pendência' : 'pendências'} em Modalidades de pedido</Button>}

      <section id="settings-timing" ref={timingRef} tabIndex={-1} className={initialSection === 'timing' ? 'operation-settings-section is-selected' : 'operation-settings-section'} aria-labelledby="timing-title">
        <div className="operation-section-heading"><div><h2 id="timing-title">Tempos da cozinha</h2><p>Use minutos inteiros para acompanhar pedidos agendados e imediatos.</p></div>{timingIssues && <span className="operation-pending-badge">{timingIssueCount} {timingIssueCount === 1 ? 'pendência' : 'pendências'}</span>}</div>
        <p className="operation-impact-notice">Alterar a antecipação pode mover pedidos agendados entre espera e operação, mas não altera o horário de impressão já definido.</p>
        {readOnly ? <dl className="operation-timing-readonly">{timingFields.map((field) => <div key={field.key}><dt>{field.label}</dt><dd>{data.timing[field.key]} min</dd></div>)}</dl> : <div className="operation-timing-grid">
          {timingFields.map((field) => {
            const errorId = `${field.key}-error`
            return <label key={field.key} className="operation-timing-field">
              <span>{field.label}</span>
              <span className="operation-minute-input"><input ref={(element) => { timingInputsRef.current[field.key] = element }} name={field.key} type="number" inputMode="numeric" min={field.min} max={field.max} step={1} value={String(data.timing[field.key] ?? '')} disabled={locked} aria-invalid={errors.timing[field.key] ? true : undefined} aria-describedby={errors.timing[field.key] ? errorId : undefined} onChange={(event) => editTiming(field.key, event.target.value)} /><small>min</small></span>
              <small>Entre {field.min} e {field.max} minutos.</small>
              {errors.timing[field.key] && <small id={errorId} className="operation-field-error" role="alert">{errors.timing[field.key]}</small>}
            </label>
          })}
        </div>}
      </section>

      <section id="settings-modalities" ref={modalitiesRef} tabIndex={-1} className={initialSection === 'modalities' ? 'operation-settings-section is-selected' : 'operation-settings-section'} aria-labelledby="modalities-title">
        <div className="operation-section-heading"><div><h2 id="modalities-title">Modalidades de pedido</h2><p>Vale para novos pedidos; atendimentos existentes não serão alterados.</p></div>{modalitiesIssues && <span className="operation-pending-badge">{modalitiesIssueCount} {modalitiesIssueCount === 1 ? 'pendência' : 'pendências'}</span>}</div>
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
              <div className="operation-modality-copy"><strong>{modality}</strong><span>{active ? 'Ativo' : 'Inativo'}{isDefault ? ' · Padrão' : ''}</span>{disabledReason && <small id={reasonId}>{disabledReason}</small>}</div>
              {!readOnly && <div className="operation-modality-actions">
                <Button type="button" variant="secondary" disabled={locked || Boolean(disabledReason)} aria-describedby={disabledReason ? reasonId : undefined} onClick={() => setModalityActive(modality, !active)}>{active ? 'Desativar' : 'Ativar'}</Button>
                {active && !isDefault && <Button type="button" variant="secondary" disabled={locked} onClick={() => setDefaultModality(modality)}>Definir como padrão</Button>}
              </div>}
            </div>
          })}
        </div>
        {!readOnly && <p className="operation-modality-help">Trocar o padrão mantém a modalidade anterior ativa. Se desejar desativá-la, faça isso depois.</p>}
      </section>
    </div>}
  </SettingsEditorShell>
}

export default OperationSettings
