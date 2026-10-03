import { apiError } from '../http.js'

const escape = value => String(value).replace(/[&<>"']/g,char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))
const invalid = () => apiError(400,'INVALID_EMAIL_INPUT','Não foi possível preparar o e-mail de acesso.')
const purposes = {
  activation:{title:'Seu acesso à Mesiva está pronto',button:'Ativar minha conta',path:'/ativar-conta',validity:'24 horas',intro:'Você recebeu um convite para acessar a operação. Confirme seu e-mail e crie sua senha.'},
  password_reset:{title:'Redefina sua senha.',button:'Redefinir minha senha',path:'/redefinir-senha',validity:'30 minutos',intro:'Recebemos uma solicitação para redefinir a senha da sua conta Mesiva.'},
  company_invitation:{title:'Seu lugar na equipe está pronto.',button:'Aceitar convite',path:'/aceitar-convite',validity:'24 horas',intro:'Você recebeu um convite para fazer parte da equipe na Mesiva.'},
}

export function buildChallengeEmail({purpose,displayName,businessName,roleName,expiresAt,link,isStaging=false,globalIdentity=false}) {
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
  const notice = isStaging ? 'Ambiente de testes — dados e contas de staging.' : ''
  const eyebrow = purpose==='password_reset' ? 'SEGURANÇA DA SUA CONTA' : 'SUA EQUIPE NA MESIVA'
  const guidance = purpose==='password_reset'
    ? 'Sua senha atual continua funcionando até você concluir a redefinição.'
    : purpose==='company_invitation' ? 'Já tem uma conta Mesiva? Entre com seu e-mail e senha para aceitar. Se este é seu primeiro acesso, você poderá criar sua senha.' : ''
  const logoUrl = new URL('/brand/mesiva-email-logo.png',url.origin).href
  const detail = `Este link vale por ${copy.validity}, até ${deadline} (horário de Brasília), e só pode ser usado uma vez. Se recebeu mais de um e-mail, use o link mais recente.`
  const ignore = purpose==='password_reset' ? 'Se você não solicitou esta alteração, ignore este e-mail. Sua senha não será alterada.' : 'Se não reconhece este convite, ignore este e-mail.'
  const subject = `${isStaging ? '[Ambiente de testes] ' : ''}Mesiva — ${copy.title}`
  const text = `Mesiva${notice ? `\n${notice}` : ''}\n\n${copy.title}\n\nOlá, ${name}.${showOperation ? `\nOperação: ${operation}${roleName ? `\nPerfil: ${roleName}` : ''}` : ''}\n\n${introduction}\n\n${copy.button}:\n${link}\n\n${detail}${guidance ? `\n\n${guidance}` : ''}\n\n${ignore}\n\nMesiva · Gestão para restaurantes\nPeople · Food · Progress`
  const html = `<!doctype html><html lang="pt-BR" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(copy.title)}</title></head>
    <body style="margin:0;background:#f3f7fa;font-family:Arial,Helvetica,sans-serif;color:#082743">
    <div lang="pt-BR" dir="ltr">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;background:#f3f7fa"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;max-width:560px;background:#ffffff;border:1px solid #dbe7ed;border-top:4px solid #007f76;border-radius:16px"><tr><td style="padding:28px 24px;color:#082743">
    <img src="${escape(logoUrl)}" alt="Mesiva — People Food Progress" width="180" height="52" style="display:block;width:180px;max-width:100%;height:auto;border:0">
    ${notice ? `<p style="margin:24px 0 0;padding:12px;background:#fff6d9;border:1px solid #e8cd7b;border-radius:8px;color:#665017;font-size:12px;line-height:1.5">${escape(notice)}</p>` : ''}
    <p style="margin:32px 0 12px;color:#007f76;font-size:11px;font-weight:bold;letter-spacing:1px;line-height:1.5">${eyebrow}</p>
    <h1 style="margin:0 0 24px;color:#082743;font-size:28px;font-weight:bold;line-height:1.25">${escape(copy.title)}</h1>
    <p style="margin:0 0 12px;color:#082743;font-size:15px;line-height:1.7">Olá, ${escape(name)}.</p>
    <p style="margin:0 0 24px;color:#4f687b;font-size:15px;line-height:1.7">${escape(introduction)}</p>
    ${showOperation ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;margin-bottom:24px;background:#f3f7fa;border:1px solid #dbe7ed;border-radius:10px"><tr><td style="padding:16px;color:#082743;font-size:15px;line-height:1.6;word-break:break-word"><span style="color:#4f687b;font-size:11px;letter-spacing:1px">EMPRESA</span><br><strong>${escape(operation)}</strong>${roleName ? `<br><span style="color:#4f687b;font-size:13px">Seu perfil: ${escape(roleName)}</span>` : ''}</td></tr></table>` : ''}
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%"><tr><td align="center" bgcolor="#007f76" style="background:#007f76;border-radius:10px"><a href="${escape(link)}" style="display:block;padding:16px 12px;color:#ffffff;font-size:15px;line-height:20px;text-decoration:none;font-weight:bold;border-radius:10px">${escape(copy.button)}</a></td></tr></table>
    <p style="margin:16px 0 8px;color:#082743;font-size:12px;font-weight:bold;line-height:1.6">${purpose==='company_invitation' ? 'Convite' : 'Link'} válido por ${copy.validity} · Uso único</p>
    <p style="margin:0;color:#4f687b;font-size:12px;line-height:1.7">Válido até ${escape(deadline)} (horário de Brasília). Se recebeu mais de um e-mail, use o link mais recente.</p>
    ${guidance ? `<p style="margin:24px 0 0;color:#4f687b;font-size:13px;line-height:1.7">${escape(guidance)}</p>` : ''}
    <p style="margin:24px 0 0;border-top:1px solid #dbe7ed;padding-top:20px;color:#4f687b;font-size:12px;line-height:1.7">${escape(ignore)}</p>
    </td></tr></table>
    <p style="margin:20px 0 4px;color:#4f687b;font-size:12px;line-height:1.6">Mesiva · Gestão para restaurantes</p>
    <p style="margin:0;color:#4f687b;font-size:10px;letter-spacing:1px;line-height:1.6">People · Food · Progress</p>
    </td></tr></table></div></body></html>`
  return {subject,html,text}
}
