import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PRINT_QUEUE_STATES,
  canTransitionPrintQueueState,
  getPrintQueueLabel,
  isPrintQueueTerminal,
  resolvePrintQueueState,
} from './printQueue.js'

const {
  QUEUED,
  WAITING_STATION,
  PRINTING,
  WAITING_CONFIRMATION,
  WAITING_SECOND_COPY,
  PRINTED,
  ATTENTION,
  DISCARDED,
} = PRINT_QUEUE_STATES

test('canonical UI states translate current and target backend statuses explicitly', () => {
  assert.equal(resolvePrintQueueState('pending'), QUEUED)
  assert.equal(resolvePrintQueueState('pending', { stationReady: false }), WAITING_STATION)
  assert.equal(resolvePrintQueueState('queued'), QUEUED)
  assert.equal(resolvePrintQueueState('queued', { stationReady: false }), WAITING_STATION)
  assert.equal(resolvePrintQueueState('waiting_station'), WAITING_STATION)
  assert.equal(resolvePrintQueueState('processing'), PRINTING)
  assert.equal(resolvePrintQueueState('awaiting_confirmation'), WAITING_CONFIRMATION)
  assert.equal(resolvePrintQueueState('printing'), PRINTING)
  assert.equal(resolvePrintQueueState('awaiting_second_copy'), WAITING_SECOND_COPY)
  assert.equal(resolvePrintQueueState('waiting_second_copy'), WAITING_SECOND_COPY)
  assert.equal(resolvePrintQueueState('failed'), ATTENTION)
  assert.equal(resolvePrintQueueState('requires_attention'), ATTENTION)
  assert.equal(resolvePrintQueueState('attention'), ATTENTION)
  assert.equal(resolvePrintQueueState('printed'), PRINTED)
  assert.equal(resolvePrintQueueState('discarded'), DISCARDED)
})

test('confirmation-waiting state uses the approved label and transitions', () => {
  assert.equal(getPrintQueueLabel('awaiting_confirmation'), 'Aguardando confirma\u00e7\u00e3o')
  assert.equal(canTransitionPrintQueueState('processing', 'awaiting_confirmation'), true)
  assert.equal(canTransitionPrintQueueState('awaiting_confirmation', 'waiting_second_copy'), true)
  assert.equal(canTransitionPrintQueueState('awaiting_confirmation', 'printed'), true)
  assert.equal(canTransitionPrintQueueState('awaiting_confirmation', 'requires_attention'), true)
})

test('unknown or missing backend states fail safe to attention', () => {
  for (const status of [undefined, null, '', 'mystery']) {
    assert.equal(resolvePrintQueueState(status), ATTENTION)
  }
})

test('queue labels match the approved operational language', () => {
  assert.deepEqual(
    [QUEUED, WAITING_STATION, PRINTING, WAITING_SECOND_COPY, PRINTED, ATTENTION, DISCARDED]
      .map((state) => getPrintQueueLabel(state)),
    ['Na fila', 'Aguardando estação', 'Imprimindo', 'Aguardando 2ª via', 'Impresso', 'Requer atenção', 'Descartado'],
  )
  assert.equal(getPrintQueueLabel('requires_attention'), 'Requer atenção')
})

test('only printed and discarded jobs are terminal', () => {
  assert.equal(isPrintQueueTerminal(PRINTED), true)
  assert.equal(isPrintQueueTerminal(DISCARDED), true)
  for (const state of [QUEUED, WAITING_STATION, PRINTING, WAITING_CONFIRMATION, WAITING_SECOND_COPY, ATTENTION, 'failed', 'requires_attention']) {
    assert.equal(isPrintQueueTerminal(state), false, state)
  }
})

test('state machine accepts only operationally valid transitions', () => {
  const valid = [
    [QUEUED, WAITING_STATION],
    [WAITING_STATION, QUEUED],
    [QUEUED, PRINTING],
    [WAITING_STATION, PRINTING],
    [QUEUED, ATTENTION],
    [WAITING_STATION, ATTENTION],
    [QUEUED, DISCARDED],
    [WAITING_STATION, DISCARDED],
    [PRINTING, WAITING_SECOND_COPY],
    [PRINTING, PRINTED],
    [PRINTING, ATTENTION],
    [WAITING_SECOND_COPY, PRINTING],
    [WAITING_SECOND_COPY, ATTENTION],
    [WAITING_SECOND_COPY, DISCARDED],
    [ATTENTION, QUEUED],
    [ATTENTION, WAITING_STATION],
    [ATTENTION, DISCARDED],
    ['pending', 'processing'],
    ['processing', 'printed'],
    ['failed', 'pending'],
    ['requires_attention', 'discarded'],
  ]
  for (const [from, to] of valid) {
    assert.equal(canTransitionPrintQueueState(from, to), true, `${from} -> ${to}`)
  }

  const invalid = [
    [QUEUED, PRINTED],
    [WAITING_STATION, PRINTED],
    [PRINTING, QUEUED],
    [PRINTING, DISCARDED],
    [WAITING_SECOND_COPY, QUEUED],
    [PRINTED, QUEUED],
    [PRINTED, PRINTING],
    [DISCARDED, QUEUED],
    [ATTENTION, PRINTED],
    ['mystery', PRINTING],
  ]
  for (const [from, to] of invalid) {
    assert.equal(canTransitionPrintQueueState(from, to), false, `${from} -> ${to}`)
  }
})
