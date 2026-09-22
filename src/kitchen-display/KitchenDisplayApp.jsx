import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { detectOperationalArrivals } from '../domains/orders/index.js'
import { KitchenDisplayHttpError, readKitchenDisplayState } from './kitchenDisplayApi.js'
import { createKitchenDisplayAudio } from './kitchenDisplayAudio.js'
import { bootstrapKitchenDisplay } from './kitchenDisplaySession.js'
import { KitchenDisplayBoard } from './KitchenDisplayBoard.jsx'

const defaultFullscreen = async () => {
  if (document.documentElement?.requestFullscreen) await document.documentElement.requestFullscreen()
}

const isDefinitive = (error) => error?.definitive === true
  || error instanceof KitchenDisplayHttpError && (error.status === 401 || error.status === 403)

export function KitchenDisplayApp({
  bootstrap = bootstrapKitchenDisplay,
  readState = readKitchenDisplayState,
  audio: suppliedAudio,
  requestFullscreen = defaultFullscreen,
  schedule = globalThis.setTimeout,
  cancelSchedule = globalThis.clearTimeout,
}) {
  const audio = useMemo(() => suppliedAudio || createKitchenDisplayAudio(), [suppliedAudio])
  const [phase, setPhase] = useState('loading')
  const [snapshot, setSnapshot] = useState(null)
  const [now, setNow] = useState(() => new Date())
  const [stale, setStale] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  const [highlightedIds, setHighlightedIds] = useState(() => new Set())
  const [soundBlocked, setSoundBlocked] = useState(false)
  const previousIds = useRef(undefined)
  const alertedIds = useRef(new Set())
  const highlightTimers = useRef(new Map())

  const applySnapshot = useCallback(async (next) => {
    const currentNow = new Date(next.serverNow || Date.now())
    const arrival = detectOperationalArrivals(previousIds.current, next.orders || [], currentNow, alertedIds.current, next.timing)
    previousIds.current = arrival.currentIds
    if (arrival.newIds.length) {
      for (const id of arrival.newIds) {
        alertedIds.current.add(id)
        const priorTimer = highlightTimers.current.get(id)
        if (priorTimer) cancelSchedule(priorTimer)
        const timer = schedule(() => {
          highlightTimers.current.delete(id)
          setHighlightedIds((current) => {
            const changed = new Set(current)
            changed.delete(id)
            return changed
          })
        }, 2600)
        highlightTimers.current.set(id, timer)
      }
      setHighlightedIds((current) => new Set([...current, ...arrival.newIds]))
      if (!await audio.playArrival()) setSoundBlocked(true)
    }
    setSnapshot(next)
    setStale(false)
    setLastUpdatedAt(new Date())
  }, [audio, cancelSchedule, schedule])

  useEffect(() => {
    let active = true
    const start = async () => {
      try {
        const initial = await bootstrap()
        if (!active) return
        await applySnapshot(initial)
        if (active) setPhase('start-required')
      } catch (error) {
        if (!active) return
        setSnapshot(null)
        setPhase(error?.pairing ? 'pairing-error' : isDefinitive(error) ? 'unauthorized' : 'pairing-error')
      }
    }
    void start()
    return () => { active = false }
  }, [applySnapshot, bootstrap])

  const refresh = useCallback(async () => {
    try {
      await applySnapshot(await readState())
    } catch (error) {
      if (isDefinitive(error)) {
        previousIds.current = undefined
        setSnapshot(null)
        setStale(false)
        setPhase('unauthorized')
      } else {
        setStale(true)
      }
    }
  }, [applySnapshot, readState])

  useEffect(() => {
    if (phase !== 'live') return undefined
    const tick = globalThis.setInterval(() => setNow(new Date()), 1000)
    const poll = globalThis.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh()
    }, 2000)
    const onOnline = () => void refresh()
    const onFocus = () => void refresh()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      globalThis.clearInterval(tick)
      globalThis.clearInterval(poll)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [phase, refresh])

  useEffect(() => () => {
    for (const timer of highlightTimers.current.values()) cancelSchedule(timer)
    highlightTimers.current.clear()
  }, [cancelSchedule])

  const startPanel = async () => {
    const audioReady = await audio.unlock()
    setSoundBlocked(!audioReady)
    try {
      await requestFullscreen()
    } catch {
      // Fullscreen is an enhancement; the operational panel remains available.
    }
    setPhase('live')
  }

  const enableSound = async () => setSoundBlocked(!await audio.unlock())

  if (phase === 'loading') return <main className="kds-shell"><p>Carregando painel da cozinha…</p></main>
  if (phase === 'pairing-error') return <main className="kds-shell"><h1>Não foi possível configurar esta TV</h1><p>Gere um novo acesso no Gestão Delivery.</p></main>
  if (phase === 'unauthorized') return <main className="kds-shell"><h1>Painel não autorizado</h1><p>Gere um novo acesso no Gestão Delivery.</p></main>
  if (phase === 'start-required') return <main className="kds-shell"><button type="button" onClick={startPanel}>Iniciar painel da cozinha</button></main>

  return <main className="kds-shell kds-shell--live" data-stale={stale}>
    <span className="kds-visually-hidden">Painel da cozinha ativo</span>
    {stale && <p className="kds-last-updated">Dados temporariamente desatualizados{lastUpdatedAt ? ` · última atualização ${lastUpdatedAt.toLocaleTimeString('pt-BR')}` : ''}</p>}
    {soundBlocked && <button className="kds-sound-action" type="button" onClick={enableSound}>Ativar alertas sonoros</button>}
    <KitchenDisplayBoard orders={snapshot?.orders || []} timing={snapshot?.timing} now={now} highlightedIds={highlightedIds} stale={stale} />
  </main>
}
