import { createPortal } from 'react-dom'
import Button from '../../shared/ui/Button'
import ConnectionBanner from '../../components/ConnectionBanner'
import Icon from '../../shared/ui/Icon'
import LoginScreen from '../../components/LoginScreen'

const Toast = ({ message }) => <div className="toast-success" role="status"><span className="toast-icon"><Icon name="dashboard" size={17} /></span>{message}</div>
const Success = ({ message }) => <div className="success-confirmation-overlay" role="status" aria-live="polite"><div className="success-confirmation-card"><span className="success-confirmation-icon"><Icon name="check" size={30} /></span><strong>{message}</strong></div></div>
const portal = (node) => node && typeof document !== 'undefined' ? createPortal(node, document.body) : node

export default function AppRoot({ isOnline, authState, loginLoading, loginError, onLogin, bootstrapState, onRetryBootstrap, retryDisabled, toastMessage, successMessage, children }) {
  if (authState === 'checking') return <div className="system-state-screen"><div className="system-state-card"><h2>Carregando sistema</h2><p>Verificando sua sessão…</p></div></div>
  if (authState === 'anonymous') return <>{!isOnline && <ConnectionBanner />}<LoginScreen onLogin={onLogin} loading={loginLoading} error={loginError} disabled={!isOnline} /></>
  if (bootstrapState !== 'ready') return <>{!isOnline && <ConnectionBanner />}<div className="system-state-screen"><div className="system-state-card">{bootstrapState === 'error' ? <><h2>Não foi possível carregar os dados</h2><p>Confira sua conexão e tente novamente.</p><Button type="button" onClick={onRetryBootstrap} disabled={retryDisabled}>Tentar novamente</Button></> : <><h2>Carregando dados</h2><p>Sincronizando a operação da Amor &amp; Sabor…</p></>}</div></div></>
  return <>{!isOnline && <ConnectionBanner />}{toastMessage && portal(<Toast message={toastMessage} />)}{successMessage && portal(<Success message={successMessage} />)}{children}</>
}
