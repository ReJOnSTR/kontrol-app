import React, { useState, useEffect } from 'react'
import { LayoutDashboard, Users, Wallet, Briefcase, ChevronRight, UtensilsCrossed, Car, Banknote, Clock, ArrowUpRight, Sparkles, Building2, Crown, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useCompany } from '../context/CompanyContext'
import { useAuth } from '../context/AuthContext'

const portalStyles = `
    @keyframes portalShimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
    }
    @keyframes portalFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    .portal-header-area {
        animation: portalFadeIn 0.4s ease forwards;
    }
    .portal-card {
        position: relative;
        border-radius: 20px;
        padding: 24px;
        cursor: pointer;
        transition: all 0.25s var(--ease-out);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border: 1px solid rgba(255,255,255,0.06);
        animation: portalFadeIn 0.5s ease forwards;
        background: var(--bg-card);
    }
    .portal-card:hover {
        border-color: rgba(255,255,255,0.15);
        background: var(--bg-card-hover);
    }
    .portal-card::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: 20px;
        opacity: 0;
        transition: opacity 0.35s ease;
        z-index: 0;
    }
    .portal-card:hover::before {
        opacity: 1;
    }
    .portal-card > * {
        position: relative;
        z-index: 1;
    }
    .portal-card.disabled {
        cursor: default;
        opacity: 0.45;
        filter: grayscale(0.3);
    }
    .portal-card.disabled:hover {
        transform: none;
    }
    .portal-card .glow-orb {
        position: absolute;
        width: 180px;
        height: 180px;
        border-radius: 50%;
        filter: blur(70px);
        opacity: 0.12;
        transition: opacity 0.4s ease;
        z-index: 0;
    }
    .portal-card:hover .glow-orb {
        opacity: 0.25;
    }
    .portal-card .card-arrow {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
        flex-shrink: 0;
    }
    .portal-card:hover .card-arrow {
        transform: translateX(4px);
    }
    .portal-card:hover .card-arrow {
        transform: translateX(4px);
    }
`

