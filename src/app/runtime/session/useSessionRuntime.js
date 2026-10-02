import { useCallback, useEffect, useRef, useState } from 'react'
import { getSession, login, logout, selectBusiness, selectPlatform, listBusinesses } from '../../../infrastructure/auth/sessionApi.js'
import { createBrowserSessionCoordinator } from './browserSessionCoordinator.js'
const defaultApi = { getSession, login, logout, selectBusiness, selectPlatform, listBusinesses }
export const sessionHasOperationalAccess = (session) => Boolean(session?.authenticated && (session.authMode === 'multi_company' ? session.scope === 'business' : !(session.user?.id && session.authMode === 'enrollment')))
export const useSessionRuntime = ({ api = defaultApi, coordinatorFactory = createBrowserSessionCoordinator, isOnline = true, requestKey = null, setRequestKey = () => {}, resetOperationalData = () => {}, refreshBootstrap = async () => {}, onClearApplicationState = () => {}, canChangeContext = () => true } = {}) => {
  const [authState, setAuthState] = useState('checking')
  const [sessionContext, setSessionContext] = useState(null)
  const [sessionGeneration, setSessionGeneration] = useState(0)
  const [authMode, setAuthMode] = useState(null)
  const [loginError, setLoginError] = useState('')
  const contextChangeRef = useRef(null)
  const [contextChangePending, setContextChangePending] = useState(false)
  const operationRef = useRef(0)
  const authRequestRef = useRef(null)
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
    if (['legacy', 'enrollment', 'user_only', 'multi_company'].includes(session?.authMode)) setAuthMode(session.authMode)
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
  const expireSession = useCallback(({ broadcast = true, preserveRequestKey = false } = {}) => {
    operationRef.current++; clear(); setAuthState('anonymous'); if (!preserveRequestKey) { authRequestRef.current = null; setRequestKey(null) }
    setLoginError('Sua sessão expirou. Entre novamente.')
    if (broadcast) coordinatorRef.current?.publish()
  }, [clear, setRequestKey])
  const refreshSession = useCallback(async ({ broadcast = false, preserveRequestKey = false, scope, requireContext = false } = {}) => {
    const operation = ++operationRef.current
    clear(scope); if (!preserveRequestKey) { authRequestRef.current = null; setRequestKey(null) }; setAuthState('checking')
    if (broadcast) coordinatorRef.current?.publish()
    const discovery = (async () => {
      try { return await accept(await api.getSession({ requireContext }), operation) }
      catch { if (operation === operationRef.current) expireSession({ broadcast: false, preserveRequestKey }); return false }
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
    if (!isOnline || authState !== 'authenticated' || !(sessionContext?.user?.id || sessionContext?.account?.id) || credentialChangeRef.current || contextChangeRef.current) return false
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
  // Cookie settlement outlives the UI operation that initiated the POST. A
  // stale response may still install/clear the shared cookie; rediscover it,
  // while only the current operation may release its own request lock.
  const releaseAuthRequest = useCallback(operation => {
    if (authRequestRef.current !== operation) return
    authRequestRef.current = null
    setRequestKey(null)
  }, [setRequestKey])
  const settleAuth = useCallback((operation, scope) => {
    const currentScope = operation === operationRef.current ? scope : undefined
    releaseAuthRequest(operation)
    return refreshSessionRef.current({ broadcast: true, preserveRequestKey: true, scope: currentScope, requireContext: true })
  }, [releaseAuthRequest])
  const handleLogin = useCallback(async (credentials) => {
    if (!isOnline || requestKey !== null || credentialChangeRef.current || contextChangeRef.current) return false
    const operation = ++operationRef.current
    authRequestRef.current = operation
    setRequestKey('auth:login'); setLoginError('')
    try {
      await api.login(credentials, { discover: false })
      return await settleAuth(operation, 'sync')
    } catch (error) {
      if (operation === operationRef.current) {
        setLoginError(error?.code === 'INVALID_PIN' ? 'PIN inválido. Confira e tente novamente.' : error?.message || 'Não foi possível entrar no sistema.')
      }
      if (!Number.isInteger(error?.status)) await settleAuth(operation, 'sync')
      else if (operation === operationRef.current) { clear(); setAuthState('anonymous') }
      return false
    } finally { releaseAuthRequest(operation) }
  }, [api, clear, isOnline, requestKey, setRequestKey, settleAuth, releaseAuthRequest])
  const handleLogout = useCallback(async () => {
    if (!isOnline || requestKey !== null || credentialChangeRef.current || contextChangeRef.current) return false
    const operation = ++operationRef.current
    authRequestRef.current = operation
    setRequestKey('auth:logout'); clear(); setAuthState('checking')
    try {
      await api.logout(sessionContext)
      if (operation === operationRef.current) setLoginError('')
      await settleAuth(operation)
      return true
    } catch (error) {
      if (operation === operationRef.current) setLoginError(error?.message || 'Não foi possível encerrar a sessão. Tente novamente.')
      if (!Number.isInteger(error?.status)) await settleAuth(operation)
      else if (operation === operationRef.current) setAuthState('anonymous')
      return false
    } finally { releaseAuthRequest(operation) }
  }, [api, clear, isOnline, requestKey, sessionContext, setRequestKey, settleAuth, releaseAuthRequest])
  const changeContext = useCallback(async (scope, businessId) => {
    if (!isOnline || authState !== 'authenticated' || requestKey !== null || credentialChangeRef.current || contextChangeRef.current || !canChangeContext()) return false
    const origin = sessionContext
    const pending = {}
    contextChangeRef.current = pending; setContextChangePending(true)
    let success = false
    try {
      if (scope === 'platform') await api.selectPlatform(origin)
      else await api.selectBusiness(businessId, origin)
      success = true
    } catch (error) { setLoginError(error?.message || 'Não foi possível trocar de empresa.') }
    finally {
      // A response can carry Set-Cookie even when its body or UI owner is lost.
      await refreshSessionRef.current({ broadcast: true, requireContext: true })
      let latest
      do { latest = sessionDiscoveryRef.current; await latest?.promise } while (latest !== sessionDiscoveryRef.current)
      if (contextChangeRef.current === pending) { contextChangeRef.current = null; setContextChangePending(false) }
    }
    return success
  }, [api, authState, canChangeContext, isOnline, requestKey, sessionContext])
  const selectCompany = useCallback(businessId => changeContext('business', businessId), [changeContext])
  const selectAdministration = useCallback(() => changeContext('platform'), [changeContext])
  return { selectBusiness: selectCompany, selectPlatform: selectAdministration, contextChangePending, listBusinesses: () => api.listBusinesses(sessionContext), authState, sessionContext, sessionGeneration, authMode, operationalAccess: sessionHasOperationalAccess(sessionContext), loginError, handleLogin, handleLogout, expireSession, refreshSession, runCredentialChange, credentialChangePending, isCredentialChangePending }
}
