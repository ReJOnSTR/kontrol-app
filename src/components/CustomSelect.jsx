import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'

export default function CustomSelect({
    label,
    value,
    onChange,
    options = [],
    placeholder = 'Seçiniz',
    className = '',
    required = false,
    error,
    floatingLabel = false,
    icon: Icon,
    disabled = false,
    style,
    creatable = false,
    hidePlaceholderOption = false
}) {
    const [isOpen, setIsOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [placement, setPlacement] = useState('bottom')
    const [dropdownStyle, setDropdownStyle] = useState({})
    const ref = useRef(null)
    const searchInputRef = useRef(null)

    const selectedOption = options.find(opt => opt.value === value)

    const showSearch = options.length > 5 || creatable
    const filteredOptions = options.filter(opt => 
        opt.label && opt.label.toString().toLowerCase().includes(searchTerm.toLowerCase())
    )
    const hasExactMatch = options.some(opt => 
        opt.label && opt.label.toString().toLowerCase() === searchTerm.toLowerCase()
    )

    const updatePosition = () => {
        if (!isOpen || !ref.current) return
        const rect = ref.current.getBoundingClientRect()
        const spaceBelow = window.innerHeight - rect.bottom
        const spaceAbove = rect.top
        
        let newPlacement = 'bottom'
        if (spaceBelow < 250 && spaceAbove > spaceBelow) {
            newPlacement = 'top'
        }
        setPlacement(newPlacement)

        // Smart width: form selects in modals/pages should match trigger width!
        const isCompact = className.includes('filter-select-custom') || className.includes('page-select-custom')
        const isPageSelect = className.includes('page-select-custom')

        let popupWidth, popupMinWidth, popupMaxWidth
        if (isPageSelect) {
            popupMinWidth = rect.width
            popupMaxWidth = rect.width
            popupWidth = `${rect.width}px`
        } else if (isCompact) {
            popupMinWidth = Math.min(Math.max(rect.width, 180), window.innerWidth - 24)
            popupMaxWidth = Math.min(360, window.innerWidth - 24)
            popupWidth = 'max-content'
        } else {
            // Form select in modal or page - match trigger width
            popupWidth = `${Math.min(rect.width, window.innerWidth - 24)}px`
            popupMinWidth = `${Math.min(Math.max(rect.width, 240), window.innerWidth - 24)}px`
            popupMaxWidth = `${window.innerWidth - 24}px`
        }

        // Prevent overflow beyond right edge of viewport
        const targetWidth = isCompact ? (typeof popupMinWidth === 'number' ? popupMinWidth : 200) : rect.width
        let left = rect.left
        if (left + targetWidth > window.innerWidth - 12) {
            left = Math.max(12, window.innerWidth - targetWidth - 12)
        }
        if (left < 12) left = 12

        setDropdownStyle({
            position: 'fixed',
            top: newPlacement === 'bottom' ? rect.bottom + 4 : 'auto',
            bottom: newPlacement === 'top' ? (window.innerHeight - rect.top) + 4 : 'auto',
            left: left,
            minWidth: typeof popupMinWidth === 'number' ? `${popupMinWidth}px` : popupMinWidth,
            maxWidth: typeof popupMaxWidth === 'number' ? `${popupMaxWidth}px` : popupMaxWidth,
            width: popupWidth,
            zIndex: 99999
        })
    }

    useEffect(() => {
        if (isOpen) {
            updatePosition()
            window.addEventListener('resize', updatePosition)
            window.addEventListener('scroll', updatePosition, true)
            
            const timer = setTimeout(() => {
                if (searchInputRef.current) {
                    searchInputRef.current.focus()
                }
            }, 50)

            return () => {
                window.removeEventListener('resize', updatePosition)
                window.removeEventListener('scroll', updatePosition, true)
                clearTimeout(timer)
            }
        } else {
            setSearchTerm('')
        }
    }, [isOpen])

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (ref.current && !ref.current.contains(e.target)) {
                const isDropdownClick = e.target.closest('.custom-select-dropdown')
                if (!isDropdownClick) {
                    setIsOpen(false)
                }
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        document.addEventListener('touchstart', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('touchstart', handleClickOutside)
        }
    }, [])

    const handleSelect = (optValue) => {
        onChange(optValue)
        setIsOpen(false)
        setSearchTerm('')
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            e.stopPropagation()
            if (filteredOptions.length > 0) {
                handleSelect(filteredOptions[0].value)
            } else if (creatable && searchTerm && !hasExactMatch) {
                handleSelect(searchTerm)
            }
        }
    }

    const toggleOpen = () => {
        setIsOpen(!isOpen)
    }

    // Floating label logic
    const isFloating = floatingLabel
    const displayLabel = selectedOption ? selectedOption.label : (value || (isFloating ? '' : placeholder))
    const hasValue = !!(selectedOption || value || isOpen || searchTerm)
    const wrapperClass = isFloating ? `custom-select form-group floating-label-group ${hasValue ? 'has-value' : ''}` : `custom-select form-group`

    return (
        <div className={`${wrapperClass} ${className}`} ref={ref} style={style}>
            {!isFloating && label && (
                <label className="form-label">
                    {label} {required && <span style={{ color: 'var(--danger)' }}>*</span>}
                </label>
            )}

            <div className="input-wrapper" style={{ position: 'relative' }}>
                {Icon && <Icon className="input-icon" size={18} />}

                <div
                    className={`custom-select-trigger form-input ${isOpen ? 'open' : ''} ${error ? 'input-error' : ''} ${Icon ? 'has-icon' : ''} ${disabled ? 'disabled' : ''}`}
                    onClick={!disabled ? toggleOpen : undefined}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        opacity: disabled ? 0.6 : 1,
                        paddingLeft: Icon ? '40px' : undefined,
                        userSelect: 'none'
                    }}
                >
                    {isOpen && showSearch ? (
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onClick={(e) => e.stopPropagation()}
                            placeholder={selectedOption ? selectedOption.label : (value || placeholder)}
                            style={{
                                border: 'none',
                                outline: 'none',
                                background: 'transparent',
                                width: '100%',
                                color: 'var(--text-primary)',
                                fontSize: '14px',
                                padding: 0
                            }}
                        />
                    ) : (
                        <span className={hasValue ? 'value-text' : 'placeholder'} style={{ opacity: isFloating && !hasValue ? 0 : 1, width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {displayLabel}
                        </span>
                    )}
                    <ChevronDown size={16} className={`chevron ${isOpen ? 'rotate' : ''}`} style={{ flexShrink: 0, marginLeft: '8px' }} />
                </div>

                {isFloating && label && (
                    <label className="form-label">
                        {label} {required && <span>*</span>}
                    </label>
                )}

                {isOpen && createPortal(
                    <div 
                        className={`custom-select-dropdown placement-${placement}`} 
                        style={{ ...dropdownStyle, maxHeight: '250px', overflowY: 'auto' }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                    >
                        {!required && placeholder && !searchTerm && !hidePlaceholderOption && !className.includes('filter-select-custom') && !className.includes('page-select-custom') && (
                            <div
                                className={`custom-select-option ${!value ? 'selected' : ''}`}
                                onClick={() => handleSelect('')}
                            >
                                <span style={{ opacity: 0.7 }}>{placeholder}</span>
                            </div>
                        )}
                        {filteredOptions.length === 0 && !creatable && (
                            <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                                Sonuç bulunamadı
                            </div>
                        )}
                        {filteredOptions.map((opt) => (
                            <div
                                key={opt.value}
                                className={`custom-select-option ${value === opt.value ? 'selected' : ''}`}
                                onClick={() => handleSelect(opt.value)}
                                title={typeof opt.label === 'string' ? opt.label : undefined}
                            >
                                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {opt.label}
                                </span>
                                {value === opt.value && <Check size={13} style={{ flexShrink: 0, color: 'var(--accent-primary)', marginLeft: '6px' }} />}
                            </div>
                        ))}
                        {creatable && searchTerm && !hasExactMatch && (
                            <div
                                className="custom-select-option creatable-option"
                                onClick={() => handleSelect(searchTerm)}
                                style={{ borderTop: '1px dashed var(--border-color)', color: 'var(--accent-primary)', fontWeight: 500 }}
                            >
                                <span>+ Ekle: "{searchTerm}"</span>
                            </div>
                        )}
                    </div>,
                    document.body
                )}
            </div>

            {error && (
                <span className="input-error-text">
                    {error}
                </span>
            )}
        </div>
    )
}
