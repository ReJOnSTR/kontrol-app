import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { authService } from '../../services';
import CustomInput from '../CustomInput';
import PermissionMatrix, { ROLE_PRESETS } from '../PermissionMatrix';
import { 
    UserCheck, 
    Zap, 
    KeyRound, 
    Mail, 
    Share2, 
    Copy, 
    Check, 
    MessageSquare, 
    ExternalLink, 
    Sparkles, 
    ShieldCheck, 
    RefreshCw, 
    Lock, 
    ArrowRight,
    UserPlus,
    CheckCircle2,
    Shield
} from 'lucide-react';
import Modal from '../Modal';

const generateSecurePassword = () => {
    const lowers = 'abcdefghjkmnpqrstuvwxyz';
    const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const nums = '23456789';
    const syms = '!@#$%&*?';
    let res = '';
    res += lowers.charAt(Math.floor(Math.random() * lowers.length));
    res += uppers.charAt(Math.floor(Math.random() * uppers.length));
    res += nums.charAt(Math.floor(Math.random() * nums.length));
    res += syms.charAt(Math.floor(Math.random() * syms.length));
    const all = lowers + uppers + nums + syms;
    for (let i = 0; i < 8; i++) {
        res += all.charAt(Math.floor(Math.random() * all.length));
    }
    return res;
};

const getPasswordStrength = (pass) => {
    if (!pass) return { score: 0, text: 'Giriniz', color: 'var(--text-muted)' };
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 10) score += 1;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass) && /[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score <= 1) return { score: 1, text: 'Zayıf', color: '#ef4444' };
    if (score === 2) return { score: 2, text: 'Orta', color: '#f59e0b' };
    if (score === 3) return { score: 3, text: 'İyi', color: '#3b82f6' };
    return { score: 4, text: 'Çok Güçlü & Güvenli', color: '#10b981' };
};

