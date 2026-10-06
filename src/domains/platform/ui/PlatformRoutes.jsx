import { useContextApi } from '../../../infrastructure/api/ContextApi.js'
import { createPlatformApi, platformApi } from '../infrastructure/platformApi.js'
import PlatformShell from './PlatformShell.jsx'
import CompanyList from './CompanyList.jsx'
import NewCompany from './NewCompany.jsx'
import CompanyDetail from './CompanyDetail.jsx'

export default function PlatformRoutes({ session, attempts, managementAttempts, isOnline = true, path = '/mesiva/empresas', api: suppliedApi = platformApi, onNavigate, onLogout, onSelectBusiness, onAccount, onPendingChange, pending = false }) {
  const api = useContextApi(createPlatformApi, suppliedApi, platformApi)
  const grants = new Set(session?.platformCapabilities || [])
  if (!session?.authenticated || session.scope !== 'platform' || !grants.has('platform.businesses.view')) return <p role="alert">Você não tem acesso ao painel Mesiva.</p>
  const base = '/mesiva/empresas'
  let page
  if (path === `${base}/nova`) page = grants.has('platform.businesses.create') ? <NewCompany key={session.account?.id} accountId={session.account?.id} attempts={attempts} api={api} onNavigate={onNavigate} onPendingChange={attempts ? undefined : onPendingChange} onCreated={id => onNavigate?.(`${base}/${encodeURIComponent(id)}`)} /> : <p role="alert">Você não tem permissão para cadastrar empresas.</p>
  else if (path.startsWith(`${base}/`) && path.slice(base.length + 1) && !path.slice(base.length + 1).includes('/')) {
    try { page = <CompanyDetail key={path} api={api} businessId={decodeURIComponent(path.slice(base.length + 1))} accountId={session.account?.id} contextId={session.contextId} capabilities={session.platformCapabilities} attempts={managementAttempts} isOnline={isOnline} canResend={grants.has('platform.invitations.resend')} onNavigate={onNavigate} onPendingChange={onPendingChange} /> } catch { page = <p role="alert">Empresa não encontrada.</p> }
  } else page = <CompanyList api={api} onNavigate={onNavigate} canCreate={grants.has('platform.businesses.create')} />
  return <PlatformShell account={session.account} onLogout={onLogout} onSelectBusiness={onSelectBusiness} onAccount={onAccount} pending={pending}>{page}</PlatformShell>
}
