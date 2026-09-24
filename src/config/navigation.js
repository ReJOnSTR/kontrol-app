import {
    LayoutDashboard,
    Car,
    Wrench,
    ClipboardCheck,
    CheckCircle,
    Shield,
    Settings,
    FileText,
    ClipboardList,
    Layers,
    Truck,
    Wallet,
    FileSignature,
    Banknote,
    UtensilsCrossed,
    CircleDollarSign,
    Users,
    UserCheck,
    Briefcase,
    Building2,
    User,
    Calendar,
    Clock,
    Globe,
    Crown,
    Activity,
    Database,
    ScrollText,
    Megaphone,
    History,
    ShieldAlert,
    Mail
} from 'lucide-react'

// Define menus per module
export const moduleMenus = {
    fleet: [
        {
            title: 'Genel',
            items: [
                { path: '/dashboard', label: 'Filo Dashboard', icon: LayoutDashboard },
                { path: '/reports', label: 'Raporlar', icon: FileText }
            ]
        },
        {
            title: 'Araç Yönetimi',
            items: [
                { path: '/vehicles', icon: Car, label: 'Araçlar' },
                { path: '/arvento-tracking', icon: Globe, label: 'Araç Takip (Arvento)' }
            ]
        },
        {
            title: 'Operasyon',
            items: [
                { path: '/maintenance', icon: Wrench, label: 'Bakım' },
                { path: '/inspections', icon: ClipboardCheck, label: 'Muayene' },
                { path: '/periodic-inspections', icon: ClipboardList, label: 'Periyodik Kontrol' },
                { path: '/insurance', icon: Shield, label: 'Sigorta' },
                { path: '/services', icon: Truck, label: 'Servis' }
            ]
        },
        {
            title: 'Sistem',
            items: [
                { path: '/module-settings/fleet', label: 'Filo Ayarları', icon: Settings }
            ]
        }
    ],
    finance: [
        {
            title: 'Finans Yönetimi',
            items: [
                { path: '/finance-dashboard', label: 'Finans Dashboard', icon: Wallet },
                { path: '/finance', label: 'Kasa & Banka Cüzdanı', icon: Banknote },
                { path: '/checks', label: 'Çek & Senetler', icon: FileSignature }
            ]
        },
        {
            title: 'Sistem',
            items: [
                { path: '/module-settings/finance', label: 'Finans Ayarları', icon: Settings }
            ]
        }
    ],
    meals: [
        {
            title: 'Yemek Fişi Takibi',
            items: [
                { path: '/meal-tickets', label: 'Yemek Fişleri', icon: UtensilsCrossed },
                { path: '/meal-ticket-report', label: 'Fiş Raporu', icon: ClipboardList },
                { path: '/meal-ticket-settings', label: 'Ücret Ayarları', icon: CircleDollarSign }
            ]
        },
        {
            title: 'Sistem',
            items: [
                { path: '/module-settings/meals', label: 'Yemek Fişi Ayarları', icon: Settings }
            ]
        }
    ],
    hr: [
        {
            title: 'Genel',
            items: [
                { path: '/personel-dashboard', label: 'Personel Dashboard', icon: LayoutDashboard },
                { path: '/employee-reports', label: 'Raporlar', icon: FileText }
            ]
        },
        {
            title: 'Personel İşlemleri',
            items: [
                { path: '/employees', label: 'Personeller', icon: Users },
                { path: '/approvals', label: 'Onay Merkezi', icon: CheckCircle }
            ]
        },
        {
            title: 'Bordro & İzin',
            items: [
                { path: '/leaves', label: 'İzin Tablosu', icon: Calendar },
                { path: '/payroll', label: 'Maaş Tablosu', icon: Banknote },
                { path: '/overtimes', label: 'Mesai Tablosu', icon: Clock }
            ]
        },
        {
            title: 'Sistem',
            items: [
                { path: '/module-settings/hr', label: 'Personel Ayarları', icon: Settings }
            ]
        }
    ],
    works: [
        {
            title: 'Operasyon',
            items: [
                { path: '/works', label: 'İş Takibi', icon: Briefcase }
            ]
        },
        {
            title: 'Sistem',
            items: [
                { path: '/module-settings/works', label: 'İş Ayarları', icon: Settings }
            ]
        }
    ],
    customers: [
        {
            title: 'Müşteri Yönetimi',
            items: [
                { path: '/customers', label: 'Müşteriler', icon: Building2 }
            ]
        },
        {
            title: 'Sistem',
            items: [
                { path: '/module-settings/customers', label: 'Müşteri Ayarları', icon: Settings }
            ]
        }
    ],
    personnel: [
        {
            title: 'Personel Portalı',
            items: [
                { path: '/personnel-profile', label: 'Profilim & Bilgilerim', icon: User }
            ]
        }
    ],
    platform: [
        {
            title: 'Platform Yönetimi',
            items: [
                { path: '/platform/users', label: 'Kullanıcı Hesapları', icon: Users },
                { path: '/platform/companies', label: 'Şirket Portföyü', icon: Building2 },
                { path: '/platform/announcements', label: 'Canlı Duyuru Yayını', icon: Megaphone },
                { path: '/platform/email-templates', label: 'E-Posta Şablonları', icon: Mail }
            ]
        },
        {
            title: 'Sistem, Güvenlik & Denetim',
            items: [
                { path: '/platform/audit', label: 'Denetim İzi & Olaylar', icon: History },
                { path: '/platform/health', label: 'Sistem Sağlığı & İzleme', icon: Activity },
                { path: '/platform/logs', label: 'Sunucu Hata Logları', icon: ScrollText },
                { path: '/platform/backups', label: 'Veritabanı Yedekleri', icon: Database }
            ]
        }
    ],
    system: [],
    portal: []
}

