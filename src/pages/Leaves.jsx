import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
    Calendar, 
    Plus, 
    Trash2, 
    Edit2, 
    Users,
    Clock,
    AlertCircle,
    User,
    Search,
    X,
    Check,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import { useCompany } from '../context/CompanyContext';
import { useTabs } from '../context/TabContext';
import { useToast } from '../context/ToastContext';
import TopProgressBar from '../components/TopProgressBar';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import DataTable from '../components/DataTable';
import CustomInput from '../components/CustomInput';
import CustomSelect from '../components/CustomSelect';
import { formatDate, today, formatDateForInput, calculateLeaveDays, calculateLeaveEndDate, checkDateHolidayStatus, getLeaveBreakdown, isCreditLeave } from '../utils/helpers';

export default function Leaves() {
    const { currentCompany, companySettings } = useCompany();
    const whpl = companySettings?.hr?.weekdayHoursPerLeave !== undefined ? companySettings.hr.weekdayHoursPerLeave : (parseFloat(localStorage.getItem('hr_overtime_weekday_hours_per_leave')) || 8);
    const { addTab } = useTabs();
    const { showToast } = useToast();
    const [searchParams, setSearchParams] = useSearchParams();
    const [loading, setLoading] = useState(true);
    const [leaves, setLeaves] = useState([]);
    const [employees, setEmployees] = useState([]);
    
    // Modal States
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        if (searchParams.get('action') === 'new') {
            setEditingLeave(null);
            setIsModalOpen(true);
            searchParams.delete('action');
            setSearchParams(searchParams, { replace: true });
        }
    }, [searchParams]);
    const [editingLeave, setEditingLeave] = useState(null);
    const [formData, setFormData] = useState({
        employeeId: '',
        employeeIds: [], // For bulk selection
        type: 'Yıllık Ücretli İzin',
        startDate: today(),
        endDate: today(),
        days: 1,
        leaveUnit: 'daily',
        hours: '',
        status: 'approved',
        notes: ''
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [publicHolidays, setPublicHolidays] = useState([]);
    const [confirmDelete, setConfirmDelete] = useState(null);

    const [leaveModalStep, setLeaveModalStep] = useState(1);
    const [leaveQueue, setLeaveQueue] = useState([]);
    const [leaveQueueIndex, setLeaveQueueIndex] = useState(0);
    const [searchFilter, setSearchFilter] = useState('');
    const [deptFilter, setDeptFilter] = useState('');

    const defaultLeaveTypeList = [
        { value: 'Yıllık Ücretli İzin', label: 'Yıllık Ücretli İzin', color: '#3b82f6' },
        { value: 'Hastalık / Rapor (İstirahat)', label: 'Hastalık / Rapor (İstirahat)', color: '#ef4444' },
        { value: 'Ücretsiz İzin', label: 'Ücretsiz İzin', color: '#f59e0b' },
        { value: 'Mazeret İzni', label: 'Mazeret İzni', color: '#8b5cf6' },
        { value: 'Evlilik İzni', label: 'Evlilik İzni', color: '#ec4899' },
        { value: 'Ölüm İzni', label: 'Ölüm İzni', color: '#6b7280' },
        { value: 'Doğum / Analık İzni', label: 'Doğum / Analık İzni', color: '#d946ef' },
        { value: 'Babalık İzni', label: 'Babalık İzni', color: '#0ea5e9' },
        { value: 'Süt İzni', label: 'Süt İzni', color: '#10b981' },
        { value: 'İdari İzin', label: 'İdari İzin', color: '#6366f1' },
        { value: 'Mesai İzni (Mahsup)', label: 'Mesai İzni (Mahsup)', color: '#10b981' },
        { value: 'İlave Yıllık İzin (Hak Ediş)', label: 'İlave Yıllık İzin (Hak Ediş)', color: '#6366f1' },
        { value: 'Diğer', label: 'Diğer', color: '#94a3b8' }
    ];

    const [leaveTypes, setLeaveTypes] = useState(defaultLeaveTypeList);

    const defaultColors = {
        'Yıllık Ücretli İzin': '#3b82f6',
        'Hastalık / Rapor (İstirahat)': '#ef4444',
        'Ücretsiz İzin': '#f59e0b',
        'Mazeret İzni': '#8b5cf6',
        'Evlilik İzni': '#ec4899',
        'Ölüm İzni': '#6b7280',
        'Doğum / Analık İzni': '#d946ef',
        'Babalık İzni': '#0ea5e9',
        'Süt İzni': '#10b981',
        'İdari İzin': '#6366f1',
        'Mesai İzni (Mahsup)': '#10b981',
        'İlave Yıllık İzin (Hak Ediş)': '#6366f1',
        'Diğer': '#94a3b8'
    };

    const loadData = async (isBackground = false) => {
        if (!currentCompany) return;
        if (!isBackground) setLoading(true);
        try {
            const [leavesRes, employeesRes, typesRes, holidaysRes] = await Promise.all([
                window.electronAPI.getLeavesByCompany(currentCompany.id),
                window.electronAPI.getEmployees(currentCompany.id, 0),
                window.electronAPI.getLeaveTypes(currentCompany.id),
                window.electronAPI.getPublicHolidays(currentCompany.id)
            ]);
            
            if (leavesRes.success) setLeaves(leavesRes.data || []);
            if (employeesRes.success) setEmployees(employeesRes.data || []);
            if (holidaysRes.success) setPublicHolidays(holidaysRes.data || []);
            if (typesRes?.success && (typesRes.data || []).length > 0) {
                const types = (typesRes.data || [])
                    .filter(t => t.status !== 'passive')
                    .map(t => ({
                        value: t.name,
                        label: t.name,
                        color: defaultColors[t.name] || '#6b7280'
                    }));
                setLeaveTypes(types.length > 0 ? types : defaultLeaveTypeList);
            } else {
                setLeaveTypes(defaultLeaveTypeList);
            }
        } catch (err) {
            console.error('Failed to load leaves:', err);
        }
        if (!isBackground) setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, [currentCompany]);

    // Real-time synchronization listener
    const loadDataRef = useRef(null)
    useEffect(() => {
        loadDataRef.current = loadData
    })
    useEffect(() => {
        if (!currentCompany) return
        const unsub = window.electronAPI?.onDbUpdate?.((change) => {
            if (['leaves', 'employees'].includes(change?.table)) {
                console.log(`[RealTime] Leaves reloading for change in ${change.table}`)
                loadDataRef.current(true)
            }
        })
        return () => { if (unsub) unsub() }
    }, [currentCompany])

    const handleAddClick = () => {
        setEditingLeave(null);
        setFormData({
            employeeId: '',
            employeeIds: [],
            type: 'Yıllık Ücretli İzin',
            startDate: today(),
            endDate: today(),
            days: 14,
            leaveUnit: 'daily',
            hours: '',
            status: 'approved',
            notes: ''
        });
        setLeaveQueue([]);
        setLeaveQueueIndex(0);
        setLeaveModalStep(1);
        setError('');
        setIsModalOpen(true);
    };

    const handleEditClick = (leave) => {
        setEditingLeave(leave);
        const emp = employees.find(e => e.id === leave.employee_id);
        const initialFormData = {
            employeeId: leave.employee_id,
            employeeIds: [leave.employee_id],
            type: leave.type,
            startDate: formatDateForInput(leave.start_date),
            endDate: formatDateForInput(leave.end_date),
            days: leave.days,
            leaveUnit: leave.hours ? 'hourly' : 'daily',
            hours: leave.hours || '',
            status: leave.status,
            notes: leave.notes || ''
        };
        setFormData(initialFormData);
        setLeaveQueue([{
            id: leave.id,
            employeeId: leave.employee_id,
            employee: emp,
            type: leave.type,
            startDate: formatDateForInput(leave.start_date),
            endDate: formatDateForInput(leave.end_date),
            days: leave.days,
            leaveUnit: leave.hours ? 'hourly' : 'daily',
            hours: leave.hours || '',
            status: leave.status,
            notes: leave.notes || ''
        }]);
        setLeaveQueueIndex(0);
        setLeaveModalStep(2);
        setError('');
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        setSaving(true);
        setError('');
        try {
            const targetItems = leaveQueue.filter(item => !item.isSaved);
            for (const item of targetItems) {
                const payload = {
                    employeeId: parseInt(item.employeeId),
                    type: item.type,
                    startDate: item.startDate,
                    endDate: item.endDate,
                    days: item.leaveUnit === 'hourly' ? parseFloat(item.days) : (parseInt(item.days) || 1),
                    hours: item.leaveUnit === 'hourly' && item.hours ? parseFloat(item.hours) : null,
                    status: item.status,
                    notes: item.notes || null
                };

                if (item.id) {
                    await window.electronAPI.updateLeave({ id: item.id, ...payload });
                } else {
                    await window.electronAPI.createLeave(payload);
                }
            }

            setIsModalOpen(false);
            loadData();
            showToast(editingLeave ? 'İzin güncellendi.' : 'İzin(ler) kaydedildi.', 'success');
        } catch (err) {
            setError(err.message || 'İzin kaydedilirken bir hata oluştu.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirmDelete) return;
        try {
            const res = await window.electronAPI.deleteLeave(confirmDelete.id);
            if (res.success) {
                loadData();
                showToast('İzin silindi.', 'success');
            }
        } catch (err) {
            console.error('Failed to delete leave:', err);
        }
        setConfirmDelete(null);
    };

    const handleBulkDelete = async (ids) => {
        if (!ids || ids.length === 0) return;
        if (!confirm('Seçili izinleri silmek istediğinize emin misiniz?')) return;

        setSaving(true);
        try {
            let successCount = 0;
            for (const id of ids) {
                const res = await window.electronAPI.deleteLeave(id);
                if (res.success) successCount++;
            }
            if (successCount > 0) {
                loadData();
                showToast(`${successCount} izin silindi.`, 'success');
            }
        } catch (err) {
            console.error('Bulk delete failed:', err);
        }
        setSaving(false);
    };

    const updateField = (key, value) => {
        setFormData(prev => {
            let newData = { ...prev, [key]: value };

            // Fetch employee and holiday details for calculation
            const emp = employees.find(e => e.id === parseInt(newData.employeeId || prev.employeeId));
            const offDaysStr = emp ? emp.off_days : '0';
            const holidayDates = publicHolidays;

            if (key === 'type' || (key === 'employeeId' && prev.type)) {
                const typeToProcess = key === 'type' ? value : prev.type;
                const empIdToProcess = key === 'employeeId' ? value : prev.employeeId;
                
                const lower = typeToProcess.toLowerCase();
                let autoDays = 0;
                if (lower.includes('evlilik')) autoDays = 3;
                else if (lower.includes('ölüm')) autoDays = 3;
                else if (lower.includes('babalık')) autoDays = 5;
                else if (lower.includes('engelli')) autoDays = 10;
                else if (lower.includes('yıllık')) {
                    const emp = employees.find(e => e.id === parseInt(empIdToProcess));
                    if (emp && emp.start_date) {
                        const start = new Date(emp.start_date);
                        const years = Math.floor((new Date() - start) / (1000 * 60 * 60 * 24 * 365.25));
                        autoDays = years < 5 ? 14 : (years < 15 ? 20 : 26);
                    }
                } else {
                    autoDays = 1;
                }

                newData.days = autoDays;
                if (newData.startDate) {
                    newData.endDate = calculateLeaveEndDate(newData.startDate, autoDays, offDaysStr, holidayDates);
                }
            }

            if (key === 'startDate' && newData.startDate) {
                const days = parseInt(newData.days) || 1;
                newData.endDate = calculateLeaveEndDate(newData.startDate, days, offDaysStr, holidayDates);
            } else if (key === 'days' && newData.startDate) {
                const days = parseInt(value) || 1;
                newData.endDate = calculateLeaveEndDate(newData.startDate, days, offDaysStr, holidayDates);
            } else if (key === 'endDate' && newData.startDate && newData.endDate) {
                newData.days = calculateLeaveDays(newData.startDate, newData.endDate, offDaysStr, holidayDates);
            }
            return newData;
        });
    };

    function getInitials(first, last) {
        if (!first) return '';
        return `${first.charAt(0)}${last ? last.charAt(0) : ''}`.toUpperCase();
    }

    const employeeDepartmentOptions = useMemo(() => {
        const depts = [...new Set(employees.map(item => item.department).filter(Boolean))].sort()
        return depts.map(d => ({ value: d, label: d }))
    }, [employees])

    const filteredEmployeesForSelection = useMemo(() => {
        return employees.filter(emp => {
            const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.toLocaleLowerCase('tr-TR')
            const search = searchFilter.toLocaleLowerCase('tr-TR')
            const matchesSearch = fullName.includes(search) || (emp.department || '').toLocaleLowerCase('tr-TR').includes(search)
            const matchesDept = !deptFilter || emp.department === deptFilter
            return matchesSearch && matchesDept
        })
    }, [employees, searchFilter, deptFilter])

    const handleSelectEmployee = (empId) => {
        setFormData(prev => {
            const isSelected = prev.employeeIds.includes(empId)
            const newIds = isSelected 
                ? prev.employeeIds.filter(id => id !== empId) 
                : [...prev.employeeIds, empId]
            return { ...prev, employeeIds: newIds }
        })
    }

    const handleToggleAllEmployees = () => {
        setFormData(prev => {
            const allFilteredIds = filteredEmployeesForSelection.map(e => e.id)
            const allSelected = allFilteredIds.every(id => prev.employeeIds.includes(id))
            
            let newIds
            if (allSelected) {
                newIds = prev.employeeIds.filter(id => !allFilteredIds.includes(id))
            } else {
                newIds = [...new Set([...prev.employeeIds, ...allFilteredIds])]
            }
            return { ...prev, employeeIds: newIds }
        })
    }

    const startProcessingQueue = () => {
        if (formData.employeeIds.length === 0) return;
        
        const holidayDates = publicHolidays;
        const newQueue = formData.employeeIds.map(id => {
            const emp = employees.find(e => e.id === id);
            const offDaysStr = emp ? emp.off_days : '0';
            const autoDays = 1;
            const sDate = today();
            const eDate = calculateLeaveEndDate(sDate, autoDays, offDaysStr, holidayDates);

            return {
                employeeId: id,
                employee: emp,
                type: 'Yıllık Ücretli İzin',
                startDate: sDate,
                endDate: eDate,
                days: autoDays,
                leaveUnit: 'daily',
                hours: '',
                status: 'approved',
                notes: '',
                isSaved: false
            };
        });
        setLeaveQueue(newQueue);
        setLeaveQueueIndex(0);
        setLeaveModalStep(2);
    };

    const updateLeaveQueueField = (key, value) => {
        setLeaveQueue(prev => prev.map((item, idx) => {
            if (idx !== leaveQueueIndex) return item;
            let newItem = { ...item, [key]: value };
            const emp = newItem.employee || employees.find(e => e.id === newItem.employeeId);
            const offDaysStr = emp ? emp.off_days : '0';
            const holidayDates = publicHolidays;

            if (newItem.leaveUnit === 'hourly') {
                if (key === 'startDate') {
                    newItem.endDate = newItem.startDate;
                } else if (key === 'hours') {
                    const hr = parseFloat(value) || 0;
                    newItem.days = hr / whpl;
                } else if (key === 'leaveUnit') {
                    newItem.endDate = newItem.startDate;
                    const hr = parseFloat(newItem.hours) || 1;
                    newItem.hours = hr;
                    newItem.days = hr / whpl;
                }
            } else {
                if (key === 'leaveUnit') {
                    newItem.hours = '';
                    newItem.days = 1;
                }

                if (key === 'type') {
                    const autoDays = newItem.days || 1;
                    newItem.days = autoDays;
                    if (newItem.startDate) {
                        newItem.endDate = calculateLeaveEndDate(newItem.startDate, autoDays, offDaysStr, holidayDates);
                    }
                }

                if (key === 'startDate' && newItem.startDate) {
                    const days = parseInt(newItem.days) || 1;
                    newItem.endDate = calculateLeaveEndDate(newItem.startDate, days, offDaysStr, holidayDates);
                } else if (key === 'days' && newItem.startDate) {
                    const days = parseInt(value) || 1;
                    newItem.endDate = calculateLeaveEndDate(newItem.startDate, days, offDaysStr, holidayDates);
                } else if (key === 'endDate' && newItem.startDate && newItem.endDate) {
                    newItem.days = calculateLeaveDays(newItem.startDate, newItem.endDate, offDaysStr, holidayDates);
                }
            }
            return newItem;
        }));
    };

    const applyToAll = () => {
        const current = leaveQueue[leaveQueueIndex];
        const holidayDates = publicHolidays;

        setLeaveQueue(prev => prev.map((item, idx) => {
            if (item.isSaved) return item;
            const emp = item.employee || employees.find(e => e.id === item.employeeId);
            const offDaysStr = emp ? emp.off_days : '0';

            let calculatedEndDate = current.endDate;
            let calculatedDays = current.days;

            if (current.leaveUnit !== 'hourly') {
                calculatedEndDate = calculateLeaveEndDate(current.startDate, current.days, offDaysStr, holidayDates);
                calculatedDays = calculateLeaveDays(current.startDate, calculatedEndDate, offDaysStr, holidayDates);
            }

            return {
                ...item,
                type: current.type,
                startDate: current.startDate,
                endDate: calculatedEndDate,
                days: calculatedDays,
                leaveUnit: current.leaveUnit,
                hours: current.hours,
                status: current.status,
                notes: current.notes
            };
        }));
    };

    const stats = useMemo(() => {
        const todayStr = today(); // YYYY-MM-DD
        const thisMonth = todayStr.slice(0, 7);
        
        const approvedLeaves = leaves.filter(l => l.status === 'approved');
        
        const thisMonthLeaves = approvedLeaves.filter(l => {
            const dateStr = formatDateForInput(l.start_date);
            return dateStr.startsWith(thisMonth);
        });

        const activeToday = approvedLeaves.filter(l => {
            const startStr = formatDateForInput(l.start_date);
            const endStr = formatDateForInput(l.end_date);
            return todayStr >= startStr && todayStr <= endStr;
        });

        return {
            totalThisMonth: thisMonthLeaves.reduce((sum, l) => sum + (l.days || 0), 0),
            currentlyOnLeave: activeToday.length,
            pendingApproval: leaves.filter(l => l.status === 'pending').length
        };
    }, [leaves]);

    const columns = [
        {
            key: 'employee',
            label: 'Personel',
            searchValue: (row) => `${row.employees?.first_name} ${row.employees?.last_name}`,
            render: (_, row) => (
                <div style={{ fontWeight: 600 }}>{row.employees?.first_name} {row.employees?.last_name}</div>
            )
        },
        {
            key: 'type',
            label: 'İzin Türü',
            render: (val, row) => {
                const type = leaveTypes.find(t => t.value === val);
                const isCredit = isCreditLeave(row || val);
                const label = type?.label || (val === 'offset' ? 'Mahsup' : val);

                if (isCredit) {
                    const isMahsup = val === 'offset' || val === 'Mahsup' || (typeof val === 'string' && val.toLowerCase().includes('mahsup'));
                    return (
                        <span 
                            className="badge" 
                            style={{ 
                                background: isMahsup ? 'rgba(16, 185, 129, 0.12)' : 'rgba(99, 102, 241, 0.12)', 
                                color: isMahsup ? '#059669' : '#4f46e5', 
                                border: `1px solid ${isMahsup ? 'rgba(16, 185, 129, 0.28)' : 'rgba(99, 102, 241, 0.28)'}`,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontWeight: 600,
                                fontSize: '11.5px',
                                padding: '3px 8px'
                            }}
                            title={isMahsup ? 'Mesai / İzin Mahsuplaşması (+ Bakiye)' : 'İlave İzin / Hak Ediş (+ Bakiye)'}
                        >
                            <span style={{ fontSize: '12px', fontWeight: 700 }}>{isMahsup ? '⇄' : '+'}</span>
                            <span>{label}</span>
                        </span>
                    );
                }

                return (
                    <span style={{ color: type?.color || 'inherit', fontWeight: 600 }}>
                        {label}
                    </span>
                );
            }
        },
        {
            key: 'dates',
            label: 'Tarih Aralığı',
            render: (_, row) => (
                <div style={{ fontSize: '13px' }}>
                    {formatDate(row.start_date)} - {formatDate(row.end_date)}
                </div>
            )
        },
        {
            key: 'days',
            label: 'Süre',
            render: (val, row) => {
                const displayVal = (() => {
                    if (row.hours) return `${row.hours} Saat`;
                    if (val && val % 1 !== 0) {
                        return `${Math.round(val * whpl * 100) / 100} Saat`;
                    }
                    return `${val} Gün`;
                })();
                const isCredit = isCreditLeave(row);

                if (isCredit) {
                    return (
                        <span 
                            style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '3px',
                                color: '#059669', 
                                fontWeight: 700,
                                background: 'rgba(16, 185, 129, 0.12)',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                border: '1px solid rgba(16, 185, 129, 0.25)',
                                fontSize: '12px'
                            }}
                            title="Bakiyeye İlave Edilen Süre (+)"
                        >
                            +{displayVal}
                        </span>
                    );
                }

                return <span style={{ fontWeight: 600 }}>{displayVal}</span>;
            }
        },
        {
            key: 'status',
            label: 'İzin Durumu',
            width: '180px',
            render: (val, row) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap' }}>
                    <span 
                        className={`badge badge-${val === 'approved' ? 'success' : (val === 'pending' ? 'warning' : 'danger')}`}
                        style={{ whiteSpace: 'nowrap', padding: '5px 10px', fontSize: '12px' }}
                    >
                        {val === 'approved' ? 'Onaylandı' : (val === 'pending' ? 'Bekliyor' : 'Reddedildi')}
                    </span>
                    {val === 'pending' && (
                        <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                                onClick={async () => {
                                    await window.electronAPI.updateLeave({
                                        id: row.id,
                                        employeeId: row.employee_id,
                                        type: row.type,
                                        startDate: row.start_date,
                                        endDate: row.end_date,
                                        days: row.days,
                                        hours: row.hours,
                                        status: 'approved',
                                        notes: row.notes
                                    });
                                    loadData(true);
                                    showToast('İzin onaylandı.', 'success');
                                }}
                                title="Onayla"
                                style={{
                                    background: 'var(--success-bg)',
                                    color: 'var(--success)',
                                    border: '1px solid var(--success)',
                                    borderRadius: '6px',
                                    padding: '4px 8px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                            >
                                <Check size={13} /> Onayla
                            </button>
                            <button
                                onClick={async () => {
                                    await window.electronAPI.updateLeave({
                                        id: row.id,
                                        employeeId: row.employee_id,
                                        type: row.type,
                                        startDate: row.start_date,
                                        endDate: row.end_date,
                                        days: row.days,
                                        hours: row.hours,
                                        status: 'rejected',
                                        notes: row.notes
                                    });
                                    loadData(true);
                                    showToast('İzin reddedildi.', 'info');
                                }}
                                title="Reddet"
                                style={{
                                    background: 'var(--danger-bg)',
                                    color: 'var(--danger)',
                                    border: '1px solid var(--danger)',
                                    borderRadius: '6px',
                                    padding: '4px 8px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                            >
                                <X size={13} /> Reddet
                            </button>
                        </div>
                    )}
                </div>
            )
        },
        {
            key: 'notes',
            label: 'Notlar',
            render: (val) => (
                <div style={{ maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {val || '-'}
                </div>
            )
        }
    ];

    if (!currentCompany) {
        return (
            <div className="page-container">
                <div className="empty-state">
                    <div className="empty-state-icon"><User /></div>
                    <h2 className="empty-state-title">Şirket Seçilmedi</h2>
                    <p className="empty-state-desc">İzin kayıtlarını görüntülemek için lütfen bir şirket seçin.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container fade-in">
            <TopProgressBar loading={loading} />

            <div className="page-header">
                <div>
                    <h1 className="page-title">Personel İzin Tablosu</h1>
                    <p className="page-subtitle">Tüm personellerin izin kayıtlarını ve takvimini buradan yönetebilirsiniz.</p>
                </div>
                <div className="page-actions">
                    <button className="btn btn-primary" onClick={handleAddClick}>
                        <Plus size={18} />
                        Yeni İzin Ekle
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid-responsive-3" style={{ marginBottom: '25px' }}>
                <div className="stat-card">
                    <div className="stat-icon info">
                        <Calendar size={24} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-label">Bu Ay Toplam İzin</span>
                        <div className="stat-value">{stats.totalThisMonth} <span style={{ fontSize: '14px', fontWeight: 400 }}>Gün</span></div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon success">
                        <Users size={24} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-label">Şu An İzinde Olanlar</span>
                        <div className="stat-value">{stats.currentlyOnLeave} <span style={{ fontSize: '14px', fontWeight: 400 }}>Kişi</span></div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon warning">
                        <Clock size={24} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-label">Onay Bekleyenler</span>
                        <div className="stat-value">{stats.pendingApproval}</div>
                    </div>
                </div>
            </div>

            {/* Main Table */}
            <DataTable
                columns={columns}
                data={leaves}
                persistenceKey="leaves_table"
                rowClassName={(row) => isCreditLeave(row) ? 'green-row credit-leave-row' : ''}
                showSearch={true}
                showCheckboxes={true}
                onBulkDelete={handleBulkDelete}
                searchPlaceholder="Personel veya notlarda ara..."
                showDateFilter={true}
                dateFilterKey="start_date"
                filters={[
                    {
                        key: 'type',
                        label: 'İzin Türü',
                        options: leaveTypes.map(t => ({ value: t.value, label: t.label }))
                    },
                    {
                        key: 'status',
                        label: 'Durum',
                        options: [
                            { value: 'approved', label: 'Onaylandı' },
                            { value: 'pending', label: 'Bekliyor' },
                            { value: 'rejected', label: 'Reddedildi' }
                        ]
                    }
                ]}
                actions={(leave) => (
                    <>
                        <button onClick={() => handleEditClick(leave)} title="Düzenle">
                            <Edit2 size={16} />
                        </button>
                        <button className="text-danger" onClick={() => setConfirmDelete(leave)} title="Sil">
                            <Trash2 size={16} />
                        </button>
                    </>
                )}
            />

            {/* Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingLeave ? 'İzni Düzenle' : (formData.employeeId ? 'İzin Ekle' : 'Toplu İzin Ekle')}
                size="lg"
                footer={null}
                bodyStyle={{ overflow: 'visible', padding: '20px' }}
            >
                <div style={{ position: 'relative', overflow: 'hidden', width: '100%' }}>
                    {/* Stepper Header */}
                    {!editingLeave && !formData.employeeId && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: leaveModalStep === 1 ? 1 : 0.6, transition: 'opacity 0.2s' }}>
                                    <span style={{ 
                                        fontSize: '11px', 
                                        fontWeight: 700, 
                                        background: leaveModalStep === 1 ? 'var(--accent-primary)' : 'var(--success)', 
                                        color: '#fff', 
                                        width: '20px', 
                                        height: '20px', 
                                        borderRadius: '50%', 
                                        display: 'inline-flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center' 
                                    }}>
                                        {leaveModalStep > 1 ? '✓' : '1'}
                                    </span>
                                    <span style={{ fontSize: '13px', fontWeight: 600, color: leaveModalStep === 1 ? 'var(--text-primary)' : 'var(--text-muted)' }}>Personel Seçimi</span>
                                </div>
                                
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: leaveModalStep === 2 ? 1 : 0.4, transition: 'opacity 0.2s' }}>
                                    <span style={{ 
                                        fontSize: '11px', 
                                        fontWeight: 700, 
                                        background: leaveModalStep === 2 ? 'var(--accent-primary)' : 'var(--bg-tertiary)', 
                                        color: leaveModalStep === 2 ? '#fff' : 'var(--text-secondary)', 
                                        width: '20px', 
                                        height: '20px', 
                                        borderRadius: '50%', 
                                        display: 'inline-flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center',
                                        border: leaveModalStep === 2 ? 'none' : '1px solid var(--border-color)'
                                    }}>
                                        2
                                    </span>
                                    <span style={{ fontSize: '13px', fontWeight: 600, color: leaveModalStep === 2 ? 'var(--text-primary)' : 'var(--text-muted)' }}>İzin Girişi</span>
                                </div>
                            </div>
                            <div style={{ 
                                display: 'flex', 
                                flexDirection: 'column', 
                                gap: '8px', 
                                padding: '0 4px',
                                opacity: leaveModalStep === 2 ? 1 : 0,
                                visibility: leaveModalStep === 2 ? 'visible' : 'hidden',
                                transition: 'all 0.3s ease',
                                height: '28px'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600 }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>İşlem Sırası: {leaveQueueIndex + 1} / {Math.max(leaveQueue.length, 1)}</span>
                                    <span style={{ color: 'var(--accent-primary)' }}>%{Math.round(((leaveQueueIndex + 1) / Math.max(leaveQueue.length, 1)) * 100)}</span>
                                </div>
                                <div style={{ height: '4px', background: 'var(--bg-tertiary)', borderRadius: '2px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', background: 'var(--accent-primary)', width: `${((leaveQueueIndex + 1) / Math.max(leaveQueue.length, 1)) * 100}%`, transition: 'width 0.3s' }} />
                                </div>
                            </div>
                        </div>
                    )}

                    <div style={{ 
                        display: 'flex', 
                        transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                        transform: leaveModalStep === 1 ? 'translateX(0)' : 'translateX(-100%)',
                        minHeight: '440px'
                    }}>
                        {/* Step 1: Selection */}
                        <div style={{ minWidth: '100%', padding: '2px', height: '100%' }}>
                            <form onSubmit={(e) => { e.preventDefault(); startProcessingQueue(); }} style={{ height: '100%' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '12px', alignItems: 'center' }}>
                                        <div className="search-box" style={{ height: '36px', minWidth: 'auto', boxSizing: 'border-box' }}>
                                            <Search size={16} />
                                            <input 
                                                type="text"
                                                placeholder="İsim veya departman ara..."
                                                value={searchFilter}
                                                onChange={(e) => setSearchFilter(e.target.value)}
                                                style={{ height: '100%', padding: 0 }}
                                            />
                                            {searchFilter && (
                                                <button type="button" className="search-clear" onClick={() => setSearchFilter('')} style={{ display: 'flex', alignItems: 'center' }}>
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>
                                        <CustomSelect 
                                            value={deptFilter}
                                            options={[
                                                { value: '', label: 'Tüm Departmanlar' },
                                                ...employeeDepartmentOptions
                                            ]}
                                            onChange={setDeptFilter}
                                            floatingLabel={false}
                                            style={{ marginBottom: 0 }}
                                        />
                                    </div>

                                    {/* Scrollable list of employees with checkboxes */}
                                    <div 
                                        className="employee-select-list" 
                                        style={{ 
                                            position: 'relative', 
                                            width: '100%', 
                                            border: '1px solid var(--border-color)', 
                                            borderRadius: 'var(--radius-md)', 
                                            height: '220px', 
                                            overflowY: 'auto', 
                                            background: 'var(--bg-secondary)', 
                                            boxShadow: 'none',
                                            flexShrink: 0
                                        }}
                                    >
                                        <div style={{ 
                                            padding: '10px 14px', 
                                            borderBottom: '1px solid var(--border-color)', 
                                            display: 'flex', 
                                            justifyContent: 'space-between', 
                                            alignItems: 'center',
                                            backgroundColor: 'var(--bg-tertiary)',
                                            fontSize: '13px',
                                            position: 'sticky',
                                            top: 0,
                                            zIndex: 2
                                        }}>
                                            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Personel Listesi ({filteredEmployeesForSelection.length})</span>
                                            <button 
                                                type="button" 
                                                onClick={handleToggleAllEmployees}
                                                style={{ 
                                                    background: 'none', 
                                                    border: 'none', 
                                                    color: 'var(--accent-primary)', 
                                                    fontWeight: 600, 
                                                    fontSize: '12px', 
                                                    cursor: 'pointer' 
                                                }}
                                            >
                                                {formData.employeeIds.length === filteredEmployeesForSelection.length ? 'Tümünü Kaldır' : 'Tümünü Seç'}
                                            </button>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            {filteredEmployeesForSelection.map(emp => {
                                                const isChecked = formData.employeeIds.includes(emp.id)
                                                return (
                                                    <div 
                                                        key={emp.id}
                                                        className={`custom-select-option ${isChecked ? 'selected' : ''}`}
                                                        onClick={() => handleSelectEmployee(emp.id)}
                                                        style={{ 
                                                            display: 'flex', 
                                                            alignItems: 'center', 
                                                            gap: '12px', 
                                                            padding: '10px 14px', 
                                                            borderBottom: '1px solid var(--border-color)',
                                                            justifyContent: 'flex-start',
                                                            borderRadius: 0
                                                        }}
                                                    >
                                                        <div 
                                                            className={`checkbox ${isChecked ? 'checked' : ''}`}
                                                            style={{ flexShrink: 0 }}
                                                        >
                                                            {isChecked && <Check size={12} style={{ color: '#fff' }} />}
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                                                            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
                                                                {emp.first_name} {emp.last_name}
                                                            </span>
                                                            {emp.department && (
                                                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                                    {emp.department}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                            {filteredEmployeesForSelection.length === 0 && (
                                                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                                                    Personel bulunamadı
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Selection Stats */}
                                    <div style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: '12px',
                                        padding: '12px 16px', 
                                        borderRadius: 'var(--radius-md)', 
                                        background: 'var(--accent-subtle)', 
                                        border: '1px solid rgba(20, 184, 166, 0.2)',
                                    }}>
                                        <Users size={20} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                                        <div style={{ flex: 1 }}>
                                            <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 }}>
                                                {formData.employeeIds.length > 0 
                                                    ? `${formData.employeeIds.length} personel seçildi.` 
                                                    : 'Lütfen izin eklemek istediğiniz personelleri seçin.'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="modal-actions" style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '20px' }}>
                                        <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Vazgeç</button>
                                        <button type="submit" className="btn btn-primary" disabled={formData.employeeIds.length === 0} style={{ padding: '0 25px', gap: '10px' }}>
                                            İşleme Başla <ChevronRight size={18} />
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>

                        {/* Step 2: Individual Entry Form */}
                        <div style={{ minWidth: '100%', padding: '2px' }}>
                            {leaveQueue.length > 0 && (
                                <form onSubmit={handleSubmit}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                        {/* Navigation and Current Employee Header */}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '15px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                                                <div style={{ 
                                                    width: '40px', 
                                                    height: '40px', 
                                                    borderRadius: 'var(--radius-sm)', 
                                                    background: 'var(--accent-subtle)', 
                                                    color: 'var(--accent-primary)', 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    justifyContent: 'center', 
                                                    fontWeight: 700,
                                                    fontSize: '13px',
                                                    flexShrink: 0,
                                                    border: '1px solid rgba(20, 184, 166, 0.2)'
                                                }}>
                                                    {getInitials(leaveQueue[leaveQueueIndex].employee?.first_name, leaveQueue[leaveQueueIndex].employee?.last_name)}
                                                </div>
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>İşlenen Personel</span>
                                                        {leaveQueue[leaveQueueIndex].employee?.department && (
                                                            <span style={{ 
                                                                fontSize: '10px', 
                                                                fontWeight: 600, 
                                                                color: 'var(--text-secondary)', 
                                                                background: 'var(--bg-tertiary)', 
                                                                padding: '2px 6px', 
                                                                borderRadius: 'var(--radius-xs)', 
                                                                border: '1px solid var(--border-color)' 
                                                            }}>{leaveQueue[leaveQueueIndex].employee.department}</span>
                                                        )}
                                                    </div>
                                                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {leaveQueue[leaveQueueIndex].employee?.first_name} {leaveQueue[leaveQueueIndex].employee?.last_name}
                                                    </div>
                                                </div>
                                            </div>

                                            {!editingLeave && (
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    <button 
                                                        type="button"
                                                        className="btn btn-secondary"
                                                        disabled={leaveQueueIndex === 0} 
                                                        onClick={() => setLeaveQueueIndex(prev => prev - 1)}
                                                        style={{ width: '36px', height: '36px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    >
                                                        <ChevronLeft size={20} />
                                                    </button>
                                                    <button 
                                                        type="button"
                                                        className="btn btn-secondary"
                                                        disabled={leaveQueueIndex === leaveQueue.length - 1} 
                                                        onClick={() => setLeaveQueueIndex(prev => prev + 1)}
                                                        style={{ width: '36px', height: '36px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    >
                                                        <ChevronRight size={20} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {(() => {
                                            const name = leaveQueue[leaveQueueIndex].type?.toLowerCase() || '';
                                            let hint = '';
                                            if (name.includes('yıllık')) {
                                                const emp = leaveQueue[leaveQueueIndex].employee;
                                                const start = emp?.start_date ? new Date(emp.start_date) : null;
                                                const years = start ? Math.floor((new Date() - start) / (1000 * 60 * 60 * 24 * 365.25)) : 0;
                                                let legalDays = years < 5 ? 14 : (years < 15 ? 20 : 26);
                                                hint = `Kıdem: ${years} Yıl. Yasal Hak: ${legalDays} Gün`;
                                            }
                                            else if (name.includes('evlilik')) hint = 'Yasal Hak: 3 Gün';
                                            else if (name.includes('ölüm')) hint = 'Yasal Hak: 3 Gün';
                                            else if (name.includes('babalık')) hint = 'Yasal Hak: 5 Gün';
                                            else if (name.includes('engelli')) hint = 'Yasal Hak: 10 Gün';
                                            
                                            if (hint) return (
                                                <div style={{ 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    gap: '8px', 
                                                    padding: '8px 12px', 
                                                    background: 'var(--accent-subtle)', 
                                                    border: '1px solid rgba(20, 184, 166, 0.2)', 
                                                    borderRadius: 'var(--radius-sm)',
                                                    fontSize: '12px',
                                                    color: 'var(--text-primary)',
                                                    fontWeight: 500
                                                }}>
                                                    <AlertCircle size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                                                    <span>{hint}</span>
                                                </div>
                                            );
                                            return null;
                                        })()}

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '16px' }}>
                                            <CustomSelect 
                                                label="Giriş Şekli" 
                                                value={leaveQueue[leaveQueueIndex].leaveUnit || 'daily'} 
                                                options={[{ value: 'daily', label: 'Günlük' }, { value: 'hourly', label: 'Saatlik' }]} 
                                                onChange={(val) => updateLeaveQueueField('leaveUnit', val)} 
                                            />
                                            <CustomSelect 
                                                label="İzin Türü *" 
                                                value={leaveQueue[leaveQueueIndex].type} 
                                                options={leaveTypes} 
                                                onChange={(val) => updateLeaveQueueField('type', val)} 
                                            />
                                        </div>

                                        {leaveQueue[leaveQueueIndex].leaveUnit === 'hourly' ? (
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                                <div>
                                                    <CustomInput 
                                                        label="Tarih *" 
                                                        type="date" 
                                                        value={leaveQueue[leaveQueueIndex].startDate} 
                                                        onChange={(val) => updateLeaveQueueField('startDate', val)} 
                                                        required 
                                                    />
                                                    {leaveQueue[leaveQueueIndex].startDate && (() => {
                                                        const emp = employees.find(e => e.id === parseInt(leaveQueue[leaveQueueIndex].employeeId));
                                                        const offDaysStr = emp ? emp.off_days : '0';
                                                        const holidayDates = publicHolidays;
                                                        const status = checkDateHolidayStatus(leaveQueue[leaveQueueIndex].startDate, offDaysStr, holidayDates);
                                                        if (!status) return null;
                                                        return (
                                                            <div style={{ fontSize: '11px', color: 'var(--warning-primary, #eab308)', marginTop: '-8px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                <AlertCircle size={12} />
                                                                <span>Seçilen Tarih: {status.label}</span>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                                <CustomInput 
                                                    label="Süre (Saat) *" 
                                                    type="number" 
                                                    value={leaveQueue[leaveQueueIndex].hours ?? ''} 
                                                    onChange={(val) => updateLeaveQueueField('hours', val)} 
                                                    step="0.5"
                                                    min="0.5"
                                                    max="24"
                                                    required 
                                                />
                                            </div>
                                        ) : (
                                            <>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                                                    <div>
                                                        <CustomInput 
                                                            label="Başlangıç Tarihi *" 
                                                            type="date" 
                                                            value={leaveQueue[leaveQueueIndex].startDate} 
                                                            onChange={(val) => updateLeaveQueueField('startDate', val)} 
                                                            required 
                                                        />
                                                        {leaveQueue[leaveQueueIndex].startDate && (() => {
                                                            const emp = employees.find(e => e.id === parseInt(leaveQueue[leaveQueueIndex].employeeId));
                                                            const offDaysStr = emp ? emp.off_days : '0';
                                                            const holidayDates = publicHolidays;
                                                            const status = checkDateHolidayStatus(leaveQueue[leaveQueueIndex].startDate, offDaysStr, holidayDates);
                                                            if (!status) return null;
                                                            return (
                                                                <div style={{ fontSize: '11px', color: 'var(--warning-primary, #eab308)', marginTop: '-8px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                    <AlertCircle size={12} />
                                                                    <span>{status.label}</span>
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                    <div>
                                                        <CustomInput 
                                                            label="Bitiş Tarihi *" 
                                                            type="date" 
                                                            value={leaveQueue[leaveQueueIndex].endDate} 
                                                            onChange={(val) => updateLeaveQueueField('endDate', val)} 
                                                            required 
                                                        />
                                                        {leaveQueue[leaveQueueIndex].endDate && (() => {
                                                            const emp = employees.find(e => e.id === parseInt(leaveQueue[leaveQueueIndex].employeeId));
                                                            const offDaysStr = emp ? emp.off_days : '0';
                                                            const holidayDates = publicHolidays;
                                                            const status = checkDateHolidayStatus(leaveQueue[leaveQueueIndex].endDate, offDaysStr, holidayDates);
                                                            if (!status) return null;
                                                            return (
                                                                <div style={{ fontSize: '11px', color: 'var(--warning-primary, #eab308)', marginTop: '-8px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                    <AlertCircle size={12} />
                                                                    <span>{status.label}</span>
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                    <CustomInput 
                                                        label="Gün Sayısı *" 
                                                        type="number" 
                                                        value={leaveQueue[leaveQueueIndex].days} 
                                                        onChange={(val) => updateLeaveQueueField('days', val)} 
                                                        min={1}
                                                        max={365}
                                                        required 
                                                    />
                                                </div>

                                                {leaveQueue[leaveQueueIndex].startDate && leaveQueue[leaveQueueIndex].endDate && (() => {
                                                    const emp = employees.find(e => e.id === parseInt(leaveQueue[leaveQueueIndex].employeeId));
                                                    const offDaysStr = emp ? emp.off_days : '0';
                                                    const holidayDates = publicHolidays;
                                                    const breakdown = getLeaveBreakdown(leaveQueue[leaveQueueIndex].startDate, leaveQueue[leaveQueueIndex].endDate, offDaysStr, holidayDates);
                                                    if (!breakdown || (breakdown.offDays === 0 && breakdown.holidays === 0)) return null;
                                                    return (
                                                        <div style={{
                                                            marginTop: '6px',
                                                            padding: '8px 12px',
                                                            background: 'rgba(59, 130, 246, 0.08)',
                                                            border: '1px dashed rgba(59, 130, 246, 0.3)',
                                                            borderRadius: '8px',
                                                            fontSize: '12px',
                                                            color: 'var(--text-secondary)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '8px'
                                                        }}>
                                                            <Clock size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                                                            <div>
                                                                Toplam <strong>{breakdown.totalDays}</strong> takvim gününden;
                                                                {breakdown.offDays > 0 && <span> <strong>{breakdown.offDays}</strong> gün hafta tatili</span>}
                                                                {breakdown.offDays > 0 && breakdown.holidays > 0 && <span> ve</span>}
                                                                {breakdown.holidays > 0 && <span> <strong>{breakdown.holidays}</strong> gün resmi tatil</span>} düşülmüştür.
                                                                Net kullanılan izin: <strong style={{ color: 'var(--accent-primary)' }}>{breakdown.workingDays} gün</strong>.
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </>
                                        )}
                                            <div style={{
                                                display: 'flex', alignItems: 'center', gap: '12px', padding: '0 14px',
                                                background: leaveQueue[leaveQueueIndex].status === 'approved' ? 'var(--accent-subtle)' : 'var(--bg-tertiary)',
                                                border: `1px solid ${leaveQueue[leaveQueueIndex].status === 'approved' ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                                                borderRadius: 'var(--radius-sm)', transition: 'background 0.15s ease, border-color 0.15s ease', cursor: 'pointer',
                                                height: '40px', boxSizing: 'border-box'
                                            }} onClick={() => updateLeaveQueueField('status', leaveQueue[leaveQueueIndex].status === 'approved' ? 'pending' : 'approved')}>
                                                <label className="toggle-switch" style={{ flexShrink: 0, transform: 'scale(0.85)', transformOrigin: 'left center' }} onClick={e => e.stopPropagation()}>
                                                    <input type="checkbox" checked={leaveQueue[leaveQueueIndex].status === 'approved'} onChange={(e) => updateLeaveQueueField('status', e.target.checked ? 'approved' : 'pending')} />
                                                    <span className="toggle-slider"></span>
                                                </label>
                                                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1 }}>İzin Durumu</span>
                                                    <span style={{ fontSize: '13px', fontWeight: 600, color: leaveQueue[leaveQueueIndex].status === 'approved' ? 'var(--text-primary)' : 'var(--text-secondary)', marginTop: '2px', lineHeight: 1 }}>
                                                        {leaveQueue[leaveQueueIndex].status === 'approved' ? 'Onaylandı' : 'Bekliyor'}
                                                    </span>
                                                </div>
                                            </div>

                                        <div>
                                            <CustomInput 
                                                label="Notlar" 
                                                value={leaveQueue[leaveQueueIndex].notes} 
                                                onChange={(val) => updateLeaveQueueField('notes', val)} 
                                                type="textarea" 
                                                rows={1}
                                                placeholder="Opsiyonel not..."
                                                maxLength={300}
                                            />
                                        </div>

                                        {error && (
                                            <div className="alert alert-danger" style={{ padding: '8px 12px', fontSize: '13px' }}>
                                                <AlertCircle size={16} />
                                                <span>{error}</span>
                                            </div>
                                        )}

                                        <div style={{ 
                                            display: 'flex', 
                                            justifyContent: 'space-between', 
                                            alignItems: 'center',
                                            paddingTop: '15px',
                                            marginTop: 'auto',
                                            borderTop: '1px solid var(--border-color)' 
                                        }}>
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                {!editingLeave && (
                                                    <button type="button" className="btn btn-secondary" onClick={() => setLeaveModalStep(1)}>
                                                        Değiştir
                                                    </button>
                                                )}
                                                {leaveQueue.length > 1 && (
                                                    <button 
                                                        type="button" 
                                                        className="btn btn-ghost" 
                                                        style={{ color: 'var(--accent-primary)', fontWeight: 600, fontSize: '13px' }}
                                                        onClick={applyToAll}
                                                        title="Bu değerleri henüz kaydedilmemiş tüm personellere uygula"
                                                    >
                                                        Tümüne Uygula
                                                    </button>
                                                )}
                                            </div>

                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Vazgeç</button>
                                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                                    {saving ? 'Kaydediliyor...' : 'Tümünü Kaydet'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Delete Confirmation */}
            <ConfirmModal
                isOpen={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={handleDelete}
                title="İzin Kaydı Silme"
                message={confirmDelete ? `${confirmDelete.employees?.first_name} ${confirmDelete.employees?.last_name} isimli personelin bu izin kaydını silmek istediğinize emin misiniz?` : ''}
            />
        </div>
    );
}
