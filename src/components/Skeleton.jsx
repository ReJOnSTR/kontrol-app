import './Skeleton.css'

export function Skeleton({ width = '100%', height = '20px', borderRadius = '6px', style = {} }) {
    return (
        <div
            className="skeleton-pulse"
            style={{
                width,
                height,
                borderRadius,
                background: 'var(--bg-tertiary)',
                maxWidth: '100%',
                boxSizing: 'border-box',
                ...style,
            }}
        />
    )
}

export function SkeletonCard({ height = '120px' }) {
    return (
        <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px', minWidth: 0, width: '100%', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', minWidth: 0 }}>
                <Skeleton width="80px" height="12px" />
                <Skeleton width="32px" height="32px" borderRadius="8px" />
            </div>
            <div style={{ width: '100%' }}>
                <Skeleton width="60px" height="28px" borderRadius="4px" />
                <Skeleton width="50px" height="11px" borderRadius="4px" style={{ marginTop: '6px' }} />
            </div>
        </div>
    )
}

export function SkeletonList({ rows = 4 }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', boxSizing: 'border-box' }}>
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} style={{
                    padding: '10px 12px',
                    background: 'var(--bg-tertiary)',
                    borderRadius: '6px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxSizing: 'border-box',
                    width: '100%'
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: 0 }}>
                        <Skeleton width="65%" height="13px" />
                        <Skeleton width="45%" height="11px" />
                    </div>
                    <Skeleton width="50px" height="11px" />
                </div>
            ))}
        </div>
    )
}

export function DashboardSkeleton() {
    return (
        <div className="skeleton-container">
            {/* Page Header */}
            <div className="skeleton-header">
                <div style={{ maxWidth: '100%' }}>
                    <Skeleton width="200px" height="24px" borderRadius="4px" />
                    <Skeleton width="280px" height="14px" borderRadius="4px" style={{ marginTop: '8px' }} />
                </div>
            </div>

            {/* Quick Actions */}
            <Skeleton width="100px" height="14px" borderRadius="4px" style={{ marginBottom: '15px' }} />
            <div className="skeleton-quick-actions">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} height="42px" borderRadius="8px" />
                ))}
            </div>

            {/* Stats Grid */}
            <div className="skeleton-stats-grid">
                {Array.from({ length: 4 }).map((_, i) => (
                    <SkeletonCard key={i} />
                ))}
            </div>

            {/* Content Grid */}
            <div className="skeleton-content-grid">
                <div className="card" style={{ boxSizing: 'border-box', maxWidth: '100%', overflow: 'hidden' }}>
                    <div className="card-header" style={{ marginBottom: '16px' }}>
                        <Skeleton width="180px" height="16px" />
                    </div>
                    <SkeletonList rows={5} />
                </div>
                <div className="card" style={{ boxSizing: 'border-box', maxWidth: '100%', overflow: 'hidden' }}>
                    <div className="card-header" style={{ marginBottom: '16px' }}>
                        <Skeleton width="100px" height="16px" />
                    </div>
                    <SkeletonList rows={3} />
                </div>
            </div>
        </div>
    )
}

