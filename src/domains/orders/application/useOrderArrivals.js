import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { detectOperationalArrivals } from '../domain/orderRealtime.js'
import { createBrowserOrderAlertPlayer } from '../infrastructure/browserOrderAlert.js'

export function useOrderArrivals({
  active,
  orders,
  now,
  currentTiming,
  soundEnabled,
  soundProfile = 'bell',
  soundVolume = 'high',
  playSound,
  highlightDurationMs = 2600,
  setTimeoutFn = globalThis.setTimeout,
  clearTimeoutFn = globalThis.clearTimeout,
}) {
  const player = useMemo(() => createBrowserOrderAlertPlayer(), [])
  const playRef = useRef(playSound || player.play)
  const knownRef = useRef(undefined)
  const alertedRef = useRef(new Set())
  const timerRef = useRef(null)
  const [newOrderIds, setNewOrderIds] = useState(() => new Set())
  useEffect(() => { playRef.current = playSound || player.play }, [playSound, player])

  const reset = useCallback(() => {
    knownRef.current = undefined
    alertedRef.current = new Set()
    if (timerRef.current) clearTimeoutFn(timerRef.current)
    timerRef.current = null
    setNewOrderIds(new Set())
  }, [clearTimeoutFn])

  const previewSound = useCallback((profile = soundProfile, volume = soundVolume) => playRef.current({ profile, volume }), [soundProfile, soundVolume])

  useEffect(() => {
    if (!active) {
      knownRef.current = undefined
      return
    }
    const { currentIds, newIds } = detectOperationalArrivals(knownRef.current, orders, now, alertedRef.current, currentTiming)
    knownRef.current = currentIds
    if (!newIds.length) return
    newIds.forEach((id) => alertedRef.current.add(id))
    setNewOrderIds((current) => new Set([...current, ...newIds]))
    if (soundEnabled) void playRef.current({ profile: soundProfile, volume: soundVolume })
    if (timerRef.current) clearTimeoutFn(timerRef.current)
    timerRef.current = setTimeoutFn(() => {
      setNewOrderIds(new Set())
      timerRef.current = null
    }, highlightDurationMs)
  }, [active, clearTimeoutFn, currentTiming, highlightDurationMs, now, orders, setTimeoutFn, soundEnabled, soundProfile, soundVolume])

  useEffect(() => {
    if (!soundEnabled || !globalThis.window) return undefined
    const unlock = () => { void player.unlock() }
    globalThis.window.addEventListener('pointerdown', unlock, { passive: true })
    globalThis.window.addEventListener('keydown', unlock)
    return () => {
      globalThis.window.removeEventListener('pointerdown', unlock)
      globalThis.window.removeEventListener('keydown', unlock)
    }
  }, [player, soundEnabled])

  useEffect(() => () => {
    if (timerRef.current) clearTimeoutFn(timerRef.current)
    void player.close()
  }, [clearTimeoutFn, player])

  return { newOrderIds, previewSound, reset }
}
