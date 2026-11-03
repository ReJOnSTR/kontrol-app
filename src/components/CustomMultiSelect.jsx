import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

export default function CustomMultiSelect({
    label,
    value = [], // Array of selected values
    onChange,
    options = [],
    placeholder = 'Seçiniz',
    className = '',
    required = false,
    error,
    floatingLabel = false,
    icon: Icon,
    disabled = false,
    style
}) {
    const [isOpen, setIsOpen] = useState(false)
    const [placement, setPlacement] = useState('bottom')
    const ref = useRef(null)
    const triggerRef = useRef(null)

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
        } else {
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

    const handleToggle = (optValue) => {
        let newValue
        if (value.includes(optValue)) {
            newValue = value.filter(v => v !== optValue)
        } else {
            newValue = [...value, optValue]
        }
        onChange(newValue)
    }

    const toggleOpen = () => {
        setIsOpen(!isOpen)
    }

    const selectedLabels = options
        .filter(opt => value.includes(opt.value))
        .map(opt => opt.label)

    const isFloating = floatingLabel
    const hasValue = value.length > 0 || isOpen
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
                    <span className={selectedLabels.length > 0 ? 'value-text' : 'placeholder'} style={{ opacity: isFloating && !hasValue ? 0 : 1, width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {selectedLabels.length > 0 
                            ? (selectedLabels.length <= 2 ? selectedLabels.join(', ') : `${selectedLabels.length} seçildi`)
                            : (isFloating ? '' : placeholder)
                        }
                    </span>
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
                        {options.map((opt) => {
                            const isSelected = value.includes(opt.value)
                            return (
                                <div
                                    key={opt.value}
                                    className={`custom-select-option ${isSelected ? 'selected' : ''}`}
                                    onClick={() => handleToggle(opt.value)}
                                >
                                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {opt.label}
                                    </span>
                                    {isSelected && <Check size={14} style={{ flexShrink: 0, color: 'var(--accent-primary)', marginLeft: '6px' }} />}
                                </div>
                            )
                        })}
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
