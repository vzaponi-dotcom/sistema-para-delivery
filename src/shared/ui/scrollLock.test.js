import test from 'node:test'
import assert from 'node:assert/strict'
import { acquireScrollLock } from './scrollLock.js'

const makeDocument = () => ({
  body: { style: { overflow: '' } },
  documentElement: { style: { overflow: '' } },
})

test('restores body and html scroll after a modal closes normally', () => {
  const documentRef = makeDocument()
  const release = acquireScrollLock(documentRef)

  assert.equal(documentRef.body.style.overflow, 'hidden')
  assert.equal(documentRef.documentElement.style.overflow, 'hidden')

  release()

  assert.equal(documentRef.body.style.overflow, '')
  assert.equal(documentRef.documentElement.style.overflow, '')
})

test('keeps scroll locked until the last nested modal closes', () => {
  const documentRef = makeDocument()
  const releaseMain = acquireScrollLock(documentRef)
  const releaseConfirmation = acquireScrollLock(documentRef)

  releaseMain()

  assert.equal(documentRef.body.style.overflow, 'hidden')
  assert.equal(documentRef.documentElement.style.overflow, 'hidden')

  releaseConfirmation()

  assert.equal(documentRef.body.style.overflow, '')
  assert.equal(documentRef.documentElement.style.overflow, '')
})

test('releases every lock when the second-copy flow completes', () => {
  const documentRef = makeDocument()
  const releaseDetails = acquireScrollLock(documentRef)
  const releaseSecondCopyConfirmation = acquireScrollLock(documentRef)

  releaseSecondCopyConfirmation()
  releaseDetails()

  assert.equal(documentRef.body.style.overflow, '')
  assert.equal(documentRef.documentElement.style.overflow, '')
})

test('releases the confirmation lock when the second-copy flow is cancelled', () => {
  const documentRef = makeDocument()
  const releaseDetails = acquireScrollLock(documentRef)
  const releaseConfirmation = acquireScrollLock(documentRef)

  releaseConfirmation()

  assert.equal(documentRef.body.style.overflow, 'hidden')
  releaseDetails()
  assert.equal(documentRef.body.style.overflow, '')
})

test('cleanup is idempotent when a modal unmounts after it already closed', () => {
  const documentRef = makeDocument()
  const release = acquireScrollLock(documentRef)

  release()
  release()

  assert.equal(documentRef.body.style.overflow, '')
  assert.equal(documentRef.documentElement.style.overflow, '')
})

test('a modal can be reopened with a fresh lock after the previous flow', () => {
  const documentRef = makeDocument()
  const releaseFirst = acquireScrollLock(documentRef)
  releaseFirst()

  const releaseSecond = acquireScrollLock(documentRef)
  assert.equal(documentRef.body.style.overflow, 'hidden')
  assert.equal(documentRef.documentElement.style.overflow, 'hidden')

  releaseSecond()
  assert.equal(documentRef.body.style.overflow, '')
  assert.equal(documentRef.documentElement.style.overflow, '')
})
