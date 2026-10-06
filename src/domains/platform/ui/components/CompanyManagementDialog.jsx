import { useState } from 'react'
import Modal from '../../../../shared/ui/Modal.jsx'
import Button from '../../../../shared/ui/Button.jsx'

export const managementActionCopy={
  suspend:{title:'Suspender acesso da empresa?',label:'Suspender acesso',confirm:'Confirmar suspensão',message:'Toda a equipe perderá o acesso a esta empresa. Sessões, convites pendentes e pareamentos da TV serão revogados. Os dados serão preservados.'},
  resume:{title:'Retomar acesso da empresa?',label:'Reativar acesso',confirm:'Confirmar retomada',message:'A empresa voltará a permitir acesso ou ativação inicial, conforme seu cadastro. Sessões, links e pareamentos revogados continuarão inválidos.'},
  delete:{title:'Excluir empresa?',label:'Excluir empresa',confirm:'Confirmar exclusão',message:'A empresa perderá o acesso e sairá da lista principal. Os dados serão preservados e você poderá restaurá-la pelo filtro Excluídas.'},
  restore:{title:'Restaurar empresa?',label:'Restaurar empresa',confirm:'Confirmar restauração',message:'A empresa voltará à lista como Suspensa. A reativação do acesso será uma ação separada.'},
  'membership.revoke':{title:'Revogar acesso desta pessoa?',label:'Revogar acesso',confirm:'Confirmar revogação',message:'O vínculo, as sessões e os convites desta pessoa serão revogados somente nesta empresa. A conta e seus acessos a outras empresas serão preservados.'},
  'membership.reactivate':{title:'Reabilitar vínculo desta pessoa?',label:'Reativar vínculo',confirm:'Confirmar reabilitação',message:'O vínculo será habilitado com seu perfil atual. Uma pessoa que nunca aceitou precisa receber e aceitar um novo convite. Esta ação não libera uma empresa suspensa.'},
  'invitation.cancel':{title:'Cancelar convite?',label:'Cancelar convite',confirm:'Confirmar cancelamento',message:'O link deixará de funcionar. O cadastro e o vínculo serão preservados. Você poderá reenviar um novo convite quando elegível.'},
  'invitation.resend':{title:'Reenviar convite?',label:'Reenviar convite',confirm:'Confirmar reenvio',message:'Um novo link será enviado ao e-mail desta pessoa. Os links anteriores serão invalidados. O envio ao serviço não confirma entrega na caixa de entrada.'},
}

export default function CompanyManagementDialog({company,target,pending,onConfirm,onClose}) {
  const [reason,setReason]=useState(''),[name,setName]=useState(''),copy=managementActionCopy[target.operation]
  const count=Array.from(reason.trim()).length,valid=count>=3 && count<=500 && (target.operation!=='delete' || name.trim().normalize('NFC')===company.name.trim().normalize('NFC'))
  return <Modal title={copy.title} onClose={()=>{if(!pending) onClose()}} className="platform-management-dialog" initialFocusSelector="textarea">
    <p><strong>{company.name}</strong>{target.label && <> · {target.label}</>}</p><p>{copy.message}</p>
    <div className="platform-form"><label>Motivo<textarea name="reason" rows={3} maxLength={1000} required value={reason} disabled={pending} onChange={event=>setReason(event.target.value)} placeholder="Descreva o motivo, sem senhas ou informações confidenciais" /><small>De 3 a 500 caracteres.</small></label>
      {target.operation==='delete' && <label>Digite {company.name} para confirmar<input name="confirmationName" value={name} maxLength={400} autoComplete="off" disabled={pending} onChange={event=>setName(event.target.value)} /></label>}
      <div className="platform-form-actions"><Button variant="secondary" disabled={pending} onClick={onClose}>Cancelar</Button><Button variant={['resume','restore','membership.reactivate'].includes(target.operation)?'primary':'danger'} disabled={pending||!valid} onClick={()=>onConfirm({reason:reason.trim(),expectedRevision:company.managementRevision,...(target.operation==='delete'?{confirmationName:name}: {})})}>{pending?'Confirmando…':copy.confirm}</Button></div>
    </div>
  </Modal>
}