export function TableSkeleton({ rows = 6, columns = 5, cols }) {
    const colCount = cols || columns || 5;

    return (
        <div className="skeleton-container">
            {/* Page Header */}
            <div className="skeleton-header">
                <div style={{ maxWidth: '100%' }}>
                    <Skeleton width="180px" height="24px" borderRadius="6px" />
                    <Skeleton width="240px" height="13px" borderRadius="4px" style={{ marginTop: '8px' }} />
                </div>
                <div className="skeleton-header-actions">
                    <Skeleton width="110px" height="38px" borderRadius="8px" />
                </div>
            </div>

            {/* Filter Pills / Tabs */}
            <div className="skeleton-pills-row">
                <Skeleton width="70px" height="32px" borderRadius="16px" style={{ flexShrink: 0 }} />
                <Skeleton width="85px" height="32px" borderRadius="16px" style={{ flexShrink: 0 }} />
                <Skeleton width="95px" height="32px" borderRadius="16px" style={{ flexShrink: 0 }} />
                <Skeleton width="80px" height="32px" borderRadius="16px" style={{ flexShrink: 0 }} />
            </div>

            {/* Table Control Bar */}
            <div className="skeleton-controls-bar">
                <div className="skeleton-controls-search">
                    <Skeleton width="120px" height="36px" borderRadius="8px" />
                    <Skeleton width="220px" height="36px" borderRadius="8px" />
                </div>
                <div className="skeleton-controls-actions">
                    <Skeleton width="100px" height="36px" borderRadius="8px" />
                    <Skeleton width="36px" height="36px" borderRadius="8px" />
                </div>
            </div>

            {/* DESKTOP TABLE SKELETON (Hidden on mobile) */}
            <div className="skeleton-table-desktop">
                <div className="card" style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--border-color)', boxSizing: 'border-box' }}>
                    {/* Table Header */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${colCount}, 1fr)`,
                        gap: '16px',
                        padding: '14px 20px',
                        background: 'var(--bg-tertiary)',
                        borderBottom: '1px solid var(--border-color)'
                    }}>
                        {Array.from({ length: colCount }).map((_, i) => (
                            <Skeleton key={i} width={`${60 + (i % 3) * 20}%`} height="13px" borderRadius="4px" />
                        ))}
                    </div>

                    {/* Table Rows */}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {Array.from({ length: rows }).map((_, r) => (
                            <div key={r} style={{
                                display: 'grid',
                                gridTemplateColumns: `repeat(${colCount}, 1fr)`,
                                gap: '16px',
                                padding: '16px 20px',
                                alignItems: 'center',
                                borderBottom: r < rows - 1 ? '1px solid var(--border-color)' : 'none',
                                background: r % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.01)'
                            }}>
                                {Array.from({ length: colCount }).map((_, c) => (
                                    <Skeleton
                                        key={c}
                                        width={c === 0 ? '75%' : c === colCount - 1 ? '50%' : `${55 + ((r + c) % 4) * 12}%`}
                                        height="14px"
                                        borderRadius="4px"
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* MOBILE CARD SKELETON (Visible only on mobile <= 768px) */}
            <div className="skeleton-table-mobile">
                {Array.from({ length: Math.min(rows, 4) }).map((_, r) => (
                    <div key={`m-card-${r}`} className="skeleton-mobile-card">
                        {/* Header: Title + Status Badge */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: 0 }}>
                            <Skeleton width="45%" height="16px" borderRadius="4px" />
                            <Skeleton width="64px" height="22px" borderRadius="11px" />
                        </div>
                        {/* Body details */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '4px 0', minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', minWidth: 0 }}>
                                <Skeleton width="30%" height="12px" />
                                <Skeleton width="40%" height="12px" />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', minWidth: 0 }}>
                                <Skeleton width="25%" height="12px" />
                                <Skeleton width="50%" height="12px" />
                            </div>
                        </div>
                        {/* Card Footer: Quick Actions */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: '1px solid var(--border-color)', minWidth: 0 }}>
                            <Skeleton width="35%" height="11px" />
                            <Skeleton width="48px" height="24px" borderRadius="6px" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

export function DetailSkeleton() {
    return (
        <div className="skeleton-container">
            {/* Header */}
            <div className="skeleton-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, maxWidth: '100%' }}>
                    <Skeleton width="36px" height="36px" borderRadius="8px" style={{ flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                        <Skeleton width="200px" height="24px" borderRadius="6px" />
                        <Skeleton width="150px" height="13px" borderRadius="4px" style={{ marginTop: '8px' }} />
                    </div>
                </div>
                <div className="skeleton-header-actions">
                    <Skeleton width="90px" height="36px" borderRadius="8px" />
                    <Skeleton width="110px" height="36px" borderRadius="8px" />
                </div>
            </div>

            {/* Top Stat Cards */}
            <div className="skeleton-stats-grid">
                {Array.from({ length: 4 }).map((_, i) => (
                    <SkeletonCard key={i} />
                ))}
            </div>

            {/* Main Content Layout */}
            <div className="skeleton-content-grid">
                <div className="card" style={{ padding: '20px', boxSizing: 'border-box', maxWidth: '100%', overflow: 'hidden' }}>
                    <Skeleton width="160px" height="18px" style={{ marginBottom: '16px' }} />
                    <div className="skeleton-detail-form-grid">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} style={{ minWidth: 0 }}>
                                <Skeleton width="80px" height="12px" style={{ marginBottom: '6px' }} />
                                <Skeleton width="100%" height="34px" borderRadius="6px" />
                            </div>
                        ))}
                    </div>
                </div>
                <div className="card" style={{ padding: '20px', boxSizing: 'border-box', maxWidth: '100%', overflow: 'hidden' }}>
                    <Skeleton width="120px" height="18px" style={{ marginBottom: '16px' }} />
                    <SkeletonList rows={4} />
                </div>
            </div>
        </div>
    )
}

export function PageSkeleton() {
    return (
        <div className="skeleton-page-container">
            <div className="skeleton-header">
                <div style={{ maxWidth: '100%' }}>
                    <Skeleton width="220px" height="26px" borderRadius="6px" />
                    <Skeleton width="280px" height="14px" borderRadius="4px" style={{ marginTop: '8px' }} />
                </div>
                <div className="skeleton-header-actions">
                    <Skeleton width="100px" height="38px" borderRadius="8px" />
                </div>
            </div>
            <div className="skeleton-stats-grid-3">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
            </div>
            <div className="card" style={{ padding: '20px', boxSizing: 'border-box', maxWidth: '100%', overflow: 'hidden' }}>
                <Skeleton width="150px" height="16px" style={{ marginBottom: '16px' }} />
                <SkeletonList rows={5} />
            </div>
        </div>
    )
}
