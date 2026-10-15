import React from 'react'

/**
 * FormGrid
 * Modular responsive form layout primitive.
 * Displays cols (1, 2, 3, or 4) on desktop, automatically collapses to 1 column on mobile screens (<= 768px).
 */
export default function FormGrid({
    children,
    cols = 2,
    gap = '16px',
    className = '',
    style = {},
    ...rest
}) {
    const colClass = `form-grid-${cols}`
    return (
        <div
            className={`form-grid ${colClass} ${className}`.trim()}
            style={{ '--grid-gap': gap, ...style }}
            {...rest}
        >
            {children}
        </div>
    )
}
