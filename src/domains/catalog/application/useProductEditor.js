import { useCallback, useState } from 'react'
import {
  createProductDraft,
  productPayloadFromDraft,
  productToDraft,
} from '../domain/productDraft.js'

export function useProductEditor({
  createProduct,
  updateProduct,
  writesBlocked = false,
  canManageProducts = false,
} = {}) {
  const [editingId, setEditingId] = useState(null)
  const [isOpen, setOpen] = useState(false)
  const [draft, replaceDraft] = useState(createProductDraft)

  const cancel = useCallback(() => {
    setEditingId(null)
    replaceDraft(createProductDraft())
    setOpen(false)
  }, [])

  const openNewProduct = useCallback(() => {
    if (!canManageProducts || writesBlocked) return false
    setEditingId(null)
    replaceDraft(createProductDraft())
    setOpen(true)
    return true
  }, [canManageProducts, writesBlocked])

  const editProduct = useCallback((product) => {
    if (!canManageProducts || writesBlocked) return false
    setEditingId(product.id)
    replaceDraft(productToDraft(product))
    setOpen(true)
    return true
  }, [canManageProducts, writesBlocked])

  const submit = useCallback(async () => {
    if (!canManageProducts || writesBlocked || !draft.name.trim()) return false
    const result = editingId !== null
      ? await updateProduct(editingId, productPayloadFromDraft(draft))
      : await createProduct(productPayloadFromDraft(draft))
    if (!result) return false
    cancel()
    return true
  }, [canManageProducts, cancel, createProduct, draft, editingId, updateProduct, writesBlocked])

  const closeIfEditing = useCallback((productId) => {
    if (editingId !== productId) return false
    cancel()
    return true
  }, [cancel, editingId])

  return {
    isOpen,
    editing: editingId !== null,
    draft,
    replaceDraft,
    openNewProduct,
    editProduct,
    submit,
    cancel,
    closeIfEditing,
  }
}
