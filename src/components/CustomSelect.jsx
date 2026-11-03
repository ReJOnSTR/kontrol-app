import { useState, useRef, useEffect } from 'react'
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
    const ref = useRef(null)
    const triggerRef = useRef(null)
    const searchInputRef = useRef(null)

    const selectedOption = options.find(opt => opt.value === value)

    const showSearch = options.length > 5 || creatable
    const filteredOptions = options.filter(opt => 
        opt.label && opt.label.toString().toLowerCase().includes(searchTerm.toLowerCase())
    )
    const hasExactMatch = options.some(opt => 
        opt.label && opt.label.toString().toLowerCase() === searchTerm.toLowerCase()
    )

    useEffect(() => {
        if (isOpen) {
            const targetEl = triggerRef.current || ref.current
            if (targetEl) {
                const rect = targetEl.getBoundingClientRect()
                const spaceBelow = window.innerHeight - rect.bottom
                const spaceAbove = rect.top
                if (spaceBelow < 220 && spaceAbove > spaceBelow) {
                    setPlacement('top')
                } else {
                    setPlacement('bottom')
                }
            }

            const timer = setTimeout(() => {
                if (searchInputRef.current) {
                    searchInputRef.current.focus()
                }
            }, 50)

            return () => {
                clearTimeout(timer)
            }
        } else {
            setSearchTerm('')
            setPlacement('bottom')
        }
    }, [isOpen])

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (ref.current && !ref.current.contains(e.target)) {
                setIsOpen(false)
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
    const wrapperClass = isFloating 
        ? `custom-select form-group floating-label-group ${hasValue ? 'has-value' : ''} ${isOpen ? 'is-open' : ''}` 
        : `custom-select form-group ${isOpen ? 'is-open' : ''}`

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
                    ref={triggerRef}
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

                {isOpen && (
                    <div 
                        className={`custom-select-dropdown placement-${placement}`} 
                        style={{ maxHeight: '250px', overflowY: 'auto' }}
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
                                style={{ borderTop: '1px solid var(--border-color)', color: 'var(--accent-primary)', fontWeight: 500 }}
                            >
                                <span>+ Ekle: "{searchTerm}"</span>
                            </div>
                        )}
                    </div>
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
