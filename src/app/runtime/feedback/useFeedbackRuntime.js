import { useCallback, useEffect, useState } from 'react'

export const TOAST_DISMISS_MS = 2600
export const SUCCESS_DISMISS_MS = 1800

export function useFeedbackRuntime() {
  const [toastMessage, setToastMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    if (!toastMessage) return undefined
    const timer = setTimeout(() => setToastMessage(''), TOAST_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [toastMessage])

  useEffect(() => {
    if (!successMessage) return undefined
    const timer = setTimeout(() => setSuccessMessage(''), SUCCESS_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [successMessage])

  const showSuccessMessage = useCallback((message = 'Ação salva com sucesso') => {
    setSuccessMessage(message)
  }, [])

  return {
    toastMessage,
    successMessage,
    setToastMessage,
    setSuccessMessage,
    showSuccessMessage,
  }
}
