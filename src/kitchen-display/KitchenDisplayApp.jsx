import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { detectOperationalArrivals } from '../domains/orders/index.js'
import {
  KITCHEN_ALERT_PROFILES,
  KITCHEN_ALERT_VOLUME_OPTIONS,
  TV_KITCHEN_ALERT_DEFAULTS,
} from '../shared/utils/kitchenAlertCatalog.js'
import {
  readKitchenSoundProfilePreference,
  readKitchenSoundVolumePreference,
  writeKitchenSoundProfilePreference,
  writeKitchenSoundVolumePreference,
} from '../infrastructure/storage/kitchenSoundPreference.js'
import { KitchenDisplayHttpError } from './kitchenDisplayApi.js'
import { createKitchenDisplayAudio } from './kitchenDisplayAudio.js'
import { isKitchenDisplayFullscreen, requestKitchenDisplayFullscreen } from './kitchenDisplayFullscreen.js'
import { bootstrapKitchenDisplay, pollKitchenDisplayPairing, readStoredKitchenDisplayState } from './kitchenDisplaySession.js'
import { KitchenDisplayBoard } from './KitchenDisplayBoard.jsx'

const isDefinitive = (error) => error?.definitive === true
  || error instanceof KitchenDisplayHttpError && (error.status === 401 || error.status === 403)

const formatPairingCode = (value) => {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 6)
  return digits.length > 3 ? `${digits.slice(0, 3)} ${digits.slice(3)}` : digits
}

