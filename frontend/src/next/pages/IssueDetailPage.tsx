import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
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
import type { Crash } from '@/types'
import {
  deleteCrashGroup,
  getCrashGroup,
  getCrashGroupVersions,
  getCrashStats,
  getCrashesInGroup,
  retraceCrash,
  updateCrashGroupStatus,
} from '@/api/crashes'
import { useAsync, Loaded, errorText } from '../async'
import { androidVersion, cap, fillDaily, fmtDateTime, fmtK, fromTo, relTime, versionLabel } from '../format'
import { useDetailCrumb } from '../layout/useDetailCrumb'
import { issueStatusTone } from '../tones'
import './pages.css'

const DAY_OPTIONS = [
  { label: 'Last 24 hours', value: '1' },
  { label: 'Last 7 days', value: '7' },
  { label: 'Last 28 days', value: '28' },
  { label: 'Last 90 days', value: '90' },
]

function rank(items: Crash[], keyFn: (c: Crash) => string | null, topN = 5): BarListItem[] {
  const m = new Map<string, number>()
  for (const c of items) {
    const k = keyFn(c)
    if (k) m.set(k, (m.get(k) || 0) + 1)
  }
  const total = items.length || 1
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([label, count]) => ({ label, value: count, display: `${Math.round((count / total) * 100)}%` }))
}

function CrashDetail({ crash, onRetraced }: { crash: Crash; onRetraced: (c: Crash) => void }) {
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
            disabled={crash.version_code == null}
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
  const [params, setParams] = useSearchParams()
  const days = Number(params.get('days') ?? '28') || 28
  const version = params.get('version') ? Number(params.get('version')) : undefined

  const setFilter = (updates: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(updates)) {
      if (v == null || v === '') next.delete(k)
      else next.set(k, v)
    }
    setParams(next, { replace: true })
  }

  const versions = useAsync(() => getCrashGroupVersions(issueId), [issueId])
  const state = useAsync(async () => {
    const [group, stats, crashes] = await Promise.all([
      getCrashGroup(issueId),
      getCrashStats(issueId, { ...fromTo(days), version }),
      getCrashesInGroup(issueId, { days, version, pageSize: 50 }),
    ])
    return { group, stats, crashes: crashes.items, total: crashes.total }
  }, [issueId, days, version])

  const [selId, setSelId] = useState<string | null>(null)
  const [patch, setPatch] = useState<Record<string, Crash>>({})
  useEffect(() => {
    setSelId(state.data?.crashes[0]?.id ?? null)
  }, [state.data])

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
        {({ group, stats, crashes, total }) => {
          const series: ChartPoint[] = fillDaily(stats, days)
          const devices = rank(crashes, (c) => c.device_info?.model ?? null)
          const oses = rank(crashes, (c) => (c.device_info ? androidVersion(c.device_info.os_version) : null))
          const selIndex = Math.max(0, crashes.findIndex((c) => c.id === selId))
          const selected = crashes[selIndex] ? patch[crashes[selIndex].id] ?? crashes[selIndex] : null

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
                  <div className="pg-detailhead__actions">
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
                      <Button variant="danger" icon={<Icons.IconTrash size={14} />} />
                    </Popconfirm>
                  </div>
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
                  crashes.length > 0 && (
                    <span className="iss-picker">
                      <span className="iss-picker__controls">
                        <Button
                          size="sm"
                          icon={<Icons.IconChevronLeft size={14} />}
                          disabled={selIndex <= 0}
                          aria-label="Previous crash report"
                          onClick={() => setSelId(crashes[selIndex - 1].id)}
                        />
                        <Select
                          size="sm"
                          style={{ width: 250 }}
                          value={selected?.id ?? null}
                          onChange={(id) => setSelId(String(id))}
                          options={crashes.map((c) => ({
                            label: `${fmtDateTime(c.created_at)} — ${c.device_info?.model || 'Unknown'}`,
                            value: c.id,
                          }))}
                        />
                        <Button
                          size="sm"
                          icon={<Icons.IconChevronRight size={14} />}
                          disabled={selIndex >= crashes.length - 1}
                          aria-label="Next crash report"
                          onClick={() => setSelId(crashes[selIndex + 1].id)}
                        />
                      </span>
                      <Text className="iss-picker__count" type="tertiary" size="sm">
                        {selIndex + 1} of {fmtK(total)}
                      </Text>
                    </span>
                  )
                }
              >
                {selected ? (
                  <CrashDetail
                    crash={selected}
                    onRetraced={(c) => setPatch((p) => ({ ...p, [c.id]: c }))}
                  />
                ) : (
                  <Empty description="No crash reports in the selected period" />
                )}
              </Card>
            </>
          )
        }}
      </Loaded>
    </div>
  )
}
