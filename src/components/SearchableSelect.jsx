import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, Check, Search } from 'lucide-react'

export default function SearchableSelect({
    label,
    value,
    onChange,
    options = [],
    placeholder = 'Seçiniz',
    className = '',
    required = false,
    error,
    floatingLabel = false,
    icon: Icon
}) {
    const [isOpen, setIsOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [placement, setPlacement] = useState('bottom')
    const ref = useRef(null)
    const triggerRef = useRef(null)
    const inputRef = useRef(null)

    const selectedOption = options.find(opt => opt.value === value)

    const filteredOptions = useMemo(() => {
        if (!searchTerm) return options
        const lowerTerm = searchTerm.toLowerCase()
        return options.filter(opt => opt.label.toLowerCase().includes(lowerTerm))
    }, [options, searchTerm])

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
                if (inputRef.current) {
                    inputRef.current.focus()
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
        document.addEventListener('touchstart', handleClickOutside, { passive: true })
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('touchstart', handleClickOutside)
        }
    }, [])

    const handleSelect = (optValue, e) => {
        if (e) {
            e.stopPropagation()
        }
        onChange(optValue)
        setIsOpen(false)
        setSearchTerm('')
    }

    const toggleOpen = () => {
        setIsOpen(!isOpen)
    }

    const isFloating = floatingLabel
    const hasValue = !!(selectedOption || value || isOpen || searchTerm)
    const wrapperClass = isFloating 
        ? `custom-select form-group floating-label-group ${hasValue ? 'has-value' : ''} ${isOpen ? 'is-open' : ''}` 
        : `custom-select form-group ${isOpen ? 'is-open' : ''}`

    return (
        <div className={`${wrapperClass} ${className}`} ref={ref}>
            {!isFloating && label && (
                <label className="form-label">
                    {label} {required && <span>*</span>}
                </label>
            )}

            <div className="input-wrapper" style={{ position: 'relative' }}>
                {Icon && <Icon className="input-icon" size={18} />}

                <div
                    ref={triggerRef}
                    className={`custom-select-trigger form-input ${isOpen ? 'open' : ''} ${error ? 'input-error' : ''} ${Icon ? 'has-icon' : ''}`}
                    onClick={toggleOpen}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        paddingLeft: Icon ? '40px' : undefined,
                        userSelect: 'none'
                    }}
                >
                    {isOpen ? (
                        <input
                            ref={inputRef}
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            placeholder={selectedOption ? selectedOption.label : "Arama yapın..."}
                            style={{ 
                                border: 'none', outline: 'none', background: 'transparent', width: '100%', 
                                color: 'var(--text-primary)', fontSize: '14px', padding: 0 
                            }}
                        />
                    ) : (
                        <span className={selectedOption ? 'value-text' : 'placeholder'} style={{ opacity: isFloating && !selectedOption ? 0 : 1, width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {selectedOption ? selectedOption.label : (isFloating ? '' : placeholder)}
                        </span>
                    )}

                    <ChevronDown size={16} className={`chevron ${isOpen ? 'rotate' : ''}`} style={{ flexShrink: 0, marginLeft: '8px' }} />
                </div>

                {isFloating && label && (
                    <label className="form-label" style={{ pointerEvents: 'none' }}>
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
                         {filteredOptions.length === 0 ? (
                            <div className="custom-select-option" style={{ opacity: 0.5, pointerEvents: 'none' }}>
                                Sonuç bulunamadı
                            </div>
                        ) : (
                            <>
                                {!required && placeholder && !searchTerm && (
                                    <div
                                        className={`custom-select-option ${!value ? 'selected' : ''}`}
                                        onClick={(e) => handleSelect('', e)}
                                    >
                                        <span style={{ opacity: 0.7 }}>{placeholder}</span>
                                    </div>
                                )}
                                {filteredOptions.map((opt) => (
                                    <div
                                        key={opt.value}
                                        className={`custom-select-option ${value === opt.value ? 'selected' : ''}`}
                                        onClick={(e) => handleSelect(opt.value, e)}
                                    >
                                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {opt.label}
                                        </span>
                                        {value === opt.value && <Check size={14} style={{ flexShrink: 0, color: 'var(--accent-primary)', marginLeft: '6px' }} />}
                                    </div>
                                ))}
                            </>
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
