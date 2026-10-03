import { createPortal } from 'react-dom'
import Button from '../../shared/ui/Button'
import ConnectionBanner from './ConnectionBanner'
import Icon from '../../shared/ui/Icon'
import LoginScreen from './LoginScreen'
import StartupScreen from './StartupScreen'

const Toast = ({ message }) => <div className="toast-success" role="status"><span className="toast-icon"><Icon name="dashboard" size={17} /></span>{message}</div>
const Success = ({ message }) => <div className="success-confirmation-overlay" role="status" aria-live="polite"><div className="success-confirmation-card"><span className="success-confirmation-icon"><Icon name="check" size={30} /></span><strong>{message}</strong></div></div>
const portal = (node) => node && typeof document !== 'undefined' ? createPortal(node, document.body) : node

export default function AppRoot({ contextSurface, isOnline, authState, authMode, operationalAccess = true, loginLoading, loginError, onLogin, bootstrapState, onRetryBootstrap, retryDisabled, toastMessage, successMessage, children }) {
  if (authState === 'checking') return <>{!isOnline && <ConnectionBanner />}<StartupScreen message="Verificando sua sessão…" /></>
  if (authState === 'anonymous') return <>{!isOnline && <ConnectionBanner />}<LoginScreen authMode={authMode} onLogin={onLogin} loading={loginLoading} error={loginError} disabled={!isOnline} /></>
  if (contextSurface) return <>{!isOnline && <ConnectionBanner />}{contextSurface}</>
  if (operationalAccess && bootstrapState !== 'ready') return <>{!isOnline && <ConnectionBanner />}{bootstrapState === 'error' ? <div className="system-state-screen"><div className="system-state-card"><h2>Não foi possível carregar os dados</h2><p>Confira sua conexão e tente novamente.</p><Button type="button" onClick={onRetryBootstrap} disabled={retryDisabled}>Tentar novamente</Button></div></div> : <StartupScreen />}</>
  return <>{!isOnline && <ConnectionBanner />}{toastMessage && portal(<Toast message={toastMessage} />)}{successMessage && portal(<Success message={successMessage} />)}{children}</>
}
