import { useEffect, useRef, useState } from 'react'
import { reportingApi } from '../infrastructure/reportingApi.js'

const noop = () => {}
const emptyState = (view = null) => ({
  view,
  data: null,
  comparison: null,
  quality: null,
  warnings: [],
  generatedAt: null,
  timezone: null,
  normalizedQuery: null,
  loading: true,
  error: null,
})

export function useReportingData({ query, api = reportingApi, onUnauthorized = noop } = {}) {
  const generation = useRef(0)
  const [state, setState] = useState(() => emptyState(query?.view))
  useEffect(() => {
    const controller = new AbortController()
    const current = ++generation.current
    setState((previous) => previous.view === query.view
      ? { ...previous, loading: true, error: null }
      : emptyState(query.view))
    void api.load(query.view, query, { signal: controller.signal }).then((response) => {
      if (!controller.signal.aborted && generation.current === current) setState({
        view: query.view,
        data: response.data,
        comparison: response.comparison ?? null,
        quality: response.quality ?? null,
        warnings: response.warnings ?? [],
        generatedAt: response.generatedAt ?? null,
        timezone: response.timezone ?? null,
        normalizedQuery: response.normalizedQuery ?? null,
        loading: false,
        error: null,
      })
    }).catch((error) => {
      if (controller.signal.aborted || generation.current !== current) return
      if (error?.status === 401) onUnauthorized(error)
      setState((previous) => previous.view === query.view
        ? { ...previous, loading: false, error }
        : { ...emptyState(query.view), loading: false, error })
    })
    return () => controller.abort()
  }, [api, onUnauthorized, query])
  return state.view === query?.view ? state : emptyState(query?.view)
}
