import { useEffect, useId, useRef, useState } from 'react'
import Button from '../../../shared/ui/Button.jsx'
import PageHeader from '../../../shared/ui/PageHeader.jsx'
import { platformApi } from '../infrastructure/platformApi.js'
import { useCompanyManagement } from '../application/useCompanyManagement.js'
import { companyStatus, formatDate } from './companyStatus.js'
import CompanyManagementDialog from './components/CompanyManagementDialog.jsx'
import CompanyMembersPanel from './components/CompanyMembersPanel.jsx'
import CompanyHistoryPanel from './components/CompanyHistoryPanel.jsx'

export default function CompanyDetail({businessId,api=platformApi,accountId,contextId,attempts,capabilities=[],canResend=false,isOnline=true,onNavigate,onPendingChange}) {
  const [state,setState]=useState({loading:true}),[reload,setReload]=useState(0),[pending,setPending]=useState(false),[notice,setNotice]=useState(''),[dialog,setDialog]=useState(null),[tab,setTab]=useState('overview')
  const rootRef=useRef(null),previousDialog=useRef(null),generation=useRef(0),lock=useRef(null),tabId=useId(),management=useCompanyManagement({accountId,contextId,businessId,api,attempts})
  useEffect(()=>{if(previousDialog.current&&!dialog&&!pending&&typeof document!=='undefined'&&document.activeElement===document.body){(rootRef.current?.querySelector('[data-company-primary-action]')||rootRef.current?.querySelector('button:not([disabled])'))?.focus()}previousDialog.current=dialog},[dialog,pending])
  const ownerKey=`${accountId||''}:${contextId||''}:${businessId}`
  const grants=new Set(capabilities);if(canResend)grants.add('platform.invitations.resend')
  useEffect(()=>{const owner=++generation.current,controller=new AbortController();setPending(false);setDialog(null);setNotice('');setState({owner:api,author:ownerKey,loading:true});void api.getBusiness(businessId,{signal:controller.signal}).then(company=>{if(generation.current===owner){setState({owner:api,author:ownerKey,company,loading:false});management.acknowledge()}}).catch(error=>{if(generation.current===owner)setState({owner:api,author:ownerKey,error:error.message||'Não foi possível carregar o cadastro.',loading:false})});return()=>{generation.current++;controller.abort();lock.current=null;onPendingChange?.(false)}},[api,businessId,ownerKey,reload])
  const visible=state.owner===api&&state.author===ownerKey?state:{loading:true},company=visible.company,status=companyStatus(company),lifecycle=company?.lifecycleStatus||'enabled'
  const disabled=pending||management.blocked||!isOnline
  const perform=async task=>{
    if(lock.current||!isOnline)return
    const owner=generation.current,operation={};lock.current=operation;setPending(true);setNotice('');onPendingChange?.(true)
    try {
      const result=await task()
      if(generation.current!==owner)return
      if(result){setNotice(result.delivery?result.delivery.status==='accepted'?'O serviço aceitou o envio. A entrega na caixa de entrada ainda não está confirmada.':result.delivery.status==='rejected'?'O serviço rejeitou o envio. Confira o e-mail antes de solicitar outro convite.':'Envio não confirmado. O e-mail ainda pode chegar; verifique antes de reenviar.':'Ação confirmada. Cadastro atualizado.')}
      const refreshed=await api.getBusiness(businessId)
      if(generation.current===owner){setState({owner:api,author:ownerKey,company:refreshed,loading:false});if(result)management.acknowledge()}
    } catch(error){if(generation.current===owner){setState({owner:api,author:ownerKey,error:'Não foi possível atualizar o cadastro.',loading:false});setNotice(error?.status===429?'Aguarde pelo menos 60 segundos antes de reenviar. O limite do ambiente também pode ter sido atingido.':'Não foi possível atualizar o cadastro. Confira o resultado antes de agir novamente.')}}
    finally{if(lock.current===operation)lock.current=null;if(generation.current===owner){setPending(false);setDialog(null);onPendingChange?.(false)}}
  }
  const legacyResend=()=>perform(async()=>{try{return await api.resendFirstManagerInvitation(businessId)}catch(error){if(error.status===429)setNotice('Aguarde pelo menos 60 segundos antes de reenviar. O limite do ambiente também pode ter sido atingido.');return null}})
  const openAction=target=>{if(!disabled)setDialog(target)}
  const tabs=[['overview','Visão geral'],...(grants.has('platform.memberships.view')?[['people','Pessoas e convites']]:[]),['history','Histórico']]
  const activeTab=tabs.some(([key])=>key===tab)?tab:'overview'
  return <section ref={rootRef} className="platform-company-detail">
    <Button variant="secondary" disabled={disabled} onClick={()=>onNavigate?.('/mesiva/empresas')}>Voltar às empresas</Button>
    <div className="platform-title-row"><PageHeader eyebrow="Administração Mesiva" title={company?.name||'Cadastro da empresa'} description="Cadastro, pessoas e acesso da empresa." /></div>
    {visible.loading&&<p role="status">Carregando cadastro…</p>}{visible.error&&<div role="alert"><p>{visible.error}</p><Button onClick={()=>setReload(v=>v+1)}>Tentar novamente</Button></div>}
    {!isOnline&&<p role="status" className="platform-feedback">Sem conexão. As ações administrativas estão temporariamente bloqueadas.</p>}
    {notice&&<p role="status" className="platform-feedback">{notice}</p>}
    {management.attempt?.error&&<div className="platform-feedback" role="status"><p>{management.attempt.error}</p>{management.attempt.status==='uncertain'&&<div className="platform-form-actions"><Button disabled={pending||!isOnline} onClick={()=>perform(management.reconcile)}>Verificar resultado</Button>{management.attempt.notFound&&<Button variant="secondary" disabled={pending||!isOnline} onClick={()=>perform(management.retry)}>Tentar a mesma operação</Button>}</div>}{management.attempt.status==='rejected'&&<Button variant="secondary" onClick={()=>{management.acknowledge();setDialog(null)}}>Revisar cadastro</Button>}</div>}
    {company&&<><div role="tablist" aria-label="Gestão da empresa" className="platform-detail-tabs" onKeyDown={event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const buttons=[...event.currentTarget.querySelectorAll('[role="tab"]')],index=buttons.indexOf(event.target),next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;setTab(tabs[next][0]);buttons[next].focus()}}>{tabs.map(([key,label])=><button key={key} type="button" id={`${tabId}-${key}`} role="tab" aria-selected={activeTab===key} aria-controls={`${tabId}-panel`} tabIndex={activeTab===key?0:-1} disabled={pending} onClick={()=>setTab(key)}>{label}</button>)}</div>
      <div role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${activeTab}`}>
        {activeTab==='overview'&&<><div className="platform-detail-grid"><section className="platform-card"><h2>Dados da empresa</h2><dl className="platform-definition platform-definition-columns"><div><dt>Nome</dt><dd>{company.name}</dd></div><div><dt>Cadastro</dt><dd>{formatDate(company.createdAt)}</dd></div><div><dt>Gerente do cadastro</dt><dd>{company.firstManager?.name||'Ainda não preparado'}</dd></div><div><dt>E-mail</dt><dd>{company.firstManager?.email||'Ainda não preparado'}</dd></div></dl></section><section className="platform-card"><h2>Acesso da empresa</h2><span className={`platform-badge ${status.activated?'is-active':''} ${lifecycle==='deleted'?'is-muted':''}`}>{status.access}</span><p className="platform-muted">{status.invitation}</p>
          {grants.has('platform.businesses.manage')&&<div className="platform-access-actions">{lifecycle==='deleted'?<><Button variant="secondary" disabled={disabled} data-company-primary-action onClick={()=>openAction({operation:'restore'})}>Restaurar empresa</Button><p className="platform-muted">A restauração mantém o acesso suspenso.</p></>:<><Button variant="secondary" disabled={disabled} data-company-primary-action onClick={()=>openAction({operation:lifecycle==='suspended'?'resume':'suspend'})}>{lifecycle==='suspended'?(company.accessStatus==='pending'?'Retomar ativação':'Reativar acesso'):'Suspender acesso'}</Button><p className="platform-muted">Esta ação afeta somente esta empresa.</p></>}</div>}
          {lifecycle==='enabled'&&!status.activated&&company.invitation&&<><p>Validade do convite: {formatDate(company.invitation.expiresAt)}</p>{grants.has('platform.invitations.resend')&&company.invitation.canResend&&<Button variant="secondary" disabled={disabled} onClick={()=>accountId&&api.manageBusiness?openAction({operation:'invitation.resend',invitationId:company.invitation.id,label:company.firstManager?.email}):legacyResend()}>{pending?'Reenviando…':'Reenviar convite'}</Button>}{!company.firstManager?.active&&company.firstManager&&<p>O vínculo está desativado. O reenvio não reativa o acesso.</p>}</>}
        </section></div>{lifecycle!=='deleted'&&grants.has('platform.businesses.delete')&&<section className="platform-danger-section"><h2>Ações administrativas</h2><p className="platform-muted">Excluir remove a empresa da lista principal e preserva os dados para restauração.</p><Button variant="secondary" className="platform-delete-action" disabled={disabled} onClick={()=>openAction({operation:'delete'})}>Excluir empresa</Button></section>}</>}
        {activeTab==='people'&&<CompanyMembersPanel company={company} api={api} grants={grants} disabled={disabled} onAction={openAction}/>}
        {activeTab==='history'&&<CompanyHistoryPanel company={company} api={api}/>}
      </div>
    </>}
    {company&&dialog&&<CompanyManagementDialog key={`${dialog.operation}:${dialog.userId||dialog.invitationId||company.id}`} company={company} target={dialog} pending={pending} onClose={()=>setDialog(null)} onConfirm={input=>perform(()=>management.execute(dialog,input))}/>}
  </section>
}
