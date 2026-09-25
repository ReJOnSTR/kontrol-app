import { useEffect, useRef } from 'react'
import { useCompany } from '../context/CompanyContext'

export const useNotification = () => {
    const { currentCompany } = useCompany()

    // Use ref to track if we already noticed this session to avoid spam
    const notifiedRef = useRef(false)

    useEffect(() => {
        if (!currentCompany || notifiedRef.current) return

        const checkUpcoming = async () => {
            try {
                const upcoming = await window.electronAPI.getUpcomingEvents(currentCompany.id)
                if (!upcoming?.success || !upcoming?.data?.length) return

                const now = new Date()
                const criticalItems = []

                upcoming.data.forEach(item => {
                    // Check if category is enabled in preferences
                    const isEnabled = localStorage.getItem(`notify_${item.eventType}`) !== 'false'
                    if (!isEnabled) return

                    const eventDate = new Date(item.date)
                    const diffDays = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

                    // E-postadaki mantıkla: Vadesi geçmiş veya 3 gün kalmış kritik işlemleri bildir
                    if (diffDays <= 3) {
                        const dateStr = eventDate.toLocaleDateString('tr-TR')
                        let statusText = diffDays < 0 ? '🔴 Gecikti!' : (diffDays === 0 ? '🟠 Bugün!' : `🟡 ${diffDays} gün kaldı`)
                        let title = item.plate || item.employeeName || (item.eventType === 'finance_check' ? 'Çek/Senet' : 'İşlem')
                        
                        criticalItems.push(`${title}: ${item.type} (${statusText} - ${dateStr})`)
                    }
                })

                if (criticalItems.length > 0) {
                    const count = criticalItems.length
                    const displayBody = criticalItems.slice(0, 4).join('\n') + (count > 4 ? `\n...ve ${count - 4} acil işlem daha` : '')

                    window.electronAPI.showNotification(
                        `Kontrol: ${count} Acil İşlem Bekliyor`,
                        displayBody
                    )
                    notifiedRef.current = true
                }
            } catch (error) {
                console.error('Notification check failed:', error)
            }
        }

        // Delay slightly to let app load smoothly
        const timer = setTimeout(checkUpcoming, 3500)
        return () => clearTimeout(timer)
    }, [currentCompany])

    return null
}
