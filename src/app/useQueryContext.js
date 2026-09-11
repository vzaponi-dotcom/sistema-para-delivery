import { useCallback, useRef, useState } from 'react'
import { createQueryContext, patchQueryContext } from './queryContext.js'

export function useQueryContext() {
  const [query, setQuery] = useState(createQueryContext)
  const [generation, setGeneration] = useState(0)
  const generationRef = useRef(0)

  const patchQuery = useCallback((page, patch) => {
    if (generation !== generationRef.current) return
    setQuery((current) => patchQueryContext(current, page, patch))
  }, [generation])

  const resetQueries = useCallback(() => {
    generationRef.current += 1
    setGeneration(generationRef.current)
    setQuery(createQueryContext())
  }, [])

  return { query, patchQuery, resetQueries }
}