// Keep the old menuGroups reference pointing to fleet for backwards compatibility
export const menuGroups = moduleMenus.fleet

// Build a reverse lookup map: path → module key (data-driven, no hardcoded prefixes)
const buildPathToModuleMap = () => {
    const map = {}
    Object.entries(moduleMenus).forEach(([moduleKey, groups]) => {
        groups.forEach(group => {
            group.items.forEach(item => {
                map[item.path] = moduleKey
            })
        })
    })
    return map
}

const pathToModuleMap = buildPathToModuleMap()

// Flat list of all items used for reverse lookup
const getAllItems = () => {
    const all = []
    Object.values(moduleMenus).forEach(groups => {
        groups.forEach(group => {
            group.items.forEach(item => {
                if (!all.find(i => i.path === item.path)) {
                    all.push(item)
                }
            })
        })
    })
    return all
}

// Helper to find label by path
export const getRouteInfo = (path) => {
    const allItems = getAllItems()
    const item = allItems.find(i => i.path === path)
    if (item) return item

    // Platform routes
    if (path === '/platform/users') return { label: 'Kullanıcı Hesapları', icon: Users }
    if (path === '/platform/companies') return { label: 'Şirket Portföyü', icon: Building2 }
    if (path === '/platform/announcements') return { label: 'Canlı Duyuru Yayını', icon: Megaphone }
    if (path === '/platform/email-templates') return { label: 'E-Posta Şablonları', icon: Mail }
    if (path === '/platform/health') return { label: 'Sistem Sağlığı & İzleme', icon: Activity }
    if (path === '/platform/logs') return { label: 'Sistem & Güvenlik Logları', icon: ScrollText }
    if (path === '/platform/backups') return { label: 'Veritabanı Yedekleri', icon: Database }
    if (path.startsWith('/platform')) return { label: 'Platform Yönetimi', icon: Crown }

    // Fallback for global settings and company management
    if (path === '/settings') return { label: 'Ayarlar', icon: Settings }
    if (path === '/companies') return { label: 'Şirket Yönetimi', icon: Building2 }

    // Fallback for module settings
    if (path.startsWith('/module-settings/')) {
        const moduleKey = path.split('/module-settings/')[1]
        const labels = { fleet: 'Filo', finance: 'Finans', meals: 'Yemek', hr: 'Personel', works: 'İş', customers: 'Müşteri' }
        return { label: `${labels[moduleKey] || ''} Ayarları`, icon: Settings }
    }

    // Fallback for detail pages
    if (path.startsWith('/vehicles/')) return { label: 'Araç Detay', icon: Car }
    if (path === '/arvento-tracking') return { label: 'Araç Takip', icon: Globe }
    if (path === '/personel-dashboard') return { label: 'Personel Dashboard', icon: LayoutDashboard }
    if (path.startsWith('/employees/')) return { label: 'Personel Detay', icon: Users }
    if (path === '/payroll') return { label: 'Maaş & Ödeme Tablosu', icon: Banknote }
    if (path === '/leaves') return { label: 'Personel İzin Tablosu', icon: Calendar }
    if (path === '/overtimes') return { label: 'Mesai Tablosu', icon: Clock }
    if (path.startsWith('/works/')) return { label: 'İş Detayı', icon: Briefcase }
    if (path.startsWith('/customers/')) return { label: 'Müşteri Detay', icon: Building2 }
    if (path === '/portal' || path === '/') return { label: 'Ana Portal', icon: Layers }
    if (path === '/profile') return { label: 'Profil Ayarları', icon: User }

    return { label: 'Sayfa', icon: FileText }
}

