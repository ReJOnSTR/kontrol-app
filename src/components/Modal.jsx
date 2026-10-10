import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({
    isOpen,
    onClose,
    title,
    children,
    size = 'default',
    placement,
    footer,
    bodyStyle,
    bodyClassName,
    overlayStyle,
    modalStyle
}) {
    useEffect(() => {
        if (!isOpen) return
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose?.()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, onClose])

    if (!isOpen) return null

    const isSm = size === 'sm' || size === 'small'
    const isCenter = placement === 'center' || (isSm && placement !== 'drawer')
    const overlayClass = `modal-overlay ${isCenter ? 'modal-overlay-center' : 'modal-overlay-drawer'}`
    const sizeClass = isSm ? 'modal-sm'
        : (size === 'md' || size === 'medium') ? 'modal-md'
        : (size === 'lg' || size === 'large') ? 'modal-lg'
        : size === 'xl' ? 'modal-xl'
        : (size === 'fullscreen' || size === 'full') ? 'modal-fullscreen'
        : 'modal-default'
    const modalClass = `modal ${isCenter ? 'modal-center' : 'modal-drawer'} ${sizeClass}`

    return (
        <div className={overlayClass} style={overlayStyle} onClick={onClose}>
            <div
                className={modalClass}
                style={modalStyle}
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

