import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Lock, Eye, EyeOff, LogOut, ArrowLeft } from 'lucide-react'

export default function ChangePassword() {
    const { user, logout } = useAuth()
    const navigate = useNavigate()
    const [currentPassword, setCurrentPassword] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSkip = () => {
        logout()
        navigate('/login', { replace: true })
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')

        if (password.length < 12) {
            setError('Şifre en az 12 karakter olmalıdır.')
            return
        }

        if (password !== confirmPassword) {
            setError('Şifreler eşleşmiyor.')
            return
        }

        setLoading(true)
        try {
            const result = await window.electronAPI.changePassword({
                userId: Number(user?.id),
                currentPassword,
                newPassword: password
            })

            if (result.success) {
                // Update user state to remove mustChangePassword flag
                logout()
                navigate('/login', { replace: true })
            } else {
                setError(result.error || 'Şifre değiştirilemedi.')
            }
        } catch (err) {
            setError('Bir hata oluştu: ' + err.message)
        }
        setLoading(false)
    }

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            background: 'var(--bg-primary)',
            position: 'relative'
        }}>
            <div style={{
                width: '100%',
                maxWidth: '420px',
                padding: '32px 36px',
                background: 'var(--bg-secondary)',
                borderRadius: '16px',
                border: '1px solid var(--border-color)',
                boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
                position: 'relative'
            }}>
                {/* Header Action Buttons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <button
                        type="button"
                        onClick={handleSkip}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            fontSize: '13px',
                            cursor: 'pointer',
                            padding: 0
                        }}
                    >
                        <ArrowLeft size={16} /> Uygulamaya Geç
                    </button>
                    <button
                        type="button"
                        onClick={logout}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            color: '#ef4444',
                            borderRadius: '8px',
                            fontSize: '12px',
                            padding: '6px 12px',
                            cursor: 'pointer'
                        }}
                    >
                        <LogOut size={14} /> Çıkış Yap
                    </button>
                </div>

                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        background: 'rgba(245, 158, 11, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px',
                    }}>
                        <Lock size={28} color="#f59e0b" />
                    </div>
                    <h1 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
                        Şifre Değiştir
                    </h1>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px' }}>
                        Güvenliğiniz için şifrenizi güncelleyebilir veya doğrudan uygulamaya geçebilirsiniz.
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    <label htmlFor="current-password">Mevcut Şifre</label>
                    <input id="current-password" type="password" autoComplete="current-password" required value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="form-input" style={{ marginBottom: 16 }} />
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                            Yeni Şifre
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="En az 12 karakter"
                                className="form-input"
                                style={{ width: '100%', paddingRight: '40px' }}
                                maxLength={64}
                                autoFocus
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute',
                                    right: '10px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                }}
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                            Şifre Tekrar
                        </label>
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Şifrenizi tekrar girin"
                            className="form-input"
                            style={{ width: '100%' }}
                            maxLength={64}
                        />
                    </div>

                    {error && (
                        <div style={{
                            padding: '10px 14px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            borderRadius: '8px',
                            color: '#ef4444',
                            fontSize: '12px',
                            marginBottom: '16px',
                        }}>
                            {error}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={handleSkip}
                            style={{ flex: 1, justifyContent: 'center', height: '42px' }}
                        >
                            Çıkış Yap
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading}
                            style={{ flex: 1.5, justifyContent: 'center', height: '42px' }}
                        >
                            {loading ? 'Kaydediliyor...' : 'Şifreyi Değiştir'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
