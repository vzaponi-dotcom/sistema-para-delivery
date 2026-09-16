import { useCallback, useEffect, useState } from 'react'
import { getSession, login, logout } from '../../../infrastructure/auth/sessionApi.js'

const defaultApi = { getSession, login, logout }

const getLoginErrorMessage = (error) => error?.code === 'INVALID_PIN'
  ? 'PIN inválido. Confira e tente novamente.'
  : (error?.message || 'Não foi possível entrar no sistema.')

export const useSessionRuntime = ({
  api = defaultApi,
  isOnline = true,
  requestKey = null,
  setRequestKey = () => {},
  resetOperationalData = () => {},
  refreshBootstrap = async () => {},
  onClearApplicationState = () => {},
} = {}) => {
  const [authState, setAuthState] = useState('checking')
  const [sessionContext, setSessionContext] = useState(null)
  const [sessionGeneration, setSessionGeneration] = useState(0)
  const [loginError, setLoginError] = useState('')

  useEffect(() => {
    let cancelled = false

    const initialize = async () => {
      try {
        const session = await api.getSession()
        if (cancelled) return
        if (!session?.authenticated) {
          setAuthState('anonymous')
          return
        }

        setSessionContext(session)
        setSessionGeneration((current) => current + 1)
        setAuthState('authenticated')
        if (!cancelled) await refreshBootstrap()
      } catch {
        if (!cancelled) {
          setAuthState('anonymous')
          resetOperationalData()
        }
      }
    }

    void initialize()
    return () => { cancelled = true }
  }, [])

  const handleLogin = useCallback(async (pin) => {
    if (!isOnline || requestKey !== null) return

    setRequestKey('auth:login')
    setLoginError('')
    try {
      const session = await api.login(pin)
      setSessionContext({ authenticated: true, ...session })
      setSessionGeneration((current) => current + 1)
      setAuthState('authenticated')
      await refreshBootstrap()
    } catch (error) {
      resetOperationalData()
      onClearApplicationState()
      setSessionContext(null)
      setAuthState('anonymous')
      setLoginError(getLoginErrorMessage(error))
    } finally {
      setRequestKey(null)
    }
  }, [api, isOnline, onClearApplicationState, refreshBootstrap, requestKey, resetOperationalData, setRequestKey])

  const handleLogout = useCallback(async () => {
    if (!isOnline || requestKey !== null) return

    setRequestKey('auth:logout')
    try {
      await api.logout()
      setSessionGeneration((current) => current + 1)
      resetOperationalData()
      onClearApplicationState()
      setSessionContext(null)
      setAuthState('anonymous')
      setLoginError('')
    } finally {
      setRequestKey(null)
    }
  }, [api, isOnline, onClearApplicationState, requestKey, resetOperationalData, setRequestKey])

  const expireSession = useCallback(() => {
    setSessionGeneration((current) => current + 1)
    resetOperationalData()
    onClearApplicationState()
    setSessionContext(null)
    setAuthState('anonymous')
    setRequestKey(null)
    setLoginError('Sua sessão expirou. Entre novamente.')
  }, [onClearApplicationState, resetOperationalData, setRequestKey])

  return {
    authState,
    sessionContext,
    sessionGeneration,
    loginError,
    handleLogin,
    handleLogout,
    expireSession,
  }
}
