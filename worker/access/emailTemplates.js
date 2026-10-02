import { apiError } from '../http.js'

const escape = value => String(value).replace(/[&<>"']/g,char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))
const invalid = () => apiError(400,'INVALID_EMAIL_INPUT','Não foi possível preparar o e-mail de acesso.')
const purposes = {
  activation:{title:'Seu acesso à Mesiva está pronto',button:'Ativar minha conta',path:'/ativar-conta',validity:'24 horas',intro:'Você recebeu um convite para acessar a operação. Confirme seu e-mail e crie sua senha.'},
  password_reset:{title:'Crie uma nova senha',button:'Redefinir minha senha',path:'/redefinir-senha',validity:'30 minutos',intro:'Recebemos uma solicitação para redefinir sua senha. Sua senha atual continua funcionando até você concluir a redefinição.'},
  company_invitation:{title:'Você recebeu um convite',button:'Aceitar convite',path:'/aceitar-convite',validity:'24 horas',intro:'Você recebeu um convite para acessar esta empresa na Mesiva. Se já tem uma conta, entre com seu e-mail e senha para aceitar. Caso contrário, confirme seu e-mail e crie sua senha.'},
}

export function buildChallengeEmail({purpose,displayName,businessName,expiresAt,link,isStaging=false,globalIdentity=false}) {
  if (!Object.hasOwn(purposes,purpose)) throw invalid()
  const copy = purposes[purpose]
  let url
  try { url=new URL(link) } catch { throw invalid() }
  const fragment = new URLSearchParams(url.hash.slice(1))
  if (url.protocol!=='https:' || url.username || url.password || url.search || url.pathname!==copy.path
    || [...fragment].length!==1 || !/^[A-Za-z0-9_-]{43}$/.test(fragment.get('token') || '') || !Number.isFinite(Date.parse(expiresAt))) throw invalid()
  const name = String(displayName || 'Sua equipe'), operation = String(businessName || 'Sua operação')
  const showOperation = !globalIdentity || Boolean(businessName)
  const introduction = globalIdentity && purpose==='activation' ? 'Confirme seu e-mail e crie sua senha para acessar a Mesiva.' : copy.intro
  const deadline = new Date(expiresAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'})
  const notice = isStaging ? 'Ambiente de testes — dados e contas de staging.' : 'Acesso individual à sua operação.'
  const detail = `Este link vale por ${copy.validity}, até ${deadline} (horário de Brasília), e só pode ser usado uma vez. Se recebeu mais de um e-mail, use o link mais recente.`
  const ignore = purpose==='password_reset' ? 'Se você não solicitou esta alteração, ignore este e-mail. Sua senha não será alterada.' : 'Se não reconhece este convite, ignore este e-mail.'
  const subject = `${isStaging ? '[Ambiente de testes] ' : ''}Mesiva — ${copy.title}`
  const text = `Mesiva\n${notice}\n\nOlá, ${name}.${showOperation ? `\nOperação: ${operation}` : ''}\n\n${introduction}\n\n${copy.button}:\n${link}\n\n${detail}\n\n${ignore}`
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
    <body style="margin:0;background:#f3f7fa;font-family:Arial,Helvetica,sans-serif;color:#082743">
    <table role="presentation" style="width:100%;padding:32px 16px"><tr><td align="center">
    <table role="presentation" style="width:100%;max-width:560px;background:#fff;border:1px solid #dbe7ed;border-radius:20px"><tr><td style="padding:32px">
    <div style="font-size:30px;font-weight:800;color:#082743">Mesiva<span style="color:#007f76">.</span></div>
    <p style="font-size:12px;color:#587084">${escape(notice)}</p>
    <h1 style="font-size:26px;line-height:1.25;margin-top:28px">${escape(copy.title)}</h1>
    <p style="line-height:1.6">Olá, ${escape(name)}.</p>${showOperation ? `<p style="font-size:14px;color:#587084">Operação: <strong>${escape(operation)}</strong></p>` : ''}
    <p style="line-height:1.6">${escape(introduction)}</p>
    <p style="margin:28px 0"><a href="${escape(link)}" style="display:inline-block;padding:16px 24px;border-radius:12px;background:#007f76;color:#fff;text-decoration:none;font-weight:bold">${escape(copy.button)}</a></p>
    <p style="line-height:1.6;font-size:14px;color:#587084">${escape(detail)}</p>
    <p style="line-height:1.6;font-size:14px;color:#587084;border-top:1px solid #dbe7ed;padding-top:20px">${escape(ignore)}</p>
    <p style="font-size:12px;color:#587084">People · Food · Progress</p>
    </td></tr></table></td></tr></table></body></html>`
  return {subject,html,text}
}
