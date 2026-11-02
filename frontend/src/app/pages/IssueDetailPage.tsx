import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  Breakdown,
  Button,
  ConfirmDialog,
  DayBars,
  DetailPanel,
  EmptyState,
  IconButton,
  Icons,
  IssueStatusIcon,
  Notice,
  Properties,
  Segmented,
  Tabs,
  toast,
  type BreakdownItem,
} from '@/ui'
import type { Crash } from '@/types'
import {
  getCrashDistributions,
  getCrashGroup,
  getCrashStats,
  getCrashesInGroup,
  retraceCrash,
} from '@/api/crashes'
import { useAsync, Loaded, errorText } from '../async'
import { useRegisterCommands } from '../commands'
import { androidVersion, cap, countryName, fillDaily, fmtDateTime, fmtK, fromTo, relTime } from '../format'
import { parseStackTrace, shortClassName } from '../stacktrace'
import { useIssues } from './IssuesPage'

function shares(items: { name: string; count: number }[], total: number, format = (name: string) => name): BreakdownItem[] {
  return items.map((item) => ({
    label: format(item.name),
    value: item.count,
    display: `${total ? Math.round((item.count / total) * 100) : 0}%`,
  }))
}

function copy(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success('Copied to clipboard'),
    () => toast.error('Could not copy. Select the text and copy it manually.'),
  )
}

function StackTrace({ crash, canManage, onRetraced }: { crash: Crash; canManage: boolean; onRetraced: (c: Crash) => void }) {
  const [view, setView] = useState<'decoded' | 'raw'>('decoded')
  const [retracing, setRetracing] = useState(false)
  const trace = view === 'raw' || !crash.stacktrace_decoded ? crash.stacktrace_raw : crash.stacktrace_decoded

  const retrace = async () => {
    setRetracing(true)
    try {
      onRetraced(await retraceCrash(crash.id))
      toast.success('Stack trace retraced')
    } catch (e) {
      toast.error(errorText(e, 'Failed to retrace'))
    } finally {
      setRetracing(false)
    }
  }

  return (
    <>
      {crash.decode_error && <Notice tone="warning" title="Retrace failed.">{crash.decode_error}</Notice>}
      <div className="iss-stack">
        <div className="iss-stack__bar">
          {crash.stacktrace_decoded ? (
            <Segmented
              label="Stack trace view"
              value={view}
              onChange={setView}
              options={[
                { label: 'Deobfuscated', value: 'decoded' },
                { label: 'Original', value: 'raw' },
              ]}
            />
          ) : <span />}
          <span className="iss-stack__actions">
            {canManage && (
              <Button variant="ghost" loading={retracing} disabled={crash.version_code == null} onClick={retrace}>Retrace</Button>
            )}
            <Button variant="ghost" onClick={() => copy(trace)}>Copy</Button>
          </span>
        </div>
        {/* Scrolls sideways, so it has to be reachable from the keyboard. */}
        <div className="iss-stack__lines" tabIndex={0} role="group" aria-label="Stack trace">
          {trace
            ? parseStackTrace(trace).map((line, i) => (
                <div key={i} className={`iss-stack__line iss-stack__line--${line.kind}`}>{line.text}</div>
              ))
            : 'No stack trace available.'}
        </div>
      </div>
    </>
  )
}

