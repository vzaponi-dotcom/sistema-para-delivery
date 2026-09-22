import test from 'node:test'
import assert from 'node:assert/strict'

import { createKitchenDisplayAudio } from './kitchenDisplayAudio.js'

test('audio unlock resumes once and arrival sound uses a short oscillator', async () => {
  const events = []
  const context = {
    state: 'suspended', currentTime: 12,
    resume: async () => { events.push('resume'); context.state = 'running' },
    createGain: () => ({ gain: { setValueAtTime: (value) => events.push(`gain:${value}`) }, connect: () => {} }),
    createOscillator: () => ({ frequency: { setValueAtTime: (value) => events.push(`frequency:${value}`) }, connect: () => {}, start: () => events.push('start'), stop: (at) => events.push(`stop:${at}`) }),
    destination: {},
  }
  const audio = createKitchenDisplayAudio({ createContext: () => context })

  assert.equal(await audio.unlock(), true)
  assert.equal(await audio.playArrival(), true)
  assert.deepEqual(events, ['resume', 'frequency:880', 'gain:0.08', 'start', 'stop:12.16'])
})

test('blocked audio reports fallback without breaking the panel', async () => {
  const audio = createKitchenDisplayAudio({ createContext: () => ({ state: 'suspended', resume: async () => { throw new Error('blocked') } }) })
  assert.equal(await audio.unlock(), false)
  assert.equal(await audio.playArrival(), false)
})
