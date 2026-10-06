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
    const [tabs, setTabs] = useState([])
    const [activeTabId, setActiveTabId] = useState(null)
    const location = useLocation()
    const navigate = useNavigate()

    // Per-tab history: { tabId: { entries: ['/path1', '/path2'], index: 0 } }
    const tabHistoryRef = useRef({})
    // Flag to prevent recording navigations triggered by our own back/forward/tab-switch
    const internalNavRef = useRef(false)

    // Initialize first tab or sync on load
    useEffect(() => {
        if (tabs.length === 0) {
            const initialPath = location.pathname + location.search
            const routeInfo = getRouteInfo(location.pathname)
            const newTab = {
                id: crypto.randomUUID(),
                path: initialPath,
                label: routeInfo.label,
                icon: routeInfo.icon
            }
            setTabs([newTab])
            setActiveTabId(newTab.id)
            tabHistoryRef.current[newTab.id] = { entries: [initialPath], index: 0 }
        }
    }, []) // Run once on mount

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

            if (activeTabId === tabId) {
                const closeIndex = prev.findIndex(t => t.id === tabId)
                const nextTab = newTabs[closeIndex - 1] || newTabs[closeIndex]

                if (nextTab) {
                    internalNavRef.current = true
                    setActiveTabId(nextTab.id)
                    navigate(nextTab.path)
                    return newTabs
                } else {
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

    // Per-tab back/forward
    const canGoBack = useCallback(() => {
        if (!activeTabId) return false
        const hist = tabHistoryRef.current[activeTabId]
        return hist ? hist.index > 0 : false
    }, [activeTabId])

    const canGoForward = useCallback(() => {
        if (!activeTabId) return false
        const hist = tabHistoryRef.current[activeTabId]
        return hist ? hist.index < hist.entries.length - 1 : false
    }, [activeTabId])

    const goBack = useCallback(() => {
        if (!activeTabId) return
        const hist = tabHistoryRef.current[activeTabId]
        if (hist && hist.index > 0) {
            hist.index--
            const path = hist.entries[hist.index]
            internalNavRef.current = true
            navigate(path)
        }
    }, [activeTabId, navigate])

    const goForward = useCallback(() => {
        if (!activeTabId) return
        const hist = tabHistoryRef.current[activeTabId]
        if (hist && hist.index < hist.entries.length - 1) {
            hist.index++
            const path = hist.entries[hist.index]
            internalNavRef.current = true
            navigate(path)
        }
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
