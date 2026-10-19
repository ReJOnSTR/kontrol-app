import { useState, useEffect, useRef } from 'react'
import Modal from './Modal'
import CustomInput from './CustomInput'
import { CheckCircle, AlertCircle, Loader2, Send, Clock } from 'lucide-react'
import './EmailTemplatesManager.css'

export default function EmailTemplatesManager() {
    // Top Tabs: 'templates' | 'smtp'
    const [mainTab, setMainTab] = useState('templates')
    
    // Templates State
    const [templates, setTemplates] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeType, setActiveType] = useState('confirmation')
    const [editorTab, setEditorTab] = useState('source') // 'source' | 'preview'
    const [previewDevice, setPreviewDevice] = useState('desktop') // 'desktop' | 'mobile'

    // Active Template Fields
    const [currentSubject, setCurrentSubject] = useState('')
    const [currentSenderName, setCurrentSenderName] = useState('')
    const [currentHtml, setCurrentHtml] = useState('')
    const [isDirty, setIsDirty] = useState(false)
    const [saving, setSaving] = useState(false)
    const [resetting, setResetting] = useState(false)
    const [feedback, setFeedback] = useState(null)

    // Test Email Modal State
    const [testModalOpen, setTestModalOpen] = useState(false)
    const [testTargetEmail, setTestTargetEmail] = useState('')
    const [sendingTest, setSendingTest] = useState(false)
    const [testResult, setTestResult] = useState(null)

    // SMTP Settings State
    const [smtpHost, setSmtpHost] = useState('')
    const [smtpPort, setSmtpPort] = useState('587')
    const [smtpSecure, setSmtpSecure] = useState(false)
    const [smtpUser, setSmtpUser] = useState('')
    const [smtpPass, setSmtpPass] = useState('')
    const [hasPass, setHasPass] = useState(false)
    const [defaultSenderName, setDefaultSenderName] = useState('Kontrol')
    const [defaultSenderEmail, setDefaultSenderEmail] = useState('noreply@kontrol-app.com')
    const [savingSmtp, setSavingSmtp] = useState(false)
    const [testingSmtp, setTestingSmtp] = useState(false)
    const [smtpTestResult, setSmtpTestResult] = useState(null)

    const editorRef = useRef(null)

    // Template Definitions matching Supabase Studio exactly
    const TEMPLATE_TABS = [
        { type: 'confirmation', label: 'Confirm signup' },
        { type: 'invite', label: 'Invite user' },
        { type: 'magic_link', label: 'Magic Link' },
        { type: 'change_email', label: 'Change Email Address' },
        { type: 'recovery', label: 'Reset Password' }
    ]

    useEffect(() => {
        loadTemplates()
        loadSmtpSettings()
    }, [])

    const loadTemplates = async () => {
        setLoading(true)
        try {
            const res = await window.electronAPI?.getEmailTemplates()
            if (res?.success && Array.isArray(res.data)) {
                setTemplates(res.data)
                const current = res.data.find(t => t.type === activeType) || res.data[0]
                if (current) {
                    setActiveType(current.type)
                    setCurrentSubject(current.subject || '')
                    setCurrentSenderName(current.senderName || 'Kontrol')
                    setCurrentHtml(current.htmlContent || '')
                    setIsDirty(false)
                }
            }
        } catch (err) {
            console.error('Failed to load email templates:', err)
            showToast('Şablonlar yüklenirken hata oluştu', 'error')
        } finally {
            setLoading(false)
        }
    }

    const loadSmtpSettings = async () => {
        try {
            const res = await window.electronAPI?.getEmailSettings()
            if (res?.success && res.data) {
                setSmtpHost(res.data.smtpHost || '')
                setSmtpPort(String(res.data.smtpPort || 587))
                setSmtpSecure(!!res.data.smtpSecure)
                setSmtpUser(res.data.smtpUser || '')
                setSmtpPass(res.data.smtpPass || '')
                setHasPass(!!res.data.hasPass)
                setDefaultSenderName(res.data.senderName || 'Kontrol')
                setDefaultSenderEmail(res.data.senderEmail || 'noreply@kontrol-app.com')
            }
        } catch (err) {
            console.error('Failed to load SMTP settings:', err)
        }
    }

    const handleSelectTemplate = (type) => {
        if (isDirty) {
            if (!window.confirm('Kaydedilmemiş değişiklikleriniz var. Başka bir şablona geçmek istiyor musunuz?')) {
                return
            }
        }
        setActiveType(type)
        const t = templates.find(item => item.type === type)
        if (t) {
            setCurrentSubject(t.subject || '')
            setCurrentSenderName(t.senderName || 'Kontrol')
            setCurrentHtml(t.htmlContent || '')
            setIsDirty(false)
        }
    }

    const handleSubjectChange = (e) => {
        setCurrentSubject(e.target.value)
        setIsDirty(true)
    }

    const handleSenderNameChange = (e) => {
        setCurrentSenderName(e.target.value)
        setIsDirty(true)
    }

    const handleHtmlChange = (e) => {
        setCurrentHtml(e.target.value)
        setIsDirty(true)
    }

    const handleSave = async () => {
        if (!currentSubject.trim() || !currentHtml.trim()) {
            showToast('Konu başlığı ve HTML içeriği boş bırakılamaz', 'error')
            return
        }

        setSaving(true)
        try {
            const res = await window.electronAPI?.saveEmailTemplate({
                type: activeType,
                subject: currentSubject,
                senderName: currentSenderName,
                htmlContent: currentHtml
            })

            if (res?.success) {
                showToast('Şablon başarıyla kaydedildi!', 'success')
                setIsDirty(false)
                setTemplates(prev => prev.map(t => t.type === activeType ? {
                    ...t,
                    subject: currentSubject,
                    senderName: currentSenderName,
                    htmlContent: currentHtml,
                    isCustomized: true,
                    updatedAt: new Date().toISOString()
                } : t))
            } else {
                showToast(res?.error || 'Kayıt başarısız', 'error')
            }
        } catch (err) {
            showToast(err.message || 'Kayıt hatası', 'error')
        } finally {
            setSaving(false)
        }
    }

    const handleReset = async () => {
        if (!window.confirm('Bu şablonu orijinal varsayılan tasarımına sıfırlamak istediğinize emin misiniz?')) {
            return
        }

        setResetting(true)
        try {
            const res = await window.electronAPI?.resetEmailTemplate({ type: activeType })
            if (res?.success && res.data) {
                setCurrentSubject(res.data.subject)
                setCurrentSenderName(res.data.senderName)
                setCurrentHtml(res.data.htmlContent)
                setIsDirty(false)
                showToast('Şablon varsayılan tasarıma sıfırlandı!', 'success')
                
                setTemplates(prev => prev.map(t => t.type === activeType ? {
                    ...t,
                    subject: res.data.subject,
                    senderName: res.data.senderName,
                    htmlContent: res.data.htmlContent,
                    isCustomized: false,
                    updatedAt: null
                } : t))
            } else {
                showToast(res?.error || 'Sıfırlama başarısız', 'error')
            }
        } catch (err) {
            showToast(err.message || 'Sıfırlama hatası', 'error')
        } finally {
            setResetting(false)
        }
    }

    const handleSendTestEmail = async () => {
        setTestResult(null)
        if (!testTargetEmail || !testTargetEmail.includes('@')) {
            setTestResult({
                success: false,
                message: 'Lütfen geçerli bir test e-posta adresi giriniz (Örn: adiniz@sirket.com).'
            })
            return
        }

        setSendingTest(true)
        const startTime = Date.now()
        try {
            const res = await window.electronAPI?.sendTestEmail({
                type: activeType,
                targetEmail: testTargetEmail.trim().toLowerCase(),
                subject: currentSubject,
                senderName: currentSenderName,
                htmlContent: currentHtml
            })

            const durationMs = Date.now() - startTime

            if (res?.success) {
                setTestResult({
                    success: true,
                    message: res.message || 'Test e-postası başarıyla iletildi.',
                    email: testTargetEmail.trim().toLowerCase(),
                    latency: `${durationMs}ms`,
                    timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                })
            } else {
                setTestResult({
                    success: false,
                    message: res?.error || 'Test e-postası sunucu tarafından reddedildi veya gönderilemedi.',
                    email: testTargetEmail.trim().toLowerCase()
                })
            }
        } catch (err) {
            setTestResult({
                success: false,
                message: err.message || 'Test e-postası gönderilirken beklenmeyen bir hata oluştu.',
                email: testTargetEmail.trim().toLowerCase()
            })
        } finally {
            setSendingTest(false)
        }
    }

    const handleSaveSmtp = async (e) => {
        if (e) e.preventDefault()
        if (!smtpHost.trim()) {
            showToast('SMTP Sunucu adresi boş bırakılamaz', 'error')
            return
        }

        setSavingSmtp(true)
        try {
            const res = await window.electronAPI?.saveEmailSettings({
                smtpHost: smtpHost.trim(),
                smtpPort: parseInt(smtpPort || '587'),
                smtpSecure: smtpSecure,
                smtpUser: smtpUser.trim(),
                smtpPass: smtpPass,
                senderName: defaultSenderName.trim(),
                senderEmail: defaultSenderEmail.trim()
            })

            if (res?.success) {
                showToast('SMTP Ayarları başarıyla kaydedildi!', 'success')
                setHasPass(true)
            } else {
                showToast(res?.error || 'Kayıt başarısız', 'error')
            }
        } catch (err) {
            showToast(err.message || 'SMTP kayıt hatası', 'error')
        } finally {
            setSavingSmtp(false)
        }
    }

    const handleTestSmtpConnection = async () => {
        setTestingSmtp(true)
        setSmtpTestResult(null)
        try {
            const res = await window.electronAPI?.testSmtpConnection({
                smtpHost: smtpHost.trim(),
                smtpPort: parseInt(smtpPort || '587'),
                smtpSecure: smtpSecure,
                smtpUser: smtpUser.trim(),
                smtpPass: smtpPass
            })

            if (res?.success) {
                setSmtpTestResult({ success: true, msg: 'SMTP Sunucu bağlantısı başarılı!' })
            } else {
                setSmtpTestResult({ success: false, msg: res?.error || 'Bağlantı hatası' })
            }
        } catch (err) {
            setSmtpTestResult({ success: false, msg: err.message || 'Bilinmeyen hata' })
        } finally {
            setTestingSmtp(false)
        }
    }

    const showToast = (msg, type = 'info') => {
        setFeedback({ msg, type })
        setTimeout(() => setFeedback(null), 4000)
    }

    // Replace template variables for live rendered mock preview
    const getRenderedPreview = () => {
        const mockSiteUrl = 'https://kontrol-app.com'
        const mockConfirmationUrl = 'https://kontrol-app.com/login?verified=true&preview=1'
        const mockToken = '849 201'
        const mockEmail = 'ahmet@sakvinc.com.tr'
        const mockUsername = 'ahmet_sak'
        const mockCompanyName = 'SAK PETROL LOJİSTİK A.Ş.'

        return currentHtml
            .replace(/\{\{\s*\.ConfirmationURL\s*\}\}/g, mockConfirmationUrl)
            .replace(/\{\{\s*\.Token\s*\}\}/g, mockToken)
            .replace(/\{\{\s*\.Email\s*\}\}/g, mockEmail)
            .replace(/\{\{\s*\.SiteURL\s*\}\}/g, mockSiteUrl)
            .replace(/\{\{\s*\.Data\.username\s*\}\}/g, mockUsername)
            .replace(/\{\{\s*\.Data\.company_name\s*\}\}/g, mockCompanyName)
    }

    const activeTemplate = templates.find(t => t.type === activeType)

    // Calculate line numbers for source editor
    const lineCount = (currentHtml.match(/\n/g) || []).length + 1
    const lineNumbers = Array.from({ length: Math.max(lineCount, 8) }, (_, i) => i + 1)

    if (loading) {
        return (
            <div className="studio-minimal-loading">
                <p>E-Posta Şablonları yükleniyor...</p>
            </div>
        )
    }

    return (
        <div className="supabase-studio-page">
            {/* Feedback Alert Toast */}
            {feedback && (
                <div className={`supabase-toast ${feedback.type}`}>
                    <span>{feedback.msg}</span>
                </div>
            )}

            {/* 1. Supabase Main Top Navigation Tabs */}
            <div className="supabase-top-nav">
                <button 
                    type="button"
                    className={`supabase-nav-link ${mainTab === 'templates' ? 'active' : ''}`}
                    onClick={() => setMainTab('templates')}
                >
                    Templates
                </button>
                <button 
                    type="button"
                    className={`supabase-nav-link ${mainTab === 'smtp' ? 'active' : ''}`}
                    onClick={() => setMainTab('smtp')}
                >
                    SMTP Settings
                </button>
            </div>

            {/* TAB 1: TEMPLATES VIEW */}
            {mainTab === 'templates' && (
                <div className="supabase-templates-content">
                    
                    {/* Amber Notice Banner - Only shown when custom SMTP is NOT configured */}
                    {(!smtpHost || !hasPass) && (
                        <div className="supabase-amber-banner">
                            <div className="banner-text-wrap">
                                <h4 className="banner-title">Email rate-limits and custom delivery</h4>
                                <p className="banner-desc">
                                    E-postalarınızın şirket logonuz ve %100 özel HTML tasarımınızla sorunsuz iletilmesi için özel SMTP sunucunuzu bağlayabilirsiniz.
                                </p>
                                <button 
                                    type="button"
                                    className="banner-btn"
                                    onClick={() => setMainTab('smtp')}
                                >
                                    Set up custom SMTP server
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Main Template Box */}
                    <div className="supabase-template-box">
                        
                        {/* Horizontal Template Selector Tabs */}
                        <div className="supabase-inner-tabs">
                            {TEMPLATE_TABS.map(tab => (
                                <button
                                    key={tab.type}
                                    type="button"
                                    className={`supabase-inner-tab ${activeType === tab.type ? 'active' : ''}`}
                                    onClick={() => handleSelectTemplate(tab.type)}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Template Form Body */}
                        <div className="supabase-form-body">
                            
                            {/* Row 1: Sender Name & Subject Heading */}
                            <div className="supabase-field-group">
                                <div className="field-row-split">
                                    <div className="field-half">
                                        <label className="supabase-label">Gönderen Adı</label>
                                        <input 
                                            type="text"
                                            className="supabase-input"
                                            value={currentSenderName}
                                            onChange={handleSenderNameChange}
                                            maxLength={100}
                                            placeholder="Örn: Kontrol"
                                        />
                                    </div>
                                    <div className="field-half">
                                        <label className="supabase-label">E-posta Konusu</label>
                                        <input 
                                            type="text"
                                            className="supabase-input"
                                            value={currentSubject}
                                            onChange={handleSubjectChange}
                                            maxLength={150}
                                            placeholder="E-posta konusu..."
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Row 2: Message Body Header & Source/Preview Switcher */}
                            <div className="supabase-field-group" style={{ marginTop: '20px' }}>
                                <div className="message-body-header">
                                    <label className="supabase-label">Mesaj Gövdesi (HTML)</label>
                                    
                                    <div className="source-preview-toggle">
                                        <button 
                                            type="button"
                                            className={`toggle-tab ${editorTab === 'source' ? 'active' : ''}`}
                                            onClick={() => setEditorTab('source')}
                                        >
                                            Kaynak Kod
                                        </button>
                                        <button 
                                            type="button"
                                            className={`toggle-tab ${editorTab === 'preview' ? 'active' : ''}`}
                                            onClick={() => setEditorTab('preview')}
                                        >
                                            Önizleme
                                        </button>
                                    </div>
                                </div>

                                {/* Code Editor or Live Preview */}
                                {editorTab === 'source' ? (
                                    <div className="supabase-editor-wrapper">
                                        <div className="editor-line-numbers">
                                            {lineNumbers.map(n => (
                                                <span key={n}>{n}</span>
                                            ))}
                                        </div>
                                        <textarea
                                            ref={editorRef}
                                            className="supabase-code-area"
                                            value={currentHtml}
                                            onChange={handleHtmlChange}
                                            maxLength={20000}
                                            placeholder="<h2>E-posta içeriğiniz</h2>..."
                                            spellCheck="false"
                                        />
                                    </div>
                                ) : (
                                    <div className="supabase-preview-wrapper">
                                        <div className="preview-toolbar">
                                            <div className="preview-info">
                                                <strong>Gönderen:</strong> {currentSenderName} &lt;{defaultSenderEmail}&gt; | <strong>Konu:</strong> {currentSubject}
                                            </div>
                                            <div className="device-pills">
                                                <button 
                                                    type="button" 
                                                    className={`dev-btn ${previewDevice === 'desktop' ? 'active' : ''}`}
                                                    onClick={() => setPreviewDevice('desktop')}
                                                >
                                                    Masaüstü
                                                </button>
                                                <button 
                                                    type="button" 
                                                    className={`dev-btn ${previewDevice === 'mobile' ? 'active' : ''}`}
                                                    onClick={() => setPreviewDevice('mobile')}
                                                >
                                                    Mobil
                                                </button>
                                            </div>
                                        </div>
                                        <div className={`preview-viewport ${previewDevice}`}>
                                            <iframe
                                                title="Template Preview"
                                                className="preview-frame"
                                                srcDoc={getRenderedPreview()}
                                                sandbox="allow-same-origin"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                        </div>

                        {/* Bottom Actions Bar */}
                        <div className="supabase-box-footer">
                            <div className="footer-left">
                                {activeTemplate?.isCustomized && (
                                    <button 
                                        type="button"
                                        className="btn-link-reset"
                                        onClick={handleReset}
                                        disabled={resetting}
                                    >
                                        Varsayılana Sıfırla
                                    </button>
                                )}
                            </div>

                            <div className="footer-right">
                                <button 
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setTestModalOpen(true)}
                                >
                                    Test E-postası Gönder
                                </button>

                                <button 
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={handleSave}
                                    disabled={saving || !isDirty}
                                >
                                    {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            )}

            {/* TAB 2: SMTP SETTINGS VIEW */}
            {mainTab === 'smtp' && (
                <div className="supabase-smtp-content">
                    <div className="supabase-template-box smtp-box">
                        <div className="smtp-box-header">
                            <h3>Custom SMTP Provider Settings</h3>
                            <p>Configure an external SMTP mail server (Mailu, Gmail, Yandex, Brevo, SendGrid) to dispatch emails directly with custom HTML styling.</p>
                        </div>

                        <form className="smtp-form" onSubmit={handleSaveSmtp}>
                            <div className="field-row-split">
                                <div className="field-half">
                                    <label className="supabase-label">SMTP Host</label>
                                    <input 
                                        type="text"
                                        className="supabase-input"
                                        value={smtpHost}
                                        onChange={(e) => setSmtpHost(e.target.value)}
                                        maxLength={100}
                                        placeholder="e.g. 45.147.47.56 or smtp.gmail.com"
                                    />
                                </div>
                                <div className="field-half">
                                    <label className="supabase-label">Port</label>
                                    <input 
                                        type="text"
                                        className="supabase-input"
                                        value={smtpPort}
                                        onChange={(e) => setSmtpPort(e.target.value)}
                                        maxLength={5}
                                        placeholder="587 / 465 / 25"
                                    />
                                </div>
                            </div>

                            <div className="field-row-split" style={{ marginTop: '16px' }}>
                                <div className="field-half">
                                    <label className="supabase-label">SMTP Username / Email</label>
                                    <input 
                                        type="text"
                                        className="supabase-input"
                                        value={smtpUser}
                                        onChange={(e) => setSmtpUser(e.target.value)}
                                        maxLength={100}
                                        placeholder="admin@kontrol-app.com"
                                    />
                                </div>
                                <div className="field-half">
                                    <label className="supabase-label">SMTP Password</label>
                                    <input 
                                        type="password"
                                        className="supabase-input"
                                        value={smtpPass}
                                        onChange={(e) => setSmtpPass(e.target.value)}
                                        maxLength={100}
                                        placeholder={hasPass ? '••••••••' : 'Password'}
                                    />
                                </div>
                            </div>

                            <div className="field-row-split" style={{ marginTop: '16px' }}>
                                <div className="field-half">
                                    <label className="supabase-label">Default Sender Name</label>
                                    <input 
                                        type="text"
                                        className="supabase-input"
                                        value={defaultSenderName}
                                        onChange={(e) => setDefaultSenderName(e.target.value)}
                                        maxLength={100}
                                        placeholder="Kontrol"
                                    />
                                </div>
                                <div className="field-half">
                                    <label className="supabase-label">Default Sender Email</label>
                                    <input 
                                        type="text"
                                        className="supabase-input"
                                        value={defaultSenderEmail}
                                        onChange={(e) => setDefaultSenderEmail(e.target.value)}
                                        maxLength={100}
                                        placeholder="noreply@kontrol-app.com"
                                    />
                                </div>
                            </div>

                            {smtpTestResult && (
                                <div className={`smtp-test-alert ${smtpTestResult.success ? 'success' : 'error'}`}>
                                    <span>{smtpTestResult.msg}</span>
                                </div>
                            )}

                            <div className="smtp-actions-footer">
                                <button 
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={handleTestSmtpConnection}
                                    disabled={testingSmtp || !smtpHost}
                                >
                                    {testingSmtp ? 'Testing connection...' : 'Test Connection'}
                                </button>

                                <button 
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={savingSmtp}
                                >
                                    {savingSmtp ? 'Saving...' : 'Save Settings'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Test Email Send Modal */}
            <Modal
                isOpen={testModalOpen}
                onClose={() => {
                    setTestModalOpen(false)
                    setTestResult(null)
                }}
                title="Test E-Postası Gönder"
                size="small"
            >
                <div className="test-email-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <p className="test-modal-desc" style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                        Hazırladığınız e-posta şablonunun gelen kutusundaki görünümünü ve SMTP teslimatını doğrulamak için bir test gönderin.
                    </p>

                    <div className="test-input-wrap">
                        <label className="supabase-label">Alıcı E-Posta Adresi:</label>
                        <CustomInput
                            type="email"
                            placeholder="yourname@gmail.com"
                            value={testTargetEmail}
                            onChange={(e) => {
                                setTestTargetEmail(e.target ? e.target.value : e)
                                if (testResult) setTestResult(null)
                            }}
                            maxLength={100}
                            autoFocus
                        />
                    </div>

                    {/* In-Modal Status / Delivery Result Card */}
                    {testResult && (
                        <div style={{
                            padding: '14px 16px',
                            borderRadius: '12px',
                            backgroundColor: testResult.success ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                            border: `1px solid ${testResult.success ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: testResult.success ? '#10b981' : '#ef4444', fontWeight: 600, fontSize: '13px' }}>
                                    {testResult.success ? <CheckCircle size={17} /> : <AlertCircle size={17} />}
                                    <span>{testResult.success ? 'Test E-Postası Başarıyla İletildi' : 'Gönderim Başarısız'}</span>
                                </div>
                                {testResult.latency && (
                                    <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                                        {testResult.latency}
                                    </span>
                                )}
                            </div>

                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
                                {testResult.success ? (
                                    <>
                                        <strong>{testResult.email}</strong> adresine test şablonu ulaştırıldı. Gelen kutunuzu (ve Spam klasörünü) kontrol edebilirsiniz.
                                    </>
                                ) : (
                                    <span>{testResult.message}</span>
                                )}
                            </div>

                            {testResult.timestamp && (
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                    <Clock size={12} />
                                    <span>İletim Zamanı: {testResult.timestamp}</span>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="modal-actions-custom" style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button 
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => {
                                setTestModalOpen(false)
                                setTestResult(null)
                            }}
                            disabled={sendingTest}
                        >
                            Kapat
                        </button>
                        <button 
                            type="button"
                            className="btn btn-primary"
                            onClick={handleSendTestEmail}
                            disabled={sendingTest || !testTargetEmail}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            {sendingTest ? (
                                <>
                                    <Loader2 size={15} className="animate-spin" />
                                    <span>Gönderiliyor...</span>
                                </>
                            ) : (
                                <>
                                    <Send size={15} />
                                    <span>{testResult?.success ? 'Tekrar Gönder' : 'Test Gönder'}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </Modal>

        </div>
    )
}
