import { useEffect, useRef, useState } from 'react'
import Button from '../../../shared/ui/Button.jsx'
import PageHeader from '../../../shared/ui/PageHeader.jsx'
import { platformApi } from '../infrastructure/platformApi.js'
import { companyStatus, formatDate } from './companyStatus.js'
const actionLabel = action => ({ 'business.created': 'Empresa cadastrada', 'invitation.requested': 'Convite solicitado', 'invitation.resent': 'Convite reenviado', 'invitation.delivery.accepted': 'Envio aceito pelo serviço', 'invitation.delivery.rejected': 'Envio rejeitado', 'invitation.delivery.uncertain': 'Envio não confirmado' }[action] || 'Atualização do cadastro')

export default function CompanyDetail({ businessId, api = platformApi, canResend = false, onNavigate, onPendingChange }) {
  const [state, setState] = useState({ loading: true }), [revision, setRevision] = useState(0), [pending, setPending] = useState(false), [notice, setNotice] = useState('')
  const generation = useRef(0), lock = useRef(null)
  useEffect(() => {
    const requestId = ++generation.current, controller = new AbortController()
    setState({ owner: api, businessId, loading: true })
    void api.getBusiness(businessId, { signal: controller.signal }).then(company => { if (generation.current === requestId) setState({ owner: api, businessId, company, loading: false }) }).catch(error => { if (generation.current === requestId) setState({ owner: api, businessId, loading: false, error: error?.message || 'Não foi possível carregar o cadastro.' }) })
    return () => { generation.current++; controller.abort() }
  }, [api, businessId, revision])
  useEffect(() => {
    if (pending && !state.loading && state.owner === api && state.businessId === businessId && !lock.current) { setPending(false); onPendingChange?.(false) }
  }, [state, pending, api, businessId, onPendingChange])
  const visible = state.owner === api && state.businessId === businessId ? state : { loading: true }
  const company = visible.company, status = companyStatus(company)
  const resend = async () => {
    if (lock.current || !canResend || status.activated || !company?.invitation?.canResend) return
    const owner = generation.current, operation = {}; lock.current = operation; setPending(true); setNotice(''); onPendingChange?.(true)
    try {
      const result = await api.resendFirstManagerInvitation(businessId)
      if (generation.current !== owner) return
      const delivery = result?.delivery?.status
      setNotice(delivery === 'accepted' ? 'O serviço aceitou o envio. Peça ao gerente para conferir a caixa de entrada e o spam.' : delivery === 'rejected' ? 'O envio foi rejeitado. Confira o endereço e tente novamente após o intervalo.' : 'Envio não confirmado. O e-mail ainda pode chegar. Confira a caixa de entrada antes de reenviar.')
    } catch (error) { if (generation.current === owner) setNotice(error?.status === 429 ? 'Aguarde pelo menos 60 segundos antes de reenviar. O limite do ambiente também pode ter sido atingido.' : 'Não foi possível confirmar o reenvio. Atualizamos o cadastro para verificar o estado atual.') }
    finally { if (lock.current === operation) lock.current = null; if (generation.current === owner) { setState({ owner: api, businessId, loading: true }); setRevision(value => value + 1) } }
  }
  return <section><Button variant="secondary" disabled={pending} onClick={() => onNavigate?.('/mesiva/empresas')}>Voltar às empresas</Button><PageHeader eyebrow="Administração Mesiva" title={company?.name || 'Cadastro da empresa'} description="Primeiro acesso e convite do gerente." />
    {visible.loading && <p role="status">Carregando cadastro…</p>}{visible.error && <div role="alert"><p>{visible.error}</p><Button onClick={() => setRevision(value => value + 1)}>Tentar novamente</Button></div>}
    {company && <><div className="platform-detail-grid"><section className="platform-card"><h2>Empresa e primeiro gerente</h2><dl className="platform-definition"><div><dt>Empresa</dt><dd>{company.name}</dd></div><div><dt>Gerente</dt><dd>{company.firstManager?.name || 'Ainda não preparado'}</dd></div><div><dt>E-mail</dt><dd>{company.firstManager?.email || 'Ainda não preparado'}</dd></div><div><dt>Cadastro</dt><dd>{formatDate(company.createdAt)}</dd></div></dl></section><section className="platform-card"><h2>Acesso e convite</h2><span className={`platform-badge ${status.activated ? 'is-active' : ''}`}>{status.access}</span><p>{status.invitation}</p>{!status.activated && company.invitation && <><p>Validade do link: {formatDate(company.invitation.expiresAt)}</p><p className="platform-muted">Envio aceito pelo serviço ainda não confirma a entrega. Use sempre o e-mail mais recente.</p></>}{canResend && !status.activated && company.invitation?.canResend && <Button disabled={pending} onClick={resend}>{pending ? 'Reenviando…' : 'Reenviar convite'}</Button>}{!company.firstManager?.active && company.firstManager && <p>O vínculo está desativado. O reenvio não reativa o acesso.</p>}</section></div><section className="platform-card platform-history"><h2>Histórico do cadastro</h2>{company.history?.length ? <ol>{company.history.map((event, index) => <li key={index}><strong>{actionLabel(event.action)}</strong><time>{formatDate(event.occurredAt)}</time></li>)}</ol> : <p>Nenhuma atualização registrada.</p>}</section></>}
    {notice && <p role="status" className="platform-feedback">{notice}</p>}
  </section>
}
