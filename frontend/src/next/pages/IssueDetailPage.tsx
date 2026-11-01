import { useState } from 'react'
import { useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom'
import {
  Alert,
  AreaChart,
  BarList,
  Button,
  Card,
  Descriptions,
  Divider,
  Empty,
  Icons,
  Popconfirm,
  Segmented,
  Select,
  Tabs,
  Tag,
  Text,
  Timeline,
  toast,
  type BarListItem,
  type ChartPoint,
} from '@/ui'
import { uiStrings } from '@/ui/strings'
import type { Crash } from '@/types'
import {
  deleteCrashGroup,
  getCrashGroup,
  getCrashGroupVersions,
  getCrashDistributions,
  getCrashStats,
  getCrashesInGroup,
  retraceCrash,
  updateCrashGroupStatus,
} from '@/api/crashes'
import { useAsync, Loaded, errorText } from '../async'
import { androidVersion, cap, fillDaily, fmtDateTime, fmtK, fromTo, relTime, versionLabel } from '../format'
import type { ShellContext } from '../layout/AppShell'
import { useDetailCrumb } from '../layout/useDetailCrumb'
import { issueStatusTone } from '../tones'
import './pages.css'

const DAY_OPTIONS = [
  { label: 'Last 24 hours', value: '1' },
  { label: 'Last 7 days', value: '7' },
  { label: 'Last 28 days', value: '28' },
  { label: 'Last 90 days', value: '90' },
]

function rank(items: { name: string; count: number }[], total: number, format = (name: string) => name): BarListItem[] {
  return items.map((item) => ({ label: format(item.name), value: item.count,
    display: `${total ? Math.round(item.count / total * 100) : 0}%` }))
}

function CrashDetail({ crash, onRetraced, canManage }: { crash: Crash; onRetraced: (c: Crash) => void; canManage: boolean }) {
  const [view, setView] = useState<'decoded' | 'raw'>('decoded')
  const [retracing, setRetracing] = useState(false)
  const stack = view === 'raw' || !crash.stacktrace_decoded ? crash.stacktrace_raw : crash.stacktrace_decoded

  const retrace = async () => {
    setRetracing(true)
    try {
      const updated = await retraceCrash(crash.id)
      onRetraced(updated)
      toast.success('Stack trace retraced')
    } catch (e) {
      toast.error(errorText(e, 'Failed to retrace'))
    } finally {
      setRetracing(false)
    }
  }

  const stacktraceTab = (
    <div className="iss-stack">
      {crash.decode_error && <Alert type="warning" message="Retrace failed" description={crash.decode_error} />}
      <div className="iss-stack__bar">
        {crash.stacktrace_decoded ? (
          <Segmented<'decoded' | 'raw'>
            size="sm"
            value={view}
            onChange={setView}
            options={[
              { label: 'Deobfuscated', value: 'decoded' },
              { label: 'Original', value: 'raw' },
            ]}
          />
        ) : <span />}
        <span className="pg-rowactions">
          <Button
            size="sm"
            icon={<Icons.IconReload size={14} />}
            loading={retracing}
            disabled={!canManage || crash.version_code == null}
            onClick={retrace}
          >
            Retrace
          </Button>
          <Button
            size="sm"
            icon={<Icons.IconCopy size={14} />}
            onClick={() => {
              navigator.clipboard?.writeText(stack)
              toast.success('Copied to clipboard')
            }}
          >
            Copy
          </Button>
        </span>
      </div>
      <pre className="stacktrace">{stack || 'No stack trace available.'}</pre>
    </div>
  )

  const deviceTab = crash.device_info ? (
    <Descriptions
      column={2}
      items={[
        { label: 'Model', value: `${crash.device_info.manufacturer} ${crash.device_info.model}` },
        { label: 'OS version', value: androidVersion(crash.device_info.os_version) },
        { label: 'Country', value: crash.device_info.country || '—' },
        { label: 'Language', value: crash.device_info.language || '—' },
        { label: 'Thread', value: crash.thread || 'main' },
        { label: 'App version', value: crash.version_code ?? '—' },
        { label: 'Fatal', value: crash.is_fatal ? 'Yes' : 'No' },
        { label: 'When', value: fmtDateTime(crash.created_at) },
      ]}
    />
  ) : (
    <Empty description="No device information captured" />
  )

  const breadcrumbsTab = crash.breadcrumbs?.length ? (
    <Timeline
      items={crash.breadcrumbs.map((b) => ({
        content: b.message,
        meta: `${b.category} • ${new Date(b.timestamp).toLocaleTimeString()}`,
      }))}
    />
  ) : (
    <Empty description="No breadcrumbs captured before this crash" />
  )

  const contextTab = crash.context && Object.keys(crash.context).length > 0 ? (
    <Descriptions
      column={1}
      items={Object.entries(crash.context).map(([label, value]) => ({ label, value }))}
    />
  ) : (
    <Empty description="No context data attached" />
  )

  return (
    <Tabs
      items={[
        { key: 'stack', label: 'Stack trace', children: stacktraceTab },
        { key: 'device', label: 'Device', children: deviceTab },
        { key: 'breadcrumbs', label: 'Breadcrumbs', children: breadcrumbsTab },
        { key: 'context', label: 'Context', children: contextTab },
      ]}
    />
  )
}

export default function IssueDetailPage() {
  const { appId, issueId = '' } = useParams()
  const navigate = useNavigate()
  const { role } = useOutletContext<ShellContext>()
  const canManage = role === 'admin'
  const [params, setParams] = useSearchParams()
  const days = Number(params.get('days') ?? '28') || 28
  const report = Math.max(1, Number(params.get('report')) || 1)
  const version = params.get('version') ? Number(params.get('version')) : undefined

  const setFilter = (updates: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params)
    next.delete('report')
    for (const [k, v] of Object.entries(updates)) {
      if (v == null || v === '') next.delete(k)
      else next.set(k, v)
    }
    setParams(next, { replace: true })
  }

  const versions = useAsync(() => getCrashGroupVersions(issueId), [issueId])
  const state = useAsync(async () => {
    const [group, stats, distributions] = await Promise.all([
      getCrashGroup(issueId),
      getCrashStats(issueId, { ...fromTo(days), version }),
      getCrashDistributions(issueId, { ...fromTo(days), version }),
    ])
    return { group, stats, distributions }
  }, [issueId, days, version])

  const reports = useAsync(
    () => getCrashesInGroup(issueId, { days, version, page: report, pageSize: 1 }),
    [issueId, days, version, report],
  )
  const [patch, setPatch] = useState<Record<string, Crash>>({})
  const goToReport = (nextReport: number) => {
    const next = new URLSearchParams(params)
    next.set('report', String(nextReport))
    setParams(next, { replace: true })
  }

  const cls = state.data?.group.exception_class
  useDetailCrumb(state.data ? (cls ? cls.split('.').pop() || cls : 'Issue') : null)

  const setStatus = async (s: 'resolved' | 'ignored' | 'open') => {
    try {
      await updateCrashGroupStatus(issueId, s)
      toast.success(`Issue ${s === 'open' ? 'reopened' : s}`)
      state.reload()
    } catch (e) {
      toast.error(errorText(e, 'Failed to update status'))
    }
  }

  const removeGroup = async () => {
    try {
      await deleteCrashGroup(issueId)
      toast.success('Issue deleted')
      navigate(`/apps/${appId}/diagnostics/issues`)
    } catch (e) {
      toast.error(errorText(e, 'Failed to delete issue'))
    }
  }

  return (
    <div className="pg">
      <div className="pg-toolbar">
        <div className="pg-filter">
          <span className="pg-filter__label">Version</span>
          <Select
            style={{ width: 180 }}
            placeholder="All versions"
            allowClear
            value={version ?? null}
            onChange={(v) => setFilter({ version: v === '' ? undefined : String(v) })}
            options={(versions.data ?? []).map((v) => ({ label: versionLabel(v), value: v.version_code }))}
          />
        </div>
        <div className="pg-filter">
          <span className="pg-filter__label">Time</span>
          <Select style={{ width: 150 }} value={String(days)} onChange={(v) => setFilter({ days: String(v) })} options={DAY_OPTIONS} />
        </div>
      </div>

      <Loaded state={state}>
        {({ group, stats, distributions }) => {
          const series: ChartPoint[] = fillDaily(stats, days)
          const devices = rank(distributions.models, distributions.total)
          const oses = rank(distributions.os_versions, distributions.total, androidVersion)
          const total = reports.data?.total ?? 0
          const selected = reports.data?.items[0]
          const crash = selected ? patch[selected.id] ?? selected : null

          return (
            <>
              <Card>
                <div className="pg-detailhead">
                  <div className="pg-detailhead__main">
                    <div className="pg-detailhead__titlerow">
                      <div className="pg-detailhead__title">{group.exception_class || 'Unknown error'}</div>
                      <Tag tone={issueStatusTone(group.status)}>{cap(group.status)}</Tag>
                    </div>
                    <div className="pg-detailhead__msg">{group.exception_message || '—'}</div>
                  </div>
                  {canManage && <div className="pg-detailhead__actions">
                    {group.status !== 'ignored' && <Button onClick={() => void setStatus('ignored')}>Ignore</Button>}
                    {group.status === 'open' ? (
                      <Button variant="primary" onClick={() => void setStatus('resolved')}>Close issue</Button>
                    ) : (
                      <Button onClick={() => void setStatus('open')}>Reopen</Button>
                    )}
                    <Popconfirm
                      title="Delete this issue?"
                      description={`All ${fmtK(group.occurrences)} crash reports in this group will be permanently removed.`}
                      okText="Delete"
                      okDanger
                      onConfirm={() => void removeGroup()}
                    >
                      <Button variant="danger" icon={<Icons.IconTrash size={14} />} aria-label={uiStrings.delete} />
                    </Popconfirm>
                  </div>}
                </div>
                <Divider />
                <div className="pg-meta">
                  <div className="pg-meta__item"><span className="pg-meta__label">Reports</span><span className="pg-meta__value">{fmtK(group.occurrences)}</span></div>
                  <div className="pg-meta__item"><span className="pg-meta__label">Devices</span><span className="pg-meta__value">{fmtK(group.affected_devices)}</span></div>
                  <div className="pg-meta__item"><span className="pg-meta__label">First seen</span><span className="pg-meta__value">{relTime(group.first_seen)}</span></div>
                  <div className="pg-meta__item"><span className="pg-meta__label">Last report</span><span className="pg-meta__value">{relTime(group.last_seen)}</span></div>
                </div>
              </Card>

              <Card title="Reports" extra={<Text type="danger" strong>{fmtK(group.occurrences)}</Text>}>
                <AreaChart data={series} color="var(--bnn-danger)" height={160} />
              </Card>

              <div className="pg-affected">
                <Card title="Most affected devices">
                  {devices.length ? <BarList items={devices} /> : <Empty description="No device data yet" />}
                </Card>
                <Card title="Most affected OS">
                  {oses.length ? <BarList items={oses} /> : <Empty description="No OS data yet" />}
                </Card>
              </div>

              <Card
                title="Crash report"
                extra={
                  total > 0 && (
                    <span className="iss-picker">
                      <span className="iss-picker__controls">
                        <Button
                          size="sm"
                          icon={<Icons.IconChevronLeft size={14} />}
                          disabled={report <= 1 || reports.loading}
                          aria-label="Previous crash report"
                          onClick={() => goToReport(report - 1)}
                        />
                        <Text type="secondary">{crash ? fmtDateTime(crash.created_at) : '—'}</Text>
                        <Button
                          size="sm"
                          icon={<Icons.IconChevronRight size={14} />}
                          disabled={report >= total || reports.loading}
                          aria-label="Next crash report"
                          onClick={() => goToReport(report + 1)}
                        />
                      </span>
                      <Text className="iss-picker__count" type="tertiary" size="sm">
                        {report} of {fmtK(total)}
                      </Text>
                    </span>
                  )
                }
              >
                <Loaded state={reports} preserveHeight>
                  {() => crash ? (
                    <CrashDetail
                      crash={crash}
                      canManage={canManage}
                      onRetraced={(updated) => setPatch((current) => ({ ...current, [updated.id]: updated }))}
                    />
                  ) : <Empty description="No crash reports in the selected period" />}
                </Loaded>
              </Card>
            </>
          )
        }}
      </Loaded>
    </div>
  )
}
