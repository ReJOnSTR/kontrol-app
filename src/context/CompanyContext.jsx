import { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import { companyService, dashboardService } from '../services'
import { settingsService } from '../services/settings'

const CompanyContext = createContext(null)

export function CompanyProvider({ children }) {
    const { user } = useAuth()
    const [companies, setCompanies] = useState([])
    const [currentCompany, setCurrentCompany] = useState(null)
    const [companySettings, setCompanySettings] = useState(null)
    const [loading, setLoading] = useState(true)
    const [upcomingEvents, setUpcomingEvents] = useState([])
    const isSuperAdmin = user?.role === 'superadmin'

    const [isImpersonating, setIsImpersonating] = useState(() => {
        if (user && user.role !== 'superadmin') {
            sessionStorage.removeItem('aractakip_impersonate_company_id')
            sessionStorage.removeItem('aractakip_impersonate_company_name')
            return false
        }
        const urlParams = new URLSearchParams(window.location.search || (window.location.hash.includes('?') ? window.location.hash.split('?')[1] : ''))
        return !!(urlParams.get('impersonate_company_id') || sessionStorage.getItem('aractakip_impersonate_company_id'))
    })
    const [impersonatedCompanyName, setImpersonatedCompanyName] = useState(() => {
        if (user && user.role !== 'superadmin') return ''
        const urlParams = new URLSearchParams(window.location.search || (window.location.hash.includes('?') ? window.location.hash.split('?')[1] : ''))
        return urlParams.get('impersonate_company_name') || sessionStorage.getItem('aractakip_impersonate_company_name') || ''
    })

    const syncHrSettingsToLocalStorage = (hrSettings) => {
        if (!hrSettings) return;
        if (hrSettings.weekdayMultiplier !== undefined) localStorage.setItem('hr_overtime_weekday_multiplier', String(hrSettings.weekdayMultiplier));
        if (hrSettings.sundayMultiplier !== undefined) localStorage.setItem('hr_overtime_sunday_multiplier', String(hrSettings.sundayMultiplier));
        if (hrSettings.holidayMultiplier !== undefined) localStorage.setItem('hr_overtime_holiday_multiplier', String(hrSettings.holidayMultiplier));
        if (hrSettings.gurbetMultiplier !== undefined) localStorage.setItem('hr_overtime_gurbet_multiplier', String(hrSettings.gurbetMultiplier));
        if (hrSettings.weekdayHoursPerLeave !== undefined) localStorage.setItem('hr_overtime_weekday_hours_per_leave', String(hrSettings.weekdayHoursPerLeave));
        if (hrSettings.sundayDaysPerLeave !== undefined) localStorage.setItem('hr_overtime_sunday_days_per_leave', String(hrSettings.sundayDaysPerLeave));
        if (hrSettings.holidayDaysPerLeave !== undefined) localStorage.setItem('hr_overtime_holiday_days_per_leave', String(hrSettings.holidayDaysPerLeave));
        if (hrSettings.defaultAdvanceAmount !== undefined) localStorage.setItem('hr_default_advance_amount', String(hrSettings.defaultAdvanceAmount));
    };

    const clearHrSettingsFromLocalStorage = () => {
        const keys = [
            'hr_overtime_weekday_multiplier', 'hr_overtime_sunday_multiplier',
            'hr_overtime_holiday_multiplier', 'hr_overtime_gurbet_multiplier',
            'hr_overtime_weekday_hours_per_leave', 'hr_overtime_sunday_days_per_leave',
            'hr_overtime_holiday_days_per_leave', 'hr_default_advance_amount'
        ];
        keys.forEach(k => localStorage.removeItem(k));
    };

    const loadCompanySettings = async (companyId) => {
        if (!companyId) return;
        clearHrSettingsFromLocalStorage();
        try {
            const res = await settingsService.getCompanyDbSettings(companyId);
            if (res && res.success && res.data) {
                setCompanySettings(res.data);
                syncHrSettingsToLocalStorage(res.data.hr);
            }
        } catch (err) {
            console.error('Failed to load company db settings:', err);
        }
    };

    const updateCompanySettings = async (newPartialSettings) => {
        if (!currentCompany?.id) return { success: false, error: 'Şirket seçilmedi' };
        try {
            const res = await settingsService.saveCompanyDbSettings(currentCompany.id, newPartialSettings);
            if (res && res.success && res.data) {
                setCompanySettings(res.data);
                syncHrSettingsToLocalStorage(res.data.hr);
                return { success: true, data: res.data };
            }
            return res || { success: false, error: 'Ayarlar kaydedilemedi' };
        } catch (err) {
            return { success: false, error: err.message };
        }
    };

    useEffect(() => {
        if (currentCompany) {
            loadUpcomingEvents()
            loadCompanySettings(currentCompany.id)
        } else {
            setUpcomingEvents([])
            setCompanySettings(null)
        }
    }, [currentCompany])

    // Auto-refresh: window focus (başka sayfadan dönünce) + 60 saniyelik polling
    useEffect(() => {
        if (!currentCompany) return

        const handleFocus = () => loadUpcomingEvents(true)
        window.addEventListener('focus', handleFocus)

        const interval = setInterval(() => loadUpcomingEvents(true), 60_000)

        return () => {
            window.removeEventListener('focus', handleFocus)
            clearInterval(interval)
        }
    }, [currentCompany])

    const loadUpcomingEvents = async (isBackground = false) => {
        if (!currentCompany) return

        try {
            const result = await dashboardService.getUpcomingEvents(currentCompany.id)
            if (result.success) {
                setUpcomingEvents(result.data)
            }
        } catch (error) {
            console.error('Failed to load upcoming events:', error)
        }
    }

    useEffect(() => {
        if (user) {
            loadCompanies()
        } else {
            setCompanies([])
            setCurrentCompany(null)
            setLoading(false)
        }
    }, [user])

    const loadCompanies = async () => {
        setLoading(true)
        try {
            const result = await companyService.getAll(user.id)
            if (result.success) {
                setCompanies(result.data)

                const urlParams = new URLSearchParams(window.location.search || (window.location.hash.includes('?') ? window.location.hash.split('?')[1] : ''))
                const impId = urlParams.get('impersonate_company_id') || sessionStorage.getItem('aractakip_impersonate_company_id')
                const impName = urlParams.get('impersonate_company_name') || sessionStorage.getItem('aractakip_impersonate_company_name')

                // Security Check: Impersonation is STRICTLY allowed only for SuperAdmin
                if (impId && user?.role === 'superadmin') {
                    const numericImpId = parseInt(impId, 10)
                    sessionStorage.setItem('aractakip_impersonate_company_id', String(numericImpId))
                    if (impName) sessionStorage.setItem('aractakip_impersonate_company_name', decodeURIComponent(impName))
                    setIsImpersonating(true)
                    setImpersonatedCompanyName(impName ? decodeURIComponent(impName) : '')

                    const targetComp = result.data.find(c => c.id === numericImpId) || {
                        id: numericImpId,
                        name: impName ? decodeURIComponent(impName) : `Şirket #${numericImpId}`
                    }
                    setCurrentCompany(targetComp)
                } else {
                    // Non-superadmin or normal mode: Purge any stale impersonation flags
                    sessionStorage.removeItem('aractakip_impersonate_company_id')
                    sessionStorage.removeItem('aractakip_impersonate_company_name')
                    setIsImpersonating(false)
                    setImpersonatedCompanyName('')

                    // Restore last selected company or select first from authorized companies
                    const storedCompanyId = localStorage.getItem('aractakip_company')
                    const storedCompany = result.data.find(c => c.id === parseInt(storedCompanyId))

                    if (storedCompany) {
                        setCurrentCompany(storedCompany)
                    } else if (result.data.length > 0) {
                        setCurrentCompany(result.data[0])
                        localStorage.setItem('aractakip_company', result.data[0].id)
                    }
                }
            }
        } catch (error) {
            console.error('Failed to load companies:', error)
        }
        setLoading(false)
    }

    const selectCompany = (company) => {
        setCurrentCompany(company)
        if (!isImpersonating) {
            localStorage.setItem('aractakip_company', company.id)
        }
    }

    const createCompany = async (data) => {
        try {
            const result = await companyService.create({
                userId: user.id,
                name: data.name,
                taxNumber: data.taxNumber,
                taxOffice: data.taxOffice,
                sgkNo: data.sgkNo,
                address: data.address,
                phone: data.phone,
                signaturePath: data.signaturePath,
                stampPath: data.stampPath
            })

            if (result.success) {
                await loadCompanies()
                return { success: true, id: result.id }
            }
            return { success: false, error: result.error }
        } catch (error) {
            return { success: false, error: 'İşlem başarısız' }
        }
    }

    const updateCompany = async (data) => {
        try {
            const result = await companyService.update(data)
            if (result.success) {
                await loadCompanies()
                return { success: true }
            }
            return { success: false, error: result.error }
        } catch (error) {
            return { success: false, error: 'İşlem başarısız' }
        }
    }

    const deleteCompany = async (id) => {
        try {
            const result = await companyService.delete(id)
            if (result.success) {
                const freshResult = await companyService.getAll(user.id)
                if (freshResult.success) {
                    setCompanies(freshResult.data)
                    if (currentCompany?.id === id) {
                        const nextCompany = freshResult.data.length > 0 ? freshResult.data[0] : null
                        setCurrentCompany(nextCompany)
                        if (nextCompany) {
                            localStorage.setItem('aractakip_company', nextCompany.id)
                        } else {
                            localStorage.removeItem('aractakip_company')
                        }
                    }
                }
                return { success: true }
            }
            return { success: false, error: result.error }
        } catch (error) {
            return { success: false, error: 'İşlem başarısız' }
        }
    }

    const isModuleEnabled = (moduleKey) => {
        if (!moduleKey) return true;
        if (['portal', 'system', 'platform', 'personnel'].includes(moduleKey)) return true;
        if (companySettings?.modules) {
            return companySettings.modules[moduleKey] !== false;
        }
        return true;
    }

    return (
        <CompanyContext.Provider value={{
            companies,
            currentCompany,
            loading,
            selectCompany,
            createCompany,
            updateCompany,
            deleteCompany,
            refreshCompanies: loadCompanies,
            companySettings,
            updateCompanySettings,
            refreshCompanySettings: () => currentCompany && loadCompanySettings(currentCompany.id),
            isModuleEnabled,
            upcomingEvents,
            loadUpcomingEvents,
            isImpersonating,
            impersonatedCompanyName
        }}>
            {children}
        </CompanyContext.Provider>
    )
}

export function useCompany() {
    const context = useContext(CompanyContext)
    if (!context) {
        throw new Error('useCompany must be used within CompanyProvider')
    }
    return context
}
