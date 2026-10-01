import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { authService } from '../../services';
import CustomInput from '../CustomInput';
import PermissionMatrix, { ROLE_PRESETS } from '../PermissionMatrix';
import { UserCheck, Zap, KeyRound, Mail, Share2, Copy, Check, MessageSquare, ExternalLink, Sparkles } from 'lucide-react';
import Modal from '../Modal';

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
        password: '123456Password!',
        role: defaultPreset.id,
        permissions: defaultPreset.levels || {}
    });
    const [loading, setLoading] = useState(false);
    const [inviteResult, setInviteResult] = useState(null);
    const [copiedLink, setCopiedLink] = useState(false);
    const [copiedSms, setCopiedSms] = useState(false);

    if (!isOpen || !employee) return null;

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

    // Handle Manual Password Creation (Legacy)
    const handleManualSubmit = async (e) => {
        e.preventDefault();
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
                toast.success(`${employee.first_name} ${employee.last_name} için kullanıcı girişi oluşturuldu.`);
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
            toast.success('SMS / WhatsApp metni panoya kopyalandı.');
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
            <div style={{
                display: 'flex',
                gap: '8px',
                padding: '4px',
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                marginBottom: '14px',
                border: '1px solid var(--border-color)'
            }}>
                <button
                    type="button"
                    onClick={() => { setInviteMode('quick_invite'); setInviteResult(null); }}
                    style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '9px 14px',
                        border: 'none',
                        borderRadius: '6px',
                        background: inviteMode === 'quick_invite' ? 'var(--accent-primary)' : 'transparent',
                        color: inviteMode === 'quick_invite' ? '#ffffff' : 'var(--text-secondary)',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    <Zap size={16} />
                    <span>⚡ Tek Tıkla Davet Linki Gönder (Şifresiz)</span>
                </button>
                <button
                    type="button"
                    onClick={() => setInviteMode('manual_password')}
                    style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '9px 14px',
                        border: 'none',
                        borderRadius: '6px',
                        background: inviteMode === 'manual_password' ? 'var(--accent-primary)' : 'transparent',
                        color: inviteMode === 'manual_password' ? '#ffffff' : 'var(--text-secondary)',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    <KeyRound size={16} />
                    <span>Manuel Şifre Belirle</span>
                </button>
            </div>

            {inviteMode === 'quick_invite' ? (
                <form onSubmit={handleQuickInvite} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {/* Info Note */}
                    <div style={{
                        background: 'rgba(59, 130, 246, 0.08)',
                        border: '1px solid rgba(59, 130, 246, 0.2)',
                        borderRadius: '8px',
                        padding: '12px 14px',
                        fontSize: '12.5px',
                        color: 'var(--text-secondary)',
                        lineHeight: '1.5'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#3b82f6', fontWeight: 600, marginBottom: '3px' }}>
                            <Sparkles size={15} />
                            <span>Yönetici Şifre Belirlemekle Uğraşmaz</span>
                        </div>
                        Personelin e-postasına tek tıkla şifresini oluşturup girebileceği güvenli bir davet bağlantısı iletilir. Dilerseniz bağlantıyı WhatsApp veya SMS ile de tek tıkla personele gönderebilirsiniz.
                    </div>

                    {/* Inputs */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: '12px', background: 'var(--bg-secondary)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <CustomInput 
                            label="Kullanıcı Adı"
                            required
                            value={formData.username}
                            onChange={(val) => setFormData({...formData, username: val})}
                            maxLength={50}
                        />

                        <CustomInput 
                            label="Personel E-Posta Adresi"
                            type="email"
                            required
                            value={formData.email}
                            onChange={(val) => setFormData({...formData, email: val})}
                            maxLength={100}
                        />

                        <CustomInput 
                            label="Telefon (WhatsApp / SMS)"
                            value={formData.phone}
                            onChange={(val) => setFormData({...formData, phone: val})}
                            placeholder="05xxxxxxxxx"
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
                            }))
                        }}
                        permissionLevels={formData.permissions || {}}
                        onLevelChange={(moduleKey, level) => {
                            setFormData(prev => ({
                                ...prev,
                                permissions: {
                                    ...(prev.permissions || {}),
                                    [moduleKey]: level
                                }
                            }))
                        }}
                    />

                    {/* Results & Sharing Panel if Invite Generated */}
                    {inviteResult && (
                        <div style={{
                            background: 'rgba(16, 185, 129, 0.08)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            borderRadius: '8px',
                            padding: '16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontWeight: 600, fontSize: '14px' }}>
                                    <Check size={18} />
                                    <span>Davetiye Başarıyla Oluşturuldu</span>
                                </div>
                                {inviteResult.emailSent && (
                                    <span style={{ fontSize: '11.5px', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '2px 8px', borderRadius: '4px', fontWeight: 500 }}>
                                        E-posta Gönderildi
                                    </span>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    type="text"
                                    readOnly
                                    value={inviteResult.inviteLink}
                                    style={{
                                        flex: 1,
                                        padding: '8px 12px',
                                        fontSize: '12px',
                                        borderRadius: '6px',
                                        border: '1px solid var(--border-color)',
                                        background: 'var(--bg-primary)',
                                        color: 'var(--text-primary)'
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => handleCopy(inviteResult.inviteLink, 'link')}
                                    className="btn btn-secondary"
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', padding: '0 14px' }}
                                >
                                    {copiedLink ? <Check size={15} color="#10b981" /> : <Copy size={15} />}
                                    <span>{copiedLink ? 'Kopyalandı' : 'Linki Kopyala'}</span>
                                </button>
                            </div>

                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                                <button
                                    type="button"
                                    onClick={handleWhatsAppShare}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '8px 14px',
                                        background: '#25D366',
                                        color: '#ffffff',
                                        border: 'none',
                                        borderRadius: '6px',
                                        fontSize: '12.5px',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    <MessageSquare size={15} />
                                    <span>WhatsApp ile Gönder</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleCopy(inviteResult.smsText, 'sms')}
                                    className="btn btn-secondary"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px' }}
                                >
                                    {copiedSms ? <Check size={15} color="#10b981" /> : <Share2 size={15} />}
                                    <span>{copiedSms ? 'SMS Metni Kopyalandı' : 'SMS Metnini Kopyala'}</span>
                                </button>
                            </div>
                        </div>
                    )}

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
                            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                            <Mail size={16} />
                            <span>{loading ? 'İletiliyor...' : (inviteResult ? 'Tekrar Davet Gönder' : 'Davetiye Linki Oluştur & E-Posta Gönder')}</span>
                        </button>
                    </div>
                </form>
            ) : (
                <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: '12px', background: 'var(--bg-secondary)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <CustomInput 
                            label="Kullanıcı Adı"
                            required
                            value={formData.username}
                            onChange={(val) => setFormData({...formData, username: val})}
                            maxLength={50}
                        />

                        <CustomInput 
                            label="E-Posta Adresi"
                            type="email"
                            required
                            value={formData.email}
                            onChange={(val) => setFormData({...formData, email: val})}
                            maxLength={100}
                        />

                        <div>
                            <CustomInput 
                                label="Geçici Şifre"
                                required
                                value={formData.password}
                                onChange={(val) => setFormData({...formData, password: val})}
                                maxLength={64}
                            />
                            <span style={{ fontSize: '10.5px', color: 'var(--warning)', marginTop: '2px', display: 'block' }}>İlk girişte şifre değiştirilecektir.</span>
                        </div>
                    </div>

                    <PermissionMatrix
                        selectedPreset={formData.role}
                        onPresetChange={(presetId, levels) => {
                            setFormData(prev => ({
                                ...prev,
                                role: presetId,
                                permissions: levels
                            }))
                        }}
                        permissionLevels={formData.permissions || {}}
                        onLevelChange={(moduleKey, level) => {
                            setFormData(prev => ({
                                ...prev,
                                permissions: {
                                    ...(prev.permissions || {}),
                                    [moduleKey]: level
                                }
                            }))
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
                        >
                            {loading ? 'Oluşturuluyor...' : 'Giriş Hesabını Oluştur'}
                        </button>
                    </div>
                </form>
            )}
        </Modal>
    );
}
