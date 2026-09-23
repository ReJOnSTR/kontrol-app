import { createContext, useContext, useState, useEffect } from 'react'
import { authService } from '../services'
import { supabase } from '../services/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Check for stored user on mount
        const storedUser = localStorage.getItem('aractakip_user')
        if (storedUser) {
            try {
                setUser(JSON.parse(storedUser))
            } catch (e) {
                localStorage.removeItem('aractakip_user')
            }
        }
        setLoading(false)
    }, [])

    // Real-Time Heartbeat & Session Liveness
    useEffect(() => {
        if (!user || !user.id) return

        let sessionId = sessionStorage.getItem('aractakip_session_id')
        if (!sessionId) {
            sessionId = 'sess_' + user.id + '_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9)
            sessionStorage.setItem('aractakip_session_id', sessionId)
        }

        const sendHeartbeat = async () => {
            try {
                const payload = {
                    userId: user.id,
                    username: user.username,
                    userRole: user.role,
                    companyId: user.company_id || user.companies?.[0]?.id || null,
                    companyName: user.companies?.[0]?.name || 'Sistem / Genel',
                    sessionId,
                    platform: navigator.platform || 'Web / Desktop',
                    userAgent: navigator.userAgent || ''
                }

                let res;
                if (window.electronAPI?.recordHeartbeat) {
                    res = await window.electronAPI.recordHeartbeat(payload)
                } else {
                    res = await fetch('/api/rpc/recordHeartbeat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ args: [payload] })
                    }).then(r => r.json()).catch(() => null)
                }

                if (res && res.forceLogout) {
                    sessionStorage.removeItem('aractakip_session_id')
                    logout()
                    alert('Güvenlik Uyarısı:\nOturumunuz sistem yöneticisi tarafından sonlandırıldı.')
                }
            } catch (err) {
                // Ignore transient network errors
            }
        }

        // Send initial heartbeat immediately
        sendHeartbeat()

        // Recurring heartbeat every 25 seconds
        const timer = setInterval(sendHeartbeat, 25000)
        return () => clearInterval(timer)
    }, [user])

    const login = async (email, password) => {
        try {
            const result = await authService.login({ email, password })
            if (result.success) {
                if (result.require2FA) {
                    return {
                        success: true,
                        require2FA: true,
                        userId: result.userId,
                        username: result.username,
                        email: result.email
                    }
                }

                // Generate fresh new session ID on every login
                const freshSessionId = 'sess_' + result.user.id + '_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9)
                sessionStorage.setItem('aractakip_session_id', freshSessionId)

                setUser(result.user)
                localStorage.setItem('aractakip_user', JSON.stringify(result.user))
                sessionStorage.setItem('aractakip_session_active', 'true')
                
                // Keep Supabase Auth session synced on client
                if (result.user?.email) {
                    supabase.auth.signInWithPassword({ email: result.user.email, password }).catch(() => {});
                }
                return { success: true }
            }
            return { success: false, error: result.error }
        } catch (error) {
            console.error('Login error:', error)
            return { success: false, error: 'Bağlantı hatası: ' + error.message }
        }
    }

    const verify2FALogin = async (userId, tokenOrBackupCode) => {
        try {
            let result;
            if (window.electronAPI?.verifyMfaLogin) {
                result = await window.electronAPI.verifyMfaLogin(userId, tokenOrBackupCode);
            } else if (authService?.verifyMfaLogin) {
                result = await authService.verifyMfaLogin({ userId, token: tokenOrBackupCode });
            } else {
                result = await fetch('/api/rpc/verifyMfaLogin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ args: [userId, tokenOrBackupCode] })
                }).then(r => r.json());
            }

            if (result && result.success && result.user) {
                // Generate fresh new session ID on 2FA login
                const freshSessionId = 'sess_' + result.user.id + '_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9)
                sessionStorage.setItem('aractakip_session_id', freshSessionId)

                setUser(result.user)
                localStorage.setItem('aractakip_user', JSON.stringify(result.user))
                sessionStorage.setItem('aractakip_session_active', 'true')
                return { success: true, backupCodeUsed: result.backupCodeUsed, remainingBackupCodes: result.remainingBackupCodes }
            }
            return { success: false, error: result?.error || 'Geçersiz 2FA güvenlik kodu' }
        } catch (error) {
            console.error('verify2FALogin error:', error)
            return { success: false, error: 'Doğrulama hatası: ' + error.message }
        }
    }

    const register = async (username, email, password, companyName) => {
        try {
            localStorage.removeItem('aractakip_company')
            const result = await authService.register({ username, email, password, companyName })
            if (result.success) {
                // If email verification is required, do not log user in immediately
                if (result.requireVerification) {
                    return { 
                        success: true, 
                        requireVerification: true, 
                        email: result.email || email,
                        message: result.message 
                    }
                }

                const freshSessionId = 'sess_' + result.user.id + '_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9)
                sessionStorage.setItem('aractakip_session_id', freshSessionId)

                setUser(result.user)
                localStorage.setItem('aractakip_user', JSON.stringify(result.user))
                sessionStorage.setItem('aractakip_session_active', 'true')

                return { success: true }
            }
            return { success: false, error: result.error }
        } catch (error) {
            console.error('Register error:', error)
            return { success: false, error: 'Bağlantı hatası: ' + error.message }
        }
    }

    const logout = () => {
        setUser(null)
        localStorage.removeItem('aractakip_user')
        localStorage.removeItem('aractakip_company')
        localStorage.removeItem('aractakip_locked')
        sessionStorage.removeItem('aractakip_session_id')
        sessionStorage.removeItem('aractakip_session_active')
        supabase.auth.signOut().catch(() => {});
    }

    const updateProfile = async (data) => {
        try {
            const result = await authService.updateProfile({ userId: user.id, ...data })
            if (result.success) {
                const updatedUser = { ...user, ...result.user }
                setUser(updatedUser)
                localStorage.setItem('aractakip_user', JSON.stringify(updatedUser))
                return { success: true }
            }
            return { success: false, error: result.error }
        } catch (error) {
            console.error('Update profile error:', error)
            return { success: false, error: 'Bağlantı hatası: ' + error.message }
        }
    }

    const normalizedRole = (user?.role || '').toLowerCase()
    const isSuperAdmin = normalizedRole === 'superadmin'
    const isPersonnel = normalizedRole === 'personnel' || normalizedRole === 'employee' || !!user?.employee_id
    const isAdmin = normalizedRole === 'admin' || 
                    normalizedRole === 'superadmin' || 
                    normalizedRole === 'company_admin' || 
                    normalizedRole === 'company_owner' || 
                    normalizedRole === 'manager' || 
                    (!isPersonnel && !user?.role_id)
    const isManager = normalizedRole === 'manager' || isAdmin

    const hasPermission = (moduleOrAction, action = 'can_read') => {
        if (isAdmin) return true;
        if (!user) return false;

        const perms = user.permissions;

        // If permissions is an object map e.g. { works: 'ADMIN', employees: 'VIEW' } or { works_view_prices: true }
        if (perms && !Array.isArray(perms) && typeof perms === 'object' && Object.keys(perms).length > 0) {
            if (perms[moduleOrAction] !== undefined) {
                return !!perms[moduleOrAction];
            }
            const level = perms[moduleOrAction];
            if (level === 'NONE' || !level) return false;
            if (level === 'ADMIN') return true;
            if (level === 'EDIT') {
                return action === 'can_read' || action === 'can_create' || action === 'can_update';
            }
            if (level === 'VIEW') {
                return action === 'can_read';
            }
            return false;
        }

        // If permissions is an array of permission records e.g. [{ module: 'works', can_read: true }]
        if (Array.isArray(perms) && perms.length > 0) {
            if (moduleOrAction.includes('_')) {
                const parts = moduleOrAction.split('_');
                const mod = parts[0];
                const act = parts.slice(1).join('_');
                const perm = perms.find(p => p.module === mod);
                if (!perm) return false;
                if (act.includes('delete')) return !!perm.can_delete;
                if (act.includes('create') || act.includes('add')) return !!perm.can_create;
                if (act.includes('edit') || act.includes('update')) return !!perm.can_update;
                if (act.includes('view') || act.includes('read')) return !!perm.can_read;
                return !!perm.can_read;
            }

            const perm = perms.find(p => p.module === moduleOrAction);
            if (!perm) return false;
            return !!perm[action];
        }

        // Fallback for standard staff / personnel users without an explicit role matrix assigned:
        // Sensitive financial & administration modules are strictly blocked unless granted.
        const sensitivePrefixes = ['finance', 'check', 'salary', 'payroll', 'employees_view_salary', 'setting', 'compan', 'platform'];
        const isSensitive = sensitivePrefixes.some(s => moduleOrAction.toLowerCase().includes(s));
        if (isSensitive) {
            return false;
        }

        // Standard operational read access for vehicles, works, customers, leaves, assignments:
        if (action === 'can_read' || action.includes('view') || action.includes('read')) {
            return true;
        }

        return false;
    }

    return (
        <AuthContext.Provider value={{ 
            user, 
            loading, 
            login, 
            verify2FALogin,
            register, 
            logout, 
            updateProfile,
            isAdmin,
            isSuperAdmin,
            isManager,
            isPersonnel,
            hasPermission
        }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider')
    }
    return context
}
