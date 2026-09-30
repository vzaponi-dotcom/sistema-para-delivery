import { useCallback, useEffect, useRef, useState } from 'react'
import { getSession, login, logout } from '../../../infrastructure/auth/sessionApi.js'
import { createBrowserSessionCoordinator } from './browserSessionCoordinator.js'
const defaultApi = { getSession, login, logout }
export const sessionHasOperationalAccess = (session) => Boolean(session?.authenticated && !(session.user?.id && session.authMode === 'enrollment'))
export const useSessionRuntime = ({ api = defaultApi, coordinatorFactory = createBrowserSessionCoordinator, isOnline = true, requestKey = null, setRequestKey = () => {}, resetOperationalData = () => {}, refreshBootstrap = async () => {}, onClearApplicationState = () => {} } = {}) => {
  const [authState, setAuthState] = useState('checking')
  const [sessionContext, setSessionContext] = useState(null)
  const [sessionGeneration, setSessionGeneration] = useState(0)
  const [authMode, setAuthMode] = useState(null)
  const [loginError, setLoginError] = useState('')
  const operationRef = useRef(0)
  const coordinatorRef = useRef(null)
  const credentialChangeRef = useRef(null)
  const sessionDiscoveryRef = useRef(null)
  const [credentialChangePending, setCredentialChangePending] = useState(false)
  const isCredentialChangePending = useCallback(() => credentialChangeRef.current !== null, [])
  const clear = useCallback((scope) => {
    setSessionGeneration((value) => value + 1)
    resetOperationalData(); onClearApplicationState(scope); setSessionContext(null)
  }, [resetOperationalData, onClearApplicationState])
  const accept = useCallback(async (session, operation) => {
    if (operation !== operationRef.current) return false
    if (['legacy', 'enrollment', 'user_only'].includes(session?.authMode)) setAuthMode(session.authMode)
    if (!session?.authenticated) { setSessionContext(null); setAuthState('anonymous'); return false }
    setSessionContext(session); setSessionGeneration((value) => value + 1); setAuthState('authenticated')
    return operation === operationRef.current
  }, [])
  useEffect(() => {
    const operation = ++operationRef.current
    void api.getSession().then((session) => accept(session, operation)).catch(() => {
      if (operation !== operationRef.current) return
      resetOperationalData(); setSessionContext(null); setAuthState('anonymous')
    })
    return () => { operationRef.current++ }
  }, [])
  useEffect(() => {
    if (authState === 'authenticated' && sessionHasOperationalAccess(sessionContext)) void refreshBootstrap()
  }, [authState, sessionGeneration])
  const expireSession = useCallback(({ broadcast = true } = {}) => {
    operationRef.current++; clear(); setAuthState('anonymous'); setRequestKey(null)
    setLoginError('Sua sessão expirou. Entre novamente.')
    if (broadcast) coordinatorRef.current?.publish()
  }, [clear, setRequestKey])
  const refreshSession = useCallback(async ({ broadcast = false } = {}) => {
    const operation = ++operationRef.current
    clear(); setRequestKey(null); setAuthState('checking')
    if (broadcast) coordinatorRef.current?.publish()
    const discovery = (async () => {
      try { return await accept(await api.getSession(), operation) }
      catch { if (operation === operationRef.current) expireSession({ broadcast: false }); return false }
    })()
    sessionDiscoveryRef.current = { operation, promise: discovery }
    return await discovery
  }, [accept, api, clear, expireSession, setRequestKey])
  const refreshSessionRef = useRef(refreshSession)
  refreshSessionRef.current = refreshSession
  useEffect(() => {
    const coordinator = coordinatorFactory({ onInvalidate: () => { void refreshSessionRef.current({ broadcast: false }) } })
    coordinatorRef.current = coordinator
    return () => { coordinator.close(); coordinatorRef.current = null }
  }, [coordinatorFactory])
  const runCredentialChange = useCallback(async (operation) => {
    if (!isOnline || authState !== 'authenticated' || !sessionContext?.user?.id || credentialChangeRef.current) return false
    const pending = {}
    // Register synchronously before invoking the operation that sends POST.
    // This lifetime belongs to the runtime, independently of the account screen.
    credentialChangeRef.current = pending
    setCredentialChangePending(true)
    const rediscover = async options => {
      await refreshSessionRef.current(options)
      // An external invalidation may supersede this read. Hold the credential
      // guard until the newest existing discovery has also settled.
      let latest
      do {
        latest = sessionDiscoveryRef.current
        await latest?.promise
      } while (latest !== sessionDiscoveryRef.current)
    }
    try {
      let result
      try { result = await operation() }
      catch (error) {
        if (error?.code === 'CREDENTIAL_CHANGED') await rediscover()
        else if (!Number.isInteger(error?.status)) await rediscover({ broadcast: true })
        throw error
      }
      if (result?.changed !== true) {
        // A body/network failure can follow accepted Set-Cookie headers. Treat
        // this as uncertain: invalidate before discovery, never repeat the POST.
        await rediscover({ broadcast: true })
        throw new Error('Não foi possível confirmar a alteração da senha.')
      }
      // Set-Cookie is already applied by the browser. Even an expired UI owner
      // must announce that cookie change and rediscover its trusted identity.
      await rediscover({ broadcast: true })
      return result
    } finally {
      if (credentialChangeRef.current === pending) {
        credentialChangeRef.current = null
        setCredentialChangePending(false)
      }
    }
  }, [authState, isOnline, sessionContext])
  const handleLogin = useCallback(async (credentials) => {
    if (!isOnline || requestKey !== null || credentialChangeRef.current) return false
    const operation = ++operationRef.current
    setRequestKey('auth:login'); setLoginError('')
    try {
      const session = await api.login(credentials)
      if (operation !== operationRef.current) return false
      resetOperationalData(); onClearApplicationState('sync')
      coordinatorRef.current?.publish()
      return await accept(session, operation)
    } catch (error) {
      if (operation !== operationRef.current) return false
      clear(); setAuthState('anonymous')
      setLoginError(error?.code === 'INVALID_PIN' ? 'PIN inválido. Confira e tente novamente.' : error?.message || 'Não foi possível entrar no sistema.')
      return false
    } finally { if (operation === operationRef.current) setRequestKey(null) }
  }, [accept, api, clear, isOnline, onClearApplicationState, requestKey, resetOperationalData, setRequestKey])
  const handleLogout = useCallback(async () => {
    if (!isOnline || requestKey !== null || credentialChangeRef.current) return false
    const operation = ++operationRef.current
    setRequestKey('auth:logout'); clear(); setAuthState('checking')
    try {
      await api.logout()
      if (operation !== operationRef.current) return false
      coordinatorRef.current?.publish()
      setAuthState('anonymous'); setLoginError(''); return true
    } catch (error) {
      if (operation === operationRef.current) { setAuthState('anonymous'); setLoginError(error?.message || 'Não foi possível encerrar a sessão. Tente novamente.') }
      return false
    } finally { if (operation === operationRef.current) setRequestKey(null) }
  }, [api, clear, isOnline, requestKey, setRequestKey])
  return { authState, sessionContext, sessionGeneration, authMode, operationalAccess: sessionHasOperationalAccess(sessionContext), loginError, handleLogin, handleLogout, expireSession, refreshSession, runCredentialChange, credentialChangePending, isCredentialChangePending }
}
