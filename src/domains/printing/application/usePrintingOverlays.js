import { useEffect, useRef, useState } from 'react'
import {
  acknowledgeAndOpenSecondCopyPrompt,
  findOriginSecondCopyPrompt,
  getSecondCopyPromptTitle,
  isSecondCopyPromptEligible,
} from '../domain/secondCopy.js'
import {
  canKeepSecondCopyPromptOpen,
  canPresentSecondCopyPrompt,
} from '../domain/printingEligibility.js'
import { readOriginOrderIds } from '../infrastructure/printingLocalPreferences.js'

export const selectSecondCopyPromptCandidate = ({
  jobs = [],
  orders = [],
  station,
  recoveryState = 'normal',
  pausedRecoverySecondCopyJobId = null,
  canPresent = () => true,
} = {}) => {
  const recoveryJobId = station?.recoveryJobId ?? null
  const hasRecoveryAffinity = recoveryState !== 'normal' && Boolean(recoveryJobId)
  if (hasRecoveryAffinity && pausedRecoverySecondCopyJobId === recoveryJobId) return null
  if (recoveryState !== 'normal' && !hasRecoveryAffinity) return null

  const candidates = hasRecoveryAffinity
    ? jobs.filter((job) => job?.id === recoveryJobId)
    : jobs

  return candidates.find((job) => {
    const order = orders.find((candidate) => candidate?.id === job?.orderId)
    return isSecondCopyPromptEligible(job, order) && canPresent(job, order)
  }) ?? null
}

