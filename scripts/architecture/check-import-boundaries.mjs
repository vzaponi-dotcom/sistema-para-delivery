import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.mjs'])
const IMPORT_PATTERNS = [
  /\bimport\s+(?:[^'"()]*?\s+from\s+)?['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
]

const posix = (value) => value.split(path.sep).join('/')
const repoRelative = (rootDir, absolutePath) => posix(path.relative(rootDir, absolutePath))

const listSourceFiles = async (directory) => {
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch (error) {
    if (error?.code === 'ENOENT') return []
    throw error
  }
  const files = []
  for (const entry of entries) {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await listSourceFiles(target))
    else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) files.push(target)
  }
  return files
}

const importSpecifiers = (source) => {
  const values = []
  for (const pattern of IMPORT_PATTERNS) {
    pattern.lastIndex = 0
    let match
    while ((match = pattern.exec(source))) values.push(match[1])
  }
  return values
}

const resolveSpecifier = (rootDir, fromAbsolutePath, specifier) => {
  if (!specifier.startsWith('.')) return null
  return repoRelative(rootDir, path.resolve(path.dirname(fromAbsolutePath), specifier))
}

export const collectImportEdges = async (rootDir) => {
  const files = await listSourceFiles(path.join(rootDir, 'src'))
  const edges = []
  for (const absolutePath of files) {
    const source = await readFile(absolutePath, 'utf8')
    for (const specifier of importSpecifiers(source)) {
      edges.push({
        from: repoRelative(rootDir, absolutePath),
        specifier,
        resolvedPath: resolveSpecifier(rootDir, absolutePath, specifier),
      })
    }
  }
  return edges
}

const domainOf = (relativePath) => relativePath?.match(/^src\/domains\/([^/]+)\//)?.[1] ?? null
const isDomainLayer = (relativePath) => /^src\/domains\/[^/]+\/domain\//.test(relativePath)
const isReactSpecifier = (specifier) => specifier === 'react'
  || specifier.startsWith('react/')
  || specifier === 'react-dom'
  || specifier.startsWith('react-dom/')

const exactAllowed = (allowlist, key, value) => Array.isArray(allowlist?.[key]) && allowlist[key].includes(value)

export const findArchitectureViolations = async ({ rootDir, allowlist = {} }) => {
  const edges = await collectImportEdges(rootDir)
  const violations = []

  for (const edge of edges) {
    const fromDomain = domainOf(edge.from)
    const targetDomain = domainOf(edge.resolvedPath)

    if (isDomainLayer(edge.from)) {
      if (isReactSpecifier(edge.specifier)) {
        violations.push(`domain-react: ${edge.from} -> ${edge.specifier}`)
      }
      if (edge.specifier === 'qz-tray') {
        violations.push(`domain-qz: ${edge.from} -> ${edge.specifier}`)
      }
      if (edge.resolvedPath?.startsWith('src/infrastructure/')) {
        violations.push(`domain-infrastructure: ${edge.from} -> ${edge.resolvedPath}`)
      }
      if (/^src\/domains\/[^/]+\/ui\//.test(edge.resolvedPath || '')) {
        violations.push(`domain-ui: ${edge.from} -> ${edge.resolvedPath}`)
      }
    }

    if (edge.from.startsWith('src/shared/') && edge.resolvedPath?.startsWith('src/domains/')) {
      violations.push(`shared-domain: ${edge.from} -> ${edge.resolvedPath}`)
    }

    if (fromDomain && targetDomain && fromDomain !== targetDomain) {
      const publicEntry = `src/domains/${targetDomain}/index.js`
      if (edge.resolvedPath !== publicEntry && !exactAllowed(allowlist, 'crossDomainInternals', `${edge.from} -> ${edge.resolvedPath}`)) {
        violations.push(`cross-domain-internal: ${edge.from} -> ${edge.resolvedPath}`)
      }
    }

    if (edge.specifier === 'qz-tray'
      && !edge.from.startsWith('src/infrastructure/qz/')
      && !exactAllowed(allowlist, 'qzDirectImports', edge.from)) {
      violations.push(`qz-direct: ${edge.from} -> qz-tray`)
    }
  }

  return [...new Set(violations)].sort()
}

const loadDefaultAllowlist = async (rootDir) => {
  const file = path.join(rootDir, 'scripts/architecture/legacy-import-allowlist.json')
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') return {}
    throw error
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
if (isMain) {
  const rootDir = process.cwd()
  const allowlist = await loadDefaultAllowlist(rootDir)
  const violations = await findArchitectureViolations({ rootDir, allowlist })
  if (violations.length) {
    for (const violation of violations) console.error(violation)
    process.exitCode = 1
  } else {
    console.log('Frontend architecture boundaries: OK')
  }
}
