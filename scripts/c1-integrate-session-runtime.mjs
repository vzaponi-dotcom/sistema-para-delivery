import fs from 'node:fs'

const path = new URL('../src/App.jsx', import.meta.url)
let source = fs.readFileSync(path, 'utf8')

const replaceOnce = (before, after, label) => {
  const first = source.indexOf(before)
  if (first === -1) throw new Error(`Missing integration anchor: ${label}`)
  if (source.indexOf(before, first + before.length) !== -1) throw new Error(`Duplicate integration anchor: ${label}`)
  source = `${source.slice(0, first)}${after}${source.slice(first + before.length)}`
}

replaceOnce(
  "import { useOnlineStatus } from './app/runtime/network/useOnlineStatus.js'\n",
  "import { useOnlineStatus } from './app/runtime/network/useOnlineStatus.js'\nimport { useSessionRuntime } from './app/runtime/session/useSessionRuntime.js'\n",
  'session runtime import',
)

for (const line of [
  '  getSession as getSessionApi,\n',
  '  login as loginApi,\n',
  '  logout as logoutApi,\n',
]) replaceOnce(line, '', `legacy auth import ${line.trim()}`)

replaceOnce(
  "  const [authState, setAuthState] = useState('checking')\n  const [sessionKey, setSessionKey] = useState(0)\n  const [sessionContext, setSessionContext] = useState(null)\n  const [requestKey, setRequestKey] = useState(null)\n  const [loginError, setLoginError] = useState('')\n",
  "  const [requestKey, setRequestKey] = useState(null)\n",
  'legacy session state',
)

replaceOnce(
  "  const operationalBridgeTargetsRef = useRef({ onUnauthorized: null, settlePaymentOwners: null, onTablesCommitted: null })\n\n  const invalidateNewOrderDraft = useCallback(() => {",
  "  const operationalBridgeTargetsRef = useRef({ onUnauthorized: null, settlePaymentOwners: null, onTablesCommitted: null })\n  const sessionRuntimeTargetsRef = useRef({\n    refreshBootstrap: async () => {},\n    resetOperationalData: () => {},\n    clearApplicationState: () => {},\n  })\n\n  const invalidateNewOrderDraft = useCallback(() => {",
  'session runtime target ref',
)

replaceOnce(
  "  const invalidateNewOrderDraft = useCallback(() => {\n    newOrderOwnerRef.current += 1\n    setCheckoutKey(null)\n    setNewOrderContext({ tableId: '', expectedTableTabId: '', returnTab: 'orders', owner: null })\n    setNewOrderDirty(false)\n  }, [])\n\n  const granted = useMemo(",
  "  const invalidateNewOrderDraft = useCallback(() => {\n    newOrderOwnerRef.current += 1\n    setCheckoutKey(null)\n    setNewOrderContext({ tableId: '', expectedTableTabId: '', returnTab: 'orders', owner: null })\n    setNewOrderDirty(false)\n  }, [])\n\n  const refreshBootstrapForSession = useCallback(\n    (...args) => sessionRuntimeTargetsRef.current.refreshBootstrap(...args),\n    [],\n  )\n  const resetOperationalDataForSession = useCallback(\n    (...args) => sessionRuntimeTargetsRef.current.resetOperationalData(...args),\n    [],\n  )\n  const clearApplicationStateForSession = useCallback(\n    (...args) => sessionRuntimeTargetsRef.current.clearApplicationState(...args),\n    [],\n  )\n  const {\n    authState,\n    sessionContext,\n    sessionGeneration,\n    loginError,\n    handleLogin,\n    handleLogout: handleSessionLogout,\n    expireSession,\n  } = useSessionRuntime({\n    isOnline,\n    requestKey,\n    setRequestKey,\n    resetOperationalData: resetOperationalDataForSession,\n    refreshBootstrap: refreshBootstrapForSession,\n    onClearApplicationState: clearApplicationStateForSession,\n  })\n\n  const granted = useMemo(",
  'session runtime hook wiring',
)

replaceOnce(
  "  } = useOperationalDataRuntime({\n    onUnauthorized: handleOperationalUnauthorized,\n    globalSyncEnabled: isOnline && authState === 'authenticated',\n    ordersSyncEnabled: activeTab === 'orders' && isOnline && authState === 'authenticated',\n    effectiveConfigVersion: getEffectiveConfigVersion,\n    legacyBridges: operationalLegacyBridges,\n  })\n\n  const effectiveConfigOwner = useMemo(",
  "  } = useOperationalDataRuntime({\n    onUnauthorized: handleOperationalUnauthorized,\n    globalSyncEnabled: isOnline && authState === 'authenticated',\n    ordersSyncEnabled: activeTab === 'orders' && isOnline && authState === 'authenticated',\n    effectiveConfigVersion: getEffectiveConfigVersion,\n    legacyBridges: operationalLegacyBridges,\n  })\n  // Session bootstrap/cleanup needs operational actions, while operational polling\n  // needs auth state. Stable render-time targets break that hook-order cycle without\n  // moving either responsibility back into App.\n  sessionRuntimeTargetsRef.current.refreshBootstrap = refreshBootstrap\n  sessionRuntimeTargetsRef.current.resetOperationalData = resetOperationalData\n\n  const effectiveConfigOwner = useMemo(",
  'operational targets for session runtime',
)