export function usePrintingOverlays({
  printing,
  orders = [],
  authenticated = false,
  canExecutePrinting = false,
  canDiscardPrinting = false,
  onError,
  onSuccess,
} = {}) {
  const jobs = Array.isArray(printing?.jobs) ? printing.jobs : []
  const transportKind = printing?.transportKind
  const transportReady = Boolean(printing?.transportReady)
  const printerBlocked = Boolean(printing?.printerBlocked)
  const localStation = printing?.localStation ?? null
  const recoveryState = printing?.recoveryState ?? 'normal'
  const recoveryPendingCount = Number(printing?.recoveryPendingCount) || 0
  const recoveryPromptEligible = Boolean(printing?.recoveryPromptEligible)
  const physicalPrinterReady = printing?.printerHealth?.state === 'ready'

  const [secondCopyPromptJobId, setSecondCopyPromptJobId] = useState(null)
  const [secondCopyPromptBusy, setSecondCopyPromptBusy] = useState(false)
  const [originSecondCopyPromptJobId, setOriginSecondCopyPromptJobId] = useState(null)
  const [originSecondCopyPromptBusy, setOriginSecondCopyPromptBusy] = useState(false)
  const [recoveryDialogMode, setRecoveryDialogMode] = useState(null)
  const [recoveryBusy, setRecoveryBusy] = useState(false)
  const [recoveryDiscardConfirmation, setRecoveryDiscardConfirmation] = useState(false)

  const dismissedOriginSecondCopyJobIdsRef = useRef(new Set())
  const recoveryPromptSeenRef = useRef(false)
  const pausedRecoverySecondCopyJobIdRef = useRef(null)
  const previousRecoveryStateRef = useRef(null)
  const onErrorRef = useRef(onError)
  const onSuccessRef = useRef(onSuccess)
  onErrorRef.current = onError
  onSuccessRef.current = onSuccess

  const secondCopyPromptJob = jobs.find((job) => job?.id === secondCopyPromptJobId) ?? null
  const secondCopyPromptOrder = orders.find((order) => order?.id === secondCopyPromptJob?.orderId) ?? null
  const secondCopyPromptTitle = getSecondCopyPromptTitle(secondCopyPromptJob, secondCopyPromptOrder)
  const originSecondCopyPromptJob = jobs.find((job) => job?.id === originSecondCopyPromptJobId) ?? null
  const originSecondCopyPromptOrder = orders.find((order) => order?.id === originSecondCopyPromptJob?.orderId) ?? null
  const originSecondCopyPromptTitle = getSecondCopyPromptTitle(originSecondCopyPromptJob, originSecondCopyPromptOrder)

  useEffect(() => {
    if (authenticated) return
    setSecondCopyPromptJobId(null)
    setSecondCopyPromptBusy(false)
    setOriginSecondCopyPromptJobId(null)
    setOriginSecondCopyPromptBusy(false)
    setRecoveryDialogMode(null)
    setRecoveryBusy(false)
    setRecoveryDiscardConfirmation(false)
    dismissedOriginSecondCopyJobIdsRef.current = new Set()
    recoveryPromptSeenRef.current = false
    pausedRecoverySecondCopyJobIdRef.current = null
    previousRecoveryStateRef.current = null
  }, [authenticated])

  useEffect(() => {
    if (!authenticated) return
    const recoveryJobId = localStation?.recoveryJobId ?? null
    const hasRecoveryAffinity = recoveryState !== 'normal' && Boolean(recoveryJobId)
    const resumedRecovery = previousRecoveryStateRef.current === 'deferred' && recoveryState === 'active'
    previousRecoveryStateRef.current = recoveryState
    if (resumedRecovery) pausedRecoverySecondCopyJobIdRef.current = null
    if (recoveryState === 'normal') pausedRecoverySecondCopyJobIdRef.current = null

    if (secondCopyPromptJobId) {
      const current = jobs.find((job) => job?.id === secondCopyPromptJobId)
      const currentOrder = orders.find((order) => order?.id === current?.orderId)
      if (!isSecondCopyPromptEligible(current, currentOrder) || !canKeepSecondCopyPromptOpen({
        isQz: transportKind === 'qz',
        transportReady,
        printerBlocked,
        station: localStation,
        job: current,
      })) setSecondCopyPromptJobId(null)
      return
    }

    const next = selectSecondCopyPromptCandidate({
      jobs,
      orders,
      station: localStation,
      recoveryState,
      pausedRecoverySecondCopyJobId: pausedRecoverySecondCopyJobIdRef.current,
      canPresent: (job) => canPresentSecondCopyPrompt({
        isQz: transportKind === 'qz',
        transportReady,
        printerBlocked,
        station: localStation,
        job,
      }),
    })
    if (!next?.id || typeof printing?.acknowledgeSecondCopyPrompt !== 'function') return

    void acknowledgeAndOpenSecondCopyPrompt({
      job: next,
      acknowledge: printing.acknowledgeSecondCopyPrompt,
      openPrompt: setSecondCopyPromptJobId,
      reopenAcknowledged: hasRecoveryAffinity,
    }).catch((error) => onErrorRef.current?.(error))
  }, [
    authenticated,
    jobs,
    localStation,
    orders,
    printerBlocked,
    printing?.acknowledgeSecondCopyPrompt,
    recoveryState,
    secondCopyPromptJobId,
    transportKind,
    transportReady,
  ])

  useEffect(() => {
    if (!authenticated || !physicalPrinterReady) {
      setRecoveryDialogMode(null)
      setRecoveryDiscardConfirmation(false)
      return
    }
    if (recoveryState === 'normal') {
      recoveryPromptSeenRef.current = false
      setRecoveryDialogMode(null)
      return
    }
    if (recoveryPromptEligible && !recoveryPromptSeenRef.current) {
      recoveryPromptSeenRef.current = true
      setRecoveryDialogMode('prompt')
    }
  }, [authenticated, physicalPrinterReady, recoveryPromptEligible, recoveryState])

  useEffect(() => {
    if (!authenticated || transportKind === 'qz') {
      setOriginSecondCopyPromptJobId(null)
      return
    }
    if (originSecondCopyPromptJobId) {
      const current = jobs.find((job) => job?.id === originSecondCopyPromptJobId)
      const currentOrder = orders.find((order) => order?.id === current?.orderId)
      if (!isSecondCopyPromptEligible(current, currentOrder)) setOriginSecondCopyPromptJobId(null)
      return
    }
    const next = findOriginSecondCopyPrompt({
      jobs,
      orders,
      originOrderIds: readOriginOrderIds(),
      dismissedJobIds: dismissedOriginSecondCopyJobIdsRef.current,
    })
    if (next?.id) setOriginSecondCopyPromptJobId(next.id)
  }, [authenticated, jobs, orders, originSecondCopyPromptJobId, transportKind])

  const dismissSecondCopyPrompt = () => {
    if (recoveryState !== 'normal' && localStation?.recoveryJobId === secondCopyPromptJob?.id) {
      pausedRecoverySecondCopyJobIdRef.current = secondCopyPromptJob.id
      if (recoveryState === 'active') void printing?.deferRecovery?.()
    }
    setSecondCopyPromptJobId(null)
  }

  const handleGlobalSecondCopy = async () => {
    if (!canExecutePrinting || !secondCopyPromptJob || secondCopyPromptBusy) return false
    if (!canKeepSecondCopyPromptOpen({
      isQz: transportKind === 'qz',
      transportReady,
      printerBlocked,
      station: localStation,
      job: secondCopyPromptJob,
    })) {
      setSecondCopyPromptJobId(null)
      return false
    }
    const isRecoverySecondCopy = recoveryState !== 'normal'
      && localStation?.recoveryJobId === secondCopyPromptJob.id
    setSecondCopyPromptBusy(true)
    try {
      const result = await printing.printSecondCopy(secondCopyPromptJob)
      if (result?.status !== 'printed') {
        setSecondCopyPromptJobId(null)
        return false
      }
      pausedRecoverySecondCopyJobIdRef.current = null
      setSecondCopyPromptJobId(null)
      if (isRecoverySecondCopy) setRecoveryDialogMode('progress')
      onSuccessRef.current?.('2ª via enviada para impressão')
      return true
    } catch (error) {
      setSecondCopyPromptJobId(null)
      onErrorRef.current?.(error)
      return false
    } finally {
      setSecondCopyPromptBusy(false)
    }
  }

  const handleStartRecovery = async () => {
    if (!canExecutePrinting || recoveryBusy || !physicalPrinterReady) return false
    setRecoveryBusy(true)
    try {
      const result = await printing.startRecovery()
      setRecoveryDialogMode(result?.status === 'printed' && result?.job?.status !== 'awaiting_second_copy' ? 'progress' : null)
      return result
    } catch (error) {
      setRecoveryDialogMode(null)
      onErrorRef.current?.(error)
      return false
    } finally {
      setRecoveryBusy(false)
    }
  }

  const handleDeferRecovery = async () => {
    if (recoveryBusy) return false
    setRecoveryDialogMode(null)
    setRecoveryBusy(true)
    try {
      await printing.deferRecovery()
      return true
    } catch (error) {
      onErrorRef.current?.(error)
      return false
    } finally {
      setRecoveryBusy(false)
    }
  }

  const handleNextRecovery = async () => {
    if (recoveryBusy || !physicalPrinterReady) return false
    setRecoveryBusy(true)
    try {
      pausedRecoverySecondCopyJobIdRef.current = null
      await printing.resumeRecovery()
      const result = await printing.printNextRecovery()
      setRecoveryDialogMode(result?.status === 'printed' && result?.job?.status !== 'awaiting_second_copy' ? 'progress' : null)
      return result
    } catch (error) {
      setRecoveryDialogMode(null)
      onErrorRef.current?.(error)
      return false
    } finally {
      setRecoveryBusy(false)
    }
  }

  const handleDiscardRecoveryBacklog = async () => {
    if (!canDiscardPrinting || recoveryBusy || !physicalPrinterReady) return false
    setRecoveryBusy(true)
    try {
      await printing.discardRecoveryBacklog()
      setRecoveryDiscardConfirmation(false)
      setRecoveryDialogMode(null)
      return true
    } catch (error) {
      onErrorRef.current?.(error)
      return false
    } finally {
      setRecoveryBusy(false)
    }
  }

  const openRecoveryDiscardConfirmation = () => {
    if (!canDiscardPrinting || recoveryBusy) return false
    setRecoveryDialogMode(null)
    setRecoveryDiscardConfirmation(true)
    return true
  }

  const dismissOriginSecondCopyPrompt = () => {
    if (originSecondCopyPromptJob?.id) dismissedOriginSecondCopyJobIdsRef.current.add(originSecondCopyPromptJob.id)
    setOriginSecondCopyPromptJobId(null)
  }

  const handleOriginSecondCopyRequest = async () => {
    if (!canExecutePrinting || !originSecondCopyPromptJob || originSecondCopyPromptBusy) return false
    setOriginSecondCopyPromptBusy(true)
    try {
      await printing.requestSecondCopy(originSecondCopyPromptJob)
      setOriginSecondCopyPromptJobId(null)
      onSuccessRef.current?.('2ª via enviada para a fila da cozinha')
      return true
    } catch (error) {
      onErrorRef.current?.(error)
      return false
    } finally {
      setOriginSecondCopyPromptBusy(false)
    }
  }

  return {
    physicalPrinterReady,
    recoveryPromptEligible,
    recoveryPendingCount,
    recoveryState,
    recoveryDialogMode,
    recoveryBusy,
    recoveryDiscardConfirmation,
    dismissRecoveryDiscardConfirmation: () => setRecoveryDiscardConfirmation(false),
    openRecoveryDiscardConfirmation,
    secondCopyPromptJob,
    secondCopyPromptTitle,
    secondCopyPromptBusy,
    originSecondCopyPromptJob,
    originSecondCopyPromptTitle,
    originSecondCopyPromptBusy,
    dismissSecondCopyPrompt,
    handleGlobalSecondCopy,
    handleStartRecovery,
    handleDeferRecovery,
    handleNextRecovery,
    handleDiscardRecoveryBacklog,
    dismissOriginSecondCopyPrompt,
    handleOriginSecondCopyRequest,
  }
}
