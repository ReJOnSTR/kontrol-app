import React, { useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { MoreHorizontal, ChevronRight, Eye } from 'lucide-react'

/**
 * Recursively extracts action buttons from React elements, Fragments, and arrays
 */
function extractActionButtons(children) {
    const list = []

    function walk(node) {
        if (!node) return
        if (Array.isArray(node)) {
            node.forEach(walk)
            return
        }
        if (node.type === React.Fragment) {
            walk(node.props?.children)
            return
        }
        if (React.isValidElement(node)) {
            // If node is already a TableActionMenu, treat as single item
            if (node.type === TableActionMenu || node.type?.name === 'TableActionMenu') {
                list.push(node)
                return
            }
            if (node.type === 'button') {
                list.push(node)
            } else if (node.props?.role === 'button' || (typeof node.props?.className === 'string' && (node.props.className.includes('btn') || node.props.className.includes('action-item')))) {
                list.push(node)
            } else if (node.props?.children) {
                walk(node.props.children)
            }
        }
    }

    walk(children)
    return list
}

/**
 * TableActionMenu - Professional Horizontal 3-Dot Action Dropdown Popover
 */
export default function TableActionMenu({
    items = null,
    children = null,
    onRowClick = null,
    row = null
}) {
    const [isOpen, setIsOpen] = useState(false)
    const [dropdownStyle, setDropdownStyle] = useState({})
    const triggerRef = useRef(null)
    const menuIdRef = useRef(Math.random().toString(36).substring(2, 9))

    const updatePosition = () => {
        if (!triggerRef.current) return
        const rect = triggerRef.current.getBoundingClientRect()
        
        // If trigger button is scrolled out of viewport, close menu
        if (rect.bottom < 0 || rect.top > window.innerHeight) {
            setIsOpen(false)
            return
        }

        const spaceBelow = window.innerHeight - rect.bottom
        const spaceAbove = rect.top

        let placement = 'bottom'
        if (spaceBelow < 220 && spaceAbove > spaceBelow) {
            placement = 'top'
        }

        // Right-align with the trigger button to prevent right-edge overflow
        const right = Math.max(10, window.innerWidth - rect.right)

        setDropdownStyle({
            position: 'fixed',
            top: placement === 'bottom' ? `${rect.bottom + 4}px` : 'auto',
            bottom: placement === 'top' ? `${window.innerHeight - rect.top + 4}px` : 'auto',
            right: `${right}px`,
            left: 'auto',
            minWidth: '160px',
            maxWidth: '260px',
            width: 'max-content',
            zIndex: 999999
        })
    }

    useEffect(() => {
        if (isOpen) {
            updatePosition()
            window.addEventListener('resize', updatePosition)
            window.addEventListener('scroll', updatePosition, true)

            return () => {
                window.removeEventListener('resize', updatePosition)
                window.removeEventListener('scroll', updatePosition, true)
            }
        }
    }, [isOpen])

    // Close on outside click or Escape key
    useEffect(() => {
        if (!isOpen) return

        const handleClickOutside = (e) => {
            if (triggerRef.current && !triggerRef.current.contains(e.target)) {
                const isDropdownClick = e.target.closest('.table-action-popover')
                if (!isDropdownClick) {
                    setIsOpen(false)
                }
            }
        }

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') setIsOpen(false)
        }

        const handleOtherMenuOpened = (e) => {
            if (e.detail?.id !== menuIdRef.current) {
                setIsOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        document.addEventListener('keydown', handleKeyDown)
        window.addEventListener('table-action-menu-opened', handleOtherMenuOpened)

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('table-action-menu-opened', handleOtherMenuOpened)
        }
    }, [isOpen])

    const toggleMenu = (e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsOpen(prev => {
            const next = !prev
            if (next) {
                window.dispatchEvent(new CustomEvent('table-action-menu-opened', { detail: { id: menuIdRef.current } }))
            }
            return next
        })
    }

    // Parse button items
    const parsedItems = useMemo(() => {
        const result = []

        // If items prop is provided directly, use it
        if (items && items.length > 0) {
            items.forEach((item, index) => {
                result.push({
                    key: item.key || `item_${index}`,
                    label: item.label || 'İşlem',
                    icon: item.icon,
                    onClick: (e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setIsOpen(false)
                        if (item.onClick) item.onClick(e, row)
                    },
                    disabled: !!item.disabled,
                    isDanger: !!item.isDanger,
                    isSuccess: !!item.isSuccess,
                    hidden: !!item.hidden
                })
            })
            return result
        }

        const rawButtons = extractActionButtons(children)

        rawButtons.forEach((btn, index) => {
            const props = btn.props || {}
            const { title, onClick, className, style, disabled } = props

            let label = title || props['aria-label'] || props.alt || ''
            let icon = null

            const btnChildren = props.children
            if (typeof btnChildren === 'string' && btnChildren.trim()) {
                label = label || btnChildren.trim()
            } else if (Array.isArray(btnChildren)) {
                btnChildren.forEach((c) => {
                    if (typeof c === 'string' && c.trim()) {
                        label = label || c.trim()
                    } else if (React.isValidElement(c)) {
                        if (c.type === 'span' && typeof c.props?.children === 'string') {
                            label = label || c.props.children.trim()
                        } else if (!icon) {
                            icon = c
                        }
                    }
                })
            } else if (React.isValidElement(btnChildren)) {
                icon = btnChildren
            }

            let isDanger = (typeof className === 'string' && className.includes('danger')) || (style && (style.color === '#ef4444' || style.color === 'red'))
            let isSuccess = (typeof className === 'string' && className.includes('success')) || (style && (style.color === '#10b981' || style.color === 'green'))

            // If label is not explicitly defined, intelligently infer from icon type or className
            if (!label) {
                const iconName = icon?.type?.displayName || icon?.type?.name || icon?.type?.render?.name || ''
                const lowerIcon = iconName.toLowerCase()
                const lowerClass = (typeof className === 'string' ? className : '').toLowerCase()

                if (lowerIcon.includes('trash') || lowerIcon.includes('delete') || lowerClass.includes('danger') || lowerClass.includes('delete') || lowerClass.includes('trash')) {
                    label = 'Sil'
                    isDanger = true
                } else if (lowerIcon.includes('pencil') || lowerIcon.includes('edit')) {
                    label = 'Düzenle'
                } else if (lowerIcon.includes('restore')) {
                    label = 'Arşivden Çıkar'
                } else if (lowerIcon.includes('archive')) {
                    label = 'Arşivle'
                } else if (lowerIcon.includes('eye') || lowerIcon.includes('view') || lowerClass.includes('detail')) {
                    label = 'Görüntüle'
                } else if (lowerIcon.includes('printer') || lowerIcon.includes('print')) {
                    label = 'Yazdır'
                } else if (lowerIcon.includes('file') || lowerIcon.includes('doc')) {
                    label = 'Belge / Detay'
                } else if (lowerIcon.includes('download')) {
                    label = 'İndir'
                } else if (lowerIcon.includes('check')) {
                    label = 'Onayla'
                    isSuccess = true
                } else if (lowerIcon.includes('x') || lowerIcon.includes('ban') || lowerIcon.includes('close')) {
                    label = 'İptal Et'
                    isDanger = true
                } else if (lowerIcon.includes('credit') || lowerIcon.includes('wallet') || lowerIcon.includes('money') || lowerIcon.includes('dollar')) {
                    label = 'Ödeme Yap'
                } else if (lowerIcon.includes('copy')) {
                    label = 'Kopyala'
                } else {
                    label = 'İşlem'
                }
            }

            const lowerLabel = label.toLowerCase()
            if (lowerLabel.includes('sil') || lowerLabel.includes('kaldır') || lowerLabel.includes('delete')) {
                isDanger = true
            }

            result.push({
                key: btn.key || `action_${index}`,
                label,
                icon,
                onClick: (e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setIsOpen(false)
                    if (onClick) onClick(e)
                },
                disabled: !!disabled,
                isDanger,
                isSuccess
            })
        })

        return result
    }, [children, items, onRowClick, row])

    // If there are no actions at all:
    if (parsedItems.length === 0) {
        if (onRowClick) {
            return (
                <button 
                    className="btn-icon row-details-btn" 
                    onClick={(e) => {
                        e.stopPropagation()
                        onRowClick(e)
                    }}
                    title="Detaya Git"
                >
                    <ChevronRight size={18} />
                </button>
            )
        }
        return null
    }

    return (
        <div 
            className="table-action-menu-wrapper" 
            onClick={(e) => e.stopPropagation()}
            style={{ display: 'inline-flex', alignItems: 'center', position: 'relative' }}
        >
            <button
                ref={triggerRef}
                type="button"
                className={`table-3dots-btn ${isOpen ? 'active' : ''}`}
                onClick={toggleMenu}
                title="İşlemler"
                aria-label="İşlemler"
            >
                <MoreHorizontal size={18} />
            </button>

            {isOpen && createPortal(
                <div
                    className="table-action-popover"
                    onClick={(e) => e.stopPropagation()}
                    style={dropdownStyle}
                >
                    {parsedItems.map((item, idx) => {
                        if (item.hidden) return null
                        const Icon = item.icon
                        const prevItem = parsedItems[idx - 1]
                        const showDivider = item.isDanger && prevItem && !prevItem.isDanger

                        return (
                            <React.Fragment key={item.key}>
                                {showDivider && <div className="table-action-popover-divider" />}
                                <button
                                    type="button"
                                    disabled={item.disabled}
                                    onClick={item.onClick}
                                    className={`table-action-popover-item ${item.isDanger ? 'danger' : ''} ${item.isSuccess ? 'success' : ''}`}
                                >
                                    {Icon && (
                                        <span className="popover-item-icon">
                                            {typeof Icon === 'function' ? (
                                                <Icon size={15} />
                                            ) : React.isValidElement(Icon) ? (
                                                React.cloneElement(Icon, { size: 15 })
                                            ) : (
                                                Icon
                                            )}
                                        </span>
                                    )}
                                    <span className="popover-item-label">
                                        {item.label}
                                    </span>
                                </button>
                            </React.Fragment>
                        )
                    })}
                </div>,
                document.body
            )}
        </div>
    )
}
