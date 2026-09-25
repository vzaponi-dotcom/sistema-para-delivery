import { useEffect, useRef, useState } from 'react'
import { reportingApi } from '../infrastructure/reportingApi.js'

const noop = () => {}

export function useReportingData({ query, api = reportingApi, onUnauthorized = noop } = {}) {
  const generation = useRef(0)
  const [state, setState] = useState({ data: null, loading: true, error: null })
  useEffect(() => {
    const controller = new AbortController()
    const current = ++generation.current
    setState((previous) => ({ ...previous, loading: true, error: null }))
    void api.load(query.view, query, { signal: controller.signal }).then((response) => {
      if (generation.current === current) setState({ data: response.data, loading: false, error: null })
    }).catch((error) => {
      if (controller.signal.aborted || generation.current !== current) return
      if (error?.status === 401) onUnauthorized(error)
      setState((previous) => ({ ...previous, loading: false, error }))
    })
    return () => controller.abort()
  }, [api, onUnauthorized, query])
  return state
}
