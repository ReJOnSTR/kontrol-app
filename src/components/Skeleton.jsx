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
                ...style,
            }}
        />
    )
}

export function SkeletonCard({ height = '120px' }) {
    return (
        <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                <Skeleton width="80px" height="12px" />
                <Skeleton width="32px" height="32px" borderRadius="8px" />
            </div>
            <div>
                <Skeleton width="60px" height="28px" borderRadius="4px" />
                <Skeleton width="50px" height="11px" borderRadius="4px" style={{ marginTop: '6px' }} />
            </div>
        </div>
    )
}

export function SkeletonList({ rows = 4 }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} style={{
                    padding: '10px 12px',
                    background: 'var(--bg-tertiary)',
                    borderRadius: '6px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <Skeleton width="100px" height="13px" />
                        <Skeleton width="140px" height="11px" />
                    </div>
                    <Skeleton width="60px" height="11px" />
                </div>
            ))}
        </div>
    )
}

export function DashboardSkeleton() {
    return (
        <div style={{ paddingBottom: '40px' }}>
            {/* Page Header */}
            <div className="page-header">
                <div>
                    <Skeleton width="200px" height="24px" borderRadius="4px" />
                    <Skeleton width="300px" height="14px" borderRadius="4px" style={{ marginTop: '8px' }} />
                </div>
            </div>

            {/* Quick Actions */}
            <Skeleton width="100px" height="14px" borderRadius="4px" style={{ marginBottom: '15px' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '25px' }}>
                {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} height="42px" borderRadius="8px" />
                ))}
            </div>

            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '25px' }}>
                {Array.from({ length: 4 }).map((_, i) => (
                    <SkeletonCard key={i} />
                ))}
            </div>

            {/* Content Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
                <div className="card">
                    <div className="card-header">
                        <Skeleton width="200px" height="16px" />
                    </div>
                    <SkeletonList rows={5} />
                </div>
                <div className="card">
                    <div className="card-header">
                        <Skeleton width="100px" height="16px" />
                    </div>
                    <SkeletonList rows={3} />
                </div>
            </div>
        </div>
    )
}

export function TableSkeleton({ rows = 6, columns = 5 }) {
    return (
        <div style={{ paddingBottom: '30px', animation: 'fadeIn 0.2s ease' }}>
            {/* Page Header */}
            <div className="page-header" style={{ marginBottom: '20px' }}>
                <div>
                    <Skeleton width="180px" height="24px" borderRadius="6px" />
                    <Skeleton width="260px" height="13px" borderRadius="4px" style={{ marginTop: '8px' }} />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <Skeleton width="110px" height="38px" borderRadius="8px" />
                </div>
            </div>

            {/* Filter Pills / Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
                <Skeleton width="70px" height="32px" borderRadius="16px" />
                <Skeleton width="85px" height="32px" borderRadius="16px" />
                <Skeleton width="95px" height="32px" borderRadius="16px" />
                <Skeleton width="80px" height="32px" borderRadius="16px" />
            </div>

            {/* Table Control Bar */}
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginBottom: '14px', 
                gap: '12px',
                flexWrap: 'wrap'
            }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <Skeleton width="120px" height="36px" borderRadius="8px" />
                    <Skeleton width="220px" height="36px" borderRadius="8px" />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <Skeleton width="100px" height="36px" borderRadius="8px" />
                    <Skeleton width="36px" height="36px" borderRadius="8px" />
                </div>
            </div>

            {/* Table Skeleton Card */}
            <div className="card" style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                {/* Table Header */}
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: `repeat(${columns}, 1fr)`, 
                    gap: '16px', 
                    padding: '14px 20px', 
                    background: 'var(--bg-tertiary)', 
                    borderBottom: '1px solid var(--border-color)' 
                }}>
                    {Array.from({ length: columns }).map((_, i) => (
                        <Skeleton key={i} width={`${60 + (i % 3) * 20}%`} height="13px" borderRadius="4px" />
                    ))}
                </div>

                {/* Table Rows */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {Array.from({ length: rows }).map((_, r) => (
                        <div key={r} style={{ 
                            display: 'grid', 
                            gridTemplateColumns: `repeat(${columns}, 1fr)`, 
                            gap: '16px', 
                            padding: '16px 20px', 
                            alignItems: 'center',
                            borderBottom: r < rows - 1 ? '1px solid var(--border-color)' : 'none',
                            background: r % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.01)'
                        }}>
                            {Array.from({ length: columns }).map((_, c) => (
                                <Skeleton 
                                    key={c} 
                                    width={c === 0 ? '75%' : c === columns - 1 ? '50%' : `${55 + ((r + c) % 4) * 12}%`} 
                                    height="14px" 
                                    borderRadius="4px" 
                                />
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export function DetailSkeleton() {
    return (
        <div style={{ paddingBottom: '30px', animation: 'fadeIn 0.2s ease' }}>
            {/* Header */}
            <div className="page-header" style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Skeleton width="36px" height="36px" borderRadius="8px" />
                    <div>
                        <Skeleton width="220px" height="24px" borderRadius="6px" />
                        <Skeleton width="160px" height="13px" borderRadius="4px" style={{ marginTop: '8px' }} />
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <Skeleton width="90px" height="36px" borderRadius="8px" />
                    <Skeleton width="110px" height="36px" borderRadius="8px" />
                </div>
            </div>

            {/* Top Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                {Array.from({ length: 4 }).map((_, i) => (
                    <SkeletonCard key={i} />
                ))}
            </div>

            {/* Main Content Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
                <div className="card" style={{ padding: '20px' }}>
                    <Skeleton width="160px" height="18px" style={{ marginBottom: '16px' }} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i}>
                                <Skeleton width="80px" height="12px" style={{ marginBottom: '6px' }} />
                                <Skeleton width="100%" height="34px" borderRadius="6px" />
                            </div>
                        ))}
                    </div>
                </div>
                <div className="card" style={{ padding: '20px' }}>
                    <Skeleton width="120px" height="18px" style={{ marginBottom: '16px' }} />
                    <SkeletonList rows={4} />
                </div>
            </div>
        </div>
    )
}

export function PageSkeleton() {
    return (
        <div style={{ padding: '24px', animation: 'fadeIn 0.2s ease' }}>
            <div className="page-header" style={{ marginBottom: '24px' }}>
                <div>
                    <Skeleton width="220px" height="26px" borderRadius="6px" />
                    <Skeleton width="320px" height="14px" borderRadius="4px" style={{ marginTop: '8px' }} />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <Skeleton width="100px" height="38px" borderRadius="8px" />
                </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '24px' }}>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
            </div>
            <div className="card" style={{ padding: '20px' }}>
                <Skeleton width="150px" height="16px" style={{ marginBottom: '16px' }} />
                <SkeletonList rows={5} />
            </div>
        </div>
    )
}
