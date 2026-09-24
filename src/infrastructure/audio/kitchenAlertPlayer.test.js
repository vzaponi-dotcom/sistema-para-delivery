import test from 'node:test'
import assert from 'node:assert/strict'
import { createKitchenAlertPlayer } from './kitchenAlertPlayer.js'

function fakeAudioContext({ state = 'running', resumeFails = false } = {}) {
  const starts = []
  const gains = []
  const oscillators = []
  const context = {
    state,
    currentTime: 10,
    destination: {},
    async resume() {
      if (resumeFails) throw new Error('blocked')
      this.state = 'running'
    },
    async close() {
      this.state = 'closed'
    },
    createOscillator() {
      const oscillator = {
        type: 'sine',
        frequency: { setValueAtTime(value, at) { oscillator.frequencyValue = value; oscillator.frequencyAt = at } },
        connect() {},
        start(at) { starts.push(at) },
        stop(at) { oscillator.stopAt = at },
      }
      oscillators.push(oscillator)
      return oscillator
    },
    createGain() {
      const events = []
      const gain = {
        gain: {
          setValueAtTime(value, at) { events.push(['set', value, at]) },
          exponentialRampToValueAtTime(value, at) { events.push(['ramp', value, at]) },
        },
        connect() {},
      }
      gains.push(events)
      return gain
    },
  }
  return { context, starts, gains, oscillators }
}

test('shared player schedules the selected multi-tone profile', async () => {
  const fake = fakeAudioContext()
  const player = createKitchenAlertPlayer({ createContext: () => fake.context })
  assert.equal(await player.play({ profile: 'kitchen-strong', volume: 'max' }), true)
  assert.ok(fake.starts.length >= 3)
  assert.ok(fake.oscillators.every((oscillator) => oscillator.stopAt > 10))
})

test('shared player applies volume scaling and safe fallbacks without throwing', async () => {
  const normal = fakeAudioContext()
  const loud = fakeAudioContext()
  const normalPlayer = createKitchenAlertPlayer({ createContext: () => normal.context })
  const loudPlayer = createKitchenAlertPlayer({ createContext: () => loud.context })

  assert.equal(await normalPlayer.play({ profile: 'bell', volume: 'normal' }), true)
  assert.equal(await loudPlayer.play({ profile: 'not-real', volume: 'max' }), true)

  const normalPeak = Math.max(...normal.gains.flat().map((event) => event[1]))
  const loudPeak = Math.max(...loud.gains.flat().map((event) => event[1]))
  assert.ok(loudPeak > normalPeak)
})

test('shared player fails closed when audio is unavailable or blocked', async () => {
  assert.equal(await createKitchenAlertPlayer({ createContext: () => null }).play(), false)
  const blocked = fakeAudioContext({ state: 'suspended', resumeFails: true })
  assert.equal(await createKitchenAlertPlayer({ createContext: () => blocked.context }).play(), false)
})
