import { createContext, useContext, useState, useEffect } from 'react'
import { settingsService } from '../services/settings'

const sanitizeScale = (val, fallback = 100) => {
    const num = Number(val)
    if (!isNaN(num) && num >= 75 && num <= 130) {
        return Math.round(num)
    }
    return fallback
}

export const ALLOWED_ACCENTS = ['teal', 'sage', 'emerald', 'bronze', 'amber', 'indigo', 'blue', 'plum', 'violet', 'slate']

const sanitizeAccent = (val, fallback = 'teal') => {
    return ALLOWED_ACCENTS.includes(val) ? val : fallback
}

const applyScaleToDom = (scale) => {
    if (typeof document !== 'undefined') {
        const isPrint = typeof window !== 'undefined' && (
            window.location.hash.includes('print') || 
            window.location.pathname.includes('print') ||
            document.body.classList.contains('is-printing') ||
            document.body.classList.contains('print-body')
        );
        const isMobile = typeof window !== 'undefined' && (
            window.innerWidth <= 768 ||
            /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        );

        if (isPrint || isMobile) {
            document.documentElement.style.zoom = '1';
            document.documentElement.style.minWidth = '';
            document.documentElement.style.minHeight = '';
            document.documentElement.style.setProperty('--ui-scale', '1');
            return;
        }

        const ratio = scale / 100;
        document.documentElement.style.zoom = `${ratio}`;
        document.documentElement.style.setProperty('--ui-scale', `${ratio}`);
        if (ratio < 1) {
            document.documentElement.style.minWidth = `${100 / ratio}%`;
            document.documentElement.style.minHeight = `${100 / ratio}%`;
        } else {
            document.documentElement.style.minWidth = '';
            document.documentElement.style.minHeight = '';
        }
    }
}

const defaultThemeContext = {
    theme: typeof window !== 'undefined' ? (localStorage.getItem('aractakip_theme') || localStorage.getItem('theme') || 'dark') : 'dark',
    accentColor: typeof window !== 'undefined' ? sanitizeAccent(localStorage.getItem('aractakip_accent_color'), 'teal') : 'teal',
    uiScale: typeof window !== 'undefined' ? sanitizeScale(localStorage.getItem('aractakip_ui_scale'), 100) : 100,
    setTheme: (t) => {
        if (typeof document !== 'undefined') {
            document.documentElement.setAttribute('data-theme', t)
            localStorage.setItem('aractakip_theme', t)
            localStorage.setItem('theme', t)
        }
    },
    setAccentColor: (a) => {
        const val = sanitizeAccent(a, 'teal')
        if (typeof document !== 'undefined') {
            document.documentElement.setAttribute('data-accent', val)
            localStorage.setItem('aractakip_accent_color', val)
        }
    },
    toggleTheme: () => {
        if (typeof document !== 'undefined') {
            const current = document.documentElement.getAttribute('data-theme') || 'dark'
            const next = current === 'dark' ? 'light' : 'dark'
            document.documentElement.setAttribute('data-theme', next)
            localStorage.setItem('aractakip_theme', next)
            localStorage.setItem('theme', next)
            try {
                const storedUser = JSON.parse(localStorage.getItem('aractakip_user') || 'null')
                if (storedUser?.id && settingsService.saveUserPreferences) {
                    settingsService.saveUserPreferences(storedUser.id, { theme: next }).catch(() => {})
                }
            } catch (_) {}
        }
    },
    setUiScale: (s) => {
        const val = sanitizeScale(s, 100)
        applyScaleToDom(val)
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('aractakip_ui_scale', String(val))
        }
    },
    resetUiScale: () => {
        applyScaleToDom(100)
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('aractakip_ui_scale', '100')
        }
    }
}

