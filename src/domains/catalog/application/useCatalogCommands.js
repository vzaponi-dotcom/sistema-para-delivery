import { useMutationOwner } from '../../../app/runtime/session/useMutationOwner.js'
import { useCallback } from 'react'
import { catalogApi } from '../infrastructure/catalogApi.js'

export function useCatalogCommands({
  api = catalogApi,
  applyOfficialEffects = () => {},
  writesBlocked = false,
  canManageProducts = false,
  setRequestKey = () => {},
  onSuccess = () => {},
  onError = () => {},
} = {}) {
  const ownsMutation = useMutationOwner(applyOfficialEffects)
  const createProduct = useCallback(async (payload) => {
    if (!canManageProducts || writesBlocked) return null
    setRequestKey('product:create')
    try {
      const { product } = await api.createProduct(payload)
      if (!ownsMutation()) return false

      if (applyOfficialEffects({ product }) === false) return false
      onSuccess('Produto adicionado com sucesso')
      return product ?? null
    } catch (error) {
      if (!ownsMutation()) return false
      onError(error)
      return null
    } finally {
      if (ownsMutation()) setRequestKey(null)
    }
  }, [ownsMutation, api, applyOfficialEffects, canManageProducts, onError, onSuccess, setRequestKey, writesBlocked])

  const updateProduct = useCallback(async (productId, payload) => {
    if (!canManageProducts || writesBlocked) return null
    setRequestKey(`product:update:${productId}`)
    try {
      const { product } = await api.updateProduct(productId, payload)
      if (!ownsMutation()) return false

      if (applyOfficialEffects({ product }) === false) return false
      onSuccess('Produto atualizado com sucesso')
      return product ?? null
    } catch (error) {
      if (!ownsMutation()) return false
      onError(error)
      return null
    } finally {
      if (ownsMutation()) setRequestKey(null)
    }
  }, [ownsMutation, api, applyOfficialEffects, canManageProducts, onError, onSuccess, setRequestKey, writesBlocked])

  const deleteProduct = useCallback(async (productId) => {
    if (!canManageProducts || writesBlocked) return false
    setRequestKey(`product:delete:${productId}`)
    try {
      await api.deleteProduct(productId)
      if (!ownsMutation()) return false

      if (applyOfficialEffects({ deletedProductId: productId }) === false) return false
      onSuccess('Produto excluído com sucesso')
      return true
    } catch (error) {
      if (!ownsMutation()) return false
      onError(error)
      return false
    } finally {
      if (ownsMutation()) setRequestKey(null)
    }
  }, [ownsMutation, api, applyOfficialEffects, canManageProducts, onError, onSuccess, setRequestKey, writesBlocked])

  return { createProduct, updateProduct, deleteProduct }
}
