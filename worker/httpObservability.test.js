import test from 'node:test'
import assert from 'node:assert/strict'
import { handleError } from './http.js'

test('handleError logs internal message and stack for 500 responses', () => {
  const originalConsoleError = console.error
  const calls = []
  console.error = (...args) => calls.push(args)

  try {
    const error = new Error('D1_ERROR: diagnostic detail')
    error.stack = 'Error: D1_ERROR: diagnostic detail\n    at loadBootstrap (worker/repositories.js:1:1)'

    const response = handleError(error)

    assert.equal(response.status, 500)
    assert.equal(calls.length, 1)
    assert.equal(calls[0][0], 'Worker error')
    assert.equal(calls[0][1].message, 'D1_ERROR: diagnostic detail')
    assert.match(calls[0][1].stack, /loadBootstrap/)
  } finally {
    console.error = originalConsoleError
  }
})

test('handleError keeps internal 500 details out of the HTTP response', async () => {
  const originalConsoleError = console.error
  console.error = () => {}

  try {
    const response = handleError(new Error('D1_ERROR: secret diagnostic detail'))
    const payload = await response.json()

    assert.equal(response.status, 500)
    assert.deepEqual(payload, {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Não foi possível concluir a operação.',
      },
    })
  } finally {
    console.error = originalConsoleError
  }
})
