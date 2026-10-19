import { useEffect, useRef, useId, useCallback } from 'react'
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
    modalStyle,
    isDirty = false,
    dirtyConfirmMessage = 'Kaydedilmemiş değişiklikleriniz var. Kapatmak istediğinize emin misiniz?'
}) {
    const titleId = useId()
    const modalRef = useRef(null)
    const previousFocusRef = useRef(null)

    const handleAttemptClose = useCallback(() => {
        if (isDirty) {
            const confirmed = window.confirm(dirtyConfirmMessage)
            if (!confirmed) return
        }
        onClose?.()
    }, [isDirty, dirtyConfirmMessage, onClose])

    const handleAttemptCloseRef = useRef(handleAttemptClose)
    handleAttemptCloseRef.current = handleAttemptClose

    useEffect(() => {
        if (!isOpen) return

        previousFocusRef.current = document.activeElement

        const modalEl = modalRef.current
        // Only set focus to first focusable element if focus is not already inside the modal
        if (modalEl && !modalEl.contains(document.activeElement)) {
            const focusable = modalEl.querySelectorAll(
                'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
            if (focusable.length > 0) {
                // Focus the first focusable element or the close button
                focusable[0].focus()
            }
        }

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation()
                handleAttemptCloseRef.current?.()
                return
            }

            if (e.key === 'Tab' && modalRef.current) {
                const focusable = Array.from(modalRef.current.querySelectorAll(
                    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
                ))
                if (focusable.length === 0) {
                    e.preventDefault()
                    return
                }

                const firstEl = focusable[0]
                const lastEl = focusable[focusable.length - 1]

                if (e.shiftKey) {
                    if (document.activeElement === firstEl) {
                        e.preventDefault()
                        lastEl.focus()
                    }
                } else {
                    if (document.activeElement === lastEl) {
                        e.preventDefault()
                        firstEl.focus()
                    }
                }
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
                previousFocusRef.current.focus()
            }
        }
    }, [isOpen])

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
        <div
            className={overlayClass}
            style={overlayStyle}
            onClick={handleAttemptClose}
        >
            <div
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? titleId : undefined}
                className={modalClass}
                style={modalStyle}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="modal-header">
                    <div className="modal-drag-indicator" />
                    <div className="modal-header-content">
                        <h2 id={titleId} className="modal-title">{title}</h2>
                        <button className="modal-close" onClick={handleAttemptClose} aria-label="Kapat">
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

