import React, { useState, useEffect, useRef } from 'react'
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'

const MONTH_NAMES = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
]

const MONTH_SHORT = [
    'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz',
    'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'
]

const MonthFilter = ({ value, onChange, minDate }) => {
    const [isOpen, setIsOpen] = useState(false)
    const [viewYear, setViewYear] = useState(new Date().getFullYear())
    const containerRef = useRef(null)

    // Parse current value to sync viewYear when opening
    useEffect(() => {
        if (value && value.includes('-')) {
            setViewYear(parseInt(value.split('-')[0], 10))
        }
    }, [value, isOpen])

    // Click Outside Handling
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Calculate previous month string (YYYY-MM)
    const getPrevMonthStr = () => {
        if (!value || !value.includes('-')) return null
        const [year, month] = value.split('-').map(Number)
        const d = new Date(year, month - 2, 1)
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        return `${y}-${m}`
    }

    // Calculate next month string (YYYY-MM)
    const getNextMonthStr = () => {
        if (!value || !value.includes('-')) return null
        const [year, month] = value.split('-').map(Number)
        const d = new Date(year, month, 1)
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        return `${y}-${m}`
    }

    const prevMonthStr = getPrevMonthStr()
    const isPrevDisabled = minDate && prevMonthStr && prevMonthStr < minDate

    const handlePrevMonth = (e) => {
        e.stopPropagation()
        if (isPrevDisabled || !prevMonthStr) return
        onChange(prevMonthStr)
    }

    const handleNextMonth = (e) => {
        e.stopPropagation()
        const nextMonthStr = getNextMonthStr()
        if (nextMonthStr) {
            onChange(nextMonthStr)
        }
    }

    const handleYearChange = (delta) => {
        setViewYear(prev => prev + delta)
    }

    const handleMonthSelect = (monthIndex) => {
        const monthStr = (monthIndex + 1).toString().padStart(2, '0')
        const targetStr = `${viewYear}-${monthStr}`
        if (minDate && targetStr < minDate) return
        onChange(targetStr)
        setIsOpen(false)
    }

    const handleCurrentMonth = () => {
        const now = new Date()
        const y = now.getFullYear()
        const m = String(now.getMonth() + 1).padStart(2, '0')
        onChange(`${y}-${m}`)
        setIsOpen(false)
    }

    // Current parsed values
    let currentYear = -1
    let currentMonthIndex = -1
    let formattedLabel = value || ''

    if (value && value.includes('-')) {
        const [yStr, mStr] = value.split('-')
        currentYear = parseInt(yStr, 10)
        currentMonthIndex = parseInt(mStr, 10) - 1
        if (currentMonthIndex >= 0 && currentMonthIndex < 12) {
            formattedLabel = `${MONTH_NAMES[currentMonthIndex]} ${currentYear}`
        }
    }

    return (
        <div className="custom-date-picker month-filter-wrapper" ref={containerRef} style={{ position: 'relative', width: '100%', minWidth: '220px' }}>
            {/* Unified Segmented Nav: [ < ] [ 📅 Ay Yıl v ] [ > ] */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    height: '36px',
                    backgroundColor: 'var(--bg-secondary)',
                    border: `1px solid ${isOpen ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                    borderRadius: '8px',
                    padding: '2px',
                    transition: 'all 0.2s ease',
                    boxShadow: isOpen ? '0 0 0 2px var(--accent-subtle)' : 'none'
                }}
            >
                {/* Sol Buton: Önceki Ay */}
                <button
                    type="button"
                    onClick={handlePrevMonth}
                    disabled={isPrevDisabled}
                    title={isPrevDisabled ? 'Daha önceki bir tarih seçilemez' : 'Önceki Ay'}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '30px',
                        height: '30px',
                        borderRadius: '6px',
                        border: 'none',
                        background: 'transparent',
                        color: isPrevDisabled ? 'var(--text-muted)' : 'var(--text-secondary)',
                        cursor: isPrevDisabled ? 'not-allowed' : 'pointer',
                        opacity: isPrevDisabled ? 0.35 : 1,
                        transition: 'background-color 0.15s, color 0.15s',
                        flexShrink: 0
                    }}
                    onMouseEnter={(e) => {
                        if (!isPrevDisabled) {
                            e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'
                            e.currentTarget.style.color = 'var(--text-primary)'
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (!isPrevDisabled) {
                            e.currentTarget.style.backgroundColor = 'transparent'
                            e.currentTarget.style.color = 'var(--text-secondary)'
                        }
                    }}
                >
                    <ChevronLeft size={16} />
                </button>

                {/* Orta Buton: Tarih Göstergesi & Açılır Takvim */}
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        height: '30px',
                        flex: 1,
                        padding: '0 8px',
                        borderRadius: '6px',
                        border: 'none',
                        background: isOpen ? 'var(--bg-tertiary)' : 'transparent',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 600,
                        transition: 'background-color 0.15s'
                    }}
                    onMouseEnter={(e) => {
                        if (!isOpen) e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'
                    }}
                    onMouseLeave={(e) => {
                        if (!isOpen) e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                >
                    <Calendar size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                    <span style={{ whiteSpace: 'nowrap', userSelect: 'none' }}>
                        {formattedLabel}
                    </span>
                    <ChevronDown
                        size={13}
                        style={{
                            color: 'var(--text-muted)',
                            transform: isOpen ? 'rotate(180deg)' : 'none',
                            transition: 'transform 0.2s',
                            flexShrink: 0
                        }}
                    />
                </button>

                {/* Sağ Buton: Sonraki Ay */}
                <button
                    type="button"
                    onClick={handleNextMonth}
                    title="Sonraki Ay"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '30px',
                        height: '30px',
                        borderRadius: '6px',
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s, color 0.15s',
                        flexShrink: 0
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'
                        e.currentTarget.style.color = 'var(--text-primary)'
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent'
                        e.currentTarget.style.color = 'var(--text-secondary)'
                    }}
                >
                    <ChevronRight size={16} />
                </button>
            </div>

            {/* Açılır Ay & Yıl Seçici Modal / Pop-up */}
            {isOpen && (
                <div
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        right: 0,
                        width: '240px',
                        maxWidth: 'calc(100vw - 24px)',
                        boxSizing: 'border-box',
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '12px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                        zIndex: 1000,
                        padding: '14px',
                        animation: 'fadeInDown 0.15s ease'
                    }}
                >
                    {/* Header: Yıl Seçici */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <button
                            type="button"
                            onClick={() => handleYearChange(-1)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                borderRadius: '6px',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                width: '28px',
                                height: '28px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'background 0.15s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{viewYear}</span>
                        <button
                            type="button"
                            onClick={() => handleYearChange(1)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                borderRadius: '6px',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                width: '28px',
                                height: '28px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'background 0.15s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    {/* Body: Ay Grid'i */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                        {MONTH_SHORT.map((m, idx) => {
                            const isSelected = viewYear === currentYear && idx === currentMonthIndex
                            const isCurrentMonth = viewYear === new Date().getFullYear() && idx === new Date().getMonth()
                            const monthCode = (idx + 1).toString().padStart(2, '0')
                            const isMonthDisabled = minDate && `${viewYear}-${monthCode}` < minDate

                            return (
                                <button
                                    key={m}
                                    type="button"
                                    onClick={() => handleMonthSelect(idx)}
                                    disabled={isMonthDisabled}
                                    style={{
                                        height: '32px',
                                        fontSize: '12px',
                                        fontWeight: isSelected ? 700 : 500,
                                        borderRadius: '8px',
                                        background: isSelected ? 'var(--accent-primary)' : 'transparent',
                                        color: isSelected ? '#ffffff' : (isMonthDisabled ? 'var(--text-muted)' : 'var(--text-secondary)'),
                                        border: isCurrentMonth && !isSelected ? '1px solid var(--accent-primary)' : '1px solid transparent',
                                        cursor: isMonthDisabled ? 'not-allowed' : 'pointer',
                                        opacity: isMonthDisabled ? 0.35 : 1,
                                        transition: 'all 0.1s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!isSelected && !isMonthDisabled) {
                                            e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'
                                            e.currentTarget.style.color = 'var(--text-primary)'
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isSelected && !isMonthDisabled) {
                                            e.currentTarget.style.backgroundColor = 'transparent'
                                            e.currentTarget.style.color = 'var(--text-secondary)'
                                        }
                                    }}
                                >
                                    {m}
                                </button>
                            )
                        })}
                    </div>

                    {/* Footer: Bu Ay Hızlı Seçim */}
                    <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'center' }}>
                        <button
                            type="button"
                            onClick={handleCurrentMonth}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--accent-primary)',
                                fontSize: '11.5px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                transition: 'background-color 0.15s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-subtle)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            Bu Aya Git ({MONTH_NAMES[new Date().getMonth()]})
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

export default MonthFilter
