import { X } from 'lucide-react'

export default function Modal({ isOpen, onClose, title, children, size = 'default', footer, bodyStyle, bodyClassName }) {
    if (!isOpen) return null

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className={`modal ${size === 'lg' ? 'modal-lg' : size === 'xl' ? 'modal-xl' : size === 'sm' ? 'modal-sm' : (size === 'fullscreen' || size === 'full') ? 'modal-fullscreen' : ''}`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="modal-header">
                    <div className="modal-drag-indicator" />
                    <div className="modal-header-content">
                        <h2 className="modal-title">{title}</h2>
                        <button className="modal-close" onClick={onClose} aria-label="Kapat">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                <div className={`modal-body ${bodyClassName || ''}`} style={bodyStyle}>
                    {children}
                </div>

                {footer && (
                    <div className="modal-footer">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    )
}