function CrashReport({ crash, canManage, onRetraced }: { crash: Crash; canManage: boolean; onRetraced: (c: Crash) => void }) {
  const device = crash.device_info
  return (
    <Tabs
      label="Crash report"
      items={[
        {
          key: 'stack',
          label: 'Stack trace',
          children: <StackTrace crash={crash} canManage={canManage} onRetraced={onRetraced} />,
        },
        {
          key: 'device',
          label: 'Device',
          children: device ? (
            <Properties
              items={[
                { label: 'Model', value: `${device.manufacturer} ${device.model}` },
                { label: 'OS version', value: androidVersion(device.os_version) },
                { label: 'Country', value: device.country ? countryName(device.country) : '—' },
                { label: 'Language', value: device.language || '—' },
                { label: 'Thread', value: crash.thread || 'main' },
                { label: 'App version', value: crash.version_code ?? '—' },
                { label: 'Fatal', value: crash.is_fatal ? 'Yes' : 'No' },
              ]}
            />
          ) : <EmptyState title="No device information captured" />,
        },
        {
          key: 'breadcrumbs',
          label: 'Breadcrumbs',
          children: crash.breadcrumbs?.length ? (
            <ol className="iss-crumbs">
              {crash.breadcrumbs.map((b, i) => (
                <li key={i} className="iss-crumb">
                  <span className="iss-crumb__meta">{new Date(b.timestamp).toLocaleTimeString([], { hour12: false })}</span>
                  <span className="iss-crumb__meta">{b.category}</span>
                  <span className="iss-crumb__message">{b.message}</span>
                </li>
              ))}
            </ol>
          ) : <EmptyState title="No breadcrumbs captured before this crash" />,
        },
        {
          key: 'context',
          label: 'Context',
          children: crash.context && Object.keys(crash.context).length > 0 ? (
            <Properties items={Object.entries(crash.context).map(([label, value]) => ({ label, value }))} />
          ) : <EmptyState title="No context data attached" />,
        },
      ]}
    />
  )
}

