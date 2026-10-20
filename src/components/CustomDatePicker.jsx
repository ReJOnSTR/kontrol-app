import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react'

export default function CustomDatePicker({
    startDate,
    endDate,
    onChange
}) {
    const [isOpen, setIsOpen] = useState(false)
    const [internalStart, setInternalStart] = useState(startDate || '')
    const [internalEnd, setInternalEnd] = useState(endDate || '')
    const [popupStyle, setPopupStyle] = useState({})
    const ref = useRef(null)

    const updatePosition = () => {
        if (!isOpen || !ref.current) return
        const rect = ref.current.getBoundingClientRect()
        
        const popupWidth = 320
        const viewportWidth = window.innerWidth
        let left = rect.left

        // Viewport horizontal clamping
        if (left + popupWidth > viewportWidth - 10) {
            left = Math.max(10, viewportWidth - popupWidth - 10)
        }
        if (left < 10) left = 10

        // Vertical viewport clamping
        const estimatedHeight = 370
        let top = rect.bottom + 6
        if (top + estimatedHeight > window.innerHeight && rect.top > estimatedHeight) {
            top = Math.max(10, rect.top - estimatedHeight - 6)
        }

        setPopupStyle({
            position: 'fixed',
            top,
            left,
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

        setInternalStart(startDate || '')
        setInternalEnd(endDate || '')
    }, [startDate, endDate])

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (ref.current && !ref.current.contains(e.target)) {
                const popup = document.querySelector('.date-picker-popup')
                if (popup && popup.contains(e.target)) return
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

    const handleApply = () => {
        onChange(internalStart, internalEnd)
        setIsOpen(false)
    }

    const handleClear = () => {
        setInternalStart('')
        setInternalEnd('')
        onChange('', '')
        setIsOpen(false)
    }

    const presets = [
        { label: 'Bugün', days: 0 },
        { label: 'Son 7 Gün', days: 7 },
        { label: 'Son 30 Gün', days: 30 },
        { label: 'Bu Ay', type: 'month' }
    ]

    const handlePreset = (preset) => {
        const end = new Date()
        const start = new Date()

        if (preset.type === 'month') {
            start.setDate(1)
        } else {
            start.setDate(end.getDate() - preset.days)
        }

        setInternalStart(start.toISOString().split('T')[0])
        setInternalEnd(end.toISOString().split('T')[0])
    }

    return (
        <div className="custom-date-picker" ref={ref}>
            <button
                className={`date-picker-trigger ${isOpen ? 'open' : ''} ${(startDate || endDate) ? 'active' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                type="button"
            >
                <Calendar size={16} />
                <span>
                    {startDate || endDate
                        ? `${startDate ? startDate.split('-').reverse().join('.') : 'Başlangıç'} - ${endDate ? endDate.split('-').reverse().join('.') : 'Bitiş'}`
                        : 'Tarih Aralığı'}
                </span>
                {(startDate || endDate) && (
                    <div
                        className="date-clear-btn"
                        onClick={(e) => {
                            e.stopPropagation()
                            handleClear()
                        }}
                    >
                        <X size={14} />
                    </div>
                )}
            </button>

            {isOpen && createPortal(
                <div 
                    className="date-picker-popup" 
                    style={popupStyle} 
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                >
                    <div className="date-presets">
                        {presets.map((preset, index) => (
                            <button
                                key={index}
                                className="preset-btn"
                                onClick={() => handlePreset(preset)}
                                type="button"
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>

                    <div className="date-inputs">
                        <div className="date-input-group">
                            <label>Başlangıç</label>
                            <input
                                type="date"
                                value={internalStart}
                                onChange={(e) => setInternalStart(e.target.value)}
                            />
                        </div>
                        <div className="date-input-group">
                            <label>Bitiş</label>
                            <input
                                type="date"
                                value={internalEnd}
                                onChange={(e) => setInternalEnd(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="date-actions">
                        <button
                            className="btn-text"
                            onClick={() => setIsOpen(false)}
                            type="button"
                        >
                            İptal
                        </button>
                        <button
                            className="btn-primary-sm"
                            onClick={handleApply}
                            type="button"
                        >
                            Uygula
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </div>
    )
}
