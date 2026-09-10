import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const readBadge = () => readFile(new URL('./PrintStatusBadge.jsx', import.meta.url), 'utf8')

test('print badges name confirmed copies as printed and keep confirmation waiting explicit', async () => {
  const badge = await readBadge()

  assert.match(badge, /printed:\s*'Impresso'/)
  assert.match(badge, /awaiting_confirmation:\s*'Aguardando confirmação'/)
})