export function KitchenDisplayApp({
  bootstrap = bootstrapKitchenDisplay,
  pollPairing = pollKitchenDisplayPairing,
  readState = readStoredKitchenDisplayState,
  audio: suppliedAudio,
  schedule = globalThis.setTimeout,
  cancelSchedule = globalThis.clearTimeout,
  requestFullscreen = requestKitchenDisplayFullscreen,
}) {
  const audio = useMemo(() => suppliedAudio || createKitchenDisplayAudio(), [suppliedAudio])
  const [phase, setPhase] = useState('loading')
  const [pairing, setPairing] = useState(null)
  const [snapshot, setSnapshot] = useState(null)
  const [now, setNow] = useState(() => new Date())
  const [stale, setStale] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  const [highlightedIds, setHighlightedIds] = useState(() => new Set())
  const [soundProfile, setSoundProfile] = useState(() => readKitchenSoundProfilePreference(undefined, TV_KITCHEN_ALERT_DEFAULTS.profile))
  const [soundVolume, setSoundVolume] = useState(() => readKitchenSoundVolumePreference(undefined, TV_KITCHEN_ALERT_DEFAULTS.volume))
  const [soundBlocked, setSoundBlocked] = useState(false)
  const [soundPreferenceError, setSoundPreferenceError] = useState('')
  const [compatibilityError, setCompatibilityError] = useState('')
  const [fullscreenRecoveryNeeded, setFullscreenRecoveryNeeded] = useState(false)
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
      if (!await audio.playArrival({ profile: soundProfile, volume: soundVolume })) setSoundBlocked(true)
    }
    setSnapshot(next)
    setStale(false)
    setLastUpdatedAt(new Date())
  }, [audio, cancelSchedule, schedule, soundProfile, soundVolume])

  const prepareStartPanel = useCallback((next) => {
    setSnapshot(next)
    setStale(false)
    setLastUpdatedAt(new Date())
    setCompatibilityError('')
    setPhase('start-required')
  }, [])

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
        await prepareStartPanel(initial.state)
      } catch {
        if (!active) return
        setSnapshot(null)
        setPhase('pairing-error')
      }
    }
    void start()
    return () => { active = false }
  }, [bootstrap, prepareStartPanel])

  useEffect(() => {
    if (phase !== 'pairing') return undefined
    let checking = false
    const check = async () => {
      if (checking) return
      checking = true
      try {
        const next = await pollPairing()
        if (next?.kind === 'paired') {
          await prepareStartPanel(next.state)
          setPairing(null)
        } else if (next?.kind === 'pairing') {
          setPairing(next.pairing)
        }
      } catch (error) {
        if (error?.activationFailure) {
          const suffix = error.status ? `_${error.status}` : ''
          setCompatibilityError(`KDS_SESSION_ACTIVATION${suffix}: ${error.message}`)
          setPairing(null)
          setPhase('compatibility-error')
        }
        // Other transient failures keep the current code visible and retry it.
      } finally {
        checking = false
      }
    }
    const poll = globalThis.setInterval(() => void check(), 2000)
    return () => globalThis.clearInterval(poll)
  }, [phase, pollPairing, prepareStartPanel])

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

  useEffect(() => {
    if (phase !== 'live') return undefined
    const onFullscreenChange = () => setFullscreenRecoveryNeeded(!isKitchenDisplayFullscreen())
    document.addEventListener('fullscreenchange', onFullscreenChange)
    document.addEventListener('webkitfullscreenchange', onFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange)
    }
  }, [phase])


  const startPanel = async () => {
    let fullscreenAttempt
    try {
      fullscreenAttempt = requestFullscreen()
    } catch {
      setFullscreenRecoveryNeeded(true)
    }

    let unlockAttempt
    try {
      unlockAttempt = audio.unlock()
    } catch {
      setSoundBlocked(true)
    }

    setPhase('starting')
    try {
      await applySnapshot(snapshot || { orders: [], timing: undefined, serverNow: new Date().toISOString() })
      setPhase('live')
    } catch (error) {
      const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error || 'KDS_COMPAT_RUNTIME')
      setCompatibilityError(detail)
      setPhase('compatibility-error')
    }

    if (fullscreenAttempt) {
      void Promise.resolve(fullscreenAttempt)
        .then((entered) => setFullscreenRecoveryNeeded(!entered))
        .catch(() => setFullscreenRecoveryNeeded(true))
    } else {
      setFullscreenRecoveryNeeded(true)
    }

    if (unlockAttempt) {
      void Promise.resolve(unlockAttempt)
        .then((ready) => setSoundBlocked(!ready))
        .catch(() => setSoundBlocked(true))
    }
  }

  const enterFullscreen = async () => {
    try {
      setFullscreenRecoveryNeeded(!await requestFullscreen())
    } catch {
      setFullscreenRecoveryNeeded(true)
    }
  }

  const changeSoundProfile = (value) => {
    setSoundProfile(value)
    try {
      writeKitchenSoundProfilePreference(value)
      setSoundPreferenceError('')
    } catch {
      setSoundPreferenceError('A escolha vale nesta sessão, mas não pôde ser salva nesta TV.')
    }
  }

  const changeSoundVolume = (value) => {
    setSoundVolume(value)
    try {
      writeKitchenSoundVolumePreference(value)
      setSoundPreferenceError('')
    } catch {
      setSoundPreferenceError('A escolha vale nesta sessão, mas não pôde ser salva nesta TV.')
    }
  }

  const previewSound = async () => {
    try {
      const play = audio.preview || audio.playArrival
      const played = await play({ profile: soundProfile, volume: soundVolume })
      setSoundBlocked(!played)
      return played
    } catch {
      setSoundBlocked(true)
      return false
    }
  }

  const enableSound = async () => setSoundBlocked(!await audio.unlock())

  if (phase === 'loading') return <main className="kds-shell"><p>Preparando esta TV…</p></main>
  if (phase === 'pairing-error') return <main className="kds-shell"><section className="kds-pairing-card"><h1>Não foi possível preparar o pareamento</h1><p>Atualize esta página para gerar um novo código.</p></section></main>
  if (phase === 'pairing') return <main className="kds-shell">
    <section className="kds-pairing-card" aria-label="Pareamento da TV da cozinha">
      <p className="kds-pairing-kicker">Mesiva</p>
      <h1>Conectar esta TV</h1>
      <p>Abra <strong>Configurações → TV da Cozinha</strong> no celular e digite o código abaixo.</p>
      <strong className="kds-pairing-code" aria-label={`Código de pareamento ${pairing?.code || ''}`}>{formatPairingCode(pairing?.code)}</strong>
      <p className="kds-pairing-help">O código é temporário e válido por até 30 minutos. Esta tela continuará automaticamente quando a conexão for autorizada.</p>
    </section>
  </main>
  if (phase === 'unauthorized') return <main className="kds-shell"><section className="kds-pairing-card"><h1>Painel não autorizado</h1><p>Atualize a página para conectar esta TV novamente.</p></section></main>
  if (phase === 'start-required') return <main className="kds-shell">
    <section className="kds-pairing-card kds-start-card">
      <p className="kds-pairing-kicker">Mesiva</p>
      <h1>Painel da cozinha pronto</h1>
      <p>Escolha um alerta audível para esta TV e depois inicie o painel.</p>

      <div className="kds-sound-setup">
        <label className="kds-sound-select">
          <span>Toque do alerta</span>
          <select
            aria-label="Toque do alerta da TV"
            value={soundProfile}
            onChange={(event) => changeSoundProfile(event.target.value)}
          >
            {KITCHEN_ALERT_PROFILES.map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}
          </select>
        </label>

        <div className="kds-sound-volume">
          <span>Volume</span>
          <div className="kds-sound-volume-options" role="group" aria-label="Volume do alerta da TV">
            {KITCHEN_ALERT_VOLUME_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={soundVolume === option.id}
                onClick={() => changeSoundVolume(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <button className="kds-sound-preview-button" type="button" onClick={previewSound}>Ouvir alerta</button>
        {soundPreferenceError && <small className="kds-sound-preference-error">{soundPreferenceError}</small>}
        {soundBlocked && <small className="kds-sound-preference-error">A TV bloqueou o áudio. Tente novamente pelo botão Ouvir alerta.</small>}
      </div>

      <button type="button" onClick={startPanel}>Iniciar painel da cozinha</button>
    </section>
  </main>
  if (phase === 'starting') return <main className="kds-shell">
    <section className="kds-pairing-card"><p className="kds-pairing-kicker">Mesiva</p><h1>Preparando o painel…</h1></section>
  </main>
  if (phase === 'compatibility-error') return <main className="kds-shell">
    <section className="kds-pairing-card">
      <p className="kds-pairing-kicker">Compatibilidade da TV</p>
      <h1>Não foi possível preparar os pedidos nesta TV</h1>
      <p>Atualize esta página e tente novamente. Se continuar, informe o código abaixo ao suporte.</p>
      <small className="kds-compatibility-detail">{compatibilityError || 'KDS_COMPAT_RUNTIME'}</small>
      <button type="button" onClick={() => window.location.reload()}>Tentar novamente</button>
    </section>
  </main>

  return <main className="kds-shell kds-shell--live" data-stale={stale}>
    <span className="kds-visually-hidden">Painel da cozinha ativo</span>
    {stale && <p className="kds-last-updated">Dados temporariamente desatualizados{lastUpdatedAt ? ` · última atualização ${lastUpdatedAt.toLocaleTimeString('pt-BR')}` : ''}</p>}
    {fullscreenRecoveryNeeded && <button className="kds-fullscreen-action" type="button" onClick={enterFullscreen}>Entrar em tela cheia</button>}
    {soundBlocked && <button className="kds-sound-action" type="button" onClick={enableSound}>Ativar alertas sonoros</button>}
    <KitchenDisplayBoard orders={snapshot?.orders || []} timing={snapshot?.timing} now={now} highlightedIds={highlightedIds} stale={stale} />
  </main>
}
