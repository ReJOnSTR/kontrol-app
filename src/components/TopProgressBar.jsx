import { useEffect, useState } from 'react'
import { useIsFetching, useIsMutating } from '@tanstack/react-query'
import { loadingManager } from '../utils/loadingManager'

const style = `
.top-progress-bar {
    position: fixed;
    top: 40px;
    left: var(--sidebar-width);
    right: 0;
    height: 2.5px;
    z-index: 999;
    pointer-events: none;
    transition: opacity 0.2s ease;
}

body.is-electron .top-progress-bar {
    top: 78px;
}

.sidebar-collapsed .top-progress-bar {
    left: var(--sidebar-collapsed-width);
}

@media (max-width: 768px) {
    .top-progress-bar {
        left: 0 !important;
        right: 0 !important;
        top: 56px !important;
        height: 3px !important;
        z-index: 1005 !important;
    }
}

body:has(.modal-overlay) .top-progress-bar,
body:has(.modal-center) .top-progress-bar,
body:has(.modal-drawer) .top-progress-bar,
body:has([role="dialog"]) .top-progress-bar {
    opacity: 0 !important;
    visibility: hidden !important;
    pointer-events: none !important;
}
`

let hasGlobalBar = false

export default function TopProgressBar({ loading: explicitLoading, isGlobal = false }) {
    useEffect(() => {
        if (isGlobal) {
            hasGlobalBar = true
            return () => { hasGlobalBar = false }
        }
    }, [isGlobal])

    // Forward local loading prop to global loading manager
    useEffect(() => {
        if (explicitLoading) {
            loadingManager.start()
            return () => loadingManager.stop()
        }
    }, [explicitLoading])

    const isFetching = useIsFetching()
    const isMutating = useIsMutating()
    const [managerLoading, setManagerLoading] = useState(loadingManager.isLoading())
    const [progress, setProgress] = useState(0)
    const [visible, setVisible] = useState(false)
    const [fading, setFading] = useState(false)

    useEffect(() => {
        return loadingManager.subscribe((isLoading) => {
            setManagerLoading(isLoading)
        })
    }, [])

    const active = Boolean(
        explicitLoading || 
        managerLoading || 
        isFetching > 0 || 
        isMutating > 0
    )

    useEffect(() => {
        let raf
        let timeout
        let safetyTimeout

        if (active) {
            setProgress(0)
            setVisible(true)
            setFading(false)

            let current = 0
            const tick = () => {
                if (current < 30) current += 3
                else if (current < 60) current += 1.5
                else if (current < 80) current += 0.6
                else if (current < 88) current += 0.2
                setProgress(Math.min(current, 88))
                if (current < 88) {
                    raf = requestAnimationFrame(tick)
                }
            }
            raf = requestAnimationFrame(tick)

            // Auto-safety: if an operation takes longer than 6s, complete visually so bar never hangs
            safetyTimeout = setTimeout(() => {
                setProgress(100)
                timeout = setTimeout(() => {
                    setFading(true)
                    timeout = setTimeout(() => {
                        setVisible(false)
                        setProgress(0)
                        setFading(false)
                    }, 300)
                }, 200)
            }, 6000)
        } else {
            cancelAnimationFrame(raf)
            setProgress(100)
            timeout = setTimeout(() => {
                setFading(true)
                timeout = setTimeout(() => {
                    setVisible(false)
                    setProgress(0)
                    setFading(false)
                }, 300)
            }, 200)
        }

        return () => {
            cancelAnimationFrame(raf)
            clearTimeout(timeout)
            clearTimeout(safetyTimeout)
        }
    }, [active])

    // Avoid duplicate DOM rendering if global bar is already active in MainLayout
    if (!isGlobal && hasGlobalBar) {
        return null
    }

    if (!visible) return null

    return (
        <>
            <style>{style}</style>
            <div
                className="top-progress-bar"
                style={{ opacity: fading ? 0 : 1 }}
            >
                <div
                    style={{
                        height: '100%',
                        width: `${progress}%`,
                        background: 'var(--accent-primary, #6366f1)',
                        boxShadow: '0 0 8px var(--accent-primary, #6366f1)',
                        transition: progress === 100
                            ? 'width 0.3s ease-out'
                            : 'width 0.15s linear',
                    }}
                />
            </div>
        </>
    )
}
