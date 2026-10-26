import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Car, User, Building2, X, Command, ArrowRight } from 'lucide-react'
import { useTabs } from '../context/TabContext'
import { useCompany } from '../context/CompanyContext'

export default function CommandPalette() {
    const [isOpen, setIsOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [results, setResults] = useState([])
    const [filterType, setFilterType] = useState('all') // 'all' | 'vehicle' | 'employee' | 'customer'
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [loading, setLoading] = useState(false)
    
    const { currentCompany } = useCompany()
    const { openNewTab } = useTabs()
    const navigate = useNavigate()
    const inputRef = useRef(null)

    // Helper to extract reliable company ID
    const getActiveCompanyId = () => {
        if (currentCompany?.id) return currentCompany.id
        try {
            const stored = localStorage.getItem('aractakip_company') || localStorage.getItem('company')
            if (stored) {
                const parsed = JSON.parse(stored)
                return typeof parsed === 'object' ? parsed?.id : Number(stored)
            }
        } catch (_) {}
        return Number(localStorage.getItem('aractakip_company')) || null
    }

    useEffect(() => {
        const handleKeyDown = (e) => {
            // Support both Ctrl+K and Cmd+K (case-insensitive)
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault()
                setIsOpen(true)
            }
            if (e.key === 'Escape') {
                setIsOpen(false)
            }
        }

        const handleCustomOpen = () => {
            setIsOpen(true)
        }

        window.addEventListener('keydown', handleKeyDown)
        window.addEventListener('open-command-palette', handleCustomOpen)
        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('open-command-palette', handleCustomOpen)
        }
    }, [])

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 50)
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
            setQuery('')
            setResults([])
            setFilterType('all')
            setSelectedIndex(0)
        }
    }, [isOpen])

    useEffect(() => {
        const performSearch = async () => {
            const cleanQuery = query.trim()
            if (cleanQuery.length < 1) {
                setResults([])
                setLoading(false)
                return
            }
            setLoading(true)
            try {
                const targetCompanyId = getActiveCompanyId()
                if (window.electronAPI?.searchGlobal) {
                    const res = await window.electronAPI.searchGlobal(targetCompanyId, cleanQuery)
                    if (res && res.success && Array.isArray(res.data)) {
                        setResults(res.data)
                        setSelectedIndex(0)
                    } else {
                        setResults([])
                    }
                } else {
                    setResults([])
                }
            } catch (err) {
                console.error('[CommandPalette] Search error:', err)
                setResults([])
            } finally {
                setLoading(false)
            }
        }

        const timer = setTimeout(performSearch, 200)
        return () => clearTimeout(timer)
    }, [query, currentCompany])

    // Filter results based on active category tab
    const filteredResults = useMemo(() => {
        if (filterType === 'all') return results
        return results.filter(item => item.type === filterType)
    }, [results, filterType])

    // Counts for tabs
    const counts = useMemo(() => {
        return {
            all: results.length,
            vehicle: results.filter(r => r.type === 'vehicle').length,
            employee: results.filter(r => r.type === 'employee').length,
            customer: results.filter(r => r.type === 'customer').length
        }
    }, [results])

    useEffect(() => {
        setSelectedIndex(0)
    }, [filterType])

    useEffect(() => {
        // Auto-scroll selected item into view
        const activeItem = document.querySelector('.command-palette-item.active')
        if (activeItem) {
            activeItem.scrollIntoView({
                block: 'nearest',
                behavior: 'smooth'
            })
        }
    }, [selectedIndex])

    const handleSelect = (item) => {
        if (!item) return
        
        let path = ''
        let label = item.title
        
        if (item.type === 'vehicle') path = `/vehicles/${item.id}`
        if (item.type === 'employee') path = `/employees/${item.id}`
        if (item.type === 'customer') path = `/customers/${item.id}`
        
        if (path) {
            setIsOpen(false)
            try {
                if (openNewTab) openNewTab(path, false, label)
            } catch (_) {}
            navigate(path)
        }
    }

    const handleKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            if (filteredResults.length > 0) {
                setSelectedIndex(prev => (prev + 1) % filteredResults.length)
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            if (filteredResults.length > 0) {
                setSelectedIndex(prev => (prev - 1 + filteredResults.length) % filteredResults.length)
            }
        } else if (e.key === 'Enter') {
            e.preventDefault()
            if (filteredResults[selectedIndex]) {
                handleSelect(filteredResults[selectedIndex])
            }
        }
    }

    if (!isOpen) return null

    return (
        <div className="command-palette-overlay" onClick={() => setIsOpen(false)}>
            <div className="command-palette-container" onClick={e => e.stopPropagation()}>
                <div className="command-palette-header">
                    <Search size={19} className="command-palette-search-icon" />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Araç plakası, marka/model, personel veya müşteri ara..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="command-palette-input"
                        autoComplete="off"
                        spellCheck="false"
                    />
                    {query.length > 0 && (
                        <button
                            type="button"
                            className="command-palette-clear-btn"
                            onClick={() => {
                                setQuery('')
                                setResults([])
                                inputRef.current?.focus()
                            }}
                            title="Temizle"
                        >
                            <X size={15} />
                        </button>
                    )}
                    <button
                        type="button"
                        className="command-palette-close-btn"
                        onClick={() => setIsOpen(false)}
                        title="Kapat (ESC)"
                    >
                        <span className="esc-text">ESC</span>
                        <X size={16} className="close-icon" />
                    </button>
                </div>

                {/* Filter Category Tabs */}
                <div className="command-palette-tabs">
                    <button
                        type="button"
                        className={`command-palette-tab ${filterType === 'all' ? 'active' : ''}`}
                        onClick={() => setFilterType('all')}
                    >
                        <span>Tümü</span>
                        {results.length > 0 && <span className="tab-count">{counts.all}</span>}
                    </button>
                    <button
                        type="button"
                        className={`command-palette-tab ${filterType === 'vehicle' ? 'active' : ''}`}
                        onClick={() => setFilterType('vehicle')}
                    >
                        <Car size={14} />
                        <span>Araçlar</span>
                        {counts.vehicle > 0 && <span className="tab-count">{counts.vehicle}</span>}
                    </button>
                    <button
                        type="button"
                        className={`command-palette-tab ${filterType === 'employee' ? 'active' : ''}`}
                        onClick={() => setFilterType('employee')}
                    >
                        <User size={14} />
                        <span>Personeller</span>
                        {counts.employee > 0 && <span className="tab-count">{counts.employee}</span>}
                    </button>
                    <button
                        type="button"
                        className={`command-palette-tab ${filterType === 'customer' ? 'active' : ''}`}
                        onClick={() => setFilterType('customer')}
                    >
                        <Building2 size={14} />
                        <span>Müşteriler</span>
                        {counts.customer > 0 && <span className="tab-count">{counts.customer}</span>}
                    </button>
                </div>

                <div className="command-palette-content">
                    {loading && (
                        <div className="command-palette-loading">
                            <div className="loading-spinner-small" />
                            <span>Aranıyor...</span>
                        </div>
                    )}

                    {!loading && query.trim().length > 0 && filteredResults.length === 0 && (
                        <div className="command-palette-empty">
                            <Search size={28} className="empty-icon" />
                            <div className="empty-title">Sonuç bulunamadı</div>
                            <div className="empty-desc">
                                "{query}" için {filterType === 'vehicle' ? 'araç' : filterType === 'employee' ? 'personel' : filterType === 'customer' ? 'müşteri' : ''} kaydı bulunamadı.
                            </div>
                        </div>
                    )}

                    {!loading && query.trim().length === 0 && (
                        <div className="command-palette-hint">
                            <div className="hint-header">
                                <Command size={18} />
                                <span>Hızlı Arama ve Gezinme</span>
                            </div>
                            <div className="hint-tips">
                                <span className="hint-tip"><strong>Araçlar:</strong> Plaka (örn. 34 ABC 123), marka veya model</span>
                                <span className="hint-tip"><strong>Personeller:</strong> Ad, soyad, telefon veya TC Kimlik</span>
                                <span className="hint-tip"><strong>Müşteriler:</strong> Şirket/Müşteri adı veya telefon</span>
                            </div>
                        </div>
                    )}

                    <div className="command-palette-results">
                        {filteredResults.map((item, index) => (
                            <div
                                key={`${item.type}-${item.id}`}
                                className={`command-palette-item ${index === selectedIndex ? 'active' : ''}`}
                                onMouseEnter={() => setSelectedIndex(index)}
                                onClick={() => handleSelect(item)}
                            >
                                <div className={`command-palette-icon-wrapper ${item.type}`}>
                                    {item.type === 'vehicle' && <Car size={18} />}
                                    {item.type === 'employee' && <User size={18} />}
                                    {item.type === 'customer' && <Building2 size={18} />}
                                </div>
                                <div className="command-palette-item-info">
                                    <div className="title">{item.title}</div>
                                    <div className="subtitle">{item.subtitle}</div>
                                </div>
                                <div className="command-palette-item-meta">
                                    <span className={`command-palette-item-type badge-${item.type}`}>
                                        {item.type === 'vehicle' && 'Araç'}
                                        {item.type === 'employee' && 'Personel'}
                                        {item.type === 'customer' && 'Müşteri'}
                                    </span>
                                    <ArrowRight size={14} className="action-arrow" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="command-palette-footer">
                    <div className="footer-item">
                        <span className="key">↵</span> Seç / Git
                    </div>
                    <div className="footer-item">
                        <span className="key">↓↑</span> Gezin
                    </div>
                    <div className="footer-item">
                        <span className="key">ESC</span> Kapat
                    </div>
                </div>
            </div>
        </div>
    )
}
