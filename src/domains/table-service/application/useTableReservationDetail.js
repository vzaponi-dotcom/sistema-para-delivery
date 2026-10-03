import { useContextApi } from '../../../infrastructure/api/ContextApi.js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { matchesReservationDetail, reservationOwnerKey } from '../domain/tableReservation.js'
import { tableReservationApi, createTableReservationApi } from '../infrastructure/tableReservationApi.js'

const emptySnapshot = Object.freeze({ detail: null, loading: false, error: null })

export function useTableReservationDetail({
  selection,
  officialTables = [],
  api: suppliedApi = tableReservationApi,
  onUnauthorized = () => {},
} = {}) {
  const api = useContextApi(createTableReservationApi, suppliedApi, tableReservationApi)
  const apiRef = useRef(api)
  const onUnauthorizedRef = useRef(onUnauthorized)
  const ownerRef = useRef(null)
  const refreshRef = useRef(async () => false)
  const [snapshot, setSnapshot] = useState(() => reservationOwnerKey(selection)
    ? { detail: null, loading: true, error: null }
    : emptySnapshot)

  apiRef.current = api
  onUnauthorizedRef.current = onUnauthorized

  const loadOwner = useCallback(async (owner) => {
    if (!owner || owner.retired || ownerRef.current !== owner) return false
    if (owner.inFlight) {
      owner.queued = true
      return false
    }
    owner.inFlight = true
    setSnapshot((current) => current.detail
      ? { ...current, error: null }
      : { detail: null, loading: true, error: null })

    try {
      const payload = await apiRef.current.getReservation(owner.reservationId)
      if (owner.retired || ownerRef.current !== owner) return false
      if (!matchesReservationDetail(owner.reservationId, payload)) {
        throw new Error('Reserva indisponível ou alterada. Atualize a consulta.')
      }
      setSnapshot({ detail: payload, loading: false, error: null })
      return true
    } catch (error) {
      if (owner.retired || ownerRef.current !== owner) return false
      setSnapshot((current) => current.detail
        ? { ...current, loading: false, error: null }
        : {
            detail: null,
            loading: false,
            error: error?.message || 'Não foi possível carregar a reserva.',
          })
      if (error?.status === 401) onUnauthorizedRef.current?.(error)
      return false
    } finally {
      owner.inFlight = false
      if (!owner.retired && ownerRef.current === owner && owner.queued) {
        owner.queued = false
        void loadOwner(owner)
      }
    }
  }, [])

  const reservationId = reservationOwnerKey(selection)

  useEffect(() => {
    const previous = ownerRef.current
    if (previous) previous.retired = true

    if (!reservationId) {
      ownerRef.current = null
      refreshRef.current = async () => false
      setSnapshot(emptySnapshot)
      return undefined
    }

    const owner = {
      reservationId,
      inFlight: false,
      queued: false,
      retired: false,
    }
    ownerRef.current = owner
    refreshRef.current = () => loadOwner(owner)
    setSnapshot({ detail: null, loading: true, error: null })

    return () => {
      owner.retired = true
      if (ownerRef.current === owner) ownerRef.current = null
    }
  }, [loadOwner, reservationId])

  useEffect(() => {
    if (!reservationId) return
    void refreshRef.current?.()
  }, [officialTables, reservationId])

  const retry = useCallback(() => refreshRef.current?.() ?? Promise.resolve(false), [])

  return {
    detail: snapshot.detail,
    loading: snapshot.loading,
    error: snapshot.error,
    retry,
  }
}