export const getActiveModule = (pathname, search = '') => {
    // 0. Detect user role
    try {
        const user = JSON.parse(localStorage.getItem('aractakip_auth_user') || 'null')
        if (user?.role === 'personnel') return 'personnel'
    } catch (e) {
        console.error(e)
    }

    // 1. Portal check (Always empty sidebar on /portal)
    if (pathname === '/portal' || pathname === '/') {
        return 'portal'
    }

    // 2. Global system pages (Always empty sidebar on settings/profile)
    if (pathname === '/settings' || pathname === '/profile' || pathname === '/companies') {
        return 'system'
    }

    // 3. Platform Admin detection
    if (pathname.startsWith('/platform')) {
        return 'platform'
    }

    // 4. Prioritize module parameter from search string
    if (search) {
        const params = new URLSearchParams(search)
        const moduleParam = params.get('module')
        if (moduleParam && moduleMenus[moduleParam]) return moduleParam
    }

    // 5. Exact match from data-driven path→module map
    if (pathToModuleMap[pathname]) return pathToModuleMap[pathname]

    // 6. Detail page prefix matching (for /vehicles/:id, /employees/:id, etc.)
    // These are child pages that belong to specific modules
    const detailPrefixMap = {
        '/vehicles/': 'fleet',
        '/employees/': 'hr',
        '/works/': 'works',
        '/customers/': 'customers',
        '/module-settings/fleet': 'fleet',
        '/module-settings/finance': 'finance',
        '/module-settings/meals': 'meals',
        '/module-settings/hr': 'hr',
        '/module-settings/works': 'works',
        '/module-settings/customers': 'customers'
    }

    for (const [prefix, moduleKey] of Object.entries(detailPrefixMap)) {
        if (pathname.startsWith(prefix)) return moduleKey
    }

    // 7. Ultimate fallback - try to match any path prefix from the map
    for (const [path, moduleKey] of Object.entries(pathToModuleMap)) {
        if (pathname.startsWith(path)) return moduleKey
    }

    // 8. If nothing matched, preserve last known module
    const lastModule = sessionStorage.getItem('lastActiveModule')
    if (lastModule && moduleMenus[lastModule] && lastModule !== 'portal' && lastModule !== 'system') return lastModule

    return 'fleet'
}
