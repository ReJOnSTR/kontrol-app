import React, { useState, useEffect, useRef } from 'react'
import { Lock, Unlock, LogOut, ArrowRight, Loader2, User as UserIcon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { authService } from '../services'

export default function LockScreen({ isLocked, onUnlock }) {
    const { user, logout } = useAuth()
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [useAccountPassFallback, setUseAccountPassFallback] = useState(false)

    const getLockSettings = () => {
        try {
            const local = JSON.parse(localStorage.getItem('aractakip_lock_settings') || '{}')
            const userPref = user?.userPreferences?.lock || {}
            return {
                enabled: false,
                timeout: 5,
                useCustomPassword: false,
                ...userPref,
                ...local
            }
        } catch {
            return {
                enabled: false,
                timeout: 5,
                useCustomPassword: false,
                ...(user?.userPreferences?.lock || {})
            }
        }
    }

    const inputRef = useRef(null)

    useEffect(() => {
        if (isLocked) {
            setPassword('')
            setError('')
            setUseAccountPassFallback(false)
            document.body.style.overflow = 'hidden'
            const timer = setTimeout(() => {
                inputRef.current?.focus()
            }, 80)
            return () => clearTimeout(timer)
        } else {
            document.body.style.overflow = ''
        }
    }, [isLocked])

    // Intercept any focus attempts outside the lock screen container and redirect them to the input
    useEffect(() => {
        if (!isLocked) return

        const handleFocus = (e) => {
            if (inputRef.current && !inputRef.current.contains(e.target)) {
                const container = document.querySelector('.lock-screen-container')
                if (container && !container.contains(e.target)) {
                    e.preventDefault()
                    inputRef.current.focus()
                }
            }
        }

        document.addEventListener('focusin', handleFocus, true)
        return () => {
            document.removeEventListener('focusin', handleFocus, true)
        }
    }, [isLocked])

    const hashPassword = async (str) => {
        if (!str) return ''
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
    }

    const handleUnlock = async (e) => {
        e?.preventDefault()
        if (!password) return
        
        setLoading(true)
        setError('')
        
        try {
            const currentLockSettings = getLockSettings()
            const hasCustom = currentLockSettings.useCustomPassword && !!(currentLockSettings.customPasswordHash || currentLockSettings.customPassword)

            if (hasCustom && !useAccountPassFallback) {
                const inputHash = await hashPassword(password)
                const isMatch = (currentLockSettings.customPasswordHash && inputHash === currentLockSettings.customPasswordHash) ||
                                (currentLockSettings.customPassword && password === currentLockSettings.customPassword)

                if (isMatch) {
                    onUnlock()
                    setPassword('')
                    return
                }

                // Transparent fallback: check if user typed their master account password instead
                const identifier = user?.username || user?.email || ''
                const fallbackResult = await authService.login({
                    username: identifier,
                    email: user?.email || identifier,
                    password
                })
                if (fallbackResult.success) {
                    onUnlock()
                    setPassword('')
                    return
                }

                setError('Hatalı kilit şifresi / PIN.')
            } else {
                // Use master login password
                const identifier = user?.username || user?.email || ''
                const result = await authService.login({
                    username: identifier,
                    email: user?.email || identifier,
                    password
                })
                if (result.success) {
                    onUnlock()
                    setPassword('')
                } else {
                    setError('Hatalı şifre. Lütfen geçerli hesap şifrenizi girin.')
                }
            }
        } catch (err) {
            setError('Kilit açılırken hata oluştu: ' + (err.message || ''))
        } finally {
            setLoading(false)
        }
    }

    if (!isLocked) return null

    const currentLockSettings = getLockSettings()
    const hasCustom = currentLockSettings.useCustomPassword && !!(currentLockSettings.customPasswordHash || currentLockSettings.customPassword)
    const isCustomActive = hasCustom && !useAccountPassFallback

    return (
        <div className="lock-screen-overlay" onClick={() => inputRef.current?.focus()}>
            <div className="lock-screen-container">
                <div className="lock-screen-avatar-area">
                    <div className="lock-avatar">
                        {user?.image ? (
                            <img src={user.image} alt={user.username} />
                        ) : (
                            <UserIcon size={32} />
                        )}
                    </div>
                    <div className="lock-badge">
                        <Lock size={12} />
                    </div>
                </div>

                <div className="lock-screen-header">
                    <h2>Uygulama Kilitlendi</h2>
                    <p>
                        {user?.username || 'Kullanıcı'}, devam etmek için {isCustomActive ? 'özel kilit şifrenizi / PIN kodunuzu' : 'giriş şifrenizi'} girin.
                    </p>
                </div>

                <form onSubmit={handleUnlock} className="lock-screen-form">
                    <div className={`lock-input-wrapper ${error ? 'error' : ''}`}>
                        <input
                            ref={inputRef}
                            type="password"
                            placeholder={isCustomActive ? "Kilit Şifresi / PIN" : "Hesap Giriş Şifreniz"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            maxLength={64}
                            autoFocus
                        />
                        <button type="submit" disabled={loading || !password}>
                            {loading ? <Loader2 className="animate-spin" size={18} /> : <ArrowRight size={18} />}
                        </button>
                    </div>
                    {error && <div className="lock-error">{error}</div>}
                </form>

                {hasCustom && (
                    <button
                        type="button"
                        onClick={() => {
                            setUseAccountPassFallback(!useAccountPassFallback)
                            setError('')
                            setPassword('')
                            setTimeout(() => inputRef.current?.focus(), 50)
                        }}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-secondary, #a1a1aa)',
                            fontSize: '12px',
                            cursor: 'pointer',
                            marginTop: '12px',
                            textDecoration: 'underline',
                            padding: '4px'
                        }}
                    >
                        {isCustomActive ? 'Kilit şifrenizi mi unuttunuz? Ana hesap şifresiyle açın' : 'Özel kilit şifresi / PIN ile aç'}
                    </button>
                )}

                <div className="lock-screen-footer">
                    <button className="lock-logout-btn" onClick={logout}>
                        <LogOut size={14} />
                        <span>Farklı kullanıcı ile giriş yap</span>
                    </button>
                </div>
            </div>

            <style>{`
                .lock-screen-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(var(--bg-primary-rgb, 10, 10, 18), 0.7);
                    backdrop-filter: blur(20px) saturate(160%);
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    animation: lockFadeIn 0.4s ease-out;
                }

                @keyframes lockFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                .lock-screen-container {
                    width: 100%;
                    max-width: 380px;
                    padding: 40px;
                    background: var(--bg-card);
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-xl);
                    box-shadow: var(--shadow-lg);
                    text-align: center;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    backdrop-filter: blur(10px);
                }

                .lock-screen-avatar-area {
                    position: relative;
                    margin-bottom: 24px;
                }

                .lock-avatar {
                    width: 80px;
                    height: 80px;
                    border-radius: var(--radius-lg);
                    background: var(--accent-gradient);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    overflow: hidden;
                    border: 2px solid var(--border-light);
                }

                .lock-avatar img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .lock-badge {
                    position: absolute;
                    bottom: -4px;
                    right: -4px;
                    width: 24px;
                    height: 24px;
                    background: var(--warning);
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    border: 2px solid var(--bg-primary);
                }

                .lock-screen-header h2 {
                    font-size: 20px;
                    font-weight: 700;
                    color: var(--text-primary);
                    margin-bottom: 8px;
                }

                .lock-screen-header p {
                    font-size: 14px;
                    color: var(--text-secondary);
                    margin-bottom: 32px;
                }

                .lock-screen-form {
                    width: 100%;
                    margin-bottom: 32px;
                }

                .lock-input-wrapper {
                    display: flex;
                    align-items: center;
                    background: var(--bg-tertiary);
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-md);
                    padding: 4px 4px 4px 16px;
                    transition: all 0.2s var(--ease-out);
                }

                .lock-input-wrapper:focus-within {
                    border-color: var(--accent-primary);
                    background: var(--bg-elevated);
                    box-shadow: 0 0 0 4px var(--accent-subtle);
                }

                .lock-input-wrapper.error {
                    border-color: var(--danger);
                    animation: shake 0.4s ease;
                }

                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-5px); }
                    75% { transform: translateX(5px); }
                }

                .lock-input-wrapper input {
                    flex: 1;
                    background: transparent;
                    border: none;
                    color: var(--text-primary);
                    font-size: 15px;
                    outline: none;
                    padding: 10px 0;
                }

                .lock-input-wrapper input::placeholder {
                    color: var(--text-muted);
                    opacity: 0.5;
                }

                .lock-input-wrapper button {
                    width: 38px;
                    height: 38px;
                    border-radius: var(--radius-sm);
                    background: var(--accent-primary);
                    color: white;
                    border: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .lock-input-wrapper button:disabled {
                    background: var(--bg-tertiary);
                    color: var(--text-muted);
                    cursor: not-allowed;
                    opacity: 0.5;
                }

                .lock-input-wrapper button:not(:disabled):hover {
                    background: var(--accent-secondary);
                    transform: scale(1.05);
                }

                .lock-error {
                    margin-top: 10px;
                    font-size: 12px;
                    color: var(--danger);
                    font-weight: 500;
                }

                .lock-screen-footer {
                    border-top: 1px solid var(--border-color);
                    padding-top: 24px;
                    width: 100%;
                }

                .lock-logout-btn {
                    background: transparent;
                    border: none;
                    color: var(--text-muted);
                    font-size: 13px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    cursor: pointer;
                    margin: 0 auto;
                    transition: color 0.2s;
                }

                .lock-logout-btn:hover {
                    color: var(--text-primary);
                }
            `}</style>
        </div>
    )
}
