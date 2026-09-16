import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { findArchitectureViolations } from './check-import-boundaries.mjs'

const createFixture = async (t) => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'delivery-architecture-'))
  t.after(() => rm(rootDir, { recursive: true, force: true }))
  const write = async (relativePath, content) => {
    const target = path.join(rootDir, relativePath)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, content)
  }
  return { rootDir, write }
}

test('domain layer cannot import React', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/domains/orders/domain/rules.js', "import React from 'react'\n")
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.some((value) => value.includes('domain-react')))
})

test('shared cannot import domains', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/shared/utils/a.js', "import { x } from '../../domains/orders/index.js'\n")
  await write('src/domains/orders/index.js', 'export const x = 1\n')
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.some((value) => value.includes('shared-domain')))
})

test('cross-domain consumers must use the public index entry point', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/domains/finance/application/internal.js', "import { x } from '../../orders/domain/x.js'\n")
  await write('src/domains/orders/domain/x.js', 'export const x = 1\n')
  let violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.some((value) => value.includes('cross-domain-internal')))

  await write('src/domains/finance/application/internal.js', "import { x } from '../../orders/index.js'\n")
  await write('src/domains/orders/index.js', 'export const x = 1\n')
  violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.equal(violations.some((value) => value.includes('cross-domain-internal')), false)
})

test('direct qz-tray imports require infrastructure/qz or an exact legacy allowance', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/printing/usePrintingManager.js', "import qz from 'qz-tray'\n")
  await write('src/printing/anotherManager.js', "import qz from 'qz-tray'\n")
  const violations = await findArchitectureViolations({
    rootDir,
    allowlist: { qzDirectImports: ['src/printing/usePrintingManager.js'] },
  })
  assert.equal(violations.some((value) => value.includes('usePrintingManager.js') && value.includes('qz-direct')), false)
  assert.ok(violations.some((value) => value.includes('anotherManager.js') && value.includes('qz-direct')))
})
