import { useEffect, useRef, useState } from 'react'
import { reportingApi } from '../infrastructure/reportingApi.js'

const noop = () => {}

export function useReportingData({ query, api = reportingApi, onUnauthorized = noop } = {}) {
  const generation = useRef(0)
  const [state, setState] = useState({ data: null, comparison: null, quality: null, warnings: [], generatedAt: null, timezone: null, normalizedQuery: null, loading: true, error: null })
  useEffect(() => {
    const controller = new AbortController()
    const current = ++generation.current
    setState((previous) => ({ ...previous, loading: true, error: null }))
    void api.load(query.view, query, { signal: controller.signal }).then((response) => {
      if (!controller.signal.aborted && generation.current === current) setState({ data: response.data, comparison: response.comparison ?? null, quality: response.quality ?? null, warnings: response.warnings ?? [], generatedAt: response.generatedAt ?? null, timezone: response.timezone ?? null, normalizedQuery: response.normalizedQuery ?? null, loading: false, error: null })
    }).catch((error) => {
      if (controller.signal.aborted || generation.current !== current) return
      if (error?.status === 401) onUnauthorized(error)
      setState((previous) => ({ ...previous, loading: false, error }))
    })
    return () => controller.abort()
  }, [api, onUnauthorized, query])
  return state
}
