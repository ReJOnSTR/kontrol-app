import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { requestService } from '../../services';
import TopProgressBar from '../TopProgressBar';
import Modal from '../Modal';
import DataTable from '../DataTable';
import { 
    CheckCircle, XCircle, Clock, Filter, Search, User, 
    Calendar, DollarSign, Car, FileText, Check, X, RefreshCw, AlertCircle 
} from 'lucide-react';

export default function ApprovalCenter() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { currentCompany } = useCompany();
    const toast = useToast();

    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('PENDING');
    const [typeFilter, setTypeFilter] = useState('ALL');

    const [selectedRequest, setSelectedRequest] = useState(null);
    const [approvalModalOpen, setApprovalModalOpen] = useState(false);
    const [actionType, setActionType] = useState('APPROVED'); // 'APPROVED' or 'REJECTED'
    const [comment, setComment] = useState('');
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (currentCompany) {
            loadRequests();
        } else {
            setRequests([]);
            setLoading(false);
        }
    }, [currentCompany, statusFilter, typeFilter]);

    // Real-time listener for requests table changes
    const loadRequestsRef = useRef(null);
    useEffect(() => {
        loadRequestsRef.current = loadRequests;
    });
    useEffect(() => {
        if (!currentCompany) return;
        const unsub = window.electronAPI?.onDbUpdate?.((change) => {
            if (change?.table === 'requests') {
                loadRequestsRef.current && loadRequestsRef.current(true);
            }
        });
        return () => { if (unsub) unsub(); };
    }, [currentCompany]);

    const loadRequests = async (isBackground = false) => {
        if (!isBackground) setLoading(true);
        try {
            const filters = { companyId: currentCompany?.id };
            if (statusFilter !== 'ALL') filters.status = statusFilter;
            if (typeFilter !== 'ALL') filters.type = typeFilter;

            const res = await requestService.getRequests(filters);
            if (res.success) {
                setRequests(res.data || []);
            }
        } catch (error) {
            console.error('Error loading approval requests:', error);
        } finally {
            if (!isBackground) setLoading(false);
        }
    };

    const handleOpenActionModal = (req, action) => {
        setSelectedRequest(req);
        setActionType(action);
        setComment('');
        setApprovalModalOpen(true);
    };

    const handleProcessApproval = async (e) => {
        e.preventDefault();
        if (!selectedRequest) return;

        setProcessing(true);
        try {
            const res = await requestService.processApproval({
                requestId: selectedRequest.id,
                status: actionType,
                comment,
                approverId: user?.id
            });

            if (res.success) {
                const msg = actionType === 'APPROVED' 
                    ? 'Talep onaylandı ve ilgili veriler otomasyon ile işlendi.' 
                    : 'Talep reddedildi.';
                if (toast?.success) toast.success(msg);

                // Desktop notification if approval_center notifications are enabled
                const isNotifyEnabled = localStorage.getItem('notify_approval_center') !== 'false';
                if (isNotifyEnabled && window.electronAPI?.showNotification) {
                    const title = actionType === 'APPROVED' ? 'Talep Onaylandı' : 'Talep Reddedildi';
                    const body = `${selectedRequest.employee_name || selectedRequest.employee || 'Personel'} - ${selectedRequest.type_label || selectedRequest.type || 'Talep'} ${actionType === 'APPROVED' ? 'onaylandı.' : 'reddedildi.'}`;
                    window.electronAPI.showNotification(title, body);
                }

                setApprovalModalOpen(false);
                loadRequests();
            } else {
                if (toast?.error) toast.error(res.error || 'İşlem başarısız');
            }
        } catch (error) {
            if (toast?.error) toast.error('Hata: ' + error.message);
        } finally {
            setProcessing(false);
        }
    };

    const getTypeIcon = (type) => {
        switch (type) {
            case 'LEAVE': return <Calendar style={{ color: 'var(--accent-primary)' }} size={16} />;
            case 'ADVANCE': return <DollarSign style={{ color: 'var(--success)' }} size={16} />;
            case 'OVERTIME': return <Clock style={{ color: 'var(--warning)' }} size={16} />;
            case 'VEHICLE_ASSIGNMENT': return <Car style={{ color: '#8b5cf6' }} size={16} />;
            case 'EXPENSE': return <FileText style={{ color: '#ec4899' }} size={16} />;
            default: return <FileText size={16} />;
        }
    };

    const getTypeLabel = (type) => {
        switch (type) {
            case 'LEAVE': return 'İzin Talebi';
            case 'ADVANCE': return 'Ödeme Talebi';
            case 'OVERTIME': return 'Mesai Bildirimi';
            case 'VEHICLE_ASSIGNMENT': return 'Araç Talebi';
            case 'EXPENSE': return 'Masraf İadesi';
            default: return type;
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'APPROVED':
                return <span className="badge badge-success">Onaylandı</span>;
            case 'REJECTED':
                return <span className="badge badge-danger">Reddedildi</span>;
            default:
                return <span className="badge badge-warning">Onay Bekliyor</span>;
        }
    };

    const pendingCount = requests.filter(r => r.status === 'PENDING').length;
    const approvedCount = requests.filter(r => r.status === 'APPROVED').length;
    const rejectedCount = requests.filter(r => r.status === 'REJECTED').length;

    const columns = [
        {
            key: 'employee',
            label: 'Personel',
            render: (_, row) => (
                <div>
                    <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                        {row.employee?.first_name} {row.employee?.last_name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {row.employee?.department || 'Departman Belirtilmedi'}
                    </div>
                </div>
            )
        },
        {
            key: 'type',
            label: 'Talep Türü',
            render: (v) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '500' }}>
                    {getTypeIcon(v)}
                    <span>{getTypeLabel(v)}</span>
                </div>
            )
        },
        {
            key: 'title',
            label: 'Başlık & Detay',
            render: (_, row) => (
                <div>
                    <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{row.title}</div>
                    {row.description && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{row.description}</div>}
                    
                    {/* Inline Detail Summary */}
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', background: 'var(--bg-card-hover)', padding: '4px 8px', borderRadius: '6px', display: 'inline-block' }}>
                        {row.type === 'LEAVE' && `Tarih: ${row.parsedData?.start_date || '-'} ~ ${row.parsedData?.end_date || '-'} (${row.parsedData?.days || 1} Gün)`}
                        {row.type === 'ADVANCE' && `Tutar: ₺${Number(row.parsedData?.amount || 0).toLocaleString('tr-TR')} • İstenen Tarih: ${row.parsedData?.payment_date || '-'}`}
                        {row.type === 'OVERTIME' && `Mesai: ${row.parsedData?.date || '-'} (${row.parsedData?.hours || 0} Saat)`}
                        {row.type === 'VEHICLE_ASSIGNMENT' && `Araç: ${row.parsedData?.vehicle_name || 'Şirket Aracı'} (${row.parsedData?.start_date || '-'})`}
                        {row.type === 'EXPENSE' && `Masraf: ₺${Number(row.parsedData?.amount || 0).toLocaleString('tr-TR')} (${row.parsedData?.category || 'Gider'})`}
                    </div>
                </div>
            )
        },
        {
            key: 'created_at',
            label: 'Tarih',
            render: (v) => new Date(v).toLocaleDateString('tr-TR')
        },
        {
            key: 'status',
            label: 'Durum',
            render: (v) => getStatusBadge(v)
        }
    ];

    if (!currentCompany) {
        return (
            <div className="empty-state">
                <h2 className="empty-state-title">Şirket Seçilmedi</h2>
                <p className="empty-state-desc">Onay merkezini görüntülemek için lütfen bir şirket seçin.</p>
            </div>
        );
    }

    return (
        <div>
            <TopProgressBar loading={loading} />

            {/* Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Personel Onay Merkezi</h1>
                    <p style={{ marginTop: '5px', color: 'var(--text-secondary)' }}>
                        Personellerin oluşturduğu izin, ödeme, mesai ve zimmet taleplerini onaylayın veya reddedin.
                    </p>
                </div>
                <div className="page-actions">
                    <button className="btn btn-secondary" onClick={() => loadRequests()}>
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Yenile
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid-responsive-4" style={{ marginBottom: '24px', gap: '16px' }}>
                <div className="card" style={{ padding: '16px 20px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Onay Bekleyenler</div>
                    <div style={{ fontSize: '24px', fontWeight: 700, marginTop: '4px', color: pendingCount > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>
                        {pendingCount}
                    </div>
                </div>
                <div className="card" style={{ padding: '16px 20px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Onaylananlar</div>
                    <div style={{ fontSize: '24px', fontWeight: 700, marginTop: '4px', color: 'var(--success)' }}>
                        {approvedCount}
                    </div>
                </div>
                <div className="card" style={{ padding: '16px 20px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Reddedilenler</div>
                    <div style={{ fontSize: '24px', fontWeight: 700, marginTop: '4px', color: 'var(--danger)' }}>
                        {rejectedCount}
                    </div>
                </div>
                <div className="card" style={{ padding: '16px 20px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Toplam Talep</div>
                    <div style={{ fontSize: '24px', fontWeight: 700, marginTop: '4px' }}>
                        {requests.length}
                    </div>
                </div>
            </div>

            {/* Table */}
            <DataTable
                persistenceKey="ApprovalCenter_table"
                storageKey="approval_center_cols"
                columns={columns}
                data={requests}
                loading={loading}
                showSearch={true}
                searchPlaceholder="Personel adı, departman veya talep başlığı ara..."
                searchKeys={['title', 'description']}
                emptyMessage="Gösterilebilecek talep bulunmuyor."
                filters={[
                    {
                        key: 'status',
                        label: 'Durum',
                        options: [
                            { value: 'PENDING', label: '⏳ Onay Bekleyenler' },
                            { value: 'APPROVED', label: 'Onaylananlar' },
                            { value: 'REJECTED', label: 'Reddedilenler' }
                        ]
                    },
                    {
                        key: 'type',
                        label: 'Talep Türü',
                        options: [
                            { value: 'LEAVE', label: 'İzin Talebi' },
                            { value: 'ADVANCE', label: 'Ödeme Talebi' },
                            { value: 'OVERTIME', label: '⏰ Mesai Bildirimi' },
                            { value: 'VEHICLE_ASSIGNMENT', label: 'Araç Talebi' },
                            { value: 'EXPENSE', label: 'Masraf İadesi' }
                        ]
                    }
                ]}
                actions={(row) => (
                    row.status === 'PENDING' ? (
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <button 
                                className="success" 
                                onClick={() => {
                                    const empId = row.employee_id || row.employee?.id;
                                    if (empId) {
                                        navigate(`/employees/${empId}`, { state: { approveRequestId: row.id } });
                                    } else {
                                        handleOpenActionModal(row, 'APPROVED');
                                    }
                                }}
                                title="Onayla"
                            >
                                <Check size={16} />
                            </button>
                            <button 
                                className="danger" 
                                onClick={() => handleOpenActionModal(row, 'REJECTED')}
                                title="Reddet"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    ) : (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {row.approvals && row.approvals.length > 0 && row.approvals[0].comment ? `Not: ${row.approvals[0].comment}` : 'İşlem tamamlandı'}
                        </span>
                    )
                )}
            />

            {/* Approval Modal */}
            <Modal
                isOpen={approvalModalOpen && !!selectedRequest}
                onClose={() => setApprovalModalOpen(false)}
                title={actionType === 'APPROVED' ? 'Talebi Onayla' : 'Talebi Reddet'}
                size="md"
                footer={null}
            >
                {selectedRequest && (
                    <form onSubmit={handleProcessApproval} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'var(--bg-card-hover)', fontSize: '13px' }}>
                            <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                                {selectedRequest.employee?.first_name} {selectedRequest.employee?.last_name}
                            </div>
                            <div style={{ color: 'var(--accent-primary)', fontWeight: '500', marginTop: '2px' }}>
                                {selectedRequest.title}
                            </div>
                        </div>

                        {actionType === 'APPROVED' && (
                            <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', fontSize: '12px', color: 'var(--success)' }}>
                                <b>Otomasyon:</b> Bu talep onaylandığında sistem ilgili modül tablosuna otomasyon kaydını otomatik düşecektir.
                            </div>
                        )}

                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                {actionType === 'APPROVED' ? 'Onay Notu (Opsiyonel)' : 'Red Gerekçesi (Önerilir)'}
                            </label>
                            <textarea 
                                rows={3}
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder={actionType === 'APPROVED' ? 'Yönetici onay açıklaması...' : 'Red nedenini belirtiniz...'}
                                maxLength={300}
                                className="form-control"
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '10px' }}>
                            <button 
                                type="button" 
                                className="btn btn-secondary" 
                                onClick={() => setApprovalModalOpen(false)}
                            >
                                İptal
                            </button>
                            <button 
                                type="submit" 
                                className={`btn ${actionType === 'APPROVED' ? 'btn-primary' : 'btn-danger'}`}
                                disabled={processing}
                            >
                                {processing ? 'İşleniyor...' : (actionType === 'APPROVED' ? 'Onayla ve Kaydet' : 'Talebi Reddet')}
                            </button>
                        </div>
                    </form>
                )}
            </Modal>
        </div>
    );
}
