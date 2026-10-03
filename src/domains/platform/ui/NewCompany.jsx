import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import Button from '../../../shared/ui/Button.jsx'
import PageHeader from '../../../shared/ui/PageHeader.jsx'
import { platformApi } from '../infrastructure/platformApi.js'
import { createProvisioningAttempts } from '../application/provisioningAttempts.js'

const normalized = draft => ({ name: draft.name.trim(), managerName: draft.managerName.trim(), managerEmail: draft.managerEmail.trim().toLowerCase() })
export default function NewCompany({ api = platformApi, attempts: suppliedAttempts, accountId = 'standalone', randomUUID = () => crypto.randomUUID(), onCreated, onNavigate, onPendingChange }) {
  const [localAttempts] = useState(createProvisioningAttempts), attempts = suppliedAttempts || localAttempts
  const attempt = useSyncExternalStore(attempts.subscribe, () => attempts.getSnapshot(accountId))
  const [draft, setDraft] = useState(() => attempt?.input || { name: '', managerName: '', managerEmail: '' })
  const [review, setReview] = useState(Boolean(attempt)), [validationError, setError] = useState('')
  const pending = attempt?.status === 'pending', uncertain = attempt?.status === 'uncertain'
  const error = attempt?.error || validationError
  const currentApi = useRef(api), mounted = useRef(true), notified = useRef(null)
  currentApi.current = api
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    if (attempt?.status === 'rejected') setReview(false)
    if (attempt?.status !== 'confirmed' || notified.current === attempt.key) return
    notified.current = attempt.key
    onPendingChange?.(false)
    onCreated?.(attempt.result.businessId, attempt.result)
    attempts.acknowledge(accountId, attempt.key)
  }, [attempt, attempts, accountId, onCreated, onPendingChange])
  const create = async () => {
    if (!mounted.current || currentApi.current !== api || !review || attempts.getSnapshot(accountId)?.status === 'pending') return
    setError(''); onPendingChange?.(true)
    await attempts.run(accountId, api, normalized(draft), randomUUID)
    if (mounted.current && currentApi.current === api && !attempts.isBlocking(accountId)) onPendingChange?.(false)
  }
  const reviewDraft = event => {
    event.preventDefault()
    const input = normalized(draft)
    if (!input.name || !input.managerName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.managerEmail)) { setError('Informe o nome da empresa, o nome do gerente e um e-mail válido.'); return }
    setError(''); setDraft(input); setReview(true)
  }
  return <section className="platform-new-company"><Button variant="secondary" disabled={pending || uncertain} onClick={() => onNavigate?.('/mesiva/empresas')}>Voltar às empresas</Button><PageHeader eyebrow="Administração Mesiva" title="Nova empresa" description="Cadastre a operação e convide a pessoa responsável." />
    <div className="platform-card">{review ? <><h2>Confira o cadastro</h2><dl className="platform-definition"><div><dt>Empresa</dt><dd>{draft.name}</dd></div><div><dt>Primeiro gerente</dt><dd>{draft.managerName}</dd></div><div><dt>E-mail do gerente</dt><dd>{draft.managerEmail}</dd></div></dl><p>O gerente receberá um convite para confirmar o acesso. Se já tiver conta, continuará usando sua senha atual.</p><div className="platform-form-actions">{!uncertain && <Button variant="secondary" disabled={pending} onClick={() => setReview(false)}>Editar cadastro</Button>}<Button disabled={pending} onClick={create}>{pending ? 'Confirmando…' : uncertain ? 'Verificar cadastro' : 'Criar empresa e enviar convite'}</Button></div></> : <form className="platform-form" onSubmit={reviewDraft}>{[{ name: 'name', label: 'Nome da empresa', placeholder: 'Ex.: Cozinha da Ana' }, { name: 'managerName', label: 'Nome do primeiro gerente', placeholder: 'Ex.: Ana Souza' }, { name: 'managerEmail', label: 'E-mail do primeiro gerente', placeholder: 'ana@exemplo.com', type: 'email' }].map(field => <label key={field.name}>{field.label}<input name={field.name} type={field.type || 'text'} maxLength={field.type === 'email' ? 254 : 200} required value={draft[field.name]} placeholder={field.placeholder} autoComplete={field.type === 'email' ? 'email' : 'off'} autoCapitalize={field.type === 'email' ? 'none' : undefined} onChange={event => setDraft(previous => ({ ...previous, [field.name]: event.target.value }))} /></label>)}<p>Confira o e-mail: ele será usado para entrar e recuperar a senha.</p><Button type="submit">Revisar cadastro</Button></form>}{error && <p className="platform-feedback" role="alert">{error}</p>}</div>
  </section>
}
