import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
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
    const [dropdownStyle, setDropdownStyle] = useState({})
    const ref = useRef(null)

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

        setDropdownStyle({
            position: 'fixed',
            top: newPlacement === 'bottom' ? rect.bottom + 6 : 'auto',
            bottom: newPlacement === 'top' ? (window.innerHeight - rect.top) + 6 : 'auto',
            left: rect.left,
            width: rect.width,
            zIndex: 99999
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
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleToggle = (optValue) => {
        let newValue;
        if (value.includes(optValue)) {
            newValue = value.filter(v => v !== optValue);
        } else {
            newValue = [...value, optValue];
        }
        onChange(newValue);
    }

    const selectedLabels = options
        .filter(opt => value.includes(opt.value))
        .map(opt => opt.label)
        .join(', ');

    const hasValue = value.length > 0 || isOpen;
    const wrapperClass = floatingLabel ? `custom-select form-group floating-label-group ${hasValue ? 'has-value' : ''}` : `custom-select form-group`

    return (
        <div className={`${wrapperClass} ${className}`} ref={ref} style={style}>
            {!floatingLabel && label && (
                <label className="form-label">
                    {label} {required && <span style={{ color: 'var(--danger)' }}>*</span>}
                </label>
            )}

            <div className="input-wrapper" style={{ position: 'relative' }}>
                {Icon && <Icon className="input-icon" size={18} />}

                <div
                    className={`custom-select-trigger form-input ${isOpen ? 'open' : ''} ${error ? 'input-error' : ''} ${Icon ? 'has-icon' : ''} ${disabled ? 'disabled' : ''}`}
                    onClick={!disabled ? () => setIsOpen(!isOpen) : undefined}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        opacity: disabled ? 0.6 : 1,
                        background: disabled ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                        paddingLeft: Icon ? '40px' : '14px',
                        height: '40px',
                        minHeight: '40px',
                        userSelect: 'none'
                    }}
                >
                    <span className={value.length > 0 ? 'value-text' : 'placeholder'} style={{ opacity: floatingLabel && !hasValue ? 0 : 1, width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {selectedLabels || placeholder}
                    </span>
                    <ChevronDown size={16} className={`chevron ${isOpen ? 'rotate' : ''}`} style={{ flexShrink: 0, marginLeft: '8px' }} />
                </div>

                {floatingLabel && label && (
                    <label className="form-label">
                        {label} {required && <span>*</span>}
                    </label>
                )}

                {isOpen && createPortal(
                    <div className={`custom-select-dropdown placement-${placement}`} style={{ ...dropdownStyle, maxHeight: '250px', overflowY: 'auto' }}>
                        {options.map((opt) => {
                            const isSelected = value.includes(opt.value);
                            return (
                                <div
                                    key={opt.value}
                                    className={`custom-select-option ${isSelected ? 'selected' : ''}`}
                                    onClick={() => handleToggle(opt.value)}
                                >
                                    <span>{opt.label}</span>
                                    {isSelected && <Check size={14} />}
                                </div>
                            );
                        })}
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
