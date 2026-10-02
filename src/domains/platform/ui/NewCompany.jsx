import { useEffect, useRef, useState } from 'react'
import Button from '../../../shared/ui/Button.jsx'
import PageHeader from '../../../shared/ui/PageHeader.jsx'
import { platformApi } from '../infrastructure/platformApi.js'

const normalized = draft => ({ name: draft.name.trim(), managerName: draft.managerName.trim(), managerEmail: draft.managerEmail.trim().toLowerCase() })
export default function NewCompany({ api = platformApi, randomUUID = () => crypto.randomUUID(), onCreated, onNavigate, onPendingChange }) {
  const [draft, setDraft] = useState({ name: '', managerName: '', managerEmail: '' })
  const [review, setReview] = useState(false), [pending, setPending] = useState(false), [uncertain, setUncertain] = useState(false), [error, setError] = useState('')
  const attempt = useRef(null), lock = useRef(null), currentApi = useRef(api), mounted = useRef(true)
  currentApi.current = api
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const create = async () => {
    if (lock.current || !review) return
    const source = api, operation = {}; lock.current = operation
    if (!attempt.current) attempt.current = { key: randomUUID(), input: normalized(draft) }
    const captured = attempt.current
    setPending(true); setError(''); onPendingChange?.(true)
    try {
      // An explicit reconciliation repeats this exact snapshot and UUID. It is
      // never a fresh creation after a lost response or a double click.
      const result = await source.createBusiness(captured.input, captured.key)
      if (!mounted.current || currentApi.current !== source) return
      if (!result?.businessId) throw new Error('Cadastro não confirmado.')
      onPendingChange?.(false); setUncertain(false)
      onCreated?.(result.businessId, result)
    } catch (cause) {
      if (!mounted.current || currentApi.current !== source) return
      const definitive = Number.isInteger(cause?.status) && cause.status >= 400 && cause.status < 500 && cause.status !== 409
      if (definitive) { attempt.current = null; setReview(false); setUncertain(false); onPendingChange?.(false); setError(cause.message) }
      else { setUncertain(true); setError('Não foi possível confirmar o cadastro. Verifique esta mesma tentativa antes de criar outra empresa.') }
    } finally { if (lock.current === operation) lock.current = null; if (mounted.current && currentApi.current === source) setPending(false) }
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