replaceOnce('        generation: sessionKey,\n', '        generation: sessionGeneration,\n', 'effective config generation')
replaceOnce(
  '    : null, [authState, granted, sessionContext, sessionKey])\n',
  '    : null, [authState, granted, sessionContext, sessionGeneration])\n',
  'effective config generation dependency',
)

replaceOnce(
  '    effectiveConfigVersionRef.current = null\n    resetOperationalData()\n  }\n',
  '    effectiveConfigVersionRef.current = null\n  }\n',
  'App-only sync reset',
)
replaceOnce('    setSessionContext(null)\n', '', 'legacy session context cleanup')
replaceOnce(
  '  }\n\n  const ownsPaymentSelection = (owner) => owner?.guard === getSyncGuard()\n',
  '  }\n  sessionRuntimeTargetsRef.current.clearApplicationState = clearBusinessData\n\n  const ownsPaymentSelection = (owner) => owner?.guard === getSyncGuard()\n',
  'application cleanup target',
)

replaceOnce(
  "  const expireSession = () => {\n    setSessionKey((current) => current + 1); clearBusinessData(); setAuthState('anonymous'); setRequestKey(null); setLoginError('Sua sessão expirou. Entre novamente.')\n  }\n",
  '',
  'legacy expiry handler',
)

replaceOnce(
  "  const showApiError = (error) => {\n    if (error?.status === 401) return expireSession()\n    setToastMessage(error?.message || 'Não foi possível concluir a operação.')\n  }\n",
  "  const showApiError = (error) => {\n    if (error?.status === 401) return expireSession()\n    setToastMessage(error?.message || 'Não foi possível concluir a operação.')\n  }\n  const handleLogout = async () => {\n    try { await handleSessionLogout() } catch (error) { showApiError(error) }\n  }\n",
  'logout feedback wrapper',
)

replaceOnce(
  "  useEffect(() => {\n    let cancelled = false\n    const initialize = async () => {\n      try {\n        const session = await getSessionApi()\n        if (cancelled) return\n        if (!session?.authenticated) return setAuthState('anonymous')\n        setSessionContext(session); setSessionKey((current) => current + 1); setAuthState('authenticated')\n        if (!cancelled) await refreshBootstrap()\n      } catch { if (!cancelled) { setAuthState('anonymous'); resetOperationalData() } }\n    }\n    void initialize(); return () => { cancelled = true }\n  }, [])\n\n",
  '',
  'legacy session bootstrap effect',
)

replaceOnce(
  "  const handleLogin = async (pin) => {\n    if (!isOnline || requestKey) return\n    setRequestKey('auth:login'); setLoginError('')\n    try { const session = await loginApi(pin); resetSyncState(); setSessionContext({ authenticated: true, ...session }); setSessionKey((current) => current + 1); setAuthState('authenticated'); await refreshBootstrap() } catch (error) { clearBusinessData(); setAuthState('anonymous'); setLoginError(error?.code === 'INVALID_PIN' ? 'PIN inválido. Confira e tente novamente.' : (error?.message || 'Não foi possível entrar no sistema.')) } finally { setRequestKey(null) }\n  }\n  const handleLogout = async () => { if (writesBlocked) return; setRequestKey('auth:logout'); try { await logoutApi(); setSessionKey((current) => current + 1); clearBusinessData(); setAuthState('anonymous'); setLoginError('') } catch (error) { showApiError(error) } finally { setRequestKey(null) } }\n\n",
  '',
  'legacy login/logout handlers',
)

for (const forbidden of [
  'getSessionApi',
  'loginApi',
  'logoutApi',
  'setAuthState',
  'setSessionContext',
  'setSessionKey',
  'setLoginError',
  'sessionKey',
]) {
  if (source.includes(forbidden)) throw new Error(`Legacy session token remains: ${forbidden}`)
}
for (const required of [
  "useSessionRuntime({",
  'sessionGeneration',
  'handleLogout: handleSessionLogout',
  'sessionRuntimeTargetsRef.current.refreshBootstrap = refreshBootstrap',
  'sessionRuntimeTargetsRef.current.resetOperationalData = resetOperationalData',
  'sessionRuntimeTargetsRef.current.clearApplicationState = clearBusinessData',
  'operationalBridgeTargetsRef.current.onUnauthorized = expireSession',
]) {
  if (!source.includes(required)) throw new Error(`Required session integration token missing: ${required}`)
}

fs.writeFileSync(path, source)
