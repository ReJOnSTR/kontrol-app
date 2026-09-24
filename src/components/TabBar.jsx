import React, { useState, useRef, useEffect } from 'react'
import { X, GripVertical, Building2, ChevronDown, User, LogOut, Settings, Plus, ArrowLeft, ArrowRight, Crown, Eye } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTabs } from '../context/TabContext'
import { useAuth } from '../context/AuthContext'
import { useCompany } from '../context/CompanyContext'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core'
import { arrayMove, SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function SortableTab({ tab, isActive, activateTab, closeTab }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tab.id })

    const style = {
        transform: transform ? CSS.Transform.toString({
            ...transform,
            y: 0 
        }) : undefined,
        transition: transform ? transition : undefined,
        zIndex: isDragging ? 200 : (isActive ? 10 : 1),
        opacity: isDragging ? 0.9 : (isActive ? 1 : 0.8),
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`tab-item ${isActive ? 'active' : ''} ${isDragging ? 'dragging' : ''}`}
            onClick={() => activateTab(tab.id)}
            {...attributes}
            {...listeners}
        >
            {tab.icon && <tab.icon size={14} className="tab-icon" />}
            <span className="tab-label">{tab.label}</span>
            <button
                className="tab-close"
                onClick={(e) => closeTab(tab.id, e)}
            >
                <X size={12} />
            </button>
        </div>
    )
}

