import { useMemo, useState, type ReactNode } from 'react'
import { cn } from './cn'
import { EmptyState } from './EmptyState'
import { IconChevronDown, IconChevronLeft, IconChevronRight } from './Icon'
import { Skeleton } from './Skeleton'
import { uiStrings } from './strings'
import './DataList.css'

export interface DataListColumn<T> {
  key: string
  title: ReactNode
  /** Fixed width in px; a column without one takes the remaining room. */
  width?: number
  align?: 'left' | 'right'
  /** Dropped on phones, for columns the row can live without. */
  optional?: boolean
  render: (row: T, index: number) => ReactNode
  /** A comparator sorts on the client; `true` leaves sorting to the server. */
  sorter?: ((a: T, b: T) => number) | true
}

export interface DataListPagination {
  page: number
  pageSize: number
  total: number
  onChange: (page: number) => void
}

export interface DataListSort {
  key: string
  direction: 'asc' | 'desc'
  onChange: (key: string, direction: 'asc' | 'desc') => void
}

export interface DataListProps<T> {
  columns: DataListColumn<T>[]
  data: T[]
  rowKey: (row: T, index: number) => string | number
  onRowClick?: (row: T) => void
  selectedKey?: string | number | null
  loading?: boolean
  /** Client-side paging; pass `pagination` instead when the server pages. */
  pageSize?: number
  pagination?: DataListPagination
  sort?: DataListSort
  emptyText?: ReactNode
  label?: string
  className?: string
}

const SKELETON_ROWS = 5
/* A control inside a row does its own thing; only the row itself opens the row. */
const NESTED_CONTROLS = 'a, button, input, select, textarea, label, [role="button"]'

/** The primary surface of the product: dense rows with a selectable current one. */
export function DataList<T>({
  columns,
  data,
  rowKey,
  onRowClick,
  selectedKey,
  loading,
  pageSize,
  pagination,
  sort,
  emptyText,
  label,
  className,
}: DataListProps<T>) {
  const [innerSortKey, setInnerSortKey] = useState<string | null>(null)
  const [innerDirection, setInnerDirection] = useState<'asc' | 'desc'>('asc')
  const [innerPage, setInnerPage] = useState(1)
  const sortKey = sort?.key ?? innerSortKey
  const direction = sort?.direction ?? innerDirection

  const sorted = useMemo(() => {
    if (sort || !sortKey) return data
    const column = columns.find((c) => c.key === sortKey)
    if (typeof column?.sorter !== 'function') return data
    const rows = [...data].sort(column.sorter)
    return direction === 'asc' ? rows : rows.reverse()
  }, [data, sortKey, direction, columns, sort])

  const setPage = pagination ? pagination.onChange : setInnerPage
  const size = pagination ? pagination.pageSize : pageSize
  const total = pagination ? pagination.total : sorted.length
  const pageCount = size ? Math.max(1, Math.ceil(total / size)) : 1
  /* A search can shrink the data under the current page. */
  const page = pagination ? pagination.page : Math.min(innerPage, pageCount)
  const rows = useMemo(() => {
    if (pagination || !pageSize) return sorted
    const start = (page - 1) * pageSize
    return sorted.slice(start, start + pageSize)
  }, [sorted, page, pageSize, pagination])

  const toggleSort = (column: DataListColumn<T>) => {
    const next = sortKey === column.key && direction === 'asc' ? 'desc' : 'asc'
    if (sort) {
      sort.onChange(column.key, next)
      return
    }
    setInnerPage(1)
    setInnerSortKey(column.key)
    setInnerDirection(next)
  }

  return (
    <div className={cn('bnn-datalist', className)}>
      <table className="bnn-datalist__table" aria-label={label} aria-busy={loading || undefined}>
        <thead>
          <tr>
            {columns.map((column) => {
              const isSorted = sortKey === column.key
              return (
                <th
                  key={column.key}
                  scope="col"
                  style={{ width: column.width }}
                  className={cn(column.align === 'right' && 'is-right', column.optional && 'is-optional')}
                  aria-sort={column.sorter && isSorted ? (direction === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {column.sorter ? (
                    <button type="button" className="bnn-datalist__sort" onClick={() => toggleSort(column)}>
                      {column.title}
                      <IconChevronDown
                        size={10}
                        className={cn('bnn-datalist__arrow', isSorted && 'is-sorted', isSorted && direction === 'asc' && 'is-asc')}
                      />
                    </button>
                  ) : (
                    column.title
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: SKELETON_ROWS }, (_, i) => (
                <tr key={i}>
                  {columns.map((column) => (
                    <td key={column.key} className={cn(column.optional && 'is-optional')}>
                      <Skeleton width="60%" />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row, i) => {
                const key = rowKey(row, i)
                return (
                  <tr
                    key={key}
                    className={cn(onRowClick && 'is-clickable', key === selectedKey && 'is-selected')}
                    tabIndex={onRowClick ? 0 : undefined}
                    aria-current={key === selectedKey || undefined}
                    onClick={(e) => {
                      if (!(e.target as Element).closest(NESTED_CONTROLS)) onRowClick?.(row)
                    }}
                    onKeyDown={(e) => {
                      if (!onRowClick || e.target !== e.currentTarget) return
                      /* Space would scroll the page and Enter would do nothing;
                         both should open the row like a click does. */
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onRowClick(row)
                      }
                    }}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn(column.align === 'right' && 'is-right', column.optional && 'is-optional')}
                      >
                        {column.render(row, i)}
                      </td>
                    ))}
                  </tr>
                )
              })}
        </tbody>
      </table>
      {!loading && rows.length === 0 && <EmptyState title={emptyText} />}
      {size != null && pageCount > 1 && (
        <div className="bnn-datalist__pager">
          <span>
            {(page - 1) * size + 1}–{Math.min(page * size, total)} of {total}
          </span>
          <button
            type="button"
            aria-label={uiStrings.previousPage}
            className="bnn-pagination__btn"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            <IconChevronLeft size={12} />
          </button>
          <button
            type="button"
            aria-label={uiStrings.nextPage}
            className="bnn-pagination__btn"
            disabled={page >= pageCount}
            onClick={() => setPage(page + 1)}
          >
            <IconChevronRight size={12} />
          </button>
        </div>
      )}
    </div>
  )
}