export default function MainPortal() {
    const navigate = useNavigate()
    const { currentCompany } = useCompany()
    const { user } = useAuth()
    const [quickStats, setQuickStats] = useState({ vehicleCount: 0, cashBalance: 0, todayMeals: 0 })

    useEffect(() => {
        if (currentCompany) {
            loadQuickStats()
        }
    }, [currentCompany])

    const loadQuickStats = async () => {
        try {
            const [dashRes, finRes, mealRes] = await Promise.all([
                window.electronAPI.getDashboardStats(currentCompany.id),
                window.electronAPI.getFinanceStats(currentCompany.id),
                window.electronAPI.getMealTicketStats(currentCompany.id)
            ])
            setQuickStats({
                vehicleCount: dashRes.success ? dashRes.data.totalVehicles : 0,
                cashBalance: finRes.success ? finRes.data.cashBalance : 0,
                todayMeals: mealRes.success ? mealRes.data.todayCount : 0
            })
        } catch (e) {
            console.error('Failed to load portal stats:', e)
        }
    }

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(val || 0)
    }

    const getGreeting = () => {
        const hour = new Date().getHours()
        if (hour < 12) return 'Günaydın'
        if (hour < 18) return 'İyi Günler'
        return 'İyi Akşamlar'
    }

    const modules = [
        {
            id: 'fleet',
            title: 'Filo Yönetimi',
            description: 'Araçlar, bakımlar, sigorta ve servis takibi.',
            icon: LayoutDashboard,
            gradient: 'linear-gradient(145deg, rgba(59,130,246,0.08) 0%, rgba(99,102,241,0.04) 100%)',
            hoverGradient: 'linear-gradient(145deg, rgba(59,130,246,0.14) 0%, rgba(99,102,241,0.08) 100%)',
            color: '#3b82f6',
            glowColor: '#3b82f6',
            path: '/dashboard',
            active: true,
            features: ['Araç kayıtları', 'Bakım takibi', 'Muayene & Sigorta', 'Servis yönetimi'],
            stat: quickStats.vehicleCount > 0 ? `${quickStats.vehicleCount} araç kayıtlı` : null,
            statIcon: Car
        },
        {
            id: 'finance',
            title: 'Kasa & Finans',
            description: 'Nakit akışı, çek portföyü ve gelir/gider takibi.',
            icon: Wallet,
            gradient: 'linear-gradient(145deg, rgba(245,158,11,0.08) 0%, rgba(239,68,68,0.04) 100%)',
            hoverGradient: 'linear-gradient(145deg, rgba(245,158,11,0.14) 0%, rgba(239,68,68,0.08) 100%)',
            color: '#f59e0b',
            glowColor: '#f59e0b',
            path: '/finance-dashboard',
            active: true,
            features: ['Gelir/Gider takibi', 'Çek & Senet portföyü', 'Finans dashboard', 'Kasa defteri'],
            stat: quickStats.cashBalance !== 0 ? formatCurrency(quickStats.cashBalance) : null,
            statIcon: Banknote
        },
        {
            id: 'meals',
            title: 'Yemek Fişleri',
            description: 'Günlük yemek katılım takibi ve fiş yönetimi.',
            icon: UtensilsCrossed,
            gradient: 'linear-gradient(145deg, rgba(239,68,68,0.08) 0%, rgba(249,115,22,0.04) 100%)',
            hoverGradient: 'linear-gradient(145deg, rgba(239,68,68,0.14) 0%, rgba(249,115,22,0.08) 100%)',
            color: '#ef4444',
            glowColor: '#ef4444',
            path: '/meal-tickets',
            active: true,
            features: ['Günlük fiş kaydı', 'Kişi sayısı takibi', 'Aylık istatistikler', 'Not ekleme'],
            stat: quickStats.todayMeals > 0 ? `Bugün: ${quickStats.todayMeals} kişi` : null,
            statIcon: UtensilsCrossed
        },
        {
            id: 'hr',
            title: 'Personel Yönetimi',
            description: 'Personel kayıtları, maaş, izin ve mesai takibi.',
            icon: Users,
            gradient: 'linear-gradient(145deg, rgba(16,185,129,0.08) 0%, rgba(5,159,104,0.04) 100%)',
            hoverGradient: 'linear-gradient(145deg, rgba(16,185,129,0.14) 0%, rgba(5,159,104,0.08) 100%)',
            color: '#10b981',
            glowColor: '#10b981',
            path: '/personel-dashboard',
            active: true,
            features: ['Personel kayıtları', 'Maaş takibi', 'İzin yönetimi', 'Mesai & Zimmet']
        },
        {
            id: 'ops',
            title: 'İş & Operasyon',
            description: 'Projeler, şantiyeler ve görev dağılımı.',
            icon: Briefcase,
            gradient: 'linear-gradient(145deg, rgba(139,92,246,0.08) 0%, rgba(168,85,247,0.04) 100%)',
            hoverGradient: 'linear-gradient(145deg, rgba(139,92,246,0.14) 0%, rgba(168,85,247,0.08) 100%)',
            color: '#8b5cf6',
            glowColor: '#8b5cf6',
            path: '/works',
            active: true,
            features: ['Proje yönetimi', 'Şantiye takibi', 'Görev atamaları', 'İş emirleri']
        },
        {
            id: 'customers',
            title: 'Cari & Müşteri',
            description: 'Müşteri profilleri, cari hesaplar ve bakiyeler.',
            icon: Building2,
            gradient: 'linear-gradient(145deg, rgba(20,184,166,0.08) 0%, rgba(13,148,136,0.04) 100%)',
            hoverGradient: 'linear-gradient(145deg, rgba(20,184,166,0.14) 0%, rgba(13,148,136,0.08) 100%)',
            color: '#FD6400',
            glowColor: '#FD6400',
            path: '/customers',
            active: true,
            features: ['Müşteri profili', 'Açık bakiyeler', 'İletişim bilgileri', 'Geçmiş işler']
        },
        ...(user?.role === 'superadmin' ? [{
            id: 'platform',
            title: 'Platform Yönetimi',
            description: 'SaaS Master: Tüm şirketler, kullanıcılar, canlı sunucu sağlığı ve yedekleme.',
            icon: Crown,
            gradient: 'linear-gradient(145deg, rgba(245,158,11,0.12) 0%, rgba(217,119,6,0.06) 100%)',
            hoverGradient: 'linear-gradient(145deg, rgba(245,158,11,0.2) 0%, rgba(217,119,6,0.12) 100%)',
            color: '#f59e0b',
            glowColor: '#f59e0b',
            path: '/platform-admin',
            active: true,
            features: ['Tüm şirketler & Ghost modu', 'Global kullanıcılar', 'Sunucu sağlığı & Uptime', 'Veritabanı yedekleri']
        }] : [])
    ]

    const today = new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })

    // Split into main (active, first row large) and secondary
    const activeModules = modules.filter(m => m.active)
    const inactiveModules = modules.filter(m => !m.active)

    return (
        <>
            <style>{portalStyles}</style>
            <div style={{ padding: '24px 44px', maxWidth: '1240px', margin: '0 auto' }}>
                {/* Header */}
                <div className="portal-header-area" style={{ marginBottom: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '12px', marginBottom: '10px', fontWeight: '500' }}>
                                <Clock size={13} />
                                <span>{today}</span>
                            </div>
                            <h1 style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px', letterSpacing: '-0.3px' }}>
                                {getGreeting()}{user?.username ? `, ${user.username}` : ''} </h1>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5' }}>
                                {currentCompany
                                    ? <>{currentCompany.name} şirketinde çalışıyorsunuz. <span style={{ color: 'var(--text-muted)' }}>Bir modül seçerek başlayın.</span></>
                                    : 'Başlamak için sağ üstten bir şirket seçin.'
                                }
                            </p>
                        </div>
                        {currentCompany && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                                padding: '6px 14px', borderRadius: '24px', fontSize: '12px',
                                color: 'var(--primary)', fontWeight: '500'
                            }}>
                                <Sparkles size={13} />
                                {activeModules.length} aktif modül
                            </div>
                        )}
                    </div>
                </div>

                {/* Active Module Cards */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '18px',
                    marginBottom: inactiveModules.length > 0 ? '28px' : '0'
                }}>
                    {activeModules.map((mod, idx) => (
                        <div
                            key={mod.id}
                            className="portal-card"
                            style={{
                                background: mod.gradient,
                                animationDelay: `${idx * 0.08}s`,
                                opacity: 0
                            }}
                            onClick={() => navigate(mod.path)}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.boxShadow = `0 12px 40px ${mod.glowColor}15, 0 0 0 1px ${mod.glowColor}30`
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.boxShadow = 'none'
                            }}
                        >
                            {/* Glow Orb */}
                            <div className="glow-orb" style={{ background: mod.glowColor, top: '-40px', right: '-40px' }} />

                            {/* Header */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '18px' }}>
                                <div style={{
                                    width: '48px', height: '48px', borderRadius: '14px',
                                    background: `${mod.color}15`,
                                    border: `1px solid ${mod.color}20`,
                                    color: mod.color,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0
                                }}>
                                    <mod.icon size={24} strokeWidth={1.6} />
                                </div>
                                <div className="card-arrow" style={{
                                    background: `${mod.color}10`,
                                    color: mod.color
                                }}>
                                    <ArrowUpRight size={18} />
                                </div>
                            </div>

                            {/* Title */}
                            <h2 style={{ fontSize: '17px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>
                                {mod.title}
                            </h2>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '12.5px', lineHeight: '1.45', marginBottom: '16px' }}>
                                {mod.description}
                            </p>

                            {/* Feature chips */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '18px' }}>
                                {mod.features.map((feat, i) => (
                                    <span key={i} style={{
                                        fontSize: '10.5px', fontWeight: '500',
                                        padding: '3px 9px', borderRadius: '6px',
                                        background: `${mod.color}08`,
                                        color: 'var(--text-muted)',
                                        border: `1px solid ${mod.color}10`
                                    }}>
                                        {feat}
                                    </span>
                                ))}
                            </div>

                            {/* Stat Badge */}
                            <div style={{ marginTop: 'auto' }}>
                                {mod.stat && mod.statIcon ? (
                                    <div style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                                        background: `${mod.color}12`,
                                        padding: '5px 12px', borderRadius: '20px',
                                        fontSize: '11.5px', fontWeight: '600',
                                        color: mod.color,
                                        border: `1px solid ${mod.color}15`
                                    }}>
                                        <mod.statIcon size={12} />
                                        {mod.stat}
                                    </div>
                                ) : (
                                    <div style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                        fontSize: '12px', fontWeight: '500', color: mod.color
                                    }}>
                                        Modüle Git <ChevronRight size={14} />
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Inactive modules - compact row */}
                {inactiveModules.length > 0 && (
                    <div>
                        <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                            Yakında Gelecek
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${inactiveModules.length}, 1fr)`, gap: '14px' }}>
                            {inactiveModules.map((mod, idx) => (
                                <div
                                    key={mod.id}
                                    className="portal-card disabled"
                                    style={{
                                        background: mod.gradient,
                                        padding: '20px',
                                        animationDelay: `${(activeModules.length + idx) * 0.08}s`,
                                        opacity: 0
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                        <div style={{
                                            width: '40px', height: '40px', borderRadius: '12px',
                                            background: `${mod.color}10`, color: mod.color,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            flexShrink: 0
                                        }}>
                                            <mod.icon size={20} strokeWidth={1.6} />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '2px' }}>
                                                {mod.title}
                                            </div>
                                            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                                                {mod.description}
                                            </div>
                                        </div>
                                        <div style={{
                                            marginLeft: 'auto',
                                            fontSize: '9px', fontWeight: '600', color: 'var(--text-muted)',
                                            background: 'var(--bg-tertiary)',
                                            padding: '3px 10px', borderRadius: '20px',
                                            textTransform: 'uppercase', letterSpacing: '0.5px',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            Yapım Aşamasında
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </>
    )
}
