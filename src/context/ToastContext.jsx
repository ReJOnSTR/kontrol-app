import { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react'
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react'

const defaultToastValue = {
    showToast: (msg, type = 'info', duration = 3500) => {
        if (typeof window !== 'undefined' && window.__ACTIVE_TOAST_HANDLER__) {
            window.__ACTIVE_TOAST_HANDLER__(msg, type, duration)
        } else {
            console.log(`[Toast ${type}]:`, msg)
        }
    },
    success: (msg, duration) => defaultToastValue.showToast(msg, 'success', duration),
    error: (msg, duration) => defaultToastValue.showToast(msg, 'error', duration),
    info: (msg, duration) => defaultToastValue.showToast(msg, 'info', duration),
    warning: (msg, duration) => defaultToastValue.showToast(msg, 'warning', duration),
}

// Preserve context across Vite HMR refreshes (same pattern as AuthContext and CompanyContext)
const ToastContext = (typeof window !== 'undefined' && window.__TOAST_CONTEXT__)
    ? window.__TOAST_CONTEXT__
    : createContext(defaultToastValue)

if (typeof window !== 'undefined') {
    window.__TOAST_CONTEXT__ = ToastContext
}

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([])

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    const addToast = useCallback((message, type = 'info', duration = 3500) => {
        if (!message) return
        const id = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
        
        setToasts(prev => {
            // Keep at most 4 toasts visible at the same time to prevent clutter
            const next = [...prev, { id, message, type }]
            return next.slice(-4)
        })

        if (duration > 0) {
            setTimeout(() => {
                removeToast(id)
            }, duration)
        }
    }, [removeToast])

    const stableToast = useRef({
        showToast: (msg, type, duration) => addToast(msg, type, duration),
        success: (msg, duration) => addToast(msg, 'success', duration),
        error: (msg, duration) => addToast(msg, 'error', duration),
        info: (msg, duration) => addToast(msg, 'info', duration),
        warning: (msg, duration) => addToast(msg, 'warning', duration),
    }).current

    useEffect(() => {
        window.__ACTIVE_TOAST_HANDLER__ = addToast
        window.showToast = stableToast.showToast
        window.toast = stableToast
        return () => {
            if (window.__ACTIVE_TOAST_HANDLER__ === addToast) {
                delete window.__ACTIVE_TOAST_HANDLER__
            }
        }
    }, [addToast, stableToast])

    const getToastColors = (type) => {
        switch (type) {
            case 'success':
                return {
                    bg: 'rgba(16, 185, 129, 0.15)',
                    border: 'rgba(16, 185, 129, 0.35)',
                    color: '#10b981',
                    icon: <CheckCircle2 size={18} color="#10b981" style={{ flexShrink: 0 }} />
                }
            case 'error':
            case 'danger':
                return {
                    bg: 'rgba(239, 68, 68, 0.15)',
                    border: 'rgba(239, 68, 68, 0.35)',
                    color: '#ef4444',
                    icon: <AlertCircle size={18} color="#ef4444" style={{ flexShrink: 0 }} />
                }
            case 'warning':
                return {
                    bg: 'rgba(245, 158, 11, 0.15)',
                    border: 'rgba(245, 158, 11, 0.35)',
                    color: '#f59e0b',
                    icon: <AlertTriangle size={18} color="#f59e0b" style={{ flexShrink: 0 }} />
                }
            default:
                return {
                    bg: 'rgba(59, 130, 246, 0.15)',
                    border: 'rgba(59, 130, 246, 0.35)',
                    color: 'var(--accent-primary, #14b8a6)',
                    icon: <Info size={18} color="var(--accent-primary, #14b8a6)" style={{ flexShrink: 0 }} />
                }
        }
    }

    return (
        <ToastContext.Provider value={stableToast}>
            {children}

            {/* Floating Toast Notification Container */}
            {toasts.length > 0 && (
                <div style={{
                    position: 'fixed',
                    top: '20px',
                    right: '20px',
                    zIndex: 999999,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    maxWidth: '420px',
                    width: 'calc(100vw - 40px)',
                    pointerEvents: 'none'
                }}>
                    {toasts.map(t => {
                        const styleInfo = getToastColors(t.type)
                        return (
                            <div
                                key={t.id}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '12px 16px',
                                    background: 'var(--bg-secondary, #1e293b)',
                                    backgroundColor: styleInfo.bg,
                                    border: `1px solid ${styleInfo.border}`,
                                    borderRadius: '12px',
                                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.2)',
                                    backdropFilter: 'blur(12px)',
                                    WebkitBackdropFilter: 'blur(12px)',
                                    color: 'var(--text-primary, #f8fafc)',
                                    fontSize: '13.5px',
                                    fontWeight: 500,
                                    lineHeight: 1.4,
                                    pointerEvents: 'auto',
                                    animation: 'drawerSlideIn 0.2s ease-out'
                                }}
                            >
                                {styleInfo.icon}
                                <span style={{ flex: 1, wordBreak: 'break-word' }}>{t.message}</span>
                                <button
                                    type="button"
                                    onClick={() => removeToast(t.id)}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        padding: '4px',
                                        cursor: 'pointer',
                                        color: 'var(--text-muted, #94a3b8)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderRadius: '6px',
                                        flexShrink: 0
                                    }}
                                    title="Kapat"
                                >
                                    <X size={15} />
                                </button>
                            </div>
                        )
                    })}
                </div>
            )}
        </ToastContext.Provider>
    )
}

export function useToast() {
    const context = useContext(ToastContext)
    return context || defaultToastValue
}
