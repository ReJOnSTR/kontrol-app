import React, { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export default function CustomInput({
    label,
    value,
    onChange,
    required,
    format,
    placeholder,
    type = 'text',
    className,
    error,
    multiline,
    floatingLabel, // Extract floatingLabel so it's not in ...props
    disabled,
    maxDecimals = 6,
    ...props
}) {
    const [touched, setTouched] = useState(false)
    const [isFocused, setIsFocused] = useState(false)
    const [showPassword, setShowPassword] = useState(false)

    const handleChange = (e) => {
        let val = e.target.value

        if (props.maxLength && typeof val === 'string' && val.length > props.maxLength && format !== 'currency') {
            val = val.slice(0, props.maxLength)
        }

        if (format === 'uppercase') {
            val = val.toUpperCase()
        } else if (format === 'title') {
            // Capitalize first letter of each word
            val = val.replace(/\b\w/g, c => c.toUpperCase())
        } else if (format === 'tc_no') {
            val = val.replace(/\D/g, '')
            if (val.length > 11) val = val.slice(0, 11)
        } else if (format === 'plate') {
            // Uppercase and allow only numbers/letters
            val = val.toUpperCase().replace(/[^A-Z0-9]/g, '')
            if (val.length > 9) val = val.slice(0, 9)
            
            // Basic Turkish plate formatting: 34ABC123 -> 34 ABC 123
            if (val.length > 2) {
                const city = val.slice(0, 2)
                let rest = val.slice(2)
                const firstDigitIndex = rest.search(/\d/)
                if (firstDigitIndex !== -1) {
                    const letters = rest.slice(0, firstDigitIndex)
                    const numbers = rest.slice(firstDigitIndex)
                    val = letters ? `${city} ${letters} ${numbers}` : `${city} ${numbers}`
                } else {
                    val = `${city} ${rest}`
                }
            }
        } else if (format === 'iban') {
            // TR + 24 digits
            val = val.toUpperCase().replace(/[^A-Z0-9]/g, '')
            if (!val.startsWith('TR') && val.length > 0) val = 'TR' + val
            val = val.slice(0, 26) // TR + 24 digits
            
            // Format: TRXX XXXX XXXX XXXX XXXX XXXX XX
            const tr = val.slice(0, 2)
            const rest = val.slice(2).replace(/\D/g, '')
            const parts = rest.match(/.{1,4}/g) || []
            val = tr + (parts.length > 0 ? ' ' + parts.join(' ') : '')
        } else if (format === 'numeric') {
            val = val.replace(/\D/g, '')
            if (props.maxLength && val.length > props.maxLength) {
                val = val.slice(0, props.maxLength)
            }
        } else if (format === 'lowercase') {
            val = val.toLowerCase()
        } else if (format === 'alphanumeric') {
            val = val.toUpperCase().replace(/[^A-Z0-9]/g, '')
            if (props.maxLength && val.length > props.maxLength) {
                val = val.slice(0, props.maxLength)
            }
        } else if (format === 'phone') {
            val = val.replace(/\D/g, '')
            if (val.length > 10) val = val.slice(0, 10)

            if (val.length === 0) {
                val = ''
            } else if (val.length <= 3) {
                val = `(${val}`
            } else if (val.length <= 6) {
                val = `(${val.slice(0, 3)}) ${val.slice(3)}`
            } else if (val.length <= 8) {
                val = `(${val.slice(0, 3)}) ${val.slice(3, 6)} ${val.slice(6)}`
            } else {
                val = `(${val.slice(0, 3)}) ${val.slice(3, 6)} ${val.slice(6, 8)} ${val.slice(8)}`
            }
        } else if (format === 'currency') {
            // Remove existing dots (thousands separators)
            let clean = val.replace(/\./g, '')
            // Remove any char except numbers and comma
            clean = clean.replace(/[^0-9,]/g, '')

            // Strip leading zeros before any other digit (e.g. 060 -> 60)
            clean = clean.replace(/^0+(?=\d)/, '')

            const parts = clean.split(',')
            if (parts.length > 1) {
                const integerPart = parts[0]
                const decimalPart = parts.slice(1).join('').replace(/,/g, '').substring(0, maxDecimals)
                clean = integerPart + ',' + decimalPart
            }

            const maxCleanLength = props.maxLength ? Math.max(props.maxLength, 22) : undefined
            if (maxCleanLength && clean.length > maxCleanLength) {
                clean = clean.slice(0, maxCleanLength)
            }

            // Convert '1234,56' to standard float '1234.56' for the parent
            const standardFloatVal = clean.replace(',', '.')
            onChange(standardFloatVal === '' ? '' : standardFloatVal)
            return // Skip normal onChange
        }

        if (props.maxLength && typeof val === 'string' && val.length > props.maxLength) {
            val = val.slice(0, props.maxLength)
        }

        onChange(val)
    }

    const handleKeyDown = (e) => {
        if (isCurrency && e.key === '.') {
            e.preventDefault()
            const input = e.target
            const start = input.selectionStart
            const end = input.selectionEnd
            const rawVal = input.value

            // If there's already a comma and it's not inside the selected range, move cursor after comma
            const hasCommaOutsideSelection = rawVal.includes(',') && !(start !== end && rawVal.substring(start, end).includes(','));
            if (hasCommaOutsideSelection) {
                const commaIdx = rawVal.indexOf(',')
                input.setSelectionRange(commaIdx + 1, commaIdx + 1)
                return
            }

            const nextVal = rawVal.substring(0, start) + ',' + rawVal.substring(end)
            const eventMock = {
                target: {
                    value: nextVal
                }
            }
            handleChange(eventMock)
            setTimeout(() => {
                input.setSelectionRange(start + 1, start + 1)
            }, 0)
        }
        if (props.onKeyDown) props.onKeyDown(e)
    }

    const handleFocus = (e) => {
        setIsFocused(true)
        if (props.onFocus) props.onFocus(e)
    }

    const handleBlur = (e) => {
        setIsFocused(false)
        setTouched(true)
        if (props.onBlur) props.onBlur(e)
    }

    // Validation check
    const isInvalid = (touched && required && !value) || error

    // Determine if we should use floating label style
    const isFloating = true // Enforce floating label for consistency
    // Date/Time inputs always show a mask/placeholder natively, so label must float to avoid overlap
    const isDateType = ['date', 'time', 'datetime-local', 'month', 'week'].includes(type)

    // Show '0' values even when not focused.
    const shouldHideValue = false

    // Determine the display value
    let displayValue = shouldHideValue ? '' : value

    // If currency format, take the standard float value and format it for TR locale
    const isCurrency = format === 'currency';
    if (isCurrency && displayValue !== '' && displayValue !== undefined && displayValue !== null) {
        // value represents the standard float string from parent, e.g. '1234.56' or '1234'
        let strVal = String(displayValue);
        // Sometimes parent passes number, sometimes string.
        if (strVal.includes('.')) {
            strVal = strVal.replace('.', ',');
        }
        const parts = strVal.split(',');
        if (parts.length > 1 && parts[1].length > maxDecimals) {
            parts[1] = parts[1].substring(0, maxDecimals);
        }
        if (parts[0].length > 0) {
            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        }
        displayValue = parts.join(',');
    }

    // Ensure safe string value for React controlled inputs to avoid typing blocks / desync
    const safeValue = (displayValue !== undefined && displayValue !== null) ? String(displayValue) : ''

    // Check if value exists (using safeValue logic)
    const hasValue = (safeValue !== '') || isDateType

    // Wrapper classes - ensure label floats when focused even before typing
    const wrapperClass = `form-group ${isFloating ? 'floating-label-group' : ''} ${(hasValue || isFocused) ? 'has-value' : ''} ${className || ''}`

    // Ensure native maxLength doesn't block currency typing with thousands dots & extra decimals
    const inputProps = { ...props }
    if (isCurrency && inputProps.maxLength && inputProps.maxLength < 22) {
        inputProps.maxLength = 22
    }

    return (
        <div className={wrapperClass}>
            {/* Input Element */}
            {type === 'textarea' || multiline ? (
                <textarea
                    className={`form-textarea ${isInvalid ? 'input-error' : ''}`}
                    value={safeValue}
                    onChange={handleChange}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    placeholder={isFloating ? '' : placeholder} // Hide placeholder if floating to avoid clash
                    rows={props.rows || 3}
                    style={isInvalid ? { borderColor: 'var(--danger)' } : {}}
                    disabled={disabled}
                    {...props}
                />
            ) : (
                <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
                    <input
                        type={isCurrency ? 'text' : (type === 'password' && showPassword ? 'text' : type)}
                        className={`form-input ${isInvalid ? 'input-error' : ''} ${isCurrency ? 'has-currency' : ''}`}
                        value={safeValue}
                        onChange={handleChange}
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        placeholder={isFloating ? '' : placeholder}
                        disabled={disabled}
                        style={{
                            ...(isInvalid ? { borderColor: 'var(--danger)' } : {}),
                            ...(isCurrency ? { paddingRight: '36px' } : {}), // Make room for TL symbol
                            ...(type === 'password' ? { paddingRight: '40px' } : {}) // Make room for Eye icon
                        }}
                        {...inputProps}
                    />
                    {isCurrency && (
                        <span style={{
                            position: 'absolute',
                            right: '12px',
                            color: 'var(--text-muted)',
                            fontWeight: '600',
                            fontSize: '11px',
                            pointerEvents: 'none',
                            userSelect: 'none'
                        }}>
                            TL
                        </span>
                    )}
                    {type === 'password' && (
                        <button
                            type="button"
                            className="password-toggle-btn"
                            onClick={() => !disabled && setShowPassword(!showPassword)}
                            disabled={disabled}
                            style={{
                                position: 'absolute',
                                right: '12px',
                                background: 'none',
                                border: 'none',
                                cursor: disabled ? 'not-allowed' : 'pointer',
                                color: 'var(--text-secondary)',
                                display: 'flex',
                                alignItems: 'center',
                                padding: 0,
                                opacity: disabled ? 0.5 : 1
                            }}
                            title={showPassword ? "Gizle" : "Göster"}
                        >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    )}
                </div>
            )}

            {/* Label (After input for CSS peer selector) */}
            {label && (
                <label className="form-label">
                    <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <span>
                            {label} {required && <span style={{ color: 'var(--danger)' }}>*</span>}
                        </span>
                        {props.maxLength && !isCurrency && isFocused && (
                            <span className="char-counter" style={{
                                fontSize: '10px',
                                opacity: 0.7,
                                fontWeight: 'normal',
                                marginLeft: '8px'
                            }}>
                                {(displayValue || '').length}/{props.maxLength}
                            </span>
                        )}
                    </span>
                </label>
            )}

            {/* Error Message */}
            {isInvalid && (
                <span className="input-error-text" style={{
                    color: 'var(--danger)',
                    fontSize: '11px',
                    marginTop: '4px',
                    display: 'block'
                }}>
                    {error || 'Bu alan zorunludur'}
                </span>
            )}
        </div>
    )
}