const ThemeContext = createContext(defaultThemeContext)

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(() => {
        const saved = localStorage.getItem('aractakip_theme') || localStorage.getItem('theme')
        return saved || 'dark'
    })

    const [accentColor, setAccentColorState] = useState(() => {
        const saved = typeof window !== 'undefined' ? localStorage.getItem('aractakip_accent_color') : null
        return sanitizeAccent(saved, 'teal')
    })

    const [uiScale, setUiScaleState] = useState(() => {
        const saved = typeof window !== 'undefined' ? localStorage.getItem('aractakip_ui_scale') : null
        return sanitizeScale(saved, 100)
    })

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme)
        localStorage.setItem('aractakip_theme', theme)
        localStorage.setItem('theme', theme)
    }, [theme])

    useEffect(() => {
        document.documentElement.setAttribute('data-accent', accentColor)
        localStorage.setItem('aractakip_accent_color', accentColor)
    }, [accentColor])

    useEffect(() => {
        applyScaleToDom(uiScale)
        localStorage.setItem('aractakip_ui_scale', String(uiScale))

        const handleResize = () => {
            applyScaleToDom(uiScale)
        }
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [uiScale])

    // Listen for theme updates from DB when user logs in
    useEffect(() => {
        const handleExternalThemeChange = (e) => {
            if (e.detail && (e.detail === 'dark' || e.detail === 'light')) {
                setTheme(e.detail)
            }
        }
        window.addEventListener('aractakip_theme_changed', handleExternalThemeChange)
        return () => window.removeEventListener('aractakip_theme_changed', handleExternalThemeChange)
    }, [])

    // Listen for accent color updates from DB when user logs in
    useEffect(() => {
        const handleExternalAccentChange = (e) => {
            const val = sanitizeAccent(e.detail, null)
            if (val !== null) {
                setAccentColorState(val)
                document.documentElement.setAttribute('data-accent', val)
            }
        }
        window.addEventListener('aractakip_accent_changed', handleExternalAccentChange)
        return () => window.removeEventListener('aractakip_accent_changed', handleExternalAccentChange)
    }, [])

    // Listen for scale updates from DB when user logs in
    useEffect(() => {
        const handleExternalScaleChange = (e) => {
            const val = sanitizeScale(e.detail, null)
            if (val !== null) {
                setUiScaleState(val)
                applyScaleToDom(val)
            }
        }
        window.addEventListener('aractakip_scale_changed', handleExternalScaleChange)
        return () => window.removeEventListener('aractakip_scale_changed', handleExternalScaleChange)
    }, [])

    const toggleTheme = () => {
        setTheme(prev => {
            const next = prev === 'dark' ? 'light' : 'dark'
            try {
                const storedUser = JSON.parse(localStorage.getItem('aractakip_user') || 'null')
                if (storedUser?.id && settingsService.saveUserPreferences) {
                    settingsService.saveUserPreferences(storedUser.id, { theme: next }).catch(() => {})
                }
            } catch (e) {}
            return next
        })
    }

    const setUiScale = (newScale) => {
        const val = sanitizeScale(newScale, 100)
        setUiScaleState(val)
        applyScaleToDom(val)
        localStorage.setItem('aractakip_ui_scale', String(val))
        try {
            const storedUser = JSON.parse(localStorage.getItem('aractakip_user') || 'null')
            if (storedUser?.id && settingsService.saveUserPreferences) {
                settingsService.saveUserPreferences(storedUser.id, { ui_scale: val }).catch(() => {})
            }
        } catch (_) {}
    }

    const setAccentColor = (newColor) => {
        const val = sanitizeAccent(newColor, 'teal')
        setAccentColorState(val)
        if (typeof document !== 'undefined') {
            document.documentElement.setAttribute('data-accent', val)
        }
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('aractakip_accent_color', val)
        }
        try {
            const storedUser = JSON.parse(localStorage.getItem('aractakip_user') || 'null')
            if (storedUser?.id && settingsService.saveUserPreferences) {
                settingsService.saveUserPreferences(storedUser.id, { accent_color: val }).catch(() => {})
            }
        } catch (_) {}
    }

    const resetUiScale = () => {
        setUiScale(100)
    }

    return (
        <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, accentColor, setAccentColor, uiScale, setUiScale, resetUiScale }}>
            {children}
        </ThemeContext.Provider>
    )
}

export function useTheme() {
    const context = useContext(ThemeContext)
    return context || defaultThemeContext
}
