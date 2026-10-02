export function companyStatus(company) {
  if (company?.accessStatus === 'active' || company?.invitation?.status === 'accepted') return { access: 'Acesso ativado', invitation: 'Convite aceito', activated: true }
  if (company?.accessStatus === 'legacy') return { access: 'Acesso anterior', invitation: 'Preparação pendente', activated: false }
  const invitation = company?.invitation
  const state = invitation?.status
  return { access: 'Aguardando ativação', activated: false, invitation: state === 'expired' ? 'Convite expirado' : state === 'revoked' ? 'Convite revogado' : ({ pending: 'Envio em processamento', accepted: 'Enviado ao serviço de e-mail', rejected: 'Falha de envio', uncertain: 'Envio não confirmado' }[invitation?.deliveryStatus] || 'Convite pendente') }
}
export const formatDate = value => Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('pt-BR') : 'Ainda não registrado'
