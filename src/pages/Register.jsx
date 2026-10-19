import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../services/supabase'
import { 
    Building2, 
    User, 
    Mail, 
    Lock, 
    Eye, 
    EyeOff, 
    ShieldCheck, 
    CheckCircle2, 
    AlertCircle, 
    ArrowRight, 
    Loader2, 
    KeyRound, 
    Send,
    ArrowLeft
} from 'lucide-react'
import logo from '../assets/logos/Group1.svg'
import './Login.css'

export default function Register() {
    const { register } = useAuth()
    const navigate = useNavigate()

    const [companyName, setCompanyName] = useState('')
    const [username, setUsername] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    // Verification Step States
    const [isSubmitted, setIsSubmitted] = useState(false)
    const [isPendingApproval, setIsPendingApproval] = useState(false)
    const [registeredEmail, setRegisteredEmail] = useState('')
    const [otpCode, setOtpCode] = useState('')
    const [verifyingOtp, setVerifyingOtp] = useState(false)
    const [otpError, setOtpError] = useState('')
    const [resendCooldown, setResendCooldown] = useState(0)
    const [resendMsg, setResendMsg] = useState('')
    const [resending, setResending] = useState(false)

    useEffect(() => {
        let timer
        if (resendCooldown > 0) {
            timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
        }
        return () => clearTimeout(timer)
    }, [resendCooldown])

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')

        const cleanCompany = companyName.trim()
        const cleanUser = username.trim()
        const cleanEmail = email.trim().toLowerCase()
        const cleanPassword = password.trim()
        const cleanConfirm = confirmPassword.trim()

        if (!cleanCompany || !cleanUser || !cleanEmail || !cleanPassword || !cleanConfirm) {
            setError('Lütfen şirket adı dahil tüm zorunlu alanları doldurun.')
            return
        }

        if (cleanPassword !== cleanConfirm) {
            setError('Girilen şifreler birbiriyle eşleşmiyor.')
            return
        }

        if (cleanPassword.length < 6) {
            setError('Şifreniz en az 6 karakter uzunluğunda olmalıdır.')
            return
        }

        setLoading(true)

        try {
            const result = await register(cleanUser, cleanEmail, cleanPassword, cleanCompany)

            if (result.success) {
                if (result.requireVerification) {
                    setRegisteredEmail(cleanEmail)
                    setIsSubmitted(true)
                    setResendCooldown(60)
                } else {
                    navigate('/')
                }
            } else {
                setError(result.error || 'Kayıt işlemi gerçekleştirilemedi.')
                setLoading(false)
            }
        } catch (err) {
            setError('Sunucu bağlantı hatası: ' + err.message)
            setLoading(false)
        }
    }

    const handleVerifyOtp = async (e) => {
        e?.preventDefault()
        setOtpError('')
        const cleanCode = otpCode.trim()

        if (!cleanCode || cleanCode.length < 6) {
            setOtpError('Lütfen 6 haneli doğrulama kodunu eksiksiz girin.')
            return
        }

        setVerifyingOtp(true)

        try {
            let verified = false

            // Try direct Electron/Node memory verification first
            if (window.electronAPI?.verifyRecoveryOtp) {
                try {
                    const vRes = await window.electronAPI.verifyRecoveryOtp({ email: registeredEmail, otp: cleanCode })
                    if (vRes?.success && vRes?.verified) {
                        verified = true
                    }
                } catch (e) {}
            }

            // Fallback to Supabase Auth client verify
            if (!verified) {
                try {
                    const { error: verifyErr } = await supabase.auth.verifyOtp({
                        email: registeredEmail,
                        token: cleanCode,
                        type: 'signup'
                    })
                    if (!verifyErr) verified = true
                } catch (e) {}
            }

            if (verified) {
                // Record email confirmation in local database
                if (window.electronAPI?.activateUserByEmail) {
                    await window.electronAPI.activateUserByEmail({ email: registeredEmail, otp: cleanCode })
                }
                setIsPendingApproval(true)
            } else {
                setOtpError('Geçersiz veya süresi dolmuş doğrulama kodu.')
                setVerifyingOtp(false)
            }
        } catch (err) {
            setOtpError('Doğrulama hatası: ' + err.message)
            setVerifyingOtp(false)
        }
    }

    const handleResendEmail = async () => {
        if (resendCooldown > 0 || resending) return
        setResending(true)
        setResendMsg('')
        setOtpError('')

        try {
            if (window.electronAPI?.resendVerificationEmail) {
                await window.electronAPI.resendVerificationEmail({ email: registeredEmail })
            } else {
                await supabase.auth.resend({
                    type: 'signup',
                    email: registeredEmail,
                    options: {
                        emailRedirectTo: 'https://kontrol-app.com/login?verified=true'
                    }
                })
            }
            setResendMsg('Doğrulama e-postası tekrar gönderildi!')
            setResendCooldown(60)
        } catch (err) {
            setOtpError('E-posta gönderim hatası: ' + err.message)
        } finally {
            setResending(false)
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
                        <span>Güvenli Kurumsal Kayıt</span>
                    </div>
                </div>

                {/* ── RIGHT SIDE: REGISTER FORM OR VERIFICATION SCREEN ── */}
                <div className="auth-form-panel">
                    {isPendingApproval ? (
                        /* ── STEP 3: APPLICATION SUBMITTED & PENDING PLATFORM APPROVAL ── */
                        <div>
                            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                                <div style={{ 
                                    width: '64px', 
                                    height: '64px', 
                                    borderRadius: '50%', 
                                    background: 'rgba(16, 185, 129, 0.15)', 
                                    color: '#10b981', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center', 
                                    margin: '0 auto 16px',
                                    border: '1px solid rgba(16, 185, 129, 0.3)'
                                }}>
                                    <ShieldCheck size={36} />
                                </div>
                                <h2 className="form-header-title" style={{ fontSize: '22px' }}>Başvurunuz Alındı! </h2>
                                <p className="form-header-subtitle" style={{ marginTop: '8px', lineHeight: 1.5 }}>
                                    E-posta adresiniz başarıyla doğrulandı.
                                </p>
                            </div>

                            <div style={{
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '10px',
                                padding: '16px',
                                marginBottom: '20px',
                                fontSize: '13px'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Kayıtlı Şirket:</span>
                                    <strong style={{ color: 'var(--text-primary)' }}>{companyName || 'Şirketiniz'}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Yetkili E-Posta:</span>
                                    <strong style={{ color: 'var(--text-primary)' }}>{registeredEmail}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Hesap Durumu:</span>
                                    <span style={{ 
                                        display: 'inline-flex', 
                                        alignItems: 'center', 
                                        gap: '5px',
                                        fontSize: '12px', 
                                        fontWeight: 600, 
                                        color: '#f59e0b', 
                                        background: 'rgba(245, 158, 11, 0.12)', 
                                        padding: '3px 8px', 
                                        borderRadius: '4px',
                                        border: '1px solid rgba(245, 158, 11, 0.25)'
                                    }}>
                                        ⏳ Yönetici Onayı Bekleniyor
                                    </span>
                                </div>
                            </div>

                            <div style={{ 
                                background: 'rgba(59, 130, 246, 0.08)', 
                                border: '1px solid rgba(59, 130, 246, 0.2)', 
                                borderRadius: '8px', 
                                padding: '12px 14px', 
                                marginBottom: '24px', 
                                fontSize: '12.5px', 
                                color: 'var(--text-secondary)',
                                lineHeight: 1.5
                            }}>
                                Kontrol App kurumsal güvenlik protokolü gereği yeni şirket başvuruları sistem yöneticisi tarafından incelenerek onaylanmaktadır. Hesabınız aktif edildiğinde giriş yapabilirsiniz.
                            </div>

                            <Link
                                to="/login"
                                className="modern-submit-btn"
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
                            >
                                <span>Giriş Sayfasına Dön</span>
                                <ArrowRight size={16} />
                            </Link>
                        </div>
                    ) : isSubmitted ? (
                        /* ── EMAIL VERIFICATION WAITING STEP ── */
                        <div>
                            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                                <div style={{ 
                                    width: '60px', 
                                    height: '60px', 
                                    borderRadius: '50%', 
                                    background: 'rgba(59, 130, 246, 0.15)', 
                                    color: '#3b82f6', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center', 
                                    margin: '0 auto 16px',
                                    border: '1px solid rgba(59, 130, 246, 0.3)'
                                }}>
                                    <Mail size={30} />
                                </div>
                                <h2 className="form-header-title">E-Postanızı Doğrulayın</h2>
                                <p className="form-header-subtitle" style={{ marginTop: '8px', lineHeight: 1.5 }}>
                                    <strong style={{ color: 'var(--text-primary)' }}>{registeredEmail}</strong> adresinize bir doğrulama kodu gönderdik.
                                </p>
                            </div>

                            {resendMsg && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.25)', color: '#10b981', fontSize: '12.5px', marginBottom: '16px' }}>
                                    <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
                                    <span>{resendMsg}</span>
                                </div>
                            )}

                            {otpError && (
                                <div className="auth-error-alert" style={{ marginBottom: '16px' }}>
                                    <AlertCircle size={15} style={{ flexShrink: 0 }} />
                                    <span>{otpError}</span>
                                </div>
                            )}

                            {/* Option 1: Enter 6-digit OTP code directly */}
                            <form onSubmit={handleVerifyOtp} style={{ marginBottom: '20px' }}>
                                <div className="form-group" style={{ marginBottom: '14px' }}>
                                    <label className="form-label" style={{ textAlign: 'center', display: 'block', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                                        Maildeki 6 haneli güvenlik kodunu girin:
                                    </label>
                                    <div className="modern-input-wrapper">
                                        <KeyRound size={18} className="input-leading-icon" />
                                        <input
                                            type="text"
                                            className="modern-input-field"
                                            placeholder="000 000"
                                            maxLength={6}
                                            value={otpCode}
                                            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                                            style={{ letterSpacing: '6px', textAlign: 'center', fontSize: '20px', fontWeight: 'bold' }}
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="modern-submit-btn"
                                    disabled={verifyingOtp || otpCode.length < 6}
                                >
                                    {verifyingOtp ? (
                                        <>
                                            <Loader2 size={16} className="spin" />
                                            <span>Doğrulanıyor...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Kodu Onayla ve Başvuruyu Tamamla</span>
                                            <ArrowRight size={16} />
                                        </>
                                    )}
                                </button>
                            </form>

                            <div style={{ textAlign: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>
                                    Doğrulama linki veya kodu ulaşmadı mı?
                                </p>
                                <button
                                    type="button"
                                    onClick={handleResendEmail}
                                    disabled={resendCooldown > 0 || resending}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: resendCooldown > 0 ? 'var(--text-muted)' : 'var(--accent-primary, #3b82f6)',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        cursor: resendCooldown > 0 ? 'default' : 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        padding: 0
                                    }}
                                >
                                    <Send size={14} />
                                    <span>
                                        {resending ? 'Gönderiliyor...' : resendCooldown > 0 ? `Tekrar Gönder (${resendCooldown}s)` : 'Tekrar E-posta Gönder'}
                                    </span>
                                </button>
                            </div>

                            <div className="auth-bottom-footer" style={{ marginTop: '20px' }}>
                                <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <ArrowLeft size={14} />
                                    <span>Giriş Sayfasına Git</span>
                                </Link>
                            </div>
                        </div>
                    ) : (
                        /* ── STANDARD REGISTER FORM ── */
                        <div>
                            <div className="form-header-block">
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, color: 'var(--accent-primary)', background: 'var(--accent-subtle)', padding: '3px 8px', borderRadius: '20px', marginBottom: '8px', border: '1px solid var(--border-color)' }}>
                                    <Building2 size={12} />
                                    <span>Kurumsal B2B Şirket Kaydı</span>
                                </div>
                                <h2 className="form-header-title">Yeni Şirket Hesabı Başvurusu</h2>
                                <p className="form-header-subtitle">Filo yönetim sistemine başlamak için kurumsal bilgilerinizi doldurun.</p>
                            </div>

                            {error && (
                                <div className="auth-error-alert">
                                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                                    <span>{error}</span>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} noValidate>
                                <div className="form-group" style={{ marginBottom: '14px' }}>
                                    <label className="form-label" style={{ marginBottom: '6px', display: 'block', fontSize: '13px', fontWeight: 500 }}>
                                        Şirket / Firma Unvanı *
                                    </label>
                                    <div className="modern-input-wrapper">
                                        <Building2 size={18} className="input-leading-icon" />
                                        <input
                                            type="text"
                                            className="modern-input-field"
                                            placeholder="Örn: SAK VİNÇ LTD. ŞTİ."
                                            value={companyName}
                                            onChange={(e) => setCompanyName(e.target.value)}
                                            maxLength={150}
                                            autoFocus
                                            disabled={loading}
                                        />
                                    </div>
                                </div>

                                <div className="auth-form-grid" style={{ marginBottom: '14px' }}>
                                    <div className="form-group">
                                        <label className="form-label" style={{ marginBottom: '6px', display: 'block', fontSize: '13px', fontWeight: 500 }}>
                                            Yönetici Kullanıcı Adı *
                                        </label>
                                        <div className="modern-input-wrapper">
                                            <User size={18} className="input-leading-icon" />
                                            <input
                                                type="text"
                                                className="modern-input-field"
                                                placeholder="admin_kullanici"
                                                value={username}
                                                onChange={(e) => setUsername(e.target.value)}
                                                maxLength={50}
                                                disabled={loading}
                                            />
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label" style={{ marginBottom: '6px', display: 'block', fontSize: '13px', fontWeight: 500 }}>
                                            Kurumsal E-Posta *
                                        </label>
                                        <div className="modern-input-wrapper">
                                            <Mail size={18} className="input-leading-icon" />
                                            <input
                                                type="email"
                                                className="modern-input-field"
                                                placeholder="ornek@sirket.com"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                maxLength={100}
                                                disabled={loading}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="auth-form-grid" style={{ marginBottom: '18px' }}>
                                    <div className="form-group">
                                        <label className="form-label" style={{ marginBottom: '6px', display: 'block', fontSize: '13px', fontWeight: 500 }}>
                                            Şifre (Min. 6) *
                                        </label>
                                        <div className="modern-input-wrapper">
                                            <Lock size={18} className="input-leading-icon" />
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                className="modern-input-field"
                                                style={{ paddingRight: '40px' }}
                                                placeholder="••••••••"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                maxLength={64}
                                                disabled={loading}
                                            />
                                            <button
                                                type="button"
                                                className="input-toggle-btn"
                                                onClick={() => setShowPassword(!showPassword)}
                                                tabIndex="-1"
                                                title={showPassword ? 'Şifreyi Gizle' : 'Şifreyi Göster'}
                                            >
                                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label" style={{ marginBottom: '6px', display: 'block', fontSize: '13px', fontWeight: 500 }}>
                                            Şifre Tekrar *
                                        </label>
                                        <div className="modern-input-wrapper">
                                            <Lock size={18} className="input-leading-icon" />
                                            <input
                                                type={showConfirmPassword ? 'text' : 'password'}
                                                className="modern-input-field"
                                                style={{ paddingRight: '40px' }}
                                                placeholder="••••••••"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                maxLength={64}
                                                disabled={loading}
                                            />
                                            <button
                                                type="button"
                                                className="input-toggle-btn"
                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                tabIndex="-1"
                                                title={showConfirmPassword ? 'Şifreyi Gizle' : 'Şifreyi Göster'}
                                            >
                                                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="modern-submit-btn"
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 size={18} className="spin" />
                                            <span>Başvuru Oluşturuluyor...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Şirket Başvurusunu Tamamla</span>
                                            <ArrowRight size={16} />
                                        </>
                                    )}
                                </button>
                            </form>

                            {/* Personnel invite notice box */}
                            <div style={{
                                marginTop: '16px',
                                padding: '10px 12px',
                                borderRadius: '6px',
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                fontSize: '11.5px',
                                color: 'var(--text-muted)',
                                lineHeight: 1.4
                            }}>
                                <strong>Personel ve Şoförler için:</strong> Personel hesapları yalnızca bağlı olduğunuz şirket yöneticisi tarafından davetiye yoluyla açılır; dışarıdan bağımsız kayıt yapılamaz.
                            </div>

                            <div className="auth-bottom-footer" style={{ marginTop: '16px' }}>
                                Zaten bir hesabınız var mı? <Link to="/login">Giriş Yapın</Link>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
