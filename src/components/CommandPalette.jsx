import React, { useState, useEffect, useRef } from 'react'
import { Search, Car, User, Building2, X, Command } from 'lucide-react'
import { useTabs } from '../context/TabContext'
import { useCompany } from '../context/CompanyContext'

export default function CommandPalette() {
    const [isOpen, setIsOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [results, setResults] = useState([])
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [loading, setLoading] = useState(false)
    
    const { currentCompany } = useCompany()
    const { openNewTab } = useTabs()
    const inputRef = useRef(null)

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
            inputRef.current?.focus()
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
            setQuery('')
            setResults([])
        }
    }, [isOpen])

    useEffect(() => {
        const performSearch = async () => {
            if (query.length < 2) {
                setResults([])
                return
            }
            setLoading(true)
            try {
                const res = await window.electronAPI.searchGlobal(currentCompany?.id, query)
                if (res.success) {
                    setResults(res.data)
                    setSelectedIndex(0)
                }
            } catch (err) {
                console.error(err)
            } finally {
                setLoading(false)
            }
        }

        const timer = setTimeout(performSearch, 300)
        return () => clearTimeout(timer)
    }, [query, currentCompany])

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
            openNewTab(path, false, label)
            setIsOpen(false)
        }
    }

    const handleKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setSelectedIndex(prev => (prev + 1) % results.length)
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setSelectedIndex(prev => (prev - 1 + results.length) % results.length)
        } else if (e.key === 'Enter') {
            handleSelect(results[selectedIndex])
        }
    }

    if (!isOpen) return null

    return (
        <div className="command-palette-overlay" onClick={() => setIsOpen(false)}>
            <div className="command-palette-container" onClick={e => e.stopPropagation()}>
                <div className="command-palette-header">
                    <Search size={20} className="text-muted" />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Araç plakası, personel adı veya müşteri arayın..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="command-palette-input"
                    />
                    {query.length > 0 && results.length > 0 && (
                        <div className="command-palette-results-label">
                            {results.length} sonuç
                        </div>
                    )}
                    <div className="command-palette-esc">ESC</div>
                </div>

                <div className="command-palette-content">
                    {loading && (
                        <div className="command-palette-loading">Aranıyor...</div>
                    )}

                    {!loading && query.length > 0 && results.length === 0 && (
                        <div className="command-palette-empty">Sonuç bulunamadı.</div>
                    )}

                    {!loading && query.length === 0 && (
                        <div className="command-palette-hint">
                            <Command size={16} />
                            <span>Hızlıca arama yapmak için yazmaya başlayın</span>
                        </div>
                    )}

                    <div className="command-palette-results">
                        {results.map((item, index) => (
                            <div
                                key={`${item.type}-${item.id}`}
                                className={`command-palette-item ${index === selectedIndex ? 'active' : ''}`}
                                onMouseEnter={() => setSelectedIndex(index)}
                                onClick={() => handleSelect(item)}
                            >
                                <div className={`command-palette-icon-wrapper ${item.type}`}>
                                    {item.icon === 'Car' && <Car size={18} />}
                                    {item.icon === 'User' && <User size={18} />}
                                    {item.icon === 'Building2' && <Building2 size={18} />}
                                </div>
                                <div className="command-palette-item-info">
                                    <div className="title">{item.title}</div>
                                    <div className="subtitle">{item.subtitle}</div>
                                </div>
                                <div className="command-palette-item-type">
                                    {item.type === 'vehicle' && 'Araç'}
                                    {item.type === 'employee' && 'Personel'}
                                    {item.type === 'customer' && 'Müşteri'}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="command-palette-footer">
                    <div className="footer-item">
                        <span className="key">↵</span> Seç
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
