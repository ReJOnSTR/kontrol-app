import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getRouteInfo } from '../config/navigation'

const defaultTabContext = {
    tabs: [],
    activeTabId: null,
    openNewTab: () => {},
    addTab: () => {},
    replaceTab: () => {},
    activateTab: () => {},
    closeTab: () => {},
    closeOtherTabs: () => {},
    closeAll: () => {},
    updateTabsOrder: () => {},
    updateTabInfo: () => {},
    canGoBack: () => false,
    canGoForward: () => false,
    goBack: () => {},
    goForward: () => {}
}

const TabContext = createContext(defaultTabContext)

export function TabProvider({ children }) {
    // Tabs: [{ id: '1', path: '/vehicles', label: 'Araçlar', icon: Icon }]
    const location = useLocation()
    const navigate = useNavigate()

    // Per-tab history: { tabId: { entries: ['/path1', '/path2'], index: 0 } }
    const tabHistoryRef = useRef({})
    // Flag to prevent recording navigations triggered by our own back/forward/tab-switch
    const internalNavRef = useRef(false)

    // Synchronous initial state from sessionStorage or current location so tabs are NEVER empty on mount!
    const [tabs, setTabs] = useState(() => {
        const currentFullPath = (location?.pathname || window.location.pathname) + (location?.search || window.location.search)
        const currentRouteInfo = getRouteInfo(location?.pathname || window.location.pathname)
        try {
            const saved = sessionStorage.getItem('kontrol_open_tabs')
            if (saved) {
                const parsed = JSON.parse(saved)
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed.map(t => {
                        const info = getRouteInfo(t.path || '/')
                        return {
                            ...t,
                            label: t.label || info.label,
                            icon: info.icon
                        }
                    })
                }
            }
        } catch (_) {}

        const defaultId = 'tab-' + Math.random().toString(36).substring(2, 9)
        return [{
            id: defaultId,
            path: currentFullPath || '/portal',
            label: currentRouteInfo.label,
            icon: currentRouteInfo.icon
        }]
    })

    const [activeTabId, setActiveTabId] = useState(() => {
        try {
            const savedActive = sessionStorage.getItem('kontrol_active_tab_id')
            if (savedActive) return savedActive
        } catch (_) {}
        return tabs?.[0]?.id || null
    })

    // Keep history ref in sync with existing tabs and ensure activeTabId is valid
    useEffect(() => {
        tabs.forEach(tab => {
            if (!tabHistoryRef.current[tab.id]) {
                tabHistoryRef.current[tab.id] = { entries: [tab.path], index: 0 }
            }
        })
        if (!activeTabId && tabs.length > 0) {
            setActiveTabId(tabs[0].id)
        }
    }, [tabs, activeTabId])

    // Save tabs to sessionStorage
    useEffect(() => {
        try {
            if (tabs.length > 0) {
                const toSave = tabs.map(t => ({ id: t.id, path: t.path, label: t.label }))
                sessionStorage.setItem('kontrol_open_tabs', JSON.stringify(toSave))
                if (activeTabId) sessionStorage.setItem('kontrol_active_tab_id', activeTabId)
            }
        } catch (_) {}
    }, [tabs, activeTabId])

    // Update active tab when location changes
    useEffect(() => {
        if (!activeTabId) return

        const fullPath = location.pathname + location.search

        // Update the tab's path/label
        setTabs(prev => {
            return prev.map(tab => {
                if (tab.id === activeTabId && tab.path !== fullPath) {
                    const routeInfo = getRouteInfo(location.pathname)
                    const prevPathname = tab.path.split('?')[0]
                    const hasPathnameChanged = prevPathname !== location.pathname

                    return {
                        ...tab,
                        path: fullPath,
                        label: hasPathnameChanged ? routeInfo.label : tab.label,
                        icon: routeInfo.icon
                    }
                }
                return tab
            })
        })

        // Record in per-tab history (only for user-initiated navigations)
        if (!internalNavRef.current) {
            const hist = tabHistoryRef.current[activeTabId]
            if (hist) {
                const currentEntry = hist.entries[hist.index]
                if (currentEntry !== fullPath) {
                    // Truncate forward history and push new entry
                    const newEntries = hist.entries.slice(0, hist.index + 1)
                    newEntries.push(fullPath)
                    tabHistoryRef.current[activeTabId] = {
                        entries: newEntries,
                        index: newEntries.length - 1
                    }
                }
            }
        }
        internalNavRef.current = false
    }, [location.pathname, location.search, activeTabId])


    const openNewTab = useCallback((path, background = false, customLabel = null) => {
        const routeInfo = getRouteInfo(path)
        const newTab = {
            id: crypto.randomUUID(),
            path,
            label: customLabel || routeInfo.label,
            icon: routeInfo.icon
        }
        // Initialize per-tab history
        tabHistoryRef.current[newTab.id] = { entries: [path], index: 0 }

        setTabs(prev => [...prev, newTab])
        if (!background) {
            internalNavRef.current = true
            setActiveTabId(newTab.id)
            navigate(path)
        }
    }, [navigate])

    const activateTab = useCallback((tabId) => {
        const tab = tabs.find(t => t.id === tabId)
        if (tab) {
            internalNavRef.current = true
            setActiveTabId(tabId)
            navigate(tab.path)
        }
    }, [tabs, navigate])

    const updateTabsOrder = useCallback((newTabs) => {
        setTabs(newTabs)
    }, [])

    const updateTabInfo = useCallback((path, info) => {
        setTabs(prev => prev.map(t => {
            if (t.path === path) {
                return { ...t, ...info }
            }
            return t
        }))
    }, [])

    const closeTab = useCallback((tabId, e) => {
        if (e) e.stopPropagation()

        // Clean up per-tab history
        delete tabHistoryRef.current[tabId]

        setTabs(prev => {
            const newTabs = prev.filter(t => t.id !== tabId)

            if (newTabs.length === 0) {
                const routeInfo = getRouteInfo('/portal')
                const homeTab = {
                    id: crypto.randomUUID(),
                    path: '/portal',
                    label: routeInfo.label,
                    icon: routeInfo.icon
                }
                tabHistoryRef.current[homeTab.id] = { entries: ['/portal'], index: 0 }
                internalNavRef.current = true
                setActiveTabId(homeTab.id)
                navigate('/portal')
                return [homeTab]
            }

            if (activeTabId === tabId) {
                const closeIndex = prev.findIndex(t => t.id === tabId)
                const nextTab = newTabs[closeIndex - 1] || newTabs[closeIndex] || newTabs[0]

                if (nextTab) {
                    internalNavRef.current = true
                    setActiveTabId(nextTab.id)
                    navigate(nextTab.path)
                    return newTabs
                }
            }

            return newTabs
        })
    }, [activeTabId, navigate])

    const closeOtherTabs = useCallback((tabId) => {
        setTabs(prev => {
            // Clean up history for closed tabs
            prev.forEach(t => {
                if (t.id !== tabId) delete tabHistoryRef.current[t.id]
            })
            return prev.filter(t => t.id === tabId)
        })
        setActiveTabId(tabId)
    }, [])

    const closeAll = useCallback(() => {
        // Clean up all histories
        tabHistoryRef.current = {}

        const routeInfo = getRouteInfo('/portal')
        const homeTab = {
            id: crypto.randomUUID(),
            path: '/portal',
            label: routeInfo.label,
            icon: routeInfo.icon
        }
        tabHistoryRef.current[homeTab.id] = { entries: ['/portal'], index: 0 }
        setTabs([homeTab])
        internalNavRef.current = true
        setActiveTabId(homeTab.id)
        navigate('/portal')
    }, [navigate])

    // Per-tab back/forward with fallback
    const canGoBack = useCallback(() => {
        if (activeTabId && tabHistoryRef.current[activeTabId]?.index > 0) {
            return true
        }
        return Boolean(window.history?.state?.idx > 0)
    }, [activeTabId])

    const canGoForward = useCallback(() => {
        if (activeTabId && tabHistoryRef.current[activeTabId]) {
            const hist = tabHistoryRef.current[activeTabId]
            return hist.index < hist.entries.length - 1
        }
        return false
    }, [activeTabId])

    const goBack = useCallback(() => {
        if (activeTabId && tabHistoryRef.current[activeTabId]?.index > 0) {
            const hist = tabHistoryRef.current[activeTabId]
            hist.index--
            const path = hist.entries[hist.index]
            internalNavRef.current = true
            navigate(path)
            return
        }
        if (window.history?.state?.idx > 0) {
            navigate(-1)
        }
    }, [activeTabId, navigate])

    const goForward = useCallback(() => {
        if (activeTabId && tabHistoryRef.current[activeTabId]) {
            const hist = tabHistoryRef.current[activeTabId]
            if (hist.index < hist.entries.length - 1) {
                hist.index++
                const path = hist.entries[hist.index]
                internalNavRef.current = true
                navigate(path)
                return
            }
        }
        navigate(1)
    }, [activeTabId, navigate])

    const replaceTab = useCallback((oldPathOrId, newPath, customLabel = null) => {
        const routeInfo = getRouteInfo(newPath)
        setTabs(prev => prev.map(tab => {
            if (tab.id === oldPathOrId || tab.path === oldPathOrId || (activeTabId && tab.id === activeTabId)) {
                return {
                    ...tab,
                    path: newPath,
                    label: customLabel || routeInfo.label,
                    icon: routeInfo.icon
                }
            }
            return tab
        }))
        if (newPath) {
            internalNavRef.current = true
            navigate(newPath)
        }
    }, [activeTabId, navigate])

    return (
        <TabContext.Provider value={{
            tabs,
            activeTabId,
            openNewTab,
            addTab: openNewTab,
            replaceTab,
            activateTab,
            closeTab,
            closeOtherTabs,
            closeAll,
            updateTabsOrder,
            updateTabInfo,
            canGoBack,
            canGoForward,
            goBack,
            goForward
        }}>
            {children}
        </TabContext.Provider>
    )
}

export function useTabs() {
    const context = useContext(TabContext)
    return context || defaultTabContext
}