export default function TabBar() {
    const { tabs, activeTabId, activateTab, closeTab, updateTabsOrder, openNewTab, canGoBack, canGoForward, goBack, goForward } = useTabs()
    const { user, logout } = useAuth()
    const { companies, currentCompany, selectCompany, isImpersonating } = useCompany()
    const navigate = useNavigate()
    const location = useLocation()
    const [showCompanyDropdown, setShowCompanyDropdown] = useState(false)
    const [showUserDropdown, setShowUserDropdown] = useState(false)

    const isSuperAdmin = user?.role === 'superadmin'

    // Force re-render when location changes so canGoBack/canGoForward update
    const [, forceUpdate] = useState(0)
    React.useEffect(() => {
        forceUpdate(n => n + 1)
    }, [location])

    const scrollRef = useRef(null)

    useEffect(() => {
        const el = scrollRef.current
        if (!el) return

        const handleWheel = (e) => {
            if (e.deltaY !== 0) {
                e.preventDefault()
                el.scrollLeft += e.deltaY
            }
        }

        el.addEventListener('wheel', handleWheel, { passive: false })
        return () => el.removeEventListener('wheel', handleWheel)
    }, [])

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        })
    )

    const [activeId, setActiveId] = useState(null)
    const activeTab = tabs.find(t => t.id === activeId)

    const handleDragStart = (event) => {
        setActiveId(event.active.id)
    }

    const handleDragEnd = (event) => {
        const { active, over } = event
        if (over && active.id !== over.id) {
            const oldIndex = tabs.findIndex((t) => t.id === active.id)
            const newIndex = tabs.findIndex((t) => t.id === over.id)
            updateTabsOrder(arrayMove(tabs, oldIndex, newIndex))
        }
        setActiveId(null)
    }

    const handleCompanySelect = (company) => {
        selectCompany(company)
        setShowCompanyDropdown(false)
    }

    if (!tabs || tabs.length === 0) return null

    const restrictToHorizontalAxis = ({ transform }) => {
        return {
            ...transform,
            y: 0,
        };
    };

    const backEnabled = canGoBack()
    const forwardEnabled = canGoForward()

    return (
        <div className="tab-bar">
            {/* Navigation Buttons (Fixed) */}
            <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%', marginBottom: '-1px', flexShrink: 0 }}>
                <button
                    className="tab-nav-btn"
                    onClick={() => backEnabled && goBack()}
                    title="Geri Dön"
                    style={{ opacity: backEnabled ? 1 : 0.3, cursor: backEnabled ? 'pointer' : 'default' }}
                    disabled={!backEnabled}
                >
                    <ArrowLeft size={16} />
                </button>
                <button
                    className="tab-nav-btn forward-btn"
                    onClick={() => forwardEnabled && goForward()}
                    title="İleri Git"
                    style={{ opacity: forwardEnabled ? 1 : 0.3, cursor: forwardEnabled ? 'pointer' : 'default' }}
                    disabled={!forwardEnabled}
                >
                    <ArrowRight size={16} />
                </button>
            </div>

            {/* Left: Draggable Tabs (Scrolling) */}
            <div className="tab-bar-left" ref={scrollRef}>
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragCancel={() => setActiveId(null)}
                    modifiers={[restrictToHorizontalAxis]}
                >
                    <div 
                        className="tab-scroll-container"
                    >
                        <SortableContext
                            items={tabs.map(t => t.id)}
                            strategy={horizontalListSortingStrategy}
                        >
                            {tabs.map(tab => (
                                <SortableTab
                                    key={tab.id}
                                    tab={tab}
                                    isActive={tab.id === activeTabId}
                                    activateTab={activateTab}
                                    closeTab={closeTab}
                                />
                            ))}
                        </SortableContext>
                        <button
                            className="tab-add-btn"
                            onClick={() => user?.role === 'personnel' ? openNewTab('/personnel-profile', false, 'Profilim & Bilgilerim') : openNewTab('/portal', false, 'Ana Portal')}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '32px',
                                height: '32px',
                                borderRadius: '6px',
                                border: 'none',
                                background: 'transparent',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                marginLeft: '8px',
                                marginRight: '8px',
                                marginBottom: '4px',
                                flexShrink: 0
                            }}
                            title={user?.role === 'personnel' ? "Yeni Profilim Sekmesi Aç" : "Yeni Ana Portal Sekmesi Aç"}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            <Plus size={18} />
                        </button>
                    </div>

                    <DragOverlay dropAnimation={null}>
                        {activeId && activeTab ? (
                            <div className={`tab-item overlay ${activeId === activeTabId ? 'active' : ''}`}>
                                {activeTab.icon && <activeTab.icon size={14} className="tab-icon" />}
                                <span className="tab-label">{activeTab.label}</span>
                                <div className="tab-close" style={{ opacity: 1 }}>
                                    <X size={12} />
                                </div>
                            </div>
                        ) : null}
                    </DragOverlay>
                </DndContext>
            </div>

            {/* Right: Header Actions */}
            <div className="tab-bar-right">
                <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Company Selector - Hidden for Standalone SuperAdmin in Main Window */}
                    {!(isSuperAdmin && !isImpersonating) && (
                        <div className="company-selector">
                            {user?.role === 'personnel' || isImpersonating ? (
                                <div
                                    className="company-selector-btn"
                                    style={{ cursor: 'default', opacity: 0.9, pointerEvents: 'none' }}
                                >
                                    <Building2 size={16} />
                                    <span>{currentCompany?.name || ''}</span>
                                </div>
                            ) : (
                                <button
                                    className="company-selector-btn"
                                    onClick={() => setShowCompanyDropdown(!showCompanyDropdown)}
                                >
                                    <Building2 size={16} />
                                    <span>{currentCompany?.name || 'Şirket Seçin'}</span>
                                    <ChevronDown size={14} />
                                </button>
                            )}

                            {showCompanyDropdown && (
                                <>
                                    <div
                                        className="dropdown-backdrop"
                                        style={{ position: 'fixed', inset: 0, zIndex: 199 }}
                                        onClick={() => setShowCompanyDropdown(false)}
                                    />
                                    <div className="company-dropdown">
                                        {companies.length === 0 ? (
                                            <div className="company-dropdown-item">
                                                <span style={{ color: 'var(--text-secondary)' }}>Henüz şirket eklenmemiş</span>
                                            </div>
                                        ) : (
                                            companies.map((company) => (
                                                <div
                                                    key={company.id}
                                                    className={`company-dropdown-item ${currentCompany?.id === company.id ? 'active' : ''}`}
                                                    onClick={() => handleCompanySelect(company)}
                                                >
                                                    <Building2 size={18} />
                                                    <span>{company.name}</span>
                                                </div>
                                            ))
                                        )}
                                        <div
                                            className="company-dropdown-item management-action"
                                            onClick={() => { openNewTab('/companies', false, 'Şirket Yönetimi'); setShowCompanyDropdown(false) }}
                                        >
                                            <Building2 size={16} />
                                            <span>Şirket Yönetimi</span>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Direct Settings Button */}
                    {user?.role !== 'personnel' && (
                        <button
                            className="company-selector-btn"
                            style={{ padding: '6px 9px', minWidth: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={() => openNewTab('/settings?module=portal', false, 'Ayarlar')}
                            title="Sistem & Uygulama Ayarları"
                        >
                            <Settings size={15} />
                        </button>
                    )}

                    {/* User Menu */}
                    <div className="user-menu">
                        <button
                            className="user-menu-btn"
                            onClick={() => setShowUserDropdown(!showUserDropdown)}
                        >
                            <div className="user-avatar" style={{ width: '24px', height: '24px', fontSize: '10px' }}>
                                {user?.username?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <ChevronDown size={14} />
                        </button>

                        {showUserDropdown && (
                            <>
                                <div
                                    className="dropdown-backdrop"
                                    style={{ position: 'fixed', inset: 0, zIndex: 199 }}
                                    onClick={() => setShowUserDropdown(false)}
                                />
                                <div className="user-dropdown">
                                    <div 
                                        className="user-dropdown-item" 
                                        style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
                                        onClick={() => { 
                                            if (user?.role === 'personnel') {
                                                openNewTab('/personnel-profile', false, 'Profilim & Bilgilerim')
                                            } else {
                                                openNewTab('/profile')
                                            }
                                            setShowUserDropdown(false) 
                                        }}
                                    >
                                        <User size={16} />
                                        <div>
                                            <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{user?.full_name || user?.username}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{user?.email}</div>
                                        </div>
                                    </div>
                                    {isSuperAdmin && (
                                        <div 
                                            className="user-dropdown-item" 
                                            style={{ color: '#f59e0b', fontWeight: 600 }}
                                            onClick={() => { openNewTab('/platform-admin', false, 'Platform Yönetimi'); setShowUserDropdown(false) }}
                                        >
                                            <Crown size={15} />
                                            <span>Platform Yönetimi</span>
                                        </div>
                                    )}
                                    {user?.role !== 'personnel' ? (
                                        <div className="user-dropdown-item" onClick={() => { openNewTab('/settings?module=portal', false, 'Ayarlar'); setShowUserDropdown(false) }}>
                                            <Settings size={16} />
                                            <span>Genel Ayarlar</span>
                                        </div>
                                    ) : (
                                        <div className="user-dropdown-item" onClick={() => { navigate('/change-password'); setShowUserDropdown(false) }}>
                                            <Settings size={16} />
                                            <span>Şifre Değiştir</span>
                                        </div>
                                    )}
                                    <div className="user-dropdown-item danger" onClick={logout}>
                                        <LogOut size={16} />
                                        <span>Çıkış Yap</span>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
