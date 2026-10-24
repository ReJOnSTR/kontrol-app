import { useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
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
    const [dropdownStyle, setDropdownStyle] = useState({})
    const ref = useRef(null)
    const inputRef = useRef(null)

    const selectedOption = options.find(opt => opt.value === value)

    const filteredOptions = useMemo(() => {
        if (!searchTerm) return options
        const lowerTerm = searchTerm.toLowerCase()
        return options.filter(opt => opt.label.toLowerCase().includes(lowerTerm))
    }, [options, searchTerm])

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
                    setSearchTerm('')
                }
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus()
        }
    }, [isOpen])

    const handleSelect = (optValue, e) => {
        if (e) e.stopPropagation()
        onChange(optValue)
        setIsOpen(false)
        setSearchTerm('')
    }

    const toggleOpen = () => {
        setIsOpen(!isOpen)
        if (!isOpen) setSearchTerm('')
    }

    const isFloating = floatingLabel
    const hasValue = (selectedOption || isOpen || searchTerm)
    const wrapperClass = isFloating ? `custom-select form-group floating-label-group ${hasValue ? 'has-value' : ''}` : `custom-select form-group`

    return (
        <div className={`${wrapperClass} ${className}`} ref={ref}>
            {!isFloating && label && (
                <label className="form-label">
                    {label} {required && <span style={{ color: 'var(--danger)' }}>*</span>}
                </label>
            )}

            <div className="input-wrapper" style={{ position: 'relative' }}>
                {Icon && <Icon className="input-icon" size={18} />}

                <div
                    className={`custom-select-trigger form-input ${isOpen ? 'open' : ''} ${error ? 'input-error' : ''} ${Icon ? 'has-icon' : ''}`}
                    onClick={toggleOpen}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', height: '40px', minHeight: '40px', paddingLeft: Icon ? '40px' : '14px' }}
                >
                     {isOpen ? (
                        <input
                            ref={inputRef}
                            type="text"
                            className="searchable-select-input"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            placeholder={selectedOption ? selectedOption.label : "Arama yapın..."}
                            style={{ 
                                border: 'none', outline: 'none', background: 'transparent', width: '100%', 
                                color: 'var(--text-primary)', fontSize: '14px' 
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

                {isOpen && createPortal(
                    <div className={`custom-select-dropdown placement-${placement}`} style={{ ...dropdownStyle, maxHeight: '250px', overflowY: 'auto' }}>
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
                                        <span>{opt.label}</span>
                                        {value === opt.value && <Check size={14} />}
                                    </div>
                                ))}
                            </>
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