export default function IssueDetailPage() {
  const { issueId = '' } = useParams()
  const { role, days, version, changeStatus, removeIssue, close } = useIssues()
  const canManage = role === 'admin'
  const [params, setParams] = useSearchParams()
  const report = Math.max(1, Number(params.get('report')) || 1)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [patched, setPatched] = useState<Record<string, Crash>>({})

  /* Keyed so that a reload after a status change does not blank the panel. */
  const group = useAsync(() => getCrashGroup(issueId), [issueId], { key: `issue:${issueId}` })
  const analytics = useAsync(
    () => Promise.all([
      getCrashStats(issueId, { ...fromTo(days), version }),
      getCrashDistributions(issueId, { ...fromTo(days), version }),
    ]),
    [issueId, days, version],
  )
  const reports = useAsync(
    () => getCrashesInGroup(issueId, { days, version, page: report, pageSize: 1 }),
    [issueId, days, version, report],
  )
  const issue = group.data
  const total = reports.data?.total ?? 0
  const selected = reports.data?.items[0]
  const crash = selected ? patched[selected.id] ?? selected : null

  const goToReport = (next: number) => {
    const updated = new URLSearchParams(params)
    updated.set('report', String(next))
    setParams(updated, { replace: true })
  }

  const apply = (status: 'open' | 'resolved' | 'ignored') => {
    if (!issue) return
    changeStatus(issue, status).then(group.reload, (e) => toast.error(errorText(e, 'Failed to update status')))
  }

  useRegisterCommands(() => {
    if (!issue) return []
    const name = shortClassName(issue.exception_class)
    const group = `Issue: ${name}`
    return [
      ...(canManage
        ? [
            issue.status === 'open'
              ? { id: 'issue-resolve', group, label: 'Resolve issue', keys: ['R'], icon: <Icons.IconCircleCheck size={15} />, run: () => apply('resolved') }
              : { id: 'issue-reopen', group, label: 'Reopen issue', keys: ['R'], icon: <Icons.IconReload size={15} />, run: () => apply('open') },
            ...(issue.status !== 'ignored'
              ? [{ id: 'issue-ignore', group, label: 'Ignore issue', keys: ['I'], icon: <Icons.IconCircleOff size={15} />, run: () => apply('ignored') }]
              : []),
          ]
        : []),
      ...(crash
        ? [{ id: 'issue-copy', group, label: 'Copy stack trace', icon: <Icons.IconCopy size={15} />, run: () => copy(crash.stacktrace_decoded || crash.stacktrace_raw) }]
        : []),
    ]
  }, [issue, canManage, crash])

  const remove = async () => {
    if (!issue) return
    setDeleting(true)
    try {
      await removeIssue(issue)
    } catch (e) {
      toast.error(errorText(e, 'Failed to delete issue'))
      setDeleting(false)
    }
  }

  return (
    <DetailPanel
      label="Issue details"
      onClose={close}
      title={issue && (
        <span className="iss-detail__status">
          <IssueStatusIcon status={issue.status} />
          {cap(issue.status)}
        </span>
      )}
      actions={issue && canManage && (
        <>
          {issue.status !== 'ignored' && <Button onClick={() => apply('ignored')}>Ignore</Button>}
          {issue.status === 'open'
            ? <Button variant="primary" onClick={() => apply('resolved')}>Resolve</Button>
            : <Button onClick={() => apply('open')}>Reopen</Button>}
          <IconButton aria-label="Delete issue" onClick={() => setConfirmDelete(true)}>
            <Icons.IconTrash size={15} />
          </IconButton>
        </>
      )}
    >
      <Loaded state={group}>
        {(g) => (
          <div className="iss-detail">
            <div>
              <h2 className="iss-detail__title">{shortClassName(g.exception_class)}</h2>
              {g.exception_class && <code className="iss-detail__class bnn-mono">{g.exception_class}</code>}
              {g.exception_message && <p className="iss-detail__message">{g.exception_message}</p>}
            </div>

            <Properties
              layout="columns"
              items={[
                { label: 'Reports', value: g.occurrences.toLocaleString('en-US') },
                { label: 'Devices', value: g.affected_devices.toLocaleString('en-US') },
                { label: 'First seen', value: relTime(g.first_seen) },
                { label: 'Last report', value: relTime(g.last_seen) },
              ]}
            />

            <Loaded state={analytics}>
              {([stats, distributions]) => (
                <>
                  <DayBars data={fillDaily(stats, days)} label={`Reports per day over the last ${days} days`} />
                  {(distributions.models.length > 0 || distributions.os_versions.length > 0) && (
                    <div className="iss-detail__breakdowns">
                      <Breakdown title="Devices" items={shares(distributions.models, distributions.total)} />
                      <Breakdown title="Android version" items={shares(distributions.os_versions, distributions.total, androidVersion)} />
                    </div>
                  )}
                </>
              )}
            </Loaded>

            <section className="iss-report" aria-label="Crash report">
              <div className="iss-report__head">
                <h3 className="iss-report__title">Crash report</h3>
                {total > 0 && <span className="iss-report__position">{report.toLocaleString('en-US')} of {fmtK(total)}</span>}
                <IconButton aria-label="Previous crash report" disabled={report <= 1 || reports.loading} onClick={() => goToReport(report - 1)}>
                  <Icons.IconChevronLeft size={12} />
                </IconButton>
                <IconButton aria-label="Next crash report" disabled={report >= total || reports.loading} onClick={() => goToReport(report + 1)}>
                  <Icons.IconChevronRight size={12} />
                </IconButton>
              </div>
              {crash && <div className="iss-report__when">{fmtDateTime(crash.created_at)}</div>}
              <Loaded state={reports} preserveHeight>
                {() =>
                  crash ? (
                    <CrashReport
                      crash={crash}
                      canManage={canManage}
                      onRetraced={(updated) => setPatched((current) => ({ ...current, [updated.id]: updated }))}
                    />
                  ) : <EmptyState title="No crash reports in the selected period" />
                }
              </Loaded>
            </section>
          </div>
        )}
      </Loaded>

      {issue && (
        <ConfirmDialog
          open={confirmDelete}
          title="Delete this issue?"
          description={`All ${fmtK(issue.occurrences)} crash reports in this group will be permanently removed.`}
          confirmLabel="Delete"
          loading={deleting}
          onConfirm={() => void remove()}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </DetailPanel>
  )
}