export default function CreatePersonnelUserModal({ employee, isOpen, onClose, onSuccess }) {
    const toast = useToast();
    const defaultPreset = ROLE_PRESETS.find(p => p.id === 'personnel') || ROLE_PRESETS[0];

    const cleanInitialUser = employee ? `${employee.first_name || ''}.${employee.last_name || ''}`
        .toLowerCase()
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ı/g, 'i')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/[^a-z0-9._-]/g, '') : '';

    const [inviteMode, setInviteMode] = useState('quick_invite'); // 'quick_invite' | 'manual_password'
    const [formData, setFormData] = useState({
        username: cleanInitialUser || 'kullanici',
        email: employee?.email || '',
        phone: employee?.phone || '',
        password: generateSecurePassword(),
        role: defaultPreset.id,
        permissions: defaultPreset.levels || {}
    });
    const [loading, setLoading] = useState(false);
    const [inviteResult, setInviteResult] = useState(null);
    const [copiedLink, setCopiedLink] = useState(false);
    const [copiedSms, setCopiedSms] = useState(false);

    if (!isOpen || !employee) return null;

    const strength = getPasswordStrength(formData.password);

    // Handle Quick One-Click Invitation (E-Mail, SMS, WhatsApp)
    const handleQuickInvite = async (e) => {
        if (e) e.preventDefault();
        if (!formData.email) {
            toast.error('Davetiye oluşturmak için personelin bir e-posta adresi gereklidir.');
            return;
        }
        setLoading(true);
        try {
            const baseUrl = (typeof window !== 'undefined' && window.location.origin && !window.location.origin.startsWith('file:'))
                ? window.location.origin
                : 'https://kontrol-app.com';
            const res = await authService.sendPersonnelInvite({
                employeeId: employee.id,
                username: formData.username,
                email: formData.email,
                phone: formData.phone,
                role: formData.role,
                permissions: formData.permissions,
                sendEmail: true,
                baseUrl
            });

            if (res.success) {
                setInviteResult(res);
                toast.success(res.message || 'Davetiye linki başarıyla üretildi!');
                if (onSuccess) onSuccess();
            } else {
                toast.error(res.error || 'Davetiye oluşturulamadı.');
            }
        } catch (error) {
            toast.error('Hata: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Handle Manual Password Creation
    const handleManualSubmit = async (e) => {
        e.preventDefault();
        if (!formData.username || !formData.email) {
            toast.error('Kullanıcı adı ve e-posta zorunludur.');
            return;
        }
        if (!formData.password || formData.password.length < 6) {
            toast.error('Lütfen en az 6 karakterli bir şifre belirleyin.');
            return;
        }

        setLoading(true);
        try {
            const res = await authService.createEmployeeUser({
                employeeId: employee.id,
                username: formData.username,
                email: formData.email,
                password: formData.password,
                role: formData.role,
                permissions: formData.permissions
            });

            if (res.success) {
                toast.success(`${employee.first_name} ${employee.last_name} için kullanıcı girişi ve şifresi oluşturuldu.`);
                if (onSuccess) onSuccess();
                onClose();
            } else {
                toast.error(res.error || 'Kullanıcı hesabı oluşturulamadı.');
            }
        } catch (error) {
            toast.error('Hata: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = (text, type) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        if (type === 'link') {
            setCopiedLink(true);
            setTimeout(() => setCopiedLink(false), 2500);
            toast.success('Davetiye linki panoya kopyalandı.');
        } else {
            setCopiedSms(true);
            setTimeout(() => setCopiedSms(false), 2500);
            toast.success('SMS / Mesaj metni panoya kopyalandı.');
        }
    };

    const handleWhatsAppShare = () => {
        if (!inviteResult) return;
        let cleanPhone = (formData.phone || inviteResult.phone || '').replace(/[^0-9]/g, '');
        if (cleanPhone.startsWith('0')) cleanPhone = '90' + cleanPhone.substring(1);
        if (cleanPhone.length === 10) cleanPhone = '90' + cleanPhone;

        const text = encodeURIComponent(inviteResult.smsText || `Kontrol App personel davetiniz: ${inviteResult.inviteLink}`);
        const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${text}` : `https://wa.me/?text=${text}`;
        window.open(waUrl, '_blank', 'noopener,noreferrer');
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Personel Portalı Girişi: ${employee.first_name} ${employee.last_name}`}
            size="xl"
        >
            {/* Mode Switcher */}
            <div className="auth-mode-segmented">
                <button
                    type="button"
                    onClick={() => { setInviteMode('quick_invite'); setInviteResult(null); }}
                    className={`auth-mode-tab ${inviteMode === 'quick_invite' ? 'active' : ''}`}
                >
                    <Zap size={16} style={{ color: inviteMode === 'quick_invite' ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
                    <span>Davetiye Bağlantısı</span>
                    <span className="tab-badge tab-badge-recommended">Önerilen</span>
                </button>
                <button
                    type="button"
                    onClick={() => setInviteMode('manual_password')}
                    className={`auth-mode-tab ${inviteMode === 'manual_password' ? 'active' : ''}`}
                >
                    <KeyRound size={16} style={{ color: inviteMode === 'manual_password' ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
                    <span>Manuel Şifre Belirle</span>
                </button>
            </div>

            {inviteMode === 'quick_invite' ? (
                <form onSubmit={handleQuickInvite} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Share Hero if invite result is active */}
                    {inviteResult ? (
                        <div className="auth-share-hero">
                            <div className="auth-share-header">
                                <div className="auth-share-title-group">
                                    <div className="auth-share-icon-badge">
                                        <CheckCircle2 size={20} />
                                    </div>
                                    <div>
                                        <h4 className="auth-share-title">Davetiye Bağlantısı Hazır</h4>
                                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                            {employee.first_name} {employee.last_name} ({formData.email})
                                        </p>
                                    </div>
                                </div>
                                <span className={`auth-share-status-pill ${inviteResult.emailSent ? 'sent' : 'ready'}`}>
                                    {inviteResult.emailSent ? '✓ E-Posta İletildi' : '● Bağlantı Hazır'}
                                </span>
                            </div>

                            <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
                                Personel aşağıdaki bağlantıya tıklayarak kendi şifresini güvenle belirleyebilir ve hemen giriş yapabilir.
                            </p>

                            {/* Link Copy Box */}
                            <div className="auth-link-box">
                                <input
                                    type="text"
                                    readOnly
                                    value={inviteResult.inviteLink}
                                    className="auth-link-input"
                                    onClick={(e) => e.target.select()}
                                />
                                <button
                                    type="button"
                                    onClick={() => handleCopy(inviteResult.inviteLink, 'link')}
                                    className={`auth-btn-copy ${copiedLink ? 'copied' : ''}`}
                                >
                                    {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                                    <span>{copiedLink ? 'Kopyalandı' : 'Linki Kopyala'}</span>
                                </button>
                            </div>

                            {/* Actions Grid */}
                            <div className="auth-actions-grid">
                                <button
                                    type="button"
                                    onClick={handleWhatsAppShare}
                                    className="btn-whatsapp-share"
                                >
                                    <MessageSquare size={16} />
                                    <span>WhatsApp ile Gönder</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleCopy(inviteResult.smsText, 'sms')}
                                    className="btn-sms-share"
                                >
                                    {copiedSms ? <Check size={15} color="#10b981" /> : <Share2 size={15} />}
                                    <span>{copiedSms ? 'Mesaj Kopyalandı' : 'SMS / Mesaj Metnini Kopyala'}</span>
                                </button>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '4px' }}>
                                <a
                                    href={inviteResult.inviteLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        fontSize: '11.5px',
                                        color: 'var(--text-muted)',
                                        textDecoration: 'none'
                                    }}
                                >
                                    <ExternalLink size={13} />
                                    <span>Bağlantıyı test et (Yeni sekmede aç)</span>
                                </a>
                            </div>
                        </div>
                    ) : (
                        /* Feature Card before invite is created */
                        <div className="auth-info-card">
                            <div className="auth-info-card-header">
                                <div className="auth-info-card-icon">
                                    <Sparkles size={18} />
                                </div>
                                <div>
                                    <h4 className="auth-info-card-title">Güvenli Aktivasyon & Şifresiz Davetiye</h4>
                                    <p className="auth-info-card-subtitle">
                                        Yönetici şifre belirlemekle veya personelle güvensiz şifre paylaşmakla uğraşmaz.
                                    </p>
                                </div>
                            </div>
                            <div className="auth-features-list">
                                <span className="auth-feature-pill">
                                    <Check size={13} /> Tek Kullanımlık & 7 Gün Geçerli
                                </span>
                                <span className="auth-feature-pill">
                                    <Check size={13} /> Şifreyi Personel Kendisi Belirler
                                </span>
                                <span className="auth-feature-pill">
                                    <Check size={13} /> WhatsApp, SMS veya E-Posta ile Paylaşım
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Inputs */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '12px',
                        background: 'var(--bg-secondary)',
                        padding: '14px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-color)'
                    }}>
                        <CustomInput 
                            label="Kullanıcı Adı"
                            required
                            value={formData.username}
                            onChange={(val) => setFormData({...formData, username: val})}
                            maxLength={50}
                            placeholder="ornek.personel"
                        />

                        <CustomInput 
                            label="Personel E-Posta Adresi"
                            type="email"
                            required
                            value={formData.email}
                            onChange={(val) => setFormData({...formData, email: val})}
                            maxLength={100}
                            placeholder="personel@sirket.com"
                        />

                        <CustomInput 
                            label="Telefon (WhatsApp / SMS)"
                            value={formData.phone}
                            onChange={(val) => setFormData({...formData, phone: val})}
                            placeholder="05XXXXXXXXX"
                            maxLength={20}
                        />
                    </div>

                    {/* Permission Matrix */}
                    <PermissionMatrix
                        selectedPreset={formData.role}
                        onPresetChange={(presetId, levels) => {
                            setFormData(prev => ({
                                ...prev,
                                role: presetId,
                                permissions: levels
                            }));
                        }}
                        permissionLevels={formData.permissions || {}}
                        onLevelChange={(moduleKey, level) => {
                            setFormData(prev => ({
                                ...prev,
                                permissions: {
                                    ...(prev.permissions || {}),
                                    [moduleKey]: level
                                }
                            }));
                        }}
                    />

                    <div className="modal-footer" style={{ marginTop: '4px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button 
                            type="button"
                            onClick={onClose}
                            className="btn btn-secondary"
                        >
                            {inviteResult ? 'Kapat' : 'İptal'}
                        </button>
                        <button 
                            type="submit"
                            disabled={loading}
                            className="btn btn-primary"
                            style={{ display: 'flex', alignItems: 'center', gap: '7px' }}
                        >
                            <Mail size={16} />
                            <span>{loading ? 'İletiliyor...' : (inviteResult ? 'Tekrar Davet Gönder' : 'Davetiye Bağlantısı Oluştur & Gönder')}</span>
                        </button>
                    </div>
                </form>
            ) : (
                <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Manual Password Info Banner */}
                    <div className="auth-manual-pass-card">
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                            <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                background: 'rgba(245, 158, 11, 0.12)',
                                color: '#f59e0b',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}>
                                <Lock size={17} />
                            </div>
                            <div>
                                <h4 style={{ margin: '0 0 3px', fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                    Yönetici Tarafından Manuel Şifre Belirleme
                                </h4>
                                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
                                    Personele doğrudan ileteceğiniz geçici bir giriş şifresi tanımlayın. İlk oturum açılışında güvenlik gereği şifresini değiştirmesi istenecektir.
                                </p>
                            </div>
                        </div>

                        {/* Account inputs */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: '12px',
                            paddingTop: '6px'
                        }}>
                            <CustomInput 
                                label="Kullanıcı Adı"
                                required
                                value={formData.username}
                                onChange={(val) => setFormData({...formData, username: val})}
                                maxLength={50}
                                placeholder="ornek.personel"
                            />

                            <CustomInput 
                                label="E-Posta Adresi"
                                type="email"
                                required
                                value={formData.email}
                                onChange={(val) => setFormData({...formData, email: val})}
                                maxLength={100}
                                placeholder="personel@sirket.com"
                            />

                            <CustomInput 
                                label="Telefon Numarası"
                                value={formData.phone}
                                onChange={(val) => setFormData({...formData, phone: val})}
                                placeholder="05XXXXXXXXX"
                                maxLength={20}
                            />
                        </div>

                        {/* Password Row with Random Generator & Strength Meter */}
                        <div style={{
                            borderTop: '1px solid var(--border-color)',
                            paddingTop: '14px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                        }}>
                            <div className="auth-manual-input-row">
                                <CustomInput 
                                    label="Giriş Şifresi"
                                    type="password"
                                    required
                                    value={formData.password}
                                    onChange={(val) => setFormData({...formData, password: val})}
                                    placeholder="En az 6 karakter girin..."
                                    maxLength={64}
                                />
                                <button
                                    type="button"
                                    onClick={() => setFormData(p => ({ ...p, password: generateSecurePassword() }))}
                                    className="auth-btn-generate"
                                    title="Güçlü Rastgele Şifre Üret"
                                >
                                    <Zap size={14} style={{ color: 'var(--accent-primary)' }} />
                                    <span>Rastgele Şifre Üret</span>
                                </button>
                            </div>

                            {/* Strength indicator */}
                            {formData.password && (
                                <div className="auth-strength-container">
                                    <div className="auth-strength-header">
                                        <span style={{ color: 'var(--text-muted)' }}>Şifre Güvenlik Seviyesi:</span>
                                        <span style={{ color: strength.color, fontWeight: 700 }}>{strength.text}</span>
                                    </div>
                                    <div className="auth-strength-bars">
                                        {[1, 2, 3, 4].map((step) => (
                                            <div
                                                key={step}
                                                className="auth-strength-bar"
                                                style={{
                                                    background: step <= strength.score ? strength.color : undefined
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <PermissionMatrix
                        selectedPreset={formData.role}
                        onPresetChange={(presetId, levels) => {
                            setFormData(prev => ({
                                ...prev,
                                role: presetId,
                                permissions: levels
                            }));
                        }}
                        permissionLevels={formData.permissions || {}}
                        onLevelChange={(moduleKey, level) => {
                            setFormData(prev => ({
                                ...prev,
                                permissions: {
                                    ...(prev.permissions || {}),
                                    [moduleKey]: level
                                }
                            }));
                        }}
                    />

                    <div className="modal-footer" style={{ marginTop: '4px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button 
                            type="button"
                            onClick={onClose}
                            className="btn btn-secondary"
                        >
                            İptal
                        </button>
                        <button 
                            type="submit"
                            disabled={loading}
                            className="btn btn-primary"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}
                        >
                            <UserCheck size={16} />
                            <span>{loading ? 'Hesap Tanımlanıyor...' : 'Kullanıcıyı ve Şifreyi Kaydet'}</span>
                        </button>
                    </div>
                </form>
            )}
        </Modal>
    );
}
