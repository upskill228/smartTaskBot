import '../styles/Modal.css'
import { useEffect } from 'react'

function Modal({
  isOpen,
  title,
  message,
  onClose,
  onConfirm,
  confirmLabel = 'Eliminar',
  isConfirming = false,
}) {
  useEffect(() => {
    if (!isOpen) {
      return
    }
// Adicionar listener para a tecla Escape para fechar o modal
    function handleEscape(event) {
      if (event.key === 'Escape' && !isConfirming) {
        onClose()
      }
    }
// Adicionar o event listener quando o modal abrir e remover quando fechar ou quando isConfirming mudar.
    window.addEventListener('keydown', handleEscape)
    
// Cleanup do event listener para evitar memory leaks
    return () => {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, isConfirming, onClose])

  if (!isOpen) {
    return null
  }

  return (
    <div className="modal" onClick={!isConfirming ? onClose : undefined} role="dialog" aria-modal="true" aria-labelledby="modalTitle">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}> {/* Impede que o clique dentro do conteúdo do modal feche o modal */}
        <button className="modal-close" onClick={onClose} aria-label="Fechar" type="button" disabled={isConfirming}>
          &times;
        </button>
        <h4 id="modalTitle">{title}</h4>
        <p>{message}</p>
        <div className="modal-actions">
          <button type="button" className="modal-btn modal-btn-secondary" onClick={onClose} disabled={isConfirming}>
            Cancelar
          </button>
          <button type="button" className="modal-btn modal-btn-danger" onClick={onConfirm} disabled={isConfirming}>
            {isConfirming ? 'A eliminar...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Modal