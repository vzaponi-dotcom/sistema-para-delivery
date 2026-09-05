import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8')

test('kitchen visual primitives expose the approved icon and StatCard contracts', () => {
  const icon = read('./components/Icon.jsx')
  const statCard = read('./components/StatCard.jsx')
  const packageJson = read('../package.json')
  const iconNames = ['kitchen', 'preparation', 'clock', 'alert', 'client', 'delivery', 'pickup', 'local', 'note', 'details', 'printer', 'volume-on', 'volume-off', 'cancel']

  const iconMap = icon.match(/const icons = \{([\s\S]*?)\n\}/)?.[1] ?? ''
  for (const name of iconNames) assert.match(iconMap, new RegExp(`(?:['"]${name.replace('-', '\\-')}['"]|${name.replace('-', '\\-')}):`))
  assert.match(icon, /strokeWidth="1\.8"/)
  assert.match(icon, /strokeLinecap="round"/)
  assert.match(icon, /strokeLinejoin="round"/)
  assert.doesNotMatch(packageJson, /lucide|heroicons|react-icons|@fortawesome/)
  assert.match(statCard, /function StatCard\(\{[^}]*className\s*=\s*['"]['"]/)
  const classes = statCard.match(/const classes = \[([^\]]+)\]/)?.[1] ?? ''
  assert.match(classes, /className/)
  assert.match(statCard, /<article\s+className=\{classes\}/)
})
