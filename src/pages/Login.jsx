import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../services/supabase'
import Modal from '../components/Modal'
import { 
    Mail, 
    Lock, 
    Eye, 
    EyeOff, 
    ShieldCheck, 
    CheckCircle2, 
    AlertCircle, 
    ArrowRight, 
    Loader2, 
    Shield, 
    KeyRound, 
    ArrowLeft,
    Smartphone,
    Send
} from 'lucide-react'
import logo from '../assets/logos/Group1.svg'
import './Login.css'

export default function Login() {
    const { login, verify2FALogin } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [rememberMe, setRememberMe] = useState(true)
    const [capsLockActive, setCapsLockActive] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [emailVerified, setEmailVerified] = useState(false)
    const [unverifiedEmail, setUnverifiedEmail] = useState('')
    const [resendingVerification, setResendingVerification] = useState(false)
    const [resendVerificationMsg, setResendVerificationMsg] = useState('')

    // Forgot Password Modal State
    const [showForgotModal, setShowForgotModal] = useState(false)
    const [forgotEmail, setForgotEmail] = useState('')
    const [forgotOtp, setForgotOtp] = useState('')
    const [forgotStep, setForgotStep] = useState('request') // 'request' | 'otp'
    const [forgotLoading, setForgotLoading] = useState(false)
    const [forgotError, setForgotError] = useState('')
    const [forgotSuccess, setForgotSuccess] = useState('')

    // 2FA Challenge State
    const [mfaChallenge, setMfaChallenge] = useState(null) // { userId, username, email }
    const [twoFactorCode, setTwoFactorCode] = useState('')
    const [isBackupMode, setIsBackupMode] = useState(false)
    const [verifying2FA, setVerifying2FA] = useState(false)
    const mfaInputRef = useRef(null)

    const [inviteOnlyNotice, setInviteOnlyNotice] = useState(false)

    // Check if user arrived after confirming email or from invite-only redirect
    useEffect(() => {
        const params = new URLSearchParams(location.search)
        if (params.get('verified') === 'true') {
            setEmailVerified(true)
        }
        if (params.get('notice') === 'invite_only') {
            setInviteOnlyNotice(true)
        }
    }, [location])

    // Load remembered user
    useEffect(() => {
        const saved = localStorage.getItem('aractakip_saved_user')
        if (saved) {
            setEmail(saved)
            setRememberMe(true)
        }
    }, [])

    useEffect(() => {
        if (mfaChallenge && mfaInputRef.current) {
            mfaInputRef.current.focus()
        }
    }, [mfaChallenge, isBackupMode])

    const handleKeyDown = (e) => {
        if (e.getModifierState) {
            setCapsLockActive(e.getModifierState('CapsLock'))
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')

        const cleanEmail = email.trim()
        const cleanPassword = password.trim()

        if (!cleanEmail || !cleanPassword) {
            setError('Lütfen kullanıcı adı/e-posta ve şifrenizi girin.')
            return
        }

        setLoading(true)

        try {
            const result = await login(cleanEmail, cleanPassword)

            if (result.success) {
                if (result.require2FA) {
                    setMfaChallenge({
                        userId: result.userId,
                        username: result.username,
                        email: result.email
                    })
                    setLoading(false)
                    return
                }

                if (rememberMe) {
                    localStorage.setItem('aractakip_saved_user', cleanEmail)
                } else {
                    localStorage.removeItem('aractakip_saved_user')
                }
            } else {
                if (result.pendingApproval) {
                    setUnverifiedEmail('')
                    setError('⏳ Hesap Onayı Bekleniyor: Şirket başvurunuz başarıyla alınmış olup Platform Yöneticisi incelemesindedir. Hesabınız onaylandığında giriş yapabilirsiniz.')
                } else if (result.requireEmailVerification) {
                    setUnverifiedEmail(result.email || cleanEmail)
                    setResendVerificationMsg('')
                    setError(result.error || 'E-posta adresiniz henüz doğrulanmamış.')
                } else {
                    setUnverifiedEmail('')
                    setError(result.error || 'Giriş yapılamadı. Lütfen bilgilerinizi kontrol edin.')
                }
                setLoading(false)
            }
        } catch (err) {
            setError('Sunucu bağlantı hatası: ' + err.message)
            setLoading(false)
        }
    }

    const handle2FASubmit = async (e) => {
        e?.preventDefault()
        setError('')

        const cleanCode = twoFactorCode.trim()
        if (!cleanCode) {
            setError(isBackupMode ? 'Lütfen kurtarma kodunu girin.' : 'Lütfen 6 haneli doğrulama kodunu girin.')
            return
        }

        setVerifying2FA(true)

        try {
            const result = await verify2FALogin(mfaChallenge.userId, cleanCode)

            if (result.success) {
                if (rememberMe) {
                    localStorage.setItem('aractakip_saved_user', email.trim())
                }
                if (result.backupCodeUsed) {
                    alert(`Kurtarma kodu kullanıldı. Kalan kurtarma kodu sayınız: ${result.remainingBackupCodes}`)
                }
            } else {
                setError(result.error || 'Geçersiz güvenlik kodu.')
                setVerifying2FA(false)
            }
        } catch (err) {
            setError('Doğrulama hatası: ' + err.message)
            setVerifying2FA(false)
        }
    }

    const cancel2FA = () => {
        setMfaChallenge(null)
        setTwoFactorCode('')
        setIsBackupMode(false)
        setError('')
    }

    // Forgot Password Handlers
    const handleForgotRequest = async (e) => {
        e?.preventDefault()
        setForgotError('')
        setForgotSuccess('')

        const cleanEmail = forgotEmail.trim()
        if (!cleanEmail) {
            setForgotError('Lütfen geçerli bir e-posta adresi girin.')
            return
        }

        setForgotLoading(true)

        try {
            if (window.electronAPI?.requestPasswordReset) {
                const res = await window.electronAPI.requestPasswordReset({ email: cleanEmail })
                if (!res.success) {
                    setForgotError(res.error || 'Sıfırlama talebi gönderilemedi.')
                    setForgotLoading(false)
                    return
                }
            } else {
                const { error: resetErr } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
                    redirectTo: 'https://kontrol-app.com/#/reset-password'
                })
                if (resetErr) {
                    setForgotError(resetErr.message || 'Sıfırlama talebi gönderilemedi.')
                    setForgotLoading(false)
                    return
                }
            }

            setForgotSuccess('Şifre sıfırlama bağlantısı ve 6 haneli güvenlik kodunuz e-posta adresinize gönderildi!')
            setForgotStep('otp')
        } catch (err) {
            setForgotError('Bağlantı hatası: ' + err.message)
        } finally {
            setForgotLoading(false)
        }
    }

    const handleVerifyForgotOtp = async (e) => {
        e?.preventDefault()
        setForgotError('')

        const cleanEmail = forgotEmail.trim()
        const cleanOtp = forgotOtp.replace(/[\s\-_]/g, '').trim()

        if (!cleanEmail || !cleanOtp) {
            setForgotError('Lütfen 6 haneli doğrulama kodunu girin.')
            return
        }

        setForgotLoading(true)

        try {
            let verified = false

            // 1. Direct Electron API verification
            if (window.electronAPI?.verifyRecoveryOtp) {
                const res = await window.electronAPI.verifyRecoveryOtp({
                    email: cleanEmail,
                    otp: cleanOtp
                })
                if (res?.success) {
                    verified = true
                }
            }

            // 2. Supabase Auth API verification
            if (!verified) {
                const { data, error: verifyErr } = await supabase.auth.verifyOtp({
                    email: cleanEmail,
                    token: cleanOtp,
                    type: 'recovery'
                })
                if (!verifyErr) {
                    verified = true
                } else if (!window.electronAPI?.verifyRecoveryOtp) {
                    setForgotError(verifyErr.message || 'Geçersiz veya süresi dolmuş kod.')
                    setForgotLoading(false)
                    return
                }
            }

            if (verified) {
                setShowForgotModal(false)
                navigate('/reset-password?email=' + encodeURIComponent(cleanEmail) + '&otp=' + encodeURIComponent(cleanOtp))
            } else {
                setForgotError('Geçersiz veya süresi dolmuş kod. Lütfen e-postanızı kontrol edin.')
                setForgotLoading(false)
            }
        } catch (err) {
            setForgotError('Doğrulama hatası: ' + err.message)
            setForgotLoading(false)
        }
    }

    return (
        <div className="modern-auth-page">
            <div className="modern-auth-container">
                {/* ── LEFT SIDE: BRANDING & MINIMAL IDENTITY ── */}
                <div className="auth-brand-panel">
                    <div className="brand-panel-inner">
                        <img src={logo} alt="Kontrol Logo" className="brand-logo-img" />
                        <h1 className="brand-title-clean">KONTROL</h1>
                        <p className="brand-subtitle-clean">Filo & Yönetim Platformu</p>
                    </div>

                    <div className="brand-footer-clean">
                        <ShieldCheck size={14} className="brand-shield-icon" />
                        <span>Güvenli Kurumsal Giriş</span>
                    </div>
                </div>

                {/* ── RIGHT SIDE: FORM CONTAINER ── */}
                <div className="auth-form-panel">
                    {/* ── 2FA VERIFICATION CHALLENGE FORM ── */}
                    {mfaChallenge ? (
                        <div>
                            <div className="form-header-block">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                    <span className="badge badge-success" style={{ padding: '4px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                        <Smartphone size={12} />
                                        2FA Aktif
                                    </span>
                                </div>
                                <h2 className="form-header-title">Güvenlik Doğrulaması</h2>
                                <p className="form-header-subtitle">
                                    {isBackupMode 
                                        ? 'Lütfen 8 haneli kurtarma (backup) kodunuzu girin.' 
                                        : 'Authenticator uygulamanızdaki (Google / Microsoft vb.) 6 haneli kodu girin.'}
                                </p>
                            </div>

                            {error && (
                                <div className="auth-error-alert">
                                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                                    <span>{error}</span>
                                </div>
                            )}

                            <form onSubmit={handle2FASubmit}>
                                <div className="form-group" style={{ marginBottom: '14px' }}>
                                    <label className="form-label" style={{ marginBottom: '8px', display: 'block', fontSize: '13px', fontWeight: 500 }}>
                                        {isBackupMode ? 'Kurtarma Kodu' : '6 Haneli Doğrulama Kodu'}
                                    </label>
                                    <div className="modern-input-wrapper">
                                        {isBackupMode ? <KeyRound size={18} className="input-leading-icon" /> : <Shield size={18} className="input-leading-icon" />}
                                        <input
                                            ref={mfaInputRef}
                                            type="text"
                                            className="modern-input-field"
                                            placeholder={isBackupMode ? "XXXX-XXXX" : "000 000"}
                                            value={twoFactorCode}
                                            onChange={(e) => setTwoFactorCode(e.target.value)}
                                            maxLength={isBackupMode ? 10 : 7}
                                            autoComplete="one-time-code"
                                            disabled={verifying2FA}
                                            style={{
                                                letterSpacing: isBackupMode ? '3px' : '6px',
                                                fontSize: '20px',
                                                textAlign: 'center',
                                                fontWeight: '700',
                                                fontFamily: 'monospace'
                                            }}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', fontSize: '12.5px' }}>
                                    <button
                                        type="button"
                                        style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: 0 }}
                                        onClick={() => { setIsBackupMode(!isBackupMode); setTwoFactorCode(''); setError(''); }}
                                    >
                                        {isBackupMode ? '← Authenticator Kodu Kullan' : 'Telefona erişemiyorum (Kurtarma Kodu)'}
                                    </button>
                                </div>

                                <button
                                    type="submit"
                                    className="modern-submit-btn"
                                    disabled={verifying2FA}
                                >
                                    {verifying2FA ? (
                                        <>
                                            <Loader2 size={18} className="spin" />
                                            <span>Doğrulanıyor...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Doğrula ve Giriş Yap</span>
                                            <ArrowRight size={16} />
                                        </>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={cancel2FA}
                                    style={{ width: '100%', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                >
                                    <ArrowLeft size={15} />
                                    <span>Farklı Bir Hesapla Giriş Yap</span>
                                </button>
                            </form>
                        </div>
                    ) : (
                        /* ── STANDARD LOGIN FORM ── */
                        <div>
                            <div className="form-header-block">
                                <h2 className="form-header-title">Giriş Yap</h2>
                                <p className="form-header-subtitle">Yönetim paneline erişmek için bilgilerinizi girin.</p>
                            </div>

                            {emailVerified && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 14px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', fontSize: '13px', marginBottom: '16px' }}>
                                    <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                                    <span>E-posta adresiniz başarıyla doğrulandı! Şimdi giriş yapabilirsiniz.</span>
                                </div>
                            )}

                            {error && (
                                <div className="auth-error-alert" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                                        <AlertCircle size={16} style={{ flexShrink: 0 }} />
                                        <span>{error}</span>
                                    </div>
                                    {unverifiedEmail && (
                                        <div style={{ width: '100%', paddingTop: '4px', borderTop: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                            {resendVerificationMsg ? (
                                                <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 600 }}>{resendVerificationMsg}</span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        setResendingVerification(true)
                                                        try {
                                                            if (window.electronAPI?.resendVerificationEmail) {
                                                                await window.electronAPI.resendVerificationEmail({ email: unverifiedEmail })
                                                            } else {
                                                                await supabase.auth.resend({
                                                                    type: 'signup',
                                                                    email: unverifiedEmail,
                                                                    options: { emailRedirectTo: 'https://kontrol-app.com/login?verified=true' }
                                                                })
                                                            }
                                                            setResendVerificationMsg('Doğrulama bağlantısı e-posta adresinize tekrar gönderildi!')
                                                        } catch (e) {
                                                            setResendVerificationMsg('Gönderim hatası: ' + e.message)
                                                        } finally {
                                                            setResendingVerification(false)
                                                        }
                                                    }}
                                                    disabled={resendingVerification}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        color: '#3b82f6',
                                                        fontSize: '12.5px',
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                        padding: 0,
                                                        textDecoration: 'underline'
                                                    }}
                                                >
                                                    {resendingVerification ? 'Gönderiliyor...' : 'Doğrulama E-postasını Tekrar Gönder →'}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {inviteOnlyNotice && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '10px',
                                    padding: '12px 14px',
                                    background: 'rgba(59, 130, 246, 0.1)',
                                    border: '1px solid rgba(59, 130, 246, 0.25)',
                                    borderRadius: '8px',
                                    marginBottom: '18px',
                                    color: '#60a5fa',
                                    fontSize: '13px',
                                    lineHeight: '1.45'
                                }}>
                                    <ShieldCheck size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#3b82f6' }} />
                                    <span>
                                        <strong>Kurumsal Erişim:</strong> Kontrol platformuna yalnızca yetkili şirket davetiyesi ile giriş yapılabilir. Hesabınız yoksa lütfen şirket yöneticinizden davet talep ediniz.
                                    </span>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} noValidate>
                                <div className="form-group" style={{ marginBottom: '18px' }}>
                                    <label className="form-label" style={{ marginBottom: '8px', display: 'block', fontSize: '13px', fontWeight: 500 }}>
                                        Kullanıcı Adı veya E-Posta
                                    </label>
                                    <div className="modern-input-wrapper">
                                        <Mail size={18} className="input-leading-icon" />
                                        <input
                                            type="text"
                                            className="modern-input-field"
                                            placeholder="admin veya ornek@sirket.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            maxLength={100}
                                            autoComplete="username"
                                            autoFocus
                                            disabled={loading}
                                        />
                                    </div>
                                </div>

                                <div className="form-group" style={{ marginBottom: '8px' }}>
                                    <label className="form-label" style={{ marginBottom: '8px', display: 'block', fontSize: '13px', fontWeight: 500 }}>
                                        Şifre
                                    </label>
                                    <div className="modern-input-wrapper">
                                        <Lock size={18} className="input-leading-icon" />
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            className="modern-input-field"
                                            style={{ paddingRight: '42px' }}
                                            placeholder="••••••••"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            maxLength={64}
                                            onKeyDown={handleKeyDown}
                                            onKeyUp={handleKeyDown}
                                            autoComplete="current-password"
                                            disabled={loading}
                                        />
                                        <button
                                            type="button"
                                            className="input-toggle-btn"
                                            onClick={() => setShowPassword(!showPassword)}
                                            tabIndex="-1"
                                            title={showPassword ? 'Şifreyi Gizle' : 'Şifreyi Göster'}
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>

                                    {capsLockActive && (
                                        <div className="caps-warning-pill">
                                            <AlertCircle size={12} />
                                            <span>Büyük Harf Kilidi (Caps Lock) Açık</span>
                                        </div>
                                    )}
                                </div>

                                <div className="auth-options-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <label className="remember-label">
                                        <input
                                            type="checkbox"
                                            className="remember-checkbox"
                                            checked={rememberMe}
                                            onChange={(e) => setRememberMe(e.target.checked)}
                                            disabled={loading}
                                        />
                                        <span>Beni Hatırla</span>
                                    </label>

                                    <button
                                        type="button"
                                        className="forgot-password-link"
                                        onClick={() => {
                                            setShowForgotModal(true)
                                            setForgotEmail(email.includes('@') ? email : '')
                                            setForgotStep('request')
                                            setForgotError('')
                                            setForgotSuccess('')
                                        }}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: 'var(--accent-primary, #3b82f6)',
                                            fontSize: '13px',
                                            cursor: 'pointer',
                                            fontWeight: 500,
                                            padding: 0
                                        }}
                                    >
                                        Şifremi Unuttum?
                                    </button>
                                </div>

                                <button
                                    type="submit"
                                    className="modern-submit-btn"
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 size={18} className="spin" />
                                            <span>Giriş Yapılıyor...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Giriş Yap</span>
                                            <ArrowRight size={16} />
                                        </>
                                    )}
                                </button>
                            </form>

                            <div className="auth-bottom-footer" style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                <ShieldCheck size={14} style={{ color: '#10b981', flexShrink: 0 }} />
                                <span>Kurumsal B2B Platformu • Erişim yalnızca yetkili davetiyesi iledir.</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── FORGOT PASSWORD MODAL ── */}
            {showForgotModal && (
                <Modal
                    isOpen={showForgotModal}
                    onClose={() => setShowForgotModal(false)}
                    title="Şifre Sıfırlama"
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                            {forgotStep === 'request'
                                ? 'Hesabınıza kayıtlı e-posta adresinizi girin. Size bir şifre sıfırlama linki ve güvenlik kodu göndereceğiz.'
                                : 'E-posta adresinize gönderilen linke tıklayabilir veya aşağıdaki kutuya 6 haneli güvenlik kodunu girebilirsiniz.'}
                        </p>

                        {forgotError && (
                            <div className="auth-error-alert" style={{ margin: 0 }}>
                                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                                <span>{forgotError}</span>
                            </div>
                        )}

                        {forgotSuccess && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.25)', color: '#10b981', fontSize: '12.5px' }}>
                                <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
                                <span>{forgotSuccess}</span>
                            </div>
                        )}

                        {forgotStep === 'request' ? (
                            <form onSubmit={handleForgotRequest}>
                                <div className="form-group" style={{ marginBottom: '16px' }}>
                                    <label className="form-label">E-Posta Adresiniz</label>
                                    <div className="modern-input-wrapper">
                                        <Mail size={16} className="input-leading-icon" />
                                        <input
                                            type="email"
                                            className="modern-input-field"
                                            placeholder="ornek@sirket.com"
                                            value={forgotEmail}
                                            onChange={(e) => setForgotEmail(e.target.value)}
                                            maxLength={100}
                                            required
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={() => setShowForgotModal(false)}
                                    >
                                        İptal
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        disabled={forgotLoading}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                    >
                                        {forgotLoading ? (
                                            <>
                                                <Loader2 size={14} className="spin" />
                                                <span>Gönderiliyor...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Send size={14} />
                                                <span>Sıfırlama Linki Gönder</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <form onSubmit={handleVerifyForgotOtp}>
                                <div className="form-group" style={{ marginBottom: '14px' }}>
                                    <label className="form-label">6 Haneli Güvenlik Kodu</label>
                                    <div className="modern-input-wrapper">
                                        <KeyRound size={16} className="input-leading-icon" />
                                        <input
                                            type="text"
                                            className="modern-input-field"
                                            placeholder="000 000"
                                            maxLength={6}
                                            value={forgotOtp}
                                            onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ''))}
                                            style={{ letterSpacing: '4px', textAlign: 'center', fontSize: '18px', fontWeight: 'bold' }}
                                            required
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                                    <button
                                        type="button"
                                        style={{ background: 'none', border: 'none', color: 'var(--accent-primary, #3b82f6)', fontSize: '12px', cursor: 'pointer', padding: 0 }}
                                        onClick={() => setForgotStep('request')}
                                    >
                                        ← Başka E-Posta Dene
                                    </button>

                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            type="button"
                                            className="btn btn-secondary"
                                            onClick={() => setShowForgotModal(false)}
                                        >
                                            Kapat
                                        </button>
                                        <button
                                            type="submit"
                                            className="btn btn-primary"
                                            disabled={forgotLoading}
                                        >
                                            {forgotLoading ? 'Doğrulanıyor...' : 'Kodu Onayla ve Şifreyi Yenile'}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        )}
                    </div>
                </Modal>
            )}
        </div>
    )
}
