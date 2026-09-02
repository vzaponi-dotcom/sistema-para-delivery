import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8')
const optionalSource = (relativePath) => {
  try {
    return source(relativePath)
  } catch {
    return ''
  }
}

const loadThemeModule = async () => {
  try {
    return await import('./utils/theme.js')
  } catch {
    return null
  }
}

test('theme preferences resolve light dark and system modes', async () => {
  const theme = await loadThemeModule()
  assert.ok(theme, 'theme utility should exist')

  assert.equal(theme.normalizeThemePreference('light'), 'light')
  assert.equal(theme.normalizeThemePreference('dark'), 'dark')
  assert.equal(theme.normalizeThemePreference('system'), 'system')
  assert.equal(theme.normalizeThemePreference('invalid'), 'system')
  assert.equal(theme.resolveTheme('light', true), 'light')
  assert.equal(theme.resolveTheme('dark', false), 'dark')
  assert.equal(theme.resolveTheme('system', true), 'dark')
  assert.equal(theme.resolveTheme('system', false), 'light')
})

test('theme preference persists safely in browser storage', async () => {
  const theme = await loadThemeModule()
  assert.ok(theme, 'theme utility should exist')

  const values = new Map()
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }

  assert.equal(theme.readThemePreference(storage), 'system')
  theme.saveThemePreference('dark', storage)
  assert.equal(theme.readThemePreference(storage), 'dark')
  theme.saveThemePreference('invalid', storage)
  assert.equal(theme.readThemePreference(storage), 'system')
})

test('theme application updates the root theme and browser color scheme', async () => {
  const theme = await loadThemeModule()
  assert.ok(theme, 'theme utility should exist')

  const root = { dataset: {}, style: {} }
  assert.equal(theme.applyThemePreference('system', { root, prefersDark: true }), 'dark')
  assert.equal(root.dataset.theme, 'dark')
  assert.equal(root.style.colorScheme, 'dark')

  assert.equal(theme.applyThemePreference('light', { root, prefersDark: true }), 'light')
  assert.equal(root.dataset.theme, 'light')
  assert.equal(root.style.colorScheme, 'light')
})

test('theme is initialized before the React app renders', () => {
  const main = source('./main.jsx')
  const initializeIndex = main.indexOf('initializeTheme()')
  const renderIndex = main.indexOf('createRoot(')

  assert.match(main, /from ['"]\.\/utils\/theme\.js['"]/)
  assert.match(main, /ThemeProvider/)
  assert.ok(initializeIndex >= 0, 'main should initialize the stored theme')
  assert.ok(renderIndex > initializeIndex, 'theme should initialize before React renders')
})

test('global provider exposes persistent Claro Escuro and Automático controls', () => {
  const provider = optionalSource('./components/ThemeProvider.jsx')
  const sidebar = source('./components/Sidebar.jsx')

  assert.match(provider, /themePreference/)
  assert.match(provider, /saveThemePreference/)
  assert.match(provider, /matchMedia\(['"]\(prefers-color-scheme: dark\)['"]\)/)
  assert.match(sidebar, /Claro/)
  assert.match(sidebar, /Escuro/)
  assert.match(sidebar, /Automático/)
  assert.match(sidebar, /aria-label=['"]Tema/)
})

test('dark theme defines a complete global palette', () => {
  const css = source('./index.css')

  assert.match(css, /\[data-theme=['"]dark['"]\]/)
  assert.match(css, /--bg:\s*#[0-9a-f]{6}/i)
  assert.match(css, /--surface:\s*#[0-9a-f]{6}/i)
  assert.match(css, /--text:\s*#[0-9a-f]{6}/i)
  assert.match(css, /--border:\s*#[0-9a-f]{6}/i)
  assert.match(css, /--primary-soft:\s*#[0-9a-f]{6}/i)
})
