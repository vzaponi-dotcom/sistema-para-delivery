import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import {
  normalizeReportingQuery,
  patchReportingQuery,
  reportingQueryToSearchParams,
} from '../domain/reportingQuery.js'

export function useReportingSearchParams({ today } = {}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = useMemo(
    () => normalizeReportingQuery(searchParams, { today }),
    [searchParams, today],
  )

  const patchQuery = useCallback((patch, { replace = false } = {}) => {
    const next = patchReportingQuery(query, patch)
    setSearchParams(reportingQueryToSearchParams(next), { replace })
    return next
  }, [query, setSearchParams])

  return { query, patchQuery }
}
