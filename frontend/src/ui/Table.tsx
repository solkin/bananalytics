import { useMemo, useState, type ReactNode } from 'react'
import { cn } from './primitives'
import { Empty } from './primitives'
import { IconChevronLeft, IconChevronRight } from './Icon'

export interface Column<T> {
  key: string
  title: ReactNode
  dataIndex?: keyof T
  width?: number | string
  align?: 'left' | 'right' | 'center'
  render?: (row: T, index: number) => ReactNode
  sorter?: (a: T, b: T) => number
}

export interface TablePagination {
  page: number
  pageSize: number
  total: number
  onChange: (page: number) => void
}

export interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  rowKey: (row: T, index: number) => string | number
  onRowClick?: (row: T) => void
  loading?: boolean
  size?: 'sm' | 'md'
  pageSize?: number
  /* Server-side mode: data is already one page; the pager reflects `total`. */
  pagination?: TablePagination
  emptyText?: ReactNode
  className?: string
}

export function Table<T>({
  columns,
  data,
  rowKey,
  onRowClick,
  loading,
  size = 'md',
  pageSize,
  pagination,
  emptyText = 'No data',
  className,
}: TableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [innerPage, setInnerPage] = useState(1)

  const sorted = useMemo(() => {
    if (!sortKey) return data
    const col = columns.find((c) => c.key === sortKey)
    if (!col?.sorter) return data
    const arr = [...data].sort(col.sorter)
    return sortDir === 'asc' ? arr : arr.reverse()
  }, [data, sortKey, sortDir, columns])

  const page = pagination ? pagination.page : innerPage
  const setPage = pagination ? pagination.onChange : setInnerPage
  const effPageSize = pagination ? pagination.pageSize : pageSize
  const total = pagination ? pagination.total : sorted.length
  const paged = useMemo(() => {
    if (pagination || !pageSize) return sorted
    const start = (page - 1) * pageSize
    return sorted.slice(start, start + pageSize)
  }, [sorted, page, pageSize, pagination])

  const pageCount = effPageSize ? Math.max(1, Math.ceil(total / effPageSize)) : 1

  const toggleSort = (col: Column<T>) => {
    if (!col.sorter) return
    if (sortKey === col.key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(col.key)
      setSortDir('asc')
    }
  }

  return (
    <div className={cn('bnn-table-wrap', className)}>
      <div className="bnn-table-scroll">
        <table className={cn('bnn-table', `bnn-table--${size}`)}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width, textAlign: col.align }}
                  className={cn(col.sorter && 'is-sortable')}
                  onClick={() => toggleSort(col)}
                >
                  <span className="bnn-table__th">
                    {col.title}
                    {col.sorter && (
                      <span
                        className={cn(
                          'bnn-table__sort',
                          sortKey === col.key && `is-${sortDir}`,
                        )}
                      >
                        <i className="up" />
                        <i className="down" />
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="bnn-table__skeleton-row">
                  {columns.map((c) => (
                    <td key={c.key}>
                      <span className="bnn-skeleton__block is-active" style={{ height: 12, width: '70%', borderRadius: 4 }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="bnn-table__empty">
                  <Empty description={emptyText} />
                </td>
              </tr>
            ) : (
              paged.map((row, i) => (
                <tr
                  key={rowKey(row, i)}
                  className={cn(onRowClick && 'is-clickable')}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => (
                    <td key={col.key} style={{ textAlign: col.align }}>
                      {col.render
                        ? col.render(row, i)
                        : col.dataIndex
                          ? (row[col.dataIndex] as ReactNode)
                          : null}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {effPageSize != null && pageCount > 1 && (
        <div className="bnn-table__pagination">
          <span className="bnn-table__page-info">
            {(page - 1) * effPageSize + 1}–{Math.min(page * effPageSize, total)} of {total}
          </span>
          <div className="bnn-pagination">
            <button
              className="bnn-pagination__btn"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <IconChevronLeft size={15} />
            </button>
            <span className="bnn-pagination__current">
              {page} / {pageCount}
            </span>
            <button
              className="bnn-pagination__btn"
              disabled={page >= pageCount}
              onClick={() => setPage(page + 1)}
            >
              <IconChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------- Descriptions */
export interface DescItem {
  label: ReactNode
  value: ReactNode
  span?: number
}

export function Descriptions({
  items,
  column = 2,
  bordered = true,
  size = 'md',
  className,
}: {
  items: DescItem[]
  column?: number
  bordered?: boolean
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <div
      className={cn(
        'bnn-desc',
        bordered && 'bnn-desc--bordered',
        `bnn-desc--${size}`,
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${column}, minmax(0, 1fr))` }}
    >
      {items.map((it, i) => (
        <div
          className="bnn-desc__cell"
          key={i}
          style={{ gridColumn: it.span ? `span ${it.span}` : undefined }}
        >
          <div className="bnn-desc__label">{it.label}</div>
          <div className="bnn-desc__value">{it.value}</div>
        </div>
      ))}
    </div>
  )
}
