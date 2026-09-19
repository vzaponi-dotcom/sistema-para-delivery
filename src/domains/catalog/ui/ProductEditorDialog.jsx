import Modal from '../../../components/Modal'
import ProductForm from './ProductForm.jsx'

export default function ProductEditorDialog({ editor, writesBlocked }) {
  if (!editor.isOpen) return null
  return (
    <Modal title={editor.editing ? 'Editar produto' : 'Novo produto'} onClose={editor.cancel}>
      <ProductForm
        value={editor.draft}
        onChange={editor.replaceDraft}
        onSubmit={editor.submit}
        onCancel={editor.cancel}
        disabled={writesBlocked}
        editing={editor.editing}
      />
    </Modal>
  )
}
