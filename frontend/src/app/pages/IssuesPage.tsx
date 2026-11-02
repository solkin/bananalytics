import { useCallback, useMemo } from 'react'
import { Outlet, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import {
  Button,
  DataList,
  EmptyState,
  IssueStatusIcon,
  PageHeader,
  Select,
  Sparkline,
  SplitView,
  Tabs,
  toast,
  type DataListColumn,
} from '@/ui'
import type { CrashGroup } from '@/types'
import {
  deleteCrashGroup,
  getAppCrashStats,
  getCrashFreeStats,
  getCrashGroups,
  getCrashVersions,
  updateCrashGroupStatus,
} from '@/api/crashes'
import { useAsync, errorText } from '../async'
import { useRegisterCommands } from '../commands'
import { useStickyFilters } from '../filters'
import { fillDaily, fmtK, fromTo, relTime, versionLabel } from '../format'
import { useShell, type ShellContext } from '../layout/AppShell'
import { shortClassName } from '../stacktrace'
import './issues.css'

const PAGE_SIZE = 25
const DEFAULT_DAYS = '28'
const DAY_OPTIONS = [
  { label: 'Last 24 hours', value: '1' },
  { label: 'Last 7 days', value: '7' },
  { label: 'Last 28 days', value: '28' },
  { label: 'Last 90 days', value: '90' },
]
const STATUS_TABS = [
  { key: 'open', label: 'Open' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'ignored', label: 'Ignored' },
  { key: 'all', label: 'All' },
]
const STATUS_VERB = { open: 'Reopened', resolved: 'Resolved', ignored: 'Ignored' }

type IssueStatus = CrashGroup['status']

export interface IssuesContext extends ShellContext {
  days: number
  version?: number
  /** Everything the status of an issue touches, so the panel stays simple. */
  changeStatus: (issue: CrashGroup, status: IssueStatus) => Promise<void>
  removeIssue: (issue: CrashGroup) => Promise<void>
  close: () => void
}

export function useIssues() {
  return useOutletContext<IssuesContext>()
}

const COLUMNS: DataListColumn<CrashGroup>[] = [
  {
    key: 'status',
    title: <span className="bnn-visually-hidden">Status</span>,
    width: 42,
    render: (r) => <IssueStatusIcon status={r.status} label={r.status} />,
  },
  {
    key: 'title',
    title: 'Issue',
    render: (r) => (
      <span className="iss-row">
        <span className="iss-row__name">{shortClassName(r.exception_class)}</span>
        <span className="iss-row__message">{r.exception_message}</span>
      </span>
    ),
  },
  { key: 'occurrences', title: 'Reports', width: 88, align: 'right', sorter: true, render: (r) => <strong className="iss-row__count">{r.occurrences.toLocaleString('en-US')}</strong> },
  { key: 'affected_devices', title: 'Devices', width: 84, align: 'right', optional: true, sorter: true, render: (r) => r.affected_devices.toLocaleString('en-US') },
  { key: 'last_seen', title: 'Last report', width: 124, align: 'right', optional: true, sorter: true, render: (r) => <span className="iss-row__time">{relTime(r.last_seen)}</span> },
]

export default function IssuesPage() {
  const shell = useShell()
  const navigate = useNavigate()
  const { appId, issueId } = useParams()
  const { get, set } = useStickyFilters(`issues_filters_${appId}`)
  const days = Number(get('days', DEFAULT_DAYS)) || Number(DEFAULT_DAYS)
  const status = get('status', 'open')
  const version = get('version') ? Number(get('version')) : undefined
  const page = Math.max(1, Number(get('page', '1')) || 1)
  const sortBy = get('sortBy', 'occurrences')
  const sortOrder = get('sortOrder', 'desc') === 'asc' ? 'asc' : 'desc'
  const setFilter = (values: Record<string, string | undefined>) => set({ ...values, page: undefined, report: undefined })

  const versions = useAsync(() => getCrashVersions(appId!), [appId])
  const groups = useAsync(
    () => getCrashGroups(appId!, { days, version, status: status === 'all' ? undefined : status, page, pageSize: PAGE_SIZE, sortBy, sortOrder }),
    [appId, days, status, version, page, sortBy, sortOrder],
    /* Keyed so that a reload after a status change keeps the rows on screen. */
    { key: `issues:${appId}:${days}:${status}:${version}:${page}:${sortBy}:${sortOrder}` },
  )
  const stats = useAsync(() => getAppCrashStats(appId!, { ...fromTo(days), version }), [appId, days, version])
  const crashFree = useAsync(() => getCrashFreeStats(appId!, { ...fromTo(days), version }), [appId, days, version])

  /* The panel keeps the list's filters in its URL, so closing it or reloading
     the page shows the same list. */
  const listSearch = useMemo(() => {
    const params = new URLSearchParams({ days: String(days), status, sortBy, sortOrder })
    if (version != null) params.set('version', String(version))
    if (page > 1) params.set('page', String(page))
    return `?${params}`
  }, [days, status, version, page, sortBy, sortOrder])
  const listPath = `/apps/${appId}/diagnostics/issues`
  const open = useCallback(
    (id: string) => navigate({ pathname: `${listPath}/${id}`, search: listSearch }),
    [navigate, listPath, listSearch],
  )
  const close = useCallback(() => navigate({ pathname: listPath, search: listSearch }), [navigate, listPath, listSearch])

  const items = groups.data?.items
  const neighbour = (direction: 1 | -1) => {
    if (!items?.length) return undefined
    const index = items.findIndex((i) => i.id === issueId)
    return items[index < 0 ? 0 : index + direction]
  }

  const reloadAfterChange = () => {
    groups.reload()
    shell.reloadIssueCount()
  }

  const changeStatus = async (issue: CrashGroup, next: IssueStatus) => {
    const previous = issue.status
    await updateCrashGroupStatus(issue.id, next)
    /* An issue that left this tab cannot stay selected, so move on to the next one. */
    const leavesTab = status !== 'all' && next !== status
    if (leavesTab) {
      const following = neighbour(1) ?? neighbour(-1)
      if (following) open(following.id)
      else close()
    }
    reloadAfterChange()
    toast.success(`${STATUS_VERB[next]} ${shortClassName(issue.exception_class)}`, {
      duration: 6000,
      action: {
        label: 'Undo',
        onClick: () => {
          updateCrashGroupStatus(issue.id, previous).then(
            () => {
              reloadAfterChange()
              if (leavesTab) open(issue.id)
            },
            (e) => toast.error(errorText(e, 'Failed to update status')),
          )
        },
      },
    })
  }

  const removeIssue = async (issue: CrashGroup) => {
    const following = neighbour(1) ?? neighbour(-1)
    await deleteCrashGroup(issue.id)
    if (following) open(following.id)
    else close()
    reloadAfterChange()
    toast.success('Issue deleted')
  }

  useRegisterCommands(() => {
    const step = (direction: 1 | -1) => {
      const target = neighbour(direction)
      if (target) open(target.id)
    }
    return [
      { id: 'issue-next', group: 'Issues', label: 'Next issue', keys: ['J'], run: () => step(1) },
      { id: 'issue-previous', group: 'Issues', label: 'Previous issue', keys: ['K'], run: () => step(-1) },
    ]
  }, [items, issueId, open])

  const total = (stats.data ?? []).reduce((sum, d) => sum + d.count, 0)
  const crashSeries = fillDaily(stats.data ?? [], days).map((d) => d.value)
  /* No zero-fill here: a day without sessions is not a 0% crash-free day. */
  const crashFreeRows = crashFree.data ?? []
  const latestCrashFree = crashFreeRows[crashFreeRows.length - 1]?.crash_free_rate

  return (
    <SplitView
      list={
        <section aria-label="Issues">
          <div className="iss-sticky">
            <PageHeader title="Issues">
              <Tabs
                label="Status"
                activeKey={status}
                onChange={(key) => setFilter({ status: key })}
                items={STATUS_TABS.map((tab) => ({
                  ...tab,
                  count: tab.key === status ? groups.data?.total : undefined,
                }))}
              />
            </PageHeader>
            <div className="iss-filters">
              <Select
                variant="chip"
                name="Version"
                aria-label="Version"
                placeholder="All"
                allowClear
                value={version ?? null}
                onChange={(v) => setFilter({ version: v === '' ? undefined : String(v) })}
                options={(versions.data ?? []).map((v) => ({ label: versionLabel(v), value: v.version_code }))}
              />
              <Select
                variant="chip"
                aria-label="Period"
                value={String(days)}
                onChange={(v) => setFilter({ days: String(v) })}
                options={DAY_OPTIONS}
              />
              <div className="iss-metrics">
                <span className="iss-metric">
                  <Sparkline data={crashSeries} />
                  <span><strong>{stats.data ? fmtK(total) : '—'}</strong> crashes</span>
                </span>
                <span className="iss-metric">
                  <Sparkline data={crashFreeRows.map((r) => r.crash_free_rate)} />
                  <span><strong>{latestCrashFree != null ? `${latestCrashFree.toFixed(1)}%` : '—'}</strong> crash-free</span>
                </span>
              </div>
            </div>
          </div>
          {groups.error ? (
            <EmptyState title="Couldn't load issues" description={groups.error}>
              <Button onClick={groups.reload}>Retry</Button>
            </EmptyState>
          ) : (
            <DataList
              label="Issues"
              columns={COLUMNS}
              data={items ?? []}
              rowKey={(r) => r.id}
              loading={groups.loading}
              selectedKey={issueId}
              onRowClick={(r) => open(r.id)}
              pagination={{ page, pageSize: PAGE_SIZE, total: groups.data?.total ?? 0, onChange: (next) => set({ page: String(next), report: undefined }) }}
              sort={{ key: sortBy, direction: sortOrder, onChange: (key, direction) => setFilter({ sortBy: key, sortOrder: direction }) }}
              emptyText="No issues in this period"
            />
          )}
        </section>
      }
      detail={
        issueId ? (
          <Outlet context={{ ...shell, days, version, changeStatus, removeIssue, close } satisfies IssuesContext} />
        ) : undefined
      }
    />
  )
}
