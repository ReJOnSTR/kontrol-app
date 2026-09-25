import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { authService } from '../../services';
import CustomInput from '../CustomInput';
import PermissionMatrix, { ROLE_PRESETS } from '../PermissionMatrix';
import { UserCheck } from 'lucide-react';
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

    const [formData, setFormData] = useState({
        username: cleanInitialUser || 'kullanici',
        email: employee?.email || '',
        password: '123456Password!',
        role: defaultPreset.id,
        permissions: defaultPreset.levels || {}
    });
    const [loading, setLoading] = useState(false);

    if (!isOpen || !employee) return null;

    const handleSubmit = async (e) => {
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
                toast.success(`${employee.first_name} ${employee.last_name} için kullanıcı girişi başarıyla oluşturuldu.`);
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

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Personel Girişi Tanımla: ${employee.first_name} ${employee.last_name}`}
            size="xl"
        >
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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

                {/* Unified 2-Column Permission Matrix */}
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
        </Modal>
    );
}
