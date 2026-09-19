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
  const createProduct = useCallback(async (payload) => {
    if (!canManageProducts || writesBlocked) return null
    setRequestKey('product:create')
    try {
      const { product } = await api.createProduct(payload)
      applyOfficialEffects({ product })
      onSuccess('Produto adicionado com sucesso')
      return product ?? null
    } catch (error) {
      onError(error)
      return null
    } finally {
      setRequestKey(null)
    }
  }, [api, applyOfficialEffects, canManageProducts, onError, onSuccess, setRequestKey, writesBlocked])

  const updateProduct = useCallback(async (productId, payload) => {
    if (!canManageProducts || writesBlocked) return null
    setRequestKey(`product:update:${productId}`)
    try {
      const { product } = await api.updateProduct(productId, payload)
      applyOfficialEffects({ product })
      onSuccess('Produto atualizado com sucesso')
      return product ?? null
    } catch (error) {
      onError(error)
      return null
    } finally {
      setRequestKey(null)
    }
  }, [api, applyOfficialEffects, canManageProducts, onError, onSuccess, setRequestKey, writesBlocked])

  const deleteProduct = useCallback(async (productId) => {
    if (!canManageProducts || writesBlocked) return false
    setRequestKey(`product:delete:${productId}`)
    try {
      await api.deleteProduct(productId)
      applyOfficialEffects({ deletedProductId: productId })
      onSuccess('Produto excluído com sucesso')
      return true
    } catch (error) {
      onError(error)
      return false
    } finally {
      setRequestKey(null)
    }
  }, [api, applyOfficialEffects, canManageProducts, onError, onSuccess, setRequestKey, writesBlocked])

  return { createProduct, updateProduct, deleteProduct }
}
