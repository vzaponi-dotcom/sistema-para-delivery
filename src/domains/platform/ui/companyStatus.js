export function companyStatus(company) {
  if (company?.lifecycleStatus === 'deleted') return {access:'Excluída',invitation:'Dados preservados para restauração',activated:false,tone:'muted'}
  if (company?.lifecycleStatus === 'suspended') return {access:'Suspensa',invitation:'Acesso operacional bloqueado',activated:false,tone:'warning'}
  if (company?.accessStatus === 'active') return { access: 'Ativa', invitation: company?.invitation?.status === 'accepted' ? 'Convite aceito' : company?.invitation ? 'Ativação concluída' : 'Sem convite pendente', activated: true }
  if (company?.accessStatus === 'legacy') return { access: 'Acesso anterior', invitation: 'Preparação pendente', activated: false }
  const invitation = company?.invitation
  const state = invitation?.status
  return { access: 'Aguardando ativação', activated: false, invitation: state === 'expired' ? 'Convite expirado' : state === 'revoked' ? 'Convite revogado' : ({ pending: 'Envio em processamento', accepted: 'Enviado ao serviço de e-mail', rejected: 'Falha de envio', uncertain: 'Envio não confirmado' }[invitation?.deliveryStatus] || 'Convite pendente') }
}
export const formatDate = value => {
  const normalized=typeof value==='string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)?`${value.replace(' ','T')}.000Z`:value
  return Number.isFinite(Date.parse(normalized))?new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'medium'}).format(new Date(normalized)):'Ainda não registrado'
}
export const platformEventLabel=action=>({'business.created':'Empresa cadastrada','business.suspended':'Acesso suspenso','business.resumed':'Acesso retomado','business.deleted':'Empresa excluída','business.restored':'Empresa restaurada','membership.revoked':'Vínculo revogado','membership.reactivated':'Vínculo reativado','invitation.issued':'Convite emitido','invitation.resent':'Convite reenviado','invitation.cancelled':'Convite cancelado','invitation.delivery.accepted':'Envio aceito pelo serviço','invitation.delivery.rejected':'Envio rejeitado','invitation.delivery.uncertain':'Envio não confirmado','administrator.prepared':'Administrador preparado','legacy.finalized':'Preparação concluída','account.recovery.issued':'Recuperação de conta emitida'}[action]||'Atualização administrativa')
