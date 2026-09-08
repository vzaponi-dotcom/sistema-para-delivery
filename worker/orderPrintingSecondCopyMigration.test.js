import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const migration = await readFile(
  new URL('../migrations/0015_print_waiting_second_copy.sql', import.meta.url),
  'utf8',
).catch(() => '')

test('second-copy migration adds the dedicated waiting_second_copy persistence state', () => {
  assert.match(migration, /waiting_second_copy/)
  assert.match(migration, /status TEXT NOT NULL CHECK \(status IN \([^)]*'waiting_second_copy'/)
})

test('second-copy migration upgrades legacy partial printed jobs without losing their progress', () => {
  assert.match(migration, /status = 'printed'/)
  assert.match(migration, /copies_printed > 0/)
  assert.match(migration, /copies_printed < copies_requested/)
  assert.match(migration, /THEN 'waiting_second_copy'/)
})
