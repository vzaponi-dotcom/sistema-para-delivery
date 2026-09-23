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
    return await import('./app/shell/theme/theme.js')
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
  const main = source('./admin/AdminBootstrap.jsx')
  const initializeIndex = main.indexOf('initializeTheme()')
  const renderIndex = main.indexOf('createRoot(')

  assert.match(main, /from ['"]\.\.\/app\/shell\/theme\/theme\.js['"]/)
  assert.match(main, /ThemeProvider/)
  assert.ok(initializeIndex >= 0, 'main should initialize the stored theme')
  assert.ok(renderIndex > initializeIndex, 'theme should initialize before React renders')
})

test('global provider exposes persistent Claro Escuro and Automático controls', () => {
  const provider = optionalSource('./app/shell/theme/ThemeProvider.jsx')
  const settings = source('./app/surfaces/settings/local/DevicePreferences.jsx')

  assert.match(provider, /themePreference/)
  assert.match(provider, /saveThemePreference/)
  assert.match(provider, /matchMedia\(['"]\(prefers-color-scheme: dark\)['"]\)/)
  assert.match(settings, /Claro/)
  assert.match(settings, /Escuro/)
  assert.match(settings, /Automático/)
  assert.match(settings, /aria-label="Tema do sistema"/)
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

test('printing settings consume the shared semantic palette in both themes', () => {
  const themeCss = source('./index.css')
  const printingCss = source('./domains/printing/ui/printing.css')

  for (const token of ['surface', 'surface-soft', 'text', 'muted', 'border', 'primary', 'success', 'success-soft', 'danger', 'danger-soft', 'info', 'info-soft']) {
    assert.match(themeCss, new RegExp(`--${token}:`))
  }

  for (const token of ['surface', 'surface-soft', 'text', 'muted', 'border', 'primary']) {
    assert.match(printingCss, new RegExp(`var\\(--${token}\\)`))
  }
  assert.doesNotMatch(printingCss, /var\(--[^,]+,\s*#[0-9a-f]{3,8}\)/i)
})

test('light kitchen palette follows the selected light theme while dark keeps Ticket clássico', () => {
  const css = source('./index.css')
  const lightMatch = css.match(/:root\s*\{([\s\S]*?)\n\}/)
  const darkMatch = css.match(/:root\[data-theme=['"]dark['"]\]\s*\{([\s\S]*?)\n\}/)

  assert.ok(lightMatch, 'light root palette should exist')
  assert.ok(darkMatch, 'dark root palette should exist')

  const light = lightMatch[1]
  const dark = darkMatch[1]

  assert.match(light, /--kitchen-bg:\s*var\(--bg\);/)
  assert.match(light, /--kitchen-panel:\s*var\(--surface-soft\);/)
  assert.match(light, /--kitchen-ticket:\s*var\(--surface\);/)
  assert.match(light, /--kitchen-ticket-text:\s*var\(--text\);/)
  assert.match(light, /--kitchen-ticket-muted:\s*var\(--muted\);/)
  assert.match(light, /--kitchen-preparing:\s*var\(--warning\);/)
  assert.match(light, /--kitchen-scheduled:\s*var\(--info\);/)
  assert.match(light, /--kitchen-late:\s*var\(--danger\);/)
  assert.match(light, /--kitchen-finished:\s*var\(--success\);/)

  assert.match(dark, /--kitchen-bg:\s*#1b1817;/i)
  assert.match(dark, /--kitchen-panel:\s*#24201e;/i)
  assert.match(dark, /--kitchen-ticket:\s*#fffaf7;/i)
})

test('kitchen board text colors remain readable when light surfaces replace the dark board', () => {
  const themeCss = source('./index.css')
  const contrastCss = optionalSource('./kitchen-theme-contrast.css')
  const lightMatch = themeCss.match(/:root\s*\{([\s\S]*?)\n\}/)
  const darkMatch = themeCss.match(/:root\[data-theme=['"]dark['"]\]\s*\{([\s\S]*?)\n\}/)

  assert.ok(lightMatch, 'light root palette should exist')
  assert.ok(darkMatch, 'dark root palette should exist')
  assert.ok(contrastCss, 'kitchen contrast layer should exist')

  const light = lightMatch[1]
  const dark = darkMatch[1]

  assert.match(themeCss, /@import ['"]\.\/kitchen-theme-contrast\.css['"];/)
  assert.match(light, /--kitchen-board-text:\s*var\(--text\);/)
  assert.match(light, /--kitchen-board-muted:\s*var\(--muted\);/)
  assert.match(dark, /--kitchen-board-text:\s*var\(--kitchen-ticket\);/)
  assert.match(dark, /--kitchen-board-muted:\s*color-mix\(in srgb,\s*var\(--kitchen-ticket\) 60%,\s*var\(--kitchen-panel\)\);/)

  for (const className of [
    'page-header h1',
    'page-description',
    'kitchen-header-actions',
    'kitchen-stat-card',
    'toolbar-count',
    'kitchen-queue-heading',
    'kitchen-queue-help',
    'kitchen-queue-empty',
  ]) {
    assert.match(contrastCss, new RegExp(className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }

  assert.ok((contrastCss.match(/var\(--kitchen-board-text\)/g) || []).length >= 6)
  assert.ok((contrastCss.match(/var\(--kitchen-board-muted\)/g) || []).length >= 5)
})

test('dark login brand uses semantic foreground colors without changing shared logo defaults', () => {
  const css = source('./theme.css')
  const brand = source('./app/shell/BrandLogo.jsx')

  assert.match(css, /\[data-theme=['"]dark['"]\]\s+\.login-brand\s+text:first-of-type\s*\{[^}]*fill:\s*var\(--text\);[^}]*\}/s)
  assert.match(css, /\[data-theme=['"]dark['"]\]\s+\.login-brand\s+text:last-of-type\s*\{[^}]*fill:\s*var\(--muted\);[^}]*\}/s)
  assert.match(brand, /fill=['"]#25211f['"]/i)
  assert.match(brand, /fill=['"]#716863['"]/i)
})


test('visual theme preference persists independently from light dark and system', async () => {
  const theme = await loadThemeModule()
  assert.ok(theme, 'theme utility should exist')

  const values = new Map()
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }

  assert.equal(theme.VISUAL_THEME_STORAGE_KEY, 'delivery-visual-theme')
  assert.equal(theme.normalizeVisualTheme('classic'), 'classic')
  assert.equal(theme.normalizeVisualTheme('mesiva'), 'mesiva')
  assert.equal(theme.normalizeVisualTheme('invalid'), 'classic')
  assert.equal(theme.readVisualTheme(storage), 'classic')
  assert.equal(theme.saveVisualTheme('mesiva', storage), 'mesiva')
  assert.equal(theme.readVisualTheme(storage), 'mesiva')
  assert.equal(theme.saveVisualTheme('invalid', storage), 'classic')
})

test('visual theme application updates the root without changing color scheme preference', async () => {
  const theme = await loadThemeModule()
  assert.ok(theme, 'theme utility should exist')

  const root = { dataset: {}, style: { colorScheme: 'dark' } }
  assert.equal(theme.applyVisualTheme('mesiva', { root }), 'mesiva')
  assert.equal(root.dataset.visualTheme, 'mesiva')
  assert.equal(root.style.colorScheme, 'dark')
  assert.equal(theme.applyVisualTheme('invalid', { root }), 'classic')
  assert.equal(root.dataset.visualTheme, 'classic')
})

test('global provider exposes a local Classic or Mesiva visual theme selector', () => {
  const provider = optionalSource('./app/shell/theme/ThemeProvider.jsx')
  const settings = source('./app/surfaces/settings/local/DevicePreferences.jsx')

  assert.match(provider, /visualTheme/)
  assert.match(provider, /saveVisualTheme/)
  assert.match(settings, /Clássico/)
  assert.match(settings, /Mesiva/)
  assert.match(settings, /aria-label="Estilo visual"/)
})

test('Mesiva palette follows the official v1.0 brand colors and keeps semantic states separate', () => {
  const css = source('./index.css')
  const lightMatch = css.match(/:root\[data-visual-theme=['"]mesiva['"]\]\s*\{([\s\S]*?)\n\}/)
  const darkMatch = css.match(/:root\[data-theme=['"]dark['"]\]\[data-visual-theme=['"]mesiva['"]\]\s*\{([\s\S]*?)\n\}/)

  assert.ok(lightMatch, 'Mesiva light palette should exist')
  assert.ok(darkMatch, 'Mesiva dark palette should exist')

  const light = lightMatch[1]
  const dark = darkMatch[1]
  assert.match(light, /--brand:\s*#14b8a6;/i)
  assert.match(light, /--primary:\s*#0f2747;/i)
  assert.match(light, /--primary-fill:\s*#14b8a6;/i)
  assert.match(light, /--text:\s*#0f2747;/i)
  assert.match(light, /--primary-soft:\s*#dff7f1;/i)
  assert.match(light, /--accent:\s*#fbbf24;/i)
  assert.match(light, /--bg:\s*#f8fafc;/i)
  assert.match(light, /--surface:\s*#ffffff;/i)
  assert.match(light, /--primary-contrast:\s*#0f2747;/i)
  assert.doesNotMatch(light, /--success:\s*#14b8a6;/i)
  assert.doesNotMatch(light, /--warning:\s*#fbbf24;/i)
  assert.match(dark, /--primary:\s*#2dd4bf;/i)
  assert.match(dark, /--primary-fill:\s*#2dd4bf;/i)
  assert.match(dark, /--primary-contrast:\s*#0f2747;/i)
  assert.match(dark, /--kitchen-bg:\s*var\(--bg\);/i)
  assert.match(dark, /--kitchen-ticket:\s*#f8fafc;/i)
})
