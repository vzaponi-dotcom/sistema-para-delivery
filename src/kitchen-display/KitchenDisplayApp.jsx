import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { detectOperationalArrivals } from '../domains/orders/index.js'
import { KitchenDisplayHttpError, readKitchenDisplayState } from './kitchenDisplayApi.js'
import { createKitchenDisplayAudio } from './kitchenDisplayAudio.js'
import { bootstrapKitchenDisplay, pollKitchenDisplayPairing } from './kitchenDisplaySession.js'
import { KitchenDisplayBoard } from './KitchenDisplayBoard.jsx'

const defaultFullscreen = async () => {
  if (document.documentElement?.requestFullscreen) await document.documentElement.requestFullscreen()
}

const isDefinitive = (error) => error?.definitive === true
  || error instanceof KitchenDisplayHttpError && (error.status === 401 || error.status === 403)

const formatPairingCode = (value) => {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 6)
  return digits.length > 3 ? `${digits.slice(0, 3)} ${digits.slice(3)}` : digits
}

export function KitchenDisplayApp({
  bootstrap = bootstrapKitchenDisplay,
  pollPairing = pollKitchenDisplayPairing,
  readState = readKitchenDisplayState,
  audio: suppliedAudio,
  requestFullscreen = defaultFullscreen,
  schedule = globalThis.setTimeout,
  cancelSchedule = globalThis.clearTimeout,
}) {
  const audio = useMemo(() => suppliedAudio || createKitchenDisplayAudio(), [suppliedAudio])
  const [phase, setPhase] = useState('loading')
  const [pairing, setPairing] = useState(null)
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
        if (initial?.kind === 'pairing') {
          setPairing(initial.pairing)
          setPhase('pairing')
          return
        }
        await applySnapshot(initial.state)
        if (active) setPhase('start-required')
      } catch {
        if (!active) return
        setSnapshot(null)
        setPhase('pairing-error')
      }
    }
    void start()
    return () => { active = false }
  }, [applySnapshot, bootstrap])

  useEffect(() => {
    if (phase !== 'pairing') return undefined
    let checking = false
    const check = async () => {
      if (checking) return
      checking = true
      try {
        const next = await pollPairing()
        if (next?.kind === 'paired') {
          await applySnapshot(next.state)
          setPairing(null)
          setPhase('start-required')
        } else if (next?.kind === 'pairing') {
          setPairing(next.pairing)
        }
      } catch {
        // Keep the current code visible on transient failures. The next poll retries
        // the same request instead of generating a new code.
      } finally {
        checking = false
      }
    }
    const poll = globalThis.setInterval(() => void check(), 2000)
    return () => globalThis.clearInterval(poll)
  }, [applySnapshot, phase, pollPairing])

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

  if (phase === 'loading') return <main className="kds-shell"><p>Preparando esta TV…</p></main>
  if (phase === 'pairing-error') return <main className="kds-shell"><section className="kds-pairing-card"><h1>Não foi possível preparar o pareamento</h1><p>Atualize esta página para gerar um novo código.</p></section></main>
  if (phase === 'pairing') return <main className="kds-shell">
    <section className="kds-pairing-card" aria-label="Pareamento da TV da cozinha">
      <p className="kds-pairing-kicker">Gestão Delivery</p>
      <h1>Conectar esta TV</h1>
      <p>Abra <strong>Configurações → TV da Cozinha</strong> no celular e digite o código abaixo.</p>
      <strong className="kds-pairing-code" aria-label={`Código de pareamento ${pairing?.code || ''}`}>{formatPairingCode(pairing?.code)}</strong>
      <p className="kds-pairing-help">O código é temporário e válido por até 30 minutos. Esta tela continuará automaticamente quando a conexão for autorizada.</p>
    </section>
  </main>
  if (phase === 'unauthorized') return <main className="kds-shell"><section className="kds-pairing-card"><h1>Painel não autorizado</h1><p>Atualize a página para conectar esta TV novamente.</p></section></main>
  if (phase === 'start-required') return <main className="kds-shell"><button type="button" onClick={startPanel}>Iniciar painel da cozinha</button></main>

  return <main className="kds-shell kds-shell--live" data-stale={stale}>
    <span className="kds-visually-hidden">Painel da cozinha ativo</span>
    {stale && <p className="kds-last-updated">Dados temporariamente desatualizados{lastUpdatedAt ? ` · última atualização ${lastUpdatedAt.toLocaleTimeString('pt-BR')}` : ''}</p>}
    {soundBlocked && <button className="kds-sound-action" type="button" onClick={enableSound}>Ativar alertas sonoros</button>}
    <KitchenDisplayBoard orders={snapshot?.orders || []} timing={snapshot?.timing} now={now} highlightedIds={highlightedIds} stale={stale} />
  </main>
}
