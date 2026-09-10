import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyQzPrinterStatus, createQzStatusMonitor } from './qzStatusMonitor.js'

test('QZ printer status classification fails closed outside an explicit OK signal', () => {
  assert.deepEqual(classifyQzPrinterStatus({ eventType: 'PRINTER', statusText: 'OK', statusCode: 0 }), {
    state: 'ready', ready: true, statusText: 'OK', statusCode: 0,
  })
  assert.deepEqual(classifyQzPrinterStatus({ eventType: 'PRINTER', statusText: 'Offline', statusCode: 7 }), {
    state: 'printer_offline', ready: false, statusText: 'Offline', statusCode: 7,
  })
  assert.equal(classifyQzPrinterStatus({ eventType: 'PRINTER', statusText: 'Paper out' }).state, 'printer_attention')
  assert.equal(classifyQzPrinterStatus({ eventType: 'PRINTER', severity: 'INFO', statusText: 'Waiting' }).state, 'verifying')
})

const makeQzApi = ({ currentStatus = null } = {}) => {
  const calls = []
  let callback
  return {
    calls,
    emit: (event) => callback(event),
    api: {
      printers: {
        setPrinterCallbacks: (next) => { calls.push('callbacks'); callback = next },
        startListening: async (printerName) => { calls.push(`start:${printerName}`) },
        getStatus: async () => { calls.push('status'); return currentStatus },
        stopListening: async () => { calls.push('stop') },
      },
    },
  }
}

test('QZ status monitor observes the selected printer before listening and resolves only its Gestao Delivery completion', async () => {
  const printerStates = []
  const jobStates = []
  const fake = makeQzApi({ currentStatus: { printerName: 'MPT-II', eventType: 'PRINTER', statusText: 'OK', statusCode: 0 } })
  const monitor = createQzStatusMonitor({
    qzApi: fake.api,
    printerName: 'MPT-II',
    onPrinterStatus: (status) => printerStates.push(status),
    onJobStatus: (status) => jobStates.push(status),
  })

  await monitor.start()
  assert.deepEqual(fake.calls, ['callbacks', 'start:MPT-II', 'status'])
  assert.equal(printerStates[0].state, 'ready')

  const outcome = monitor.awaitJobOutcome('GESTAO-DELIVERY:job-1:COPY:1:ATTEMPT:1')
  fake.emit({ printerName: 'Other', eventType: 'JOB', statusText: 'COMPLETE', jobName: 'GESTAO-DELIVERY:job-1:COPY:1:ATTEMPT:1' })
  fake.emit({ printerName: 'MPT-II', eventType: 'JOB', statusText: 'COMPLETE', jobName: 'external-document' })
  fake.emit({ printerName: 'MPT-II', eventType: 'JOB', statusText: 'SPOOLING', jobName: 'GESTAO-DELIVERY:job-1:COPY:1:ATTEMPT:1', jobId: 17 })
  assert.equal(jobStates.length, 1)
  fake.emit({ printerName: 'MPT-II', eventType: 'JOB', statusText: 'COMPLETE', jobName: 'GESTAO-DELIVERY:job-1:COPY:1:ATTEMPT:1', jobId: 17 })

  assert.deepEqual(await outcome, {
    printerName: 'MPT-II', eventType: 'JOB', statusText: 'COMPLETE', statusCode: null,
    severity: null, jobId: 17, jobName: 'GESTAO-DELIVERY:job-1:COPY:1:ATTEMPT:1',
  })
  await monitor.stop()
  assert.deepEqual(fake.calls, ['callbacks', 'start:MPT-II', 'status', 'stop'])
})

test('QZ status monitor rejects pending outcomes when stopped or when its connection observation is lost', async () => {
  const stopped = makeQzApi()
  const stoppedMonitor = createQzStatusMonitor({ qzApi: stopped.api, printerName: 'MPT-II' })
  await stoppedMonitor.start()
  const stoppedOutcome = stoppedMonitor.awaitJobOutcome('GESTAO-DELIVERY:job-1:COPY:1:ATTEMPT:1')
  await stoppedMonitor.stop()
  await assert.rejects(stoppedOutcome, (error) => error.code === 'QZ_OBSERVATION_LOST')

  const disconnected = makeQzApi()
  const disconnectedMonitor = createQzStatusMonitor({ qzApi: disconnected.api, printerName: 'MPT-II' })
  await disconnectedMonitor.start()
  const disconnectedOutcome = disconnectedMonitor.awaitJobOutcome('GESTAO-DELIVERY:job-2:COPY:1:ATTEMPT:1')
  disconnected.emit({ printerName: 'MPT-II', eventType: 'CONNECTION_LOST', statusText: 'CLOSED' })
  await assert.rejects(disconnectedOutcome, (error) => error.code === 'QZ_OBSERVATION_LOST')
})
