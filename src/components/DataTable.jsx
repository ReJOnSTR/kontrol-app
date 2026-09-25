import { useState, useMemo, useRef, useEffect } from 'react'
import { ArrowUp, ArrowDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Check, Search, X, Trash2, Download, Archive, ArchiveRestore, LayoutList, GripVertical } from 'lucide-react'
import * as XLSX from 'xlsx'
import CustomSelect from './CustomSelect'
import CustomDatePicker from './CustomDatePicker'
import TableActionMenu from './TableActionMenu'

export default function DataTable({
    columns,
    data,
    actions,
    emptyMessage = 'Kayıt bulunamadı',
    showRowNumbers = false,
    showCheckboxes = true,
    showSearch = true,
    showDateFilter = false,
    dateFilterKey = 'date',
    filters = [],
    onRowClick = null,
    onSelectionChange = null,
    onBulkDelete = null,
    onBulkArchive = null,
    customBulkActions = null,
    isArchiveView = false,
    onToggleArchiveView = null,
    onContextMenu = null,
    enableExport = false,
    exportFileName = 'Liste',
    initialSort = null,
    persistenceKey = null,
    rowClassName = null,
    onFilteredDataChange = null,
    searchKeys = null
}) {
    // Helper to get initial state from localStorage or default
    const getInitialState = (key, defaultVal) => {
        if (!persistenceKey) return defaultVal
        try {
            const saved = localStorage.getItem(`${persistenceKey}_${key}`)
            return saved ? JSON.parse(saved) : defaultVal
        } catch (e) {
            console.error('Error parsing saved state', e)
            return defaultVal
        }
    }

    const [isTransitioning, setIsTransitioning] = useState(false)
    const prevDataRef = useRef(data)
    const tableContainerRef = useRef(null)

    useEffect(() => {
        if (data !== prevDataRef.current) {
            setIsTransitioning(true)
            const timer = setTimeout(() => setIsTransitioning(false), 250)
            prevDataRef.current = data
            return () => clearTimeout(timer)
        }
    }, [data])

    const [sortConfig, setSortConfig] = useState(() => {
        const saved = getInitialState('sort', null)
        // If there is a valid saved sorting state (key is not null), respect it.
        // Otherwise, prioritize the `initialSort` prop over an empty cache.
        if (saved && saved.key !== null) return saved
        return initialSort || { key: null, direction: 'asc' }
    })
    const [userSorted, setUserSorted] = useState(false)
    const [currentPage, setCurrentPage] = useState(() => getInitialState('page', 1))
    const [pageSize, setPageSize] = useState(() => getInitialState('pageSize', 10))
    const [selectedRows, setSelectedRows] = useState(new Set())
    const [searchQuery, setSearchQuery] = useState(() => getInitialState('search', ''))
    const [activeFilters, setActiveFilters] = useState(() => getInitialState('filters', {}))
    const [dateRange, setDateRange] = useState(() => getInitialState('dateRange', { start: '', end: '' }))
    const [focusedIndex, setFocusedIndex] = useState(-1)
    const [lastSelectedIndex, setLastSelectedIndex] = useState(-1)
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery)

    // Debounce search query
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery)
        }, 300)
        return () => clearTimeout(timer)
    }, [searchQuery])

    useEffect(() => {
        if (focusedIndex !== -1 && tableContainerRef.current) {
            const focusedRow = tableContainerRef.current.querySelector('.focused')
            if (focusedRow) {
                focusedRow.scrollIntoView({ block: 'nearest', behavior: 'auto' })
            }
        }
    }, [focusedIndex])

    // Column Visibility State
    const [visibleColumns, setVisibleColumns] = useState(() => {
        const defaultVisible = new Set(columns.map(col => col.key))
        const saved = getInitialState('visibleCols', null)
        if (saved) {
            const savedColOrder = getInitialState('colOrder', [])
            const knownKeys = new Set(savedColOrder)
            const merged = new Set(saved)
            columns.forEach(col => {
                if (!knownKeys.has(col.key)) {
                    merged.add(col.key)
                }
            })
            return merged
        }
        return defaultVisible
    })

    // Column Resizing State
    const [columnWidths, setColumnWidths] = useState(() => getInitialState('colWidths', {}))
    const resizingRef = useRef(null) // { key, startX, startWidth }

    // Column Ordering State
    const [columnOrder, setColumnOrder] = useState(() => {
        const defaultOrder = columns.map(col => col.key)
        const saved = getInitialState('colOrder', null)
        if (saved) {
            const savedKeys = new Set(saved)
            const newCols = defaultOrder.filter(k => !savedKeys.has(k))
            return [...saved, ...newCols]
        }
        return defaultOrder
    })
    const [draggedColumn, setDraggedColumn] = useState(null)

    // Save column order
    useEffect(() => {
        if (!persistenceKey) return
        localStorage.setItem(`${persistenceKey}_colOrder`, JSON.stringify(columnOrder))
    }, [columnOrder, persistenceKey])

    // Ensure new columns are added to order
    useEffect(() => {
        const currentKeys = new Set(columnOrder)
        const newCols = columns.filter(col => !currentKeys.has(col.key)).map(col => col.key)
        if (newCols.length > 0) {
            setColumnOrder(prev => [...prev, ...newCols])
        }
    }, [columns])

    // Sort original columns by columnOrder
    const orderedColumns = useMemo(() => {
        const orderMap = new Map(columnOrder.map((key, index) => [key, index]))
        return [...columns].sort((a, b) => {
            const indexA = orderMap.has(a.key) ? orderMap.get(a.key) : 999
            const indexB = orderMap.has(b.key) ? orderMap.get(b.key) : 999
            return indexA - indexB
        })
    }, [columns, columnOrder])

    // Ensure new columns are visible by default if not in saved state
    // But we need to handle Set vs Array conversion from localStorage
    useEffect(() => {
        // If we have saved state, loaded as array, convert to Set
        if (Array.isArray(visibleColumns)) {
            setVisibleColumns(new Set(visibleColumns))
        }
    }, [])

    const [showColumnMenu, setShowColumnMenu] = useState(false)
    const [dropdownPosition, setDropdownPosition] = useState('bottom')
    const [hoveredColumn, setHoveredColumn] = useState(null)
    const columnMenuRef = useRef(null)

    // Save column visibility
    useEffect(() => {
        if (!persistenceKey) return
        // Save as array
        localStorage.setItem(`${persistenceKey}_visibleCols`, JSON.stringify(Array.from(visibleColumns)))
    }, [visibleColumns, persistenceKey])

    // Handle outside click for column menu
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (columnMenuRef.current && !columnMenuRef.current.contains(event.target)) {
                setShowColumnMenu(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const toggleColumn = (key) => {
        setVisibleColumns(prev => {
            const newSet = new Set(prev)
            if (newSet.has(key)) {
                newSet.delete(key)
            } else {
                newSet.add(key)
            }
            return newSet
        })
    }

    // Initialize column widths (merged with saved)
    useEffect(() => {
        const initialWidths = {}
        columns.forEach(col => {
            // Priority: Saved > Prop > Default
            if (col.width && typeof col.width === 'string' && col.width.endsWith('px')) {
                initialWidths[col.key] = parseInt(col.width)
            } else if (typeof col.width === 'number') {
                initialWidths[col.key] = col.width
            } else if (col.minWidth && typeof col.minWidth === 'string' && col.minWidth.endsWith('px')) {
                initialWidths[col.key] = parseInt(col.minWidth)
            } else {
                initialWidths[col.key] = 150
            }
        })
        // Merge: Saved values take precedence, but if a saved value is smaller than col.minWidth or col.width, upgrade it
        setColumnWidths(prev => {
            const merged = { ...initialWidths, ...prev }
            columns.forEach(col => {
                const minW = col.minWidth ? parseInt(col.minWidth) : (col.width ? parseInt(col.width) : null)
                if (minW && (!merged[col.key] || merged[col.key] < minW)) {
                    merged[col.key] = minW
                }
            })
            return merged
        })
    }, [columns])

    // Save column widths when they change
    useEffect(() => {
        if (!persistenceKey || Object.keys(columnWidths).length === 0) return
        localStorage.setItem(`${persistenceKey}_colWidths`, JSON.stringify(columnWidths))
    }, [columnWidths, persistenceKey])

    // Save other states
    useEffect(() => {
        if (!persistenceKey) return
        localStorage.setItem(`${persistenceKey}_sort`, JSON.stringify(sortConfig))
        localStorage.setItem(`${persistenceKey}_page`, JSON.stringify(currentPage))
        localStorage.setItem(`${persistenceKey}_pageSize`, JSON.stringify(pageSize))
        localStorage.setItem(`${persistenceKey}_search`, JSON.stringify(searchQuery))
        localStorage.setItem(`${persistenceKey}_filters`, JSON.stringify(activeFilters))
        localStorage.setItem(`${persistenceKey}_dateRange`, JSON.stringify(dateRange))
    }, [sortConfig, currentPage, pageSize, searchQuery, activeFilters, dateRange, persistenceKey])

    // Reload states when persistenceKey changes (e.g. tab switch)
    useEffect(() => {
        if (!persistenceKey) return
        
        const loadState = (key, defaultVal) => {
            try {
                const saved = localStorage.getItem(`${persistenceKey}_${key}`)
                return saved ? JSON.parse(saved) : defaultVal
            } catch (e) {
                return defaultVal
            }
        }

        const savedSort = loadState('sort', null)
        setSortConfig(savedSort && savedSort.key !== null ? savedSort : (initialSort || { key: null, direction: 'asc' }))
        setCurrentPage(loadState('page', 1))
        setPageSize(loadState('pageSize', 10))
        setSearchQuery(loadState('search', ''))
        setActiveFilters(loadState('filters', {}))
        setDateRange(loadState('dateRange', { start: '', end: '' }))
        
        const savedColOrder = loadState('colOrder', null)
        const defaultOrder = columns.map(col => col.key)
        let mergedOrder = defaultOrder
        if (savedColOrder) {
            const savedKeys = new Set(savedColOrder)
            const newCols = defaultOrder.filter(k => !savedKeys.has(k))
            mergedOrder = [...savedColOrder, ...newCols]
            setColumnOrder(mergedOrder)
        } else {
            setColumnOrder(defaultOrder)
        }
        
        const savedVisible = loadState('visibleCols', null)
        if (savedVisible) {
            const savedKeys = new Set(savedColOrder || [])
            const newVisibleCols = defaultOrder.filter(k => !savedKeys.has(k))
            setVisibleColumns(new Set([...savedVisible, ...newVisibleCols]))
        } else {
            setVisibleColumns(new Set(defaultOrder))
        }
        
        const savedWidths = loadState('colWidths', null)
        if (savedWidths) setColumnWidths(prev => ({ ...prev, ...savedWidths }))

    }, [persistenceKey])

    const visibleColumnsList = useMemo(() => {
        // Always show columns in 'visibleColumns' set
        // But map over ordered 'columns' array to preserve customized order
        // If visibleColumns is an Array (initial render quirk), handle it
        const visibilitySet = visibleColumns instanceof Set ? visibleColumns : new Set(visibleColumns)
        return orderedColumns.filter(col => visibilitySet.has(col.key))
    }, [orderedColumns, visibleColumns])

    // Column Ordering Methods
    const moveColumnUp = (colKey) => {
        setColumnOrder(prevOrder => {
            const index = prevOrder.indexOf(colKey)
            if (index <= 0) return prevOrder

            const newOrder = [...prevOrder]
            newOrder[index] = newOrder[index - 1]
            newOrder[index - 1] = colKey
            return newOrder
        })
    }

    const moveColumnDown = (colKey) => {
        setColumnOrder(prevOrder => {
            const index = prevOrder.indexOf(colKey)
            if (index === -1 || index === prevOrder.length - 1) return prevOrder

            const newOrder = [...prevOrder]
            newOrder[index] = newOrder[index + 1]
            newOrder[index + 1] = colKey
            return newOrder
        })
    }

    // Resize Handlers
    const handleResizeStart = (e, key) => {
        e.preventDefault()
        e.stopPropagation()
        const startWidth = columnWidths[key] || 150
        resizingRef.current = { key, startX: e.clientX, startWidth }

        document.addEventListener('mousemove', handleResizeMove)
        document.addEventListener('mouseup', handleResizeEnd)
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'
    }

    const handleResizeMove = (e) => {
        if (!resizingRef.current) return
        const { key, startX, startWidth } = resizingRef.current
        const diff = e.clientX - startX
        const newWidth = Math.max(50, startWidth + diff) // Min width 50px

        setColumnWidths(prev => ({
            ...prev,
            [key]: newWidth
        }))
    }

    const handleResizeEnd = () => {
        resizingRef.current = null
        document.removeEventListener('mousemove', handleResizeMove)
        document.removeEventListener('mouseup', handleResizeEnd)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
    }

    // Filter by custom filters
    const customFilteredData = useMemo(() => {
        if (!data) return []

        return data.filter(row => {
            // Check dropdown filters
            for (const [key, value] of Object.entries(activeFilters)) {
                if (value) {
                    const filterDef = filters?.find(f => f.key === key)
                    if (filterDef && filterDef.filterFn) {
                        if (!filterDef.filterFn(row, value)) return false
                    } else if (row[key] !== value) {
                        return false
                    }
                }
            }

            // Check date range
            if (showDateFilter && (dateRange.start || dateRange.end)) {
                const rawDate = row[dateFilterKey]
                if (rawDate) {
                    // Normalize to YYYY-MM-DD for comparison (input type="date" gives YYYY-MM-DD)
                    const d = new Date(rawDate)
                    const rowDateStr = isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0]
                    if (!rowDateStr) return false
                    if (dateRange.start && rowDateStr < dateRange.start) return false
                    if (dateRange.end && rowDateStr > dateRange.end) return false
                }
            }

            return true
        })
    }, [data, activeFilters, dateRange, showDateFilter, dateFilterKey])

    // Helper to normalize Turkish text for search comparison
    const normalizeSearchString = (str) => {
        if (!str) return ''
        return String(str)
            .toLocaleLowerCase('tr-TR')
            .replace(/ı/g, 'i')
            .replace(/ğ/g, 'g')
            .replace(/ü/g, 'u')
            .replace(/ş/g, 's')
            .replace(/ö/g, 'o')
            .replace(/ç/g, 'c')
            .replace(/\s/g, '')
    }

    // Filter by search
    const filteredData = useMemo(() => {
        if (!debouncedSearchQuery.trim()) return customFilteredData

        const queryRaw = debouncedSearchQuery.toLocaleLowerCase('tr-TR').replace(/\s/g, '')
        const queryNorm = normalizeSearchString(debouncedSearchQuery)
        
        return customFilteredData.filter(row => {
            // Collect all searchable content for this row
            const searchValues = []
            
            // 1. Add explicitly provided search keys
            if (searchKeys && searchKeys.length > 0) {
                searchKeys.forEach(key => {
                    const val = row[key]
                    if (val !== null && val !== undefined) searchValues.push(String(val))
                })
            }

            // 2. Add visible column content
            visibleColumnsList.forEach(col => {
                let val = ''
                if (col.searchValue) {
                    val = col.searchValue(row)
                } else {
                    val = row[col.key]
                }
                if (val !== null && val !== undefined) searchValues.push(String(val))
            })

            // 3. Fallback: Include common descriptive fields (machine/personnel/customer)
            const commonKeys = [
                'plate', 'custom_vehicle', 'vehicle_name', 'brand', 'model',
                'employee_name', 'employee_surname', 'employee_full_name', 'custom_employee',
                'first_name', 'last_name', 'full_name',
                'customer_name', 'customer', 'receipt_no', 'title', 'description'
            ]
            commonKeys.forEach(key => {
                const val = row[key]
                if (val !== null && val !== undefined) {
                    searchValues.push(String(val))
                }
            })

            // Join all and check both exact Turkish lowercase & character-normalized match
            const joinedText = searchValues.join(' ')
            const rowRaw = joinedText.toLocaleLowerCase('tr-TR').replace(/\s/g, '')
            const rowNorm = normalizeSearchString(joinedText)

            return rowRaw.includes(queryRaw) || rowNorm.includes(queryNorm)
        })
    }, [customFilteredData, debouncedSearchQuery, visibleColumnsList, searchKeys])

    // Expose filtered data to parent
    useEffect(() => {
        if (onFilteredDataChange) {
            onFilteredDataChange(filteredData)
        }
    }, [filteredData, onFilteredDataChange])

    // Sort data
    const sortedData = useMemo(() => {
        if (!filteredData || !sortConfig.key) return filteredData || []

        return [...filteredData].sort((a, b) => {
            const aVal = a[sortConfig.key]
            const bVal = b[sortConfig.key]

            if (aVal === null || aVal === undefined) return 1
            if (bVal === null || bVal === undefined) return -1

            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal
            }

            // Date Handling
            const isDateString = (val) => typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)
            const isDateObj = (val) => val instanceof Date

            if ((isDateString(aVal) || isDateObj(aVal)) && (isDateString(bVal) || isDateObj(bVal))) {
                const dateA = new Date(aVal)
                const dateB = new Date(bVal)
                if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
                    return sortConfig.direction === 'asc'
                        ? dateA.getTime() - dateB.getTime()
                        : dateB.getTime() - dateA.getTime()
                }
            }

            const collator = new Intl.Collator('tr', { 
                sensitivity: 'variant', 
                numeric: true,
                caseFirst: 'upper'
            })
            
            return sortConfig.direction === 'asc'
                ? collator.compare(String(aVal), String(bVal))
                : collator.compare(String(bVal), String(aVal))
        })
    }, [filteredData, sortConfig])

    // Paginate
    const totalPages = Math.ceil((sortedData?.length || 0) / pageSize)
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * pageSize
        return sortedData.slice(start, start + pageSize)
    }, [sortedData, currentPage, pageSize])

    useMemo(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(1)
        }
    }, [filteredData, totalPages])

    // Calculate total table width for explicit resizing support
    const totalTableWidth = useMemo(() => {
        let total = 0
        if (showCheckboxes) total += 50 // Checkbox col width approx
        if (showRowNumbers) total += 50 // Number col width approx

        visibleColumnsList.forEach(col => {
            const width = columnWidths[col.key] || (col.width ? parseInt(col.width) : 150)
            total += width
        })

        if (actions || onRowClick) total += 60 // Actions column width approx
        return total
    }, [visibleColumnsList, columnWidths, showCheckboxes, showRowNumbers, actions, onRowClick])


    const handleSort = (key) => {
        // Case 1: New column -> Start with ASC
        if (sortConfig.key !== key) {
            setUserSorted(true)
            setSortConfig({ key, direction: 'asc' })
            return
        }

        // Case 2: Same column, currently Default (Hidden) -> Explicit ASC
        if (!userSorted) {
            setUserSorted(true)
            setSortConfig({ key, direction: 'asc' })
            return
        }

        // Case 3: Same column, currently Explicit ASC -> Explicit DESC
        if (sortConfig.direction === 'asc') {
            setSortConfig({ key, direction: 'desc' })
            return
        }

        // Case 4: Same column, currently Explicit DESC -> Default (Hidden)
        setUserSorted(false)
        setSortConfig(initialSort || { key: null, direction: 'asc' })
    }

    const handleSelectRow = (e, id, index) => {
        e.stopPropagation()
        
        const newSet = new Set(selectedRows)
        
        // Handle Shift+Click for range selection
        if (e.shiftKey && lastSelectedIndex !== -1 && index !== undefined) {
            const start = Math.min(lastSelectedIndex, index)
            const end = Math.max(lastSelectedIndex, index)
            
            for (let i = start; i <= end; i++) {
                const rowId = paginatedData[i]?.id
                if (rowId !== undefined) newSet.add(rowId)
            }
        } else {
            if (newSet.has(id)) {
                newSet.delete(id)
            } else {
                newSet.add(id)
            }
        }
        
        setSelectedRows(newSet)
        onSelectionChange?.(Array.from(newSet))
        
        if (index !== undefined) {
            setLastSelectedIndex(index)
            setFocusedIndex(index)
        }
    }

    const handleKeyDown = (e) => {
        if (!paginatedData.length) return

        if (e.key === 'ArrowDown') {
            e.preventDefault()
            const nextIndex = Math.min(focusedIndex + 1, paginatedData.length - 1)
            setFocusedIndex(nextIndex)
            
            if (e.shiftKey) {
                const rowId = paginatedData[nextIndex].id
                const newSet = new Set(selectedRows)
                newSet.add(rowId)
                setSelectedRows(newSet)
                onSelectionChange?.(Array.from(newSet))
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            const prevIndex = Math.max(focusedIndex - 1, 0)
            setFocusedIndex(prevIndex)
            
            if (e.shiftKey) {
                const rowId = paginatedData[prevIndex].id
                const newSet = new Set(selectedRows)
                newSet.add(rowId)
                setSelectedRows(newSet)
                onSelectionChange?.(Array.from(newSet))
            }
        } else if (e.key === ' ') {
            e.preventDefault()
            if (focusedIndex >= 0 && focusedIndex < paginatedData.length) {
                const rowId = paginatedData[focusedIndex].id
                handleSelectRow(e, rowId, focusedIndex)
            }
        }
    }

    const handleSelectAll = () => {
        if (selectedRows.size === paginatedData.length) {
            setSelectedRows(new Set())
            onSelectionChange?.([])
        } else {
            const allIds = new Set(paginatedData.map(row => row.id))
            setSelectedRows(allIds)
            onSelectionChange?.(Array.from(allIds))
        }
    }

    const clearSelection = () => {
        setSelectedRows(new Set())
        onSelectionChange?.([])
    }

    const handleBulkDeleteClick = () => {
        if (onBulkDelete && selectedRows.size > 0) {
            onBulkDelete(Array.from(selectedRows))
            clearSelection()
        }
    }

    const handleExcelExport = () => {
        // Determine which data to export: Selected rows or All filtered rows
        let dataToExport = sortedData
        if (selectedRows.size > 0) {
            dataToExport = sortedData.filter(row => selectedRows.has(row.id))
        }

        if (!dataToExport || dataToExport.length === 0) return

        const exportData = dataToExport.map(row => {
            const rowData = {}
            visibleColumnsList.forEach(col => {
                rowData[col.label] = row[col.key] || ''
            })
            return rowData
        })

        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.json_to_sheet(exportData)
        XLSX.utils.book_append_sheet(wb, ws, 'Liste')
        XLSX.writeFile(wb, `${exportFileName}_${new Date().toLocaleDateString('tr-TR').replace(/\./g, '-')}.xlsx`)
    }

    const handleFilterChange = (key, value) => {
        setActiveFilters(prev => ({
            ...prev,
            [key]: value || undefined
        }))
        setCurrentPage(1)
    }

    const handleDateChange = (start, end) => {
        setDateRange({ start, end })
        setCurrentPage(1)
    }

    const clearFilters = () => {
        setActiveFilters({})
        setSearchQuery('')
        setDateRange({ start: '', end: '' })
        setCurrentPage(1)
    }

    const hasActiveFilters = Object.values(activeFilters).some(v => v) || searchQuery || dateRange.start || dateRange.end

    const handleRowClick = (row, e, index) => {
        setFocusedIndex(index)
        setLastSelectedIndex(index)
        if (onRowClick) {
            onRowClick(row, e)
        }
    }

    const isAllSelected = paginatedData.length > 0 && selectedRows.size === paginatedData.length
    const isSomeSelected = selectedRows.size > 0 && selectedRows.size < paginatedData.length

    const startRecord = sortedData.length > 0 ? (currentPage - 1) * pageSize + 1 : 0
    const endRecord = Math.min(currentPage * pageSize, sortedData?.length || 0)

    const pageSizeOptions = [
        { value: 10, label: '10' },
        { value: 25, label: '25' },
        { value: 50, label: '50' }
    ]

    return (
        <div className="table-wrapper">
            {/* Toolbar */}
            <div className="table-toolbar">
                <div className="toolbar-left">
                    {onToggleArchiveView && (
                        <div className="view-toggle" style={{
                            display: 'flex',
                            background: 'var(--bg-secondary)',
                            padding: '4px',
                            borderRadius: '10px',
                            marginRight: '12px',
                            border: '1px solid var(--border-color)',
                            position: 'relative',
                            width: '180px', // Fixed width for smooth sliding
                            height: '36px',
                            alignItems: 'center'
                        }}>
                            {/* Sliding Pill Background */}
                            <div style={{
                                position: 'absolute',
                                left: '4px',
                                top: '4px',
                                bottom: '4px',
                                width: 'calc(50% - 4px)',
                                background: 'var(--bg-elevated)',
                                borderRadius: '8px',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                transition: 'transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)',
                                transform: isArchiveView ? 'translateX(100%)' : 'translateX(0%)',
                                zIndex: 1
                            }} />

                            <button
                                style={{
                                    flex: 1,
                                    position: 'relative',
                                    zIndex: 2,
                                    border: 'none',
                                    background: 'transparent',
                                    color: !isArchiveView ? 'var(--text-primary)' : 'var(--text-muted)',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    transition: 'color 0.2s',
                                    height: '100%'
                                }}
                                onClick={() => onToggleArchiveView(false)}
                            >
                                <LayoutList size={15} style={{ opacity: !isArchiveView ? 1 : 0.7 }} />
                                Aktif
                            </button>
                            <button
                                style={{
                                    flex: 1,
                                    position: 'relative',
                                    zIndex: 2,
                                    border: 'none',
                                    background: 'transparent',
                                    color: isArchiveView ? 'var(--text-primary)' : 'var(--text-muted)',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    transition: 'color 0.2s',
                                    height: '100%'
                                }}
                                onClick={() => onToggleArchiveView(true)}
                            >
                                <Archive size={15} style={{ opacity: isArchiveView ? 1 : 0.7 }} />
                                Arşiv
                            </button>
                        </div>
                    )}
                    {/* Search */}
                    {showSearch && (
                        <div className="search-box">
                            <Search size={16} />
                            <input
                                type="text"
                                placeholder="Ara..."
                                value={searchQuery}
                                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
                            />
                            {searchQuery && (
                                <button className="search-clear" onClick={() => setSearchQuery('')}>
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    )}

                    {/* Filters */}
                    {filters.length > 0 && (
                        <div className="filter-group">
                            {filters.map(filter => (
                                <CustomSelect
                                    key={filter.key}
                                    label=""
                                    value={activeFilters[filter.key] || ''}
                                    onChange={(value) => handleFilterChange(filter.key, value)}
                                    options={filter.options}
                                    placeholder={filter.label}
                                    className="filter-select-custom"
                                    floatingLabel={false}
                                />
                            ))}
                        </div>
                    )}

                    {/* Date Range */}
                    {showDateFilter && (
                        <CustomDatePicker
                            startDate={dateRange.start}
                            endDate={dateRange.end}
                            onChange={handleDateChange}
                        />
                    )}

                    {hasActiveFilters && (
                        <button className="filter-clear" onClick={clearFilters}>
                            <X size={14} />
                            Temizle
                        </button>
                    )}

                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                        {/* Column Toggle */}
                        <div style={{ position: 'relative' }} ref={columnMenuRef}>
                            <button
                                className={`filter-clear ${showColumnMenu ? 'active' : ''}`}
                                style={{
                                    borderColor: showColumnMenu ? 'var(--accent-primary)' : undefined,
                                    background: showColumnMenu ? 'var(--bg-tertiary)' : undefined,
                                    color: showColumnMenu ? 'var(--text-primary)' : undefined
                                }}
                                onClick={(e) => {
                                    if (!showColumnMenu) {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const spaceBelow = window.innerHeight - rect.bottom;
                                        if (spaceBelow < 300 && rect.top > 300) {
                                            setDropdownPosition('top');
                                        } else {
                                            setDropdownPosition('bottom');
                                        }
                                    }
                                    setShowColumnMenu(!showColumnMenu)
                                }}
                                title="Sütunları Düzenle"
                            >
                                <Check size={13} style={{ color: 'var(--accent-primary)' }} />
                                Sütunlar
                            </button>
                            {showColumnMenu && (
                                <div 
                                    className={`custom-select-dropdown placement-${dropdownPosition}`}
                                    style={{
                                        position: 'absolute',
                                        top: dropdownPosition === 'bottom' ? 'calc(100% + 4px)' : 'auto',
                                        bottom: dropdownPosition === 'top' ? 'calc(100% + 4px)' : 'auto',
                                        right: 0,
                                        left: 'auto',
                                        width: '210px',
                                        padding: '4px',
                                        maxHeight: '280px',
                                        zIndex: 1000
                                    }}
                                >
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '6px 8px',
                                        borderBottom: '1px solid var(--border-color)',
                                        marginBottom: '4px'
                                    }}>
                                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            Sütunlar
                                        </span>
                                        <span style={{ fontSize: '11px', color: 'var(--accent-primary)', fontWeight: 600, fontFamily: 'var(--font-mono, monospace)' }}>
                                            {orderedColumns.filter(c => visibleColumns instanceof Set ? visibleColumns.has(c.key) : new Set(visibleColumns).has(c.key)).length}/{orderedColumns.length}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', maxHeight: '230px', overflowY: 'auto' }}>
                                        {orderedColumns.map((col, index) => {
                                            const isVisible = visibleColumns instanceof Set ? visibleColumns.has(col.key) : new Set(visibleColumns).has(col.key);
                                            return (
                                                <div
                                                    key={col.key}
                                                    className="custom-select-option"
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        gap: '6px',
                                                        padding: '6px 8px',
                                                        borderRadius: '6px',
                                                        cursor: 'pointer'
                                                    }}
                                                    onMouseEnter={() => setHoveredColumn(col.key)}
                                                    onMouseLeave={() => setHoveredColumn(null)}
                                                    onClick={() => toggleColumn(col.key)}
                                                >
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flex: 1, margin: 0, userSelect: 'none', minWidth: 0 }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={isVisible}
                                                            onChange={() => {}} // Handled by row onClick
                                                            style={{ accentColor: 'var(--accent-primary)', width: '13px', height: '13px', cursor: 'pointer', margin: 0, flexShrink: 0 }}
                                                        />
                                                        <span style={{
                                                            color: isVisible ? 'var(--text-primary)' : 'var(--text-muted)',
                                                            fontWeight: isVisible ? 500 : 400,
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                            fontSize: '12px'
                                                        }}>
                                                            {col.label}
                                                        </span>
                                                    </label>

                                                    <div style={{
                                                        display: 'flex',
                                                        gap: '2px',
                                                        opacity: hoveredColumn === col.key ? 1 : 0,
                                                        pointerEvents: hoveredColumn === col.key ? 'auto' : 'none',
                                                        transition: 'opacity 0.12s',
                                                        alignItems: 'center'
                                                    }}>
                                                        <button
                                                            type="button"
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                width: '18px',
                                                                height: '18px',
                                                                padding: 0,
                                                                border: 'none',
                                                                background: 'transparent',
                                                                borderRadius: '3px',
                                                                color: 'var(--text-muted)',
                                                                opacity: index === 0 ? 0.2 : 0.8,
                                                                cursor: index === 0 ? 'default' : 'pointer'
                                                            }}
                                                            onClick={(e) => { e.stopPropagation(); moveColumnUp(col.key); }}
                                                            disabled={index === 0}
                                                            title="Yukarı Taşı"
                                                        >
                                                            <ArrowUp size={11} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                width: '18px',
                                                                height: '18px',
                                                                padding: 0,
                                                                border: 'none',
                                                                background: 'transparent',
                                                                borderRadius: '3px',
                                                                color: 'var(--text-muted)',
                                                                opacity: index === orderedColumns.length - 1 ? 0.2 : 0.8,
                                                                cursor: index === orderedColumns.length - 1 ? 'default' : 'pointer'
                                                            }}
                                                            onClick={(e) => { e.stopPropagation(); moveColumnDown(col.key); }}
                                                            disabled={index === orderedColumns.length - 1}
                                                            title="Aşağı Taşı"
                                                        >
                                                            <ArrowDown size={11} />
                                                        </button>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {enableExport && (
                            <button className="filter-clear" onClick={handleExcelExport} title="Excel'e Aktar">
                                <Download size={14} />
                                Excel
                            </button>
                        )}
                    </div>
                </div>

                <div className="toolbar-right">
                    <span className="record-info">
                        {sortedData.length} kayıt
                    </span>
                </div>
            </div>

            {/* Bulk Selection Overlay */}
            {selectedRows.size > 0 && (
                <div className="bulk-selection-overlay">
                    <span className="bulk-count">{selectedRows.size} öğe seçili</span>
                    <div className="bulk-divider" />
                    <div className="bulk-actions">
                        {onBulkDelete && (
                            <button className="btn-bulk-action danger" onClick={handleBulkDeleteClick}>
                                <Trash2 size={15} />
                                Sil
                            </button>
                        )}
                        {onBulkArchive && (
                            <button className="btn-bulk-action secondary" onClick={() => { onBulkArchive(Array.from(selectedRows)); clearSelection() }}>
                                {isArchiveView ? <ArchiveRestore size={15} /> : <Archive size={15} />}
                                {isArchiveView ? 'Geri Al' : 'Arşivle'}
                            </button>
                        )}
                        {customBulkActions && customBulkActions(Array.from(selectedRows), clearSelection)}

                        <button className="btn-bulk-action secondary" onClick={clearSelection}>
                            <X size={15} />
                            Vazgeç
                        </button>
                    </div>
                </div>
            )}


            {/* Table */}
            <div 
                ref={tableContainerRef}
                className={`table-container ${isTransitioning ? 'data-transitioning' : ''}`}
                onKeyDown={handleKeyDown}
                tabIndex="0"
                style={{ outline: 'none' }}
            >
                <table
                    className="data-table"
                    style={{
                        width: totalTableWidth ? `${totalTableWidth}px` : '100%',
                        minWidth: '100%'
                    }}
                >
                    <thead>
                        <tr>
                            {showCheckboxes && (
                                <th className="th-checkbox">
                                    <div
                                        className={`checkbox ${isAllSelected ? 'checked' : ''} ${isSomeSelected ? 'indeterminate' : ''}`}
                                        onClick={handleSelectAll}
                                    >
                                        {isAllSelected && <Check size={12} />}
                                        {isSomeSelected && <div className="indeterminate-line" />}
                                    </div>
                                </th>
                            )}
                            {showRowNumbers && <th className="th-num">#</th>}
                            {visibleColumnsList.map((col) => {
                                const minW = col.minWidth ? parseInt(col.minWidth) : (col.width ? parseInt(col.width) : null)
                                const rawW = columnWidths[col.key] ? columnWidths[col.key] : (col.width ? parseInt(col.width) : 150)
                                const finalW = minW ? Math.max(rawW, minW) : rawW
                                return (
                                <th
                                    key={col.key}
                                    style={{
                                        // Use state width if available, otherwise prop or default
                                        width: `${finalW}px`,
                                        minWidth: col.minWidth || (col.width ? col.width : undefined),
                                        maxWidth: col.maxWidth || undefined,
                                        textAlign: col.align || 'left',
                                        cursor: col.sortable !== false ? 'pointer' : 'default',
                                        userSelect: 'none'
                                    }}
                                    onClick={() => col.sortable !== false && handleSort(col.key)}
                                    className={col.sortable !== false ? 'sortable' : ''}
                                >
                                    <div className="th-content" style={{ justifyContent: col.align === 'center' ? 'center' : col.align === 'right' ? 'flex-end' : 'flex-start', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span title={col.label}>{col.label}</span>
                                        {col.sortable !== false && (
                                            <span
                                                className="sort-icon"
                                                style={{
                                                    display: 'inline-flex',
                                                    color: (sortConfig.key === col.key && userSorted) ? 'var(--text-primary)' : 'var(--text-muted)',
                                                    opacity: (sortConfig.key === col.key && userSorted) ? 1 : 0.3,
                                                    transition: 'all 0.2s ease',
                                                    visibility: (sortConfig.key === col.key || col.sortable !== false) ? 'visible' : 'hidden'
                                                }}
                                            >
                                                {sortConfig.key === col.key ? (
                                                    sortConfig.direction === 'asc' ? <ArrowUp size={14} strokeWidth={2.5} /> : <ArrowDown size={14} strokeWidth={2.5} />
                                                ) : (
                                                    <ArrowUp size={14} strokeWidth={2.5} />
                                                )}
                                            </span>
                                        )}
                                    </div>
                                    <div
                                        className="resize-handle"
                                        onMouseDown={(e) => handleResizeStart(e, col.key)}
                                        onClick={(e) => e.stopPropagation()}
                                        onDoubleClick={(e) => {
                                            e.stopPropagation()
                                            resetColumnWidth(col.key)
                                        }}
                                        title="Sütun genişliğini ayarla"
                                    />
                                </th>
                            )})}
                            {(actions || onRowClick) && <th className="th-actions">İşlemler</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedData.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={visibleColumnsList.length + ((actions || onRowClick) ? 1 : 0) + (showRowNumbers ? 1 : 0) + (showCheckboxes ? 1 : 0)}
                                    className="empty-cell"
                                >
                                    {hasActiveFilters ? 'Filtre sonucu bulunamadı' : emptyMessage}
                                </td>
                            </tr>
                        ) : (
                            paginatedData.map((row, index) => (
                                <tr
                                    key={row.id || index}
                                    className={`${selectedRows.has(row.id) ? 'selected' : ''} ${onRowClick ? 'clickable' : ''} ${rowClassName ? rowClassName(row) : ''} ${focusedIndex === index ? 'focused' : ''}`}
                                    onClick={(e) => handleRowClick(row, e, index)}
                                    onContextMenu={(e) => {
                                        if (onContextMenu) {
                                            e.preventDefault()
                                            onContextMenu(e, row)
                                        }
                                    }}
                                >
                                    {showCheckboxes && (
                                        <td className="td-checkbox">
                                            <div
                                                className={`checkbox ${selectedRows.has(row.id) ? 'checked' : ''}`}
                                                onClick={(e) => handleSelectRow(e, row.id, index)}
                                            >
                                                {selectedRows.has(row.id) && <Check size={12} />}
                                            </div>
                                        </td>
                                    )}
                                    {showRowNumbers && (
                                        <td className="td-num">
                                            {startRecord + index}
                                        </td>
                                    )}
                                    {visibleColumnsList.map((col) => {
                                        const cellContent = col.render ? col.render(row[col.key], row) : row[col.key] || '-'
                                        const titleContent = typeof cellContent === 'string' || typeof cellContent === 'number' ? cellContent : ''

                                        return (
                                            <td 
                                                key={col.key} 
                                                style={{ 
                                                    minWidth: col.minWidth || (col.width ? col.width : undefined),
                                                    textAlign: col.align || 'left',
                                                    ...(col.wrap ? { whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere' } : {}),
                                                    ...(col.tdStyle || {})
                                                }} 
                                                title={String(titleContent)}
                                            >
                                                {cellContent}
                                            </td>
                                        )
                                    })}
                                    {(actions || onRowClick) && (
                                        <td className="td-actions" onClick={(e) => e.stopPropagation()}>
                                            <div className="action-btns">
                                                <TableActionMenu
                                                    onRowClick={onRowClick ? (e) => handleRowClick(row, e, index) : null}
                                                    row={row}
                                                >
                                                    {actions ? (typeof actions === 'function' ? actions(row) : actions) : null}
                                                </TableActionMenu>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Footer */}
            {
                sortedData.length > 0 && (
                    <div className="table-footer">
                        <div className="footer-left">
                            <CustomSelect
                                value={pageSize}
                                onChange={(value) => { setPageSize(Number(value)); setCurrentPage(1) }}
                                options={pageSizeOptions}
                                className="page-select-custom"
                                placeholder=""
                                floatingLabel={false}
                            />
                            <span className="footer-info">{startRecord}-{endRecord} / {sortedData.length} kayıt</span>
                        </div>

                        <div className="pagination">
                            <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
                                <ChevronsLeft size={16} />
                            </button>
                            <button onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>
                                <ChevronLeft size={16} />
                            </button>

                            <div className="page-nums">
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    let pageNum
                                    if (totalPages <= 5) {
                                        pageNum = i + 1
                                    } else if (currentPage <= 3) {
                                        pageNum = i + 1
                                    } else if (currentPage >= totalPages - 2) {
                                        pageNum = totalPages - 4 + i
                                    } else {
                                        pageNum = currentPage - 2 + i
                                    }

                                    return (
                                        <button
                                            key={pageNum}
                                            className={currentPage === pageNum ? 'active' : ''}
                                            onClick={() => setCurrentPage(pageNum)}
                                        >
                                            {pageNum}
                                        </button>
                                    )
                                })}
                            </div>

                            <button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}>
                                <ChevronRight size={16} />
                            </button>
                            <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>
                                <ChevronsRight size={16} />
                            </button>
                        </div>

                    </div>
                )
            }
        </div >
    )
}
