import { createContext, useContext, useState, useEffect } from 'react'
import { settingsService } from '../services/settings'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(() => {
        const saved = localStorage.getItem('aractakip_theme') || localStorage.getItem('theme')
        return saved || 'dark'
    })

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme)
        localStorage.setItem('aractakip_theme', theme)
        localStorage.setItem('theme', theme)
    }, [theme])

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

    return (
        <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    )
}

export function useTheme() {
    const context = useContext(ThemeContext)
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider')
    }
    return context
}
