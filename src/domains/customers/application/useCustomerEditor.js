import { useCallback, useState } from 'react'
import { findClientDuplicates } from '../domain/clientDuplicates.js'

const emptyDraft = () => ({ name: '', phone: '', address: '' })

export function useCustomerEditor({
  clients = [],
  canManageClients = false,
  writesBlocked = false,
  createClient = async () => null,
  updateClient = async () => null,
  onDuplicatePhone = () => {},
  onUseExistingClient = () => {},
} = {}) {
  const [draft, setDraft] = useState(emptyDraft)
  const [editingClientId, setEditingClientId] = useState(null)
  const [isOpen, setIsOpen] = useState(false)
  const [duplicateDialog, setDuplicateDialog] = useState(null)

  const reset = useCallback(() => {
    setEditingClientId(null)
    setDraft(emptyDraft())
    setDuplicateDialog(null)
    setIsOpen(false)
  }, [])

  const openNewClient = useCallback(() => {
    if (!canManageClients || writesBlocked) return false
    setDuplicateDialog(null)
    setEditingClientId(null)
    setDraft(emptyDraft())
    setIsOpen(true)
    return true
  }, [canManageClients, writesBlocked])

  const editClient = useCallback((client) => {
    if (!canManageClients || writesBlocked || !client) return false
    setDuplicateDialog(null)
    setEditingClientId(client.id)
    setDraft({ name: client.name, phone: client.phone, address: client.address })
    setIsOpen(true)
    return true
  }, [canManageClients, writesBlocked])

  const updateDraft = useCallback((patch) => {
    setDraft((current) => ({ ...current, ...patch }))
  }, [])

  const payload = useCallback(() => ({
    name: draft.name.trim(),
    phone: draft.phone || '',
    address: draft.address || 'Sem endereço',
  }), [draft])

  const persist = useCallback(async (action) => {
    if (!canManageClients || writesBlocked || !draft.name.trim()) return false
    const nextPayload = payload()
    const client = action === 'update'
      ? await updateClient(editingClientId, nextPayload)
      : await createClient(nextPayload)
    if (!client) return false
    reset()
    return true
  }, [canManageClients, createClient, draft.name, editingClientId, payload, reset, updateClient, writesBlocked])

  const submit = useCallback(async () => {
    if (!canManageClients || writesBlocked || !draft.name.trim()) return false
    const action = editingClientId !== null ? 'update' : 'create'
    const duplicate = findClientDuplicates(clients, draft, editingClientId)

    if (duplicate.phone) {
      onDuplicatePhone('Telefone já cadastrado para ' + duplicate.phone.name + '.')
      return false
    }
    if (duplicate.name) {
      setDuplicateDialog({ client: duplicate.name, action })
      return false
    }
    return persist(action)
  }, [canManageClients, clients, draft, editingClientId, onDuplicatePhone, persist, writesBlocked])

  const dismissDuplicate = useCallback(() => {
    setDuplicateDialog(null)
  }, [])

  const useExistingDuplicate = useCallback(() => {
    const existing = duplicateDialog?.client
    setDuplicateDialog(null)
    if (existing) onUseExistingClient(existing)
    reset()
    return Boolean(existing)
  }, [duplicateDialog, onUseExistingClient, reset])

  const confirmDuplicate = useCallback(async () => {
    const action = duplicateDialog?.action
    setDuplicateDialog(null)
    if (action !== 'create' && action !== 'update') return false
    return persist(action)
  }, [duplicateDialog, persist])

  const cancel = useCallback(() => {
    reset()
    return true
  }, [reset])

  const closeIfEditing = useCallback((clientId) => {
    if (editingClientId !== clientId) return false
    reset()
    return true
  }, [editingClientId, reset])

  return {
    draft,
    editing: editingClientId !== null,
    editingClientId,
    isOpen,
    duplicateDialog,
    openNewClient,
    editClient,
    updateDraft,
    submit,
    dismissDuplicate,
    useExistingDuplicate,
    confirmDuplicate,
    cancel,
    closeIfEditing,
  }
}
