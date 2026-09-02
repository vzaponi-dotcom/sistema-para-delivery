import { createPortal } from 'react-dom'
import Icon from './Icon'

function Modal({ title, onClose, children, footer }) {
  const content = (
    <div className="modal-backdrop" data-navigation-swipe-block="true" onMouseDown={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="icon-button icon-button-neutral" aria-label="Fechar" onClick={onClose}>
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content
}

export default Modal
