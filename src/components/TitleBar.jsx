
import React from 'react'

export const isElectron = typeof window !== 'undefined' && Boolean(
    window.process?.versions?.electron ||
    (navigator.userAgent && navigator.userAgent.toLowerCase().includes('electron'))
)

export default function TitleBar() {
    // Web tarayıcısında (Chrome, Safari vb.) boş 'Kontrol' çubuğunu gizle
    if (!isElectron) {
        return null
    }

    return (
        <div 
            className="desktop-title-bar"
            style={{
                height: '38px',
                boxSizing: 'content-box',
                background: 'var(--bg-secondary)',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                WebkitAppRegion: 'drag',
                userSelect: 'none',
                color: 'var(--text-muted)',
                fontSize: '12px',
                fontWeight: 500,
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 9999
            }}
        >
            {/* Title can go here if needed, or left empty for clean look */}
            <span>Kontrol</span>
        </div>
    )
}
