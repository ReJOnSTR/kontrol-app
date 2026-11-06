import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { requestService, employeeService, vehicleService } from '../../services';
import { 
    Calendar, DollarSign, Clock, Car, FileText, Plus, CheckCircle, 
    XCircle, Clock3, AlertCircle, LogOut, User, Send, ChevronRight 
} from 'lucide-react';

export default function PersonnelDashboard() {
    const { user, logout } = useAuth();
    const { activeCompany } = useCompany();
    const toast = useToast();

    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [requestType, setRequestType] = useState('LEAVE');
    const [vehicles, setVehicles] = useState([]);
    const [leaveTypes, setLeaveTypes] = useState([]);

    // Form State
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        // Leave fields
        leave_type: 'annual',
        start_date: '',
        end_date: '',
        days: 1,
        // Advance fields
        amount: '',
        payment_date: '',
        payment_type: 'advance',
        salary_month: new Date().toISOString().slice(0, 7),
        // Overtime fields
        overtime_date: '',
        overtime_hours: '',
        overtime_type: 'weekday',
        use_as_leave: false,
        // Vehicle fields
        vehicle_id: '',
        // Expense fields
        category: 'Yemek/Ulaşım',
        document_path: ''
    });

    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (user && activeCompany) {
            loadRequests();
            loadVehicles();
            loadLeaveTypes();
        }
    }, [user, activeCompany]);

    const loadLeaveTypes = async () => {
        if (window.electronAPI?.getLeaveTypes && activeCompany?.id) {
            try {
                const res = await window.electronAPI.getLeaveTypes(activeCompany.id);
                if (res.success) {
                    const activeTypes = (res.data || [])
                        .filter(t => t.status !== 'passive')
                        .map(t => ({ value: t.name, label: t.name }));
                    setLeaveTypes(activeTypes);
                }
            } catch (e) {
                console.error('Error loading leave types:', e);
            }
        }
    };

    const loadRequests = async () => {
        setLoading(true);
        try {
            const res = await requestService.getRequests({
                companyId: activeCompany?.id,
                employeeId: user?.employee_id || user?.employee?.id
            });
            if (res.success) {
                setRequests(res.data || []);
            }
        } catch (error) {
            console.error('Error loading personnel requests:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadVehicles = async () => {
        try {
            const res = await vehicleService.getVehicles(activeCompany?.id, 0);
            if (res.success) {
                setVehicles(res.data || []);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleOpenModal = (type) => {
        setRequestType(type);
        const titles = {
            LEAVE: 'İzin Talebi',
            ADVANCE: 'Ödeme Talebi',
            OVERTIME: 'Fazla Mesai Bildirimi',
            VEHICLE_ASSIGNMENT: 'Araç / Zimmet Talebi',
            EXPENSE: 'Masraf İadesi Talebi'
        };
        setFormData({
            title: titles[type] || 'Talep',
            description: '',
            leave_type: leaveTypes.length > 0 ? leaveTypes[0].value : 'annual',
            start_date: new Date().toISOString().split('T')[0],
            end_date: new Date().toISOString().split('T')[0],
            days: 1,
            amount: '',
            payment_date: new Date().toISOString().split('T')[0],
            payment_type: 'advance',
            salary_month: new Date().toISOString().slice(0, 7),
            overtime_date: new Date().toISOString().split('T')[0],
            overtime_hours: '2',
            overtime_type: 'weekday',
            use_as_leave: false,
            vehicle_id: '',
            category: 'Yemek/Ulaşım',
            document_path: ''
        });
        setModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!user?.employee_id && !user?.employee?.id) {
            toast.error('Personel kartınız eşleştirilmediği için talep oluşturamazsınız.');
            return;
        }

        setSubmitting(true);
        try {
            let requestDataPayload = {};
            if (requestType === 'LEAVE') {
                requestDataPayload = {
                    leave_type: formData.leave_type,
                    start_date: formData.start_date,
                    end_date: formData.end_date,
                    days: Number(formData.days)
                };
            } else if (requestType === 'ADVANCE') {
                requestDataPayload = {
                    amount: Number(formData.amount),
                    payment_date: formData.payment_date,
                    payment_type: formData.payment_type || 'advance',
                    salary_month: formData.salary_month || new Date().toISOString().slice(0, 7)
                };
            } else if (requestType === 'OVERTIME') {
                requestDataPayload = {
                    date: formData.overtime_date,
                    hours: Number(formData.overtime_hours),
                    overtime_type: formData.overtime_type || 'weekday',
                    use_as_leave: !!formData.use_as_leave,
                    rate: 1.5,
                    amount: 0
                };
            } else if (requestType === 'VEHICLE_ASSIGNMENT') {
                const selectedVehicle = vehicles.find(v => v.id === Number(formData.vehicle_id));
                requestDataPayload = {
                    vehicle_id: formData.vehicle_id ? Number(formData.vehicle_id) : null,
                    vehicle_name: selectedVehicle ? `${selectedVehicle.plate} - ${selectedVehicle.brand || ''} ${selectedVehicle.model || ''}` : 'Şirket Aracı',
                    start_date: formData.start_date,
                    end_date: formData.end_date
                };
            } else if (requestType === 'EXPENSE') {
                requestDataPayload = {
                    category: formData.category,
                    amount: Number(formData.amount),
                    expense_date: formData.start_date
                };
            }

            const res = await requestService.createRequest({
                companyId: activeCompany.id,
                createdById: user.id,
                employeeId: user.employee_id || user.employee.id,
                type: requestType,
                title: formData.title,
                description: formData.description,
                requestData: requestDataPayload,
                documentPath: formData.document_path || null
            });

            if (res.success) {
                toast.success('Talebiniz başarıyla yönetici onayına gönderildi.');
                setModalOpen(false);
                loadRequests();
            } else {
                toast.error(res.error || 'Talep oluşturulamadı');
            }
        } catch (error) {
            toast.error('Hata: ' + error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'APPROVED':
                return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><CheckCircle size={14} /> Onaylandı</span>;
            case 'REJECTED':
                return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20"><XCircle size={14} /> Reddedildi</span>;
            default:
                return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20"><Clock3 size={14} /> Onay Bekliyor</span>;
        }
    };

    const getTypeIcon = (type) => {
        switch (type) {
            case 'LEAVE': return <Calendar className="text-sky-400" size={18} />;
            case 'ADVANCE': return <DollarSign className="text-emerald-400" size={18} />;
            case 'OVERTIME': return <Clock className="text-amber-400" size={18} />;
            case 'VEHICLE_ASSIGNMENT': return <Car className="text-indigo-400" size={18} />;
            case 'EXPENSE': return <FileText className="text-purple-400" size={18} />;
            default: return <FileText className="text-gray-400" size={18} />;
        }
    };

    return (
        <div className="min-h-screen bg-[#0d0f17] text-white p-4 sm:p-6 md:p-10 font-sans">
            {/* Header Bar */}
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 md:pb-8 border-b border-gray-800/60 mb-6 md:mb-8">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 md:w-12 md:h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center font-bold text-lg md:text-xl shadow-lg shadow-indigo-500/20 flex-shrink-0">
                            {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'P'}
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">{user?.full_name || user?.username}</h1>
                            <p className="text-xs md:text-sm text-gray-400 flex items-center gap-2 truncate">
                                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"></span>
                                {user?.employee?.department || 'Personel Portalı'} • {user?.employee?.position || 'Çalışan'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <button 
                        onClick={logout}
                        className="w-full md:w-auto justify-center px-4 py-2.5 rounded-xl bg-gray-800/80 hover:bg-rose-600/20 hover:text-rose-400 text-gray-300 text-sm font-medium transition-all duration-200 border border-gray-700/50 flex items-center gap-2"
                    >
                        <LogOut size={16} /> Çıkış Yap
                    </button>
                </div>
            </div>

            {/* Quick Action Request Cards */}
            <div className="max-w-6xl mx-auto mb-8 md:mb-10">
                <h2 className="text-xs md:text-sm uppercase tracking-wider text-gray-400 font-semibold mb-3 md:mb-4">Hızlı Talep Oluştur</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
                    <button 
                        onClick={() => handleOpenModal('LEAVE')}
                        className="group p-4 rounded-2xl bg-gray-900/60 hover:bg-sky-500/10 border border-gray-800 hover:border-sky-500/40 transition-all text-left flex flex-col justify-between h-32"
                    >
                        <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 group-hover:scale-110 transition-transform">
                            <Calendar size={20} />
                        </div>
                        <div>
                            <div className="text-sm font-semibold group-hover:text-sky-300">İzin Talebi</div>
                            <div className="text-xs text-gray-500">Yıllık / Mazeret</div>
                        </div>
                    </button>

                    <button 
                        onClick={() => handleOpenModal('ADVANCE')}
                        className="group p-4 rounded-2xl bg-gray-900/60 hover:bg-emerald-500/10 border border-gray-800 hover:border-emerald-500/40 transition-all text-left flex flex-col justify-between h-32"
                    >
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                            <DollarSign size={20} />
                        </div>
                        <div>
                            <div className="text-sm font-semibold group-hover:text-emerald-300">Ödeme Talebi</div>
                            <div className="text-xs text-gray-500">Avans / Borç / Diğer</div>
                        </div>
                    </button>

                    <button 
                        onClick={() => handleOpenModal('OVERTIME')}
                        className="group p-4 rounded-2xl bg-gray-900/60 hover:bg-amber-500/10 border border-gray-800 hover:border-amber-500/40 transition-all text-left flex flex-col justify-between h-32"
                    >
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                            <Clock size={20} />
                        </div>
                        <div>
                            <div className="text-sm font-semibold group-hover:text-amber-300">Fazla Mesai</div>
                            <div className="text-xs text-gray-500">Mesai Bildirimi</div>
                        </div>
                    </button>

                    <button 
                        onClick={() => handleOpenModal('VEHICLE_ASSIGNMENT')}
                        className="group p-4 rounded-2xl bg-gray-900/60 hover:bg-indigo-500/10 border border-gray-800 hover:border-indigo-500/40 transition-all text-left flex flex-col justify-between h-32"
                    >
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                            <Car size={20} />
                        </div>
                        <div>
                            <div className="text-sm font-semibold group-hover:text-indigo-300">Araç Talebi</div>
                            <div className="text-xs text-gray-500">Geçici Zimmet</div>
                        </div>
                    </button>

                    <button 
                        onClick={() => handleOpenModal('EXPENSE')}
                        className="group p-4 rounded-2xl bg-gray-900/60 hover:bg-purple-500/10 border border-gray-800 hover:border-purple-500/40 transition-all text-left flex flex-col justify-between h-32 col-span-2 md:col-span-1"
                    >
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                            <FileText size={20} />
                        </div>
                        <div>
                            <div className="text-sm font-semibold group-hover:text-purple-300">Masraf İadesi</div>
                            <div className="text-xs text-gray-500">Fiş / Fatura</div>
                        </div>
                    </button>
                </div>
            </div>

            {/* Requests History List */}
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm uppercase tracking-wider text-gray-400 font-semibold">Taleplerim ve Geçmiş</h2>
                    <button onClick={loadRequests} className="text-xs text-indigo-400 hover:underline">Yenile</button>
                </div>

                {loading ? (
                    <div className="p-8 text-center text-gray-500 bg-gray-900/40 rounded-2xl border border-gray-800">Yükleniyor...</div>
                ) : requests.length === 0 ? (
                    <div className="p-12 text-center bg-gray-900/40 rounded-2xl border border-gray-800/80">
                        <AlertCircle size={36} className="mx-auto text-gray-600 mb-3" />
                        <p className="text-gray-400 font-medium">Henüz oluşturulmuş bir talebiniz bulunmuyor.</p>
                        <p className="text-xs text-gray-600 mt-1">Yukarıdaki butonları kullanarak yeni talep oluşturabilirsiniz.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {requests.map(req => (
                            <div key={req.id} className="p-4 rounded-2xl bg-gray-900/60 border border-gray-800/80 hover:border-gray-700/60 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-start gap-3">
                                    <div className="p-2.5 rounded-xl bg-gray-800/80 border border-gray-700/50 mt-0.5">
                                        {getTypeIcon(req.type)}
                                    </div>
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="font-semibold text-white">{req.title}</h3>
                                            {getStatusBadge(req.status)}
                                        </div>
                                        <p className="text-xs text-gray-400 mt-1">{req.description || 'Açıklama girilmedi'}</p>
                                        
                                        {/* Parsed Payload Summary */}
                                        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-400 bg-gray-950/40 px-3 py-1.5 rounded-lg border border-gray-800/50">
                                            {req.type === 'LEAVE' && (
                                                <>
                                                    <span>Tarih: <b>{req.parsedData?.start_date}</b> - <b>{req.parsedData?.end_date}</b></span>
                                                    <span>Süre: <b>{req.parsedData?.days} Gün</b></span>
                                                </>
                                            )}
                                            {req.type === 'ADVANCE' && (
                                                <>
                                                    <span>Tür: <b>{req.parsedData?.payment_type === 'loan' ? 'Borç' : (req.parsedData?.payment_type === 'advance' ? 'Avans' : 'Ödeme')}</b></span>
                                                    <span>Tutar: <b>₺{Number(req.parsedData?.amount || 0).toLocaleString('tr-TR')}</b></span>
                                                    {req.parsedData?.salary_month && <span>Dönem: <b>{req.parsedData.salary_month}</b></span>}
                                                </>
                                            )}
                                            {req.type === 'OVERTIME' && (
                                                <>
                                                    <span>Mesai: <b>{req.parsedData?.date}</b> ({req.parsedData?.hours} Saat)</span>
                                                    <span>Tür: <b>{req.parsedData?.overtime_type === 'holiday' ? 'Resmi Tatil' : (req.parsedData?.overtime_type === 'weekend' ? 'Hafta Sonu / Pazar' : (req.parsedData?.overtime_type === 'gurbet' ? 'Gurbet' : 'Hafta İçi'))}</b></span>
                                                    <span>Tercih: <b>{req.parsedData?.use_as_leave ? 'Mesai İzni' : 'Ücret Ödemesi'}</b></span>
                                                </>
                                            )}
                                            {req.type === 'VEHICLE_ASSIGNMENT' && (
                                                <span>Araç: <b>{req.parsedData?.vehicle_name || 'Araç'}</b></span>
                                            )}
                                            {req.type === 'EXPENSE' && (
                                                <span>Masraf Tutarı: <b>₺{Number(req.parsedData?.amount || 0).toLocaleString('tr-TR')}</b></span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="text-left md:text-right text-xs text-gray-500 flex flex-row md:flex-col justify-between items-center md:items-end w-full md:w-auto pt-2 border-t border-gray-800/40 md:border-t-0 md:pt-0">
                                    <div>Oluşturulma: {new Date(req.created_at).toLocaleDateString('tr-TR')}</div>
                                    {req.approvals && req.approvals.length > 0 && req.approvals[0].comment && (
                                        <div className="text-rose-400 text-xs mt-1 bg-rose-500/10 px-2 py-1 rounded border border-rose-500/20">
                                            Not: {req.approvals[0].comment}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal for Creating Request */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70">
                    <div className="w-full max-w-lg bg-[#121522] border-t sm:border border-gray-800 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[92dvh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between pb-4 border-b border-gray-800 mb-5">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                    {getTypeIcon(requestType)}
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-white">Yeni Talep Oluştur</h3>
                                    <p className="text-xs text-gray-400">Yönetici onayına gönderilecek</p>
                                </div>
                            </div>
                            <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-white p-1 rounded-lg">✕</button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Talep Başlığı</label>
                                <input 
                                    type="text" 
                                    required
                                    value={formData.title} 
                                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                                    maxLength={100}
                                    className="w-full px-4 py-2.5 rounded-xl bg-gray-900 border border-gray-800 text-white focus:outline-none focus:border-indigo-500 text-sm"
                                />
                            </div>

                            {/* Conditional Form Fields */}
                            {requestType === 'LEAVE' && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 mb-1">İzin Türü</label>
                                        <select 
                                            value={formData.leave_type} 
                                            onChange={(e) => setFormData({...formData, leave_type: e.target.value})}
                                            className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-white text-sm"
                                        >
                                            {leaveTypes.length > 0 ? (
                                                leaveTypes.map(lt => (
                                                    <option key={lt.value} value={lt.value}>{lt.label}</option>
                                                ))
                                            ) : (
                                                <>
                                                    <option value="annual">Yıllık İzin</option>
                                                    <option value="excuse">Mazeret İzni</option>
                                                    <option value="sick">Sağlık / Rapor</option>
                                                    <option value="unpaid">Ücretsiz İzin</option>
                                                </>
                                            )}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 mb-1">Gün Sayısı</label>
                                        <input 
                                            type="number" 
                                            min="0.5" 
                                            max="365"
                                            step="0.5"
                                            value={formData.days} 
                                            onChange={(e) => setFormData({...formData, days: e.target.value})}
                                            className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-white text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 mb-1">Başlangıç Tarihi</label>
                                        <input 
                                            type="date" 
                                            required
                                            value={formData.start_date} 
                                            onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                                            className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-white text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 mb-1">Bitiş Tarihi</label>
                                        <input 
                                            type="date" 
                                            required
                                            value={formData.end_date} 
                                            onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                                            className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-white text-sm"
                                        />
                                    </div>
                                </div>
                            )}

                            {requestType === 'ADVANCE' && (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-400 mb-1">Ödeme Türü</label>
                                            <select 
                                                value={formData.payment_type} 
                                                onChange={(e) => setFormData({...formData, payment_type: e.target.value})}
                                                className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-white text-sm"
                                            >
                                                <option value="advance">Avans</option>
                                                <option value="loan">Borç (Avans/Geri Ödemeli)</option>
                                                <option value="other">Diğer</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-400 mb-1">Talep Edilen Tutar (₺)</label>
                                            <input 
                                                type="number" 
                                                required
                                                min="0"
                                                max="999999999"
                                                placeholder="5000"
                                                value={formData.amount} 
                                                onChange={(e) => setFormData({...formData, amount: e.target.value})}
                                                className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-white text-sm"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-400 mb-1">İstenen Ödeme Tarihi</label>
                                            <input 
                                                type="date" 
                                                required
                                                value={formData.payment_date} 
                                                onChange={(e) => setFormData({...formData, payment_date: e.target.value})}
                                                className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-white text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-400 mb-1">Ait Olduğu Ay</label>
                                            <input 
                                                type="month" 
                                                required
                                                value={formData.salary_month} 
                                                onChange={(e) => setFormData({...formData, salary_month: e.target.value})}
                                                className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-white text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {requestType === 'OVERTIME' && (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-400 mb-1">Mesai Türü</label>
                                            <select 
                                                value={formData.overtime_type} 
                                                onChange={(e) => setFormData({...formData, overtime_type: e.target.value})}
                                                className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-white text-sm"
                                            >
                                                <option value="weekday">Hafta İçi Mesaisi</option>
                                                <option value="weekend">Hafta Sonu / Pazar Mesaisi</option>
                                                <option value="holiday">Resmi Tatil Mesaisi</option>
                                                <option value="gurbet">Gurbet Mesaisi</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-400 mb-1">Kullanım Tercihi</label>
                                            <select 
                                                value={String(formData.use_as_leave)} 
                                                onChange={(e) => setFormData({...formData, use_as_leave: e.target.value === 'true'})}
                                                className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-white text-sm"
                                            >
                                                <option value="false">Mesai Ücreti Olarak Ödensin</option>
                                                <option value="true">Mesai İzni (İzin Günü) Olarak Kullanılsın</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-400 mb-1">Mesai Tarihi</label>
                                            <input 
                                                type="date" 
                                                required
                                                value={formData.overtime_date} 
                                                onChange={(e) => setFormData({...formData, overtime_date: e.target.value})}
                                                className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-white text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-400 mb-1">Mesai Süresi (Saat)</label>
                                            <input 
                                                type="number" 
                                                min="0.5"
                                                max="24"
                                                step="0.5"
                                                required
                                                value={formData.overtime_hours} 
                                                onChange={(e) => setFormData({...formData, overtime_hours: e.target.value})}
                                                className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-white text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {requestType === 'VEHICLE_ASSIGNMENT' && (
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 mb-1">Araç Seçimi</label>
                                        <select 
                                            value={formData.vehicle_id}
                                            onChange={(e) => setFormData({...formData, vehicle_id: e.target.value})}
                                            className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-white text-sm"
                                        >
                                            <option value="">Farketmez / Şirket Uygun Aracı</option>
                                            {vehicles.map(v => (
                                                <option key={v.id} value={v.id}>{v.plate} - {v.brand} {v.model}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-400 mb-1">Başlangıç Tarihi</label>
                                            <input 
                                                type="date" 
                                                required
                                                value={formData.start_date} 
                                                onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                                                className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-white text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-400 mb-1">Bitiş Tarihi</label>
                                            <input 
                                                type="date" 
                                                required
                                                value={formData.end_date} 
                                                onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                                                className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-white text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {requestType === 'EXPENSE' && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 mb-1">Masraf Kategori</label>
                                        <input 
                                            type="text" 
                                            value={formData.category} 
                                            onChange={(e) => setFormData({...formData, category: e.target.value})}
                                            maxLength={50}
                                            className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-white text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 mb-1">Tutar (₺)</label>
                                        <input 
                                            type="number" 
                                            min="0"
                                            max="999999999"
                                            required
                                            value={formData.amount} 
                                            onChange={(e) => setFormData({...formData, amount: e.target.value})}
                                            className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-white text-sm"
                                        />
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Gerekçe / Açıklama</label>
                                <textarea 
                                    rows={3}
                                    value={formData.description} 
                                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                                    placeholder="Talep detayları ve nedeni..."
                                    maxLength={300}
                                    className="w-full px-4 py-2.5 rounded-xl bg-gray-900 border border-gray-800 text-white focus:outline-none focus:border-indigo-500 text-sm"
                                />
                            </div>

                            <div className="pt-3 flex justify-end gap-3 border-t border-gray-800">
                                <button 
                                    type="button" 
                                    onClick={() => setModalOpen(false)}
                                    className="px-4 py-2 rounded-xl bg-gray-800 text-gray-300 text-sm hover:bg-gray-700"
                                >
                                    İptal
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={submitting}
                                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm flex items-center gap-2 shadow-lg shadow-indigo-600/30"
                                >
                                    <Send size={16} /> {submitting ? 'Gönderiliyor...' : 'Talebi Gönder'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
