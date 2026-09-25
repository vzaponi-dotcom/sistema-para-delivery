import test from 'node:test'
import assert from 'node:assert/strict'

import { createKitchenDisplayAudio } from './kitchenDisplayAudio.js'

const createContext = ({ blocked = false } = {}) => {
  const events = []
  const context = {
    state: 'suspended',
    currentTime: 12,
    destination: {},
    resume: async () => {
      events.push('resume')
      if (blocked) throw new Error('blocked')
      context.state = 'running'
    },
    createGain: () => ({
      gain: {
        setValueAtTime: (value) => events.push(`gain-set:${value}`),
        exponentialRampToValueAtTime: (value) => events.push(`gain-ramp:${value}`),
      },
      connect: () => {},
    }),
    createOscillator: () => ({
      frequency: { setValueAtTime: (value) => events.push(`frequency:${value}`) },
      connect: () => {},
      start: () => events.push('start'),
      stop: (at) => events.push(`stop:${at}`),
    }),
  }
  return { context, events }
}

test('Kitchen TV audio defaults to the strong multi-tone profile and can preview another profile', async () => {
  const fake = createContext()
  const audio = createKitchenDisplayAudio({ createContext: () => fake.context })

  assert.equal(await audio.unlock(), true)
  assert.equal(await audio.playArrival(), true)
  assert.ok(fake.events.filter((event) => event === 'start').length >= 3)
  assert.ok(fake.events.includes('frequency:720'))
  assert.equal(await audio.preview({ profile: 'classic', volume: 'normal' }), true)
})

test('blocked audio reports fallback without breaking the panel', async () => {
  const fake = createContext({ blocked: true })
  const audio = createKitchenDisplayAudio({ createContext: () => fake.context })
  assert.equal(await audio.unlock(), false)
  assert.equal(await audio.playArrival(), false)
})
