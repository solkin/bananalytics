import { useId, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Button,
  ConfirmDialog,
  Dialog,
  Field,
  FileButton,
  Input,
  Notice,
  Properties,
  SettingsGroup,
  SettingsRow,
  toast,
} from '@/ui'
import type { App } from '@/types'
import { deleteApp, deleteAppIcon, getApp, updateApp, uploadAppIcon } from '@/api/apps'
import {
  cleanupOrphanedCrashes,
  getRetentionPreview,
  migrateCrashFingerprints,
  trimOldData,
  type RetentionPreview,
  type TrimTarget,
} from '@/api/crashes'
import { AppIcon } from '../AppIcon'
import { useAsync, Loaded, errorText } from '../async'
import { fmtK, shortDate } from '../format'
import { IMAGE_ACCEPT, squarePng } from '../image'
import { useShell } from '../layout/AppShell'
import './settings.css'

const TRIM_STEPS: Array<{ target: TrimTarget; label: string; count: keyof RetentionPreview }> = [
  { target: 'crashes', label: 'Deleting old crash reports…', count: 'crashes' },
  { target: 'events', label: 'Deleting old analytics events…', count: 'events' },
  { target: 'sessions', label: 'Deleting old sessions…', count: 'sessions' },
]
const MAX_RETENTION_DAYS = 3650
const ICON_SIZE = 32

function TrimDialog({ appId, onClose }: { appId: string; onClose: () => void }) {
  const [days, setDays] = useState('90')
  const [reviewing, setReviewing] = useState(false)
  const [preview, setPreview] = useState<RetentionPreview | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState('')
  const [done, setDone] = useState(false)
  const retention = Number(days)
  const valid = Number.isInteger(retention) && retention >= 1 && retention <= MAX_RETENTION_DAYS

  const review = async () => {
    setReviewing(true)
    setProgress(0)
    setStage('')
    try {
      setPreview(await getRetentionPreview(appId, retention))
    } catch (e) {
      toast.error(errorText(e, 'Failed to calculate old data'))
    } finally {
      setReviewing(false)
    }
  }

  const trim = async () => {
    if (!preview) return
    setConfirming(false)
    setRunning(true)
    let completed = 0
    try {
      for (const step of TRIM_STEPS) {
        if ((preview[step.count] as number) === 0) continue
        setStage(step.label)
        let stepDone = false
        while (!stepDone) {
          const result = await trimOldData(appId, step.target, preview.cutoff)
          completed += result.deleted
          stepDone = result.done
          setProgress(Math.min(99, Math.round((completed / preview.total) * 100)))
        }
      }
      setProgress(100)
      setStage(`${fmtK(completed)} records deleted.`)
      setDone(true)
    } catch (e) {
      setStage('Cleanup stopped. Review the remaining data and try again.')
      setPreview(null)
      toast.error(errorText(e, 'Historical data cleanup stopped'))
    } finally {
      setRunning(false)
    }
  }

  return (
    <Dialog
      open
      onClose={running ? undefined : onClose}
      title="Trim historical data"
      width={520}
      footer={
        <>
          <Button onClick={onClose} disabled={running}>{done ? 'Done' : 'Cancel'}</Button>
          {!done && !preview && (
            <Button variant="primary" loading={reviewing} disabled={!valid || running} onClick={() => void review()}>Review data</Button>
          )}
          {!done && preview && preview.total > 0 && (
            <Button variant="danger-solid" loading={running} onClick={() => setConfirming(true)}>Delete old data</Button>
          )}
        </>
      }
    >
      <div className="set-trim">
        <p className="set-muted">
          This permanently removes old telemetry. Releases, mappings, APK files and settings are kept, and crash groups are recalculated.
        </p>
        <Field label="Keep recent data, days" help="Records older than this are deleted.">
          <Input
            type="number"
            min={1}
            max={MAX_RETENTION_DAYS}
            value={days}
            disabled={running}
            onChange={(e) => {
              setDays(e.target.value)
              setPreview(null)
              setDone(false)
              setProgress(0)
              setStage('')
            }}
          />
        </Field>
        {preview && (
          <div className="set-trim__preview">
            <div className="set-trim__preview-head">
              <span>Records older than {shortDate(preview.cutoff)}</span>
              <span className="set-trim__total">{fmtK(preview.total)}</span>
            </div>
            {preview.total > 0 ? (
              <Properties
                layout="columns"
                items={[
                  { label: 'Crash reports', value: preview.crashes.toLocaleString('en-US') },
                  { label: 'Events', value: preview.events.toLocaleString('en-US') },
                  { label: 'Sessions', value: preview.sessions.toLocaleString('en-US') },
                ]}
              />
            ) : <Notice className="set-notice">There is no data older than this retention period.</Notice>}
          </div>
        )}
        {(running || done || stage) && (
          <div aria-live="polite">
            <div className="set-progress__head">
              <span>{done ? 'Complete' : 'Cleanup progress'}</span>
              <span>{progress}%</span>
            </div>
            <div className="set-progress__track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Cleanup progress">
              <div className="set-progress__bar" style={{ width: `${progress}%` }} />
            </div>
            <div className="set-progress__stage">{stage}</div>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={confirming}
        title={preview ? `Delete ${fmtK(preview.total)} old records?` : ''}
        description="The deletion is permanent and cannot be undone."
        confirmLabel="Start cleanup"
        onConfirm={() => void trim()}
        onClose={() => setConfirming(false)}
      />
    </Dialog>
  )
}

/** One housekeeping job: runs on click and reports what it did in place. */
function MaintenanceRow({
  label,
  hint,
  run,
  failure,
}: {
  label: string
  hint: string
  run: () => Promise<string>
  failure: string
}) {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const start = async () => {
    setRunning(true)
    setResult(null)
    try {
      setResult(await run())
    } catch (e) {
      toast.error(errorText(e, failure))
    } finally {
      setRunning(false)
    }
  }
  return (
    <SettingsRow
      label={label}
      hint={
        <>
          {hint}
          {result && <span className="set-result" role="status">{result}</span>}
        </>
      }
    >
      <Button loading={running} onClick={() => void start()}>Run</Button>
    </SettingsRow>
  )
}

function SettingsForm({ app, onChanged }: { app: App; onChanged: () => void }) {
  const navigate = useNavigate()
  const nameId = useId()
  const [name, setName] = useState(app.name)
  const [saving, setSaving] = useState(false)
  const [iconBusy, setIconBusy] = useState(false)
  const [trimOpen, setTrimOpen] = useState(false)
  const [confirm, setConfirm] = useState<'app' | 'icon' | null>(null)
  const [deleting, setDeleting] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await updateApp(app.id, name.trim())
      toast.success('Settings saved')
      onChanged()
    } catch (e) {
      toast.error(errorText(e, 'Failed to save settings'))
    } finally {
      setSaving(false)
    }
  }

  const uploadIcon = async (file: File) => {
    setIconBusy(true)
    try {
      await uploadAppIcon(app.id, await squarePng(file))
      toast.success('Icon updated')
      onChanged()
    } catch (e) {
      toast.error(errorText(e, 'Failed to upload the icon'))
    } finally {
      setIconBusy(false)
    }
  }

  const confirmed = async () => {
    setDeleting(true)
    try {
      if (confirm === 'app') {
        await deleteApp(app.id)
        toast.success('Application deleted')
        navigate('/')
        return
      }
      await deleteAppIcon(app.id)
      toast.success('Icon removed')
      setConfirm(null)
      onChanged()
    } catch (e) {
      toast.error(errorText(e, confirm === 'app' ? 'Failed to delete the application' : 'Failed to remove the icon'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="set-page__groups">
      <SettingsGroup
        title="Application"
        footer={
          <Button variant="primary" loading={saving} disabled={!name.trim() || name.trim() === app.name} onClick={() => void save()}>
            Save changes
          </Button>
        }
      >
        <SettingsRow label="App icon" hint="PNG, JPEG or WebP, scaled down to 256×256.">
          <AppIcon name={app.name} iconUrl={app.icon_url} size={ICON_SIZE} />
          {app.icon_url && <Button variant="ghost" disabled={iconBusy} onClick={() => setConfirm('icon')}>Remove</Button>}
          <FileButton accept={IMAGE_ACCEPT} aria-label={app.icon_url ? 'Replace app icon' : 'Upload app icon'} loading={iconBusy} onFile={(file) => void uploadIcon(file)}>
            {app.icon_url ? 'Replace' : 'Upload'}
          </FileButton>
        </SettingsRow>
        <SettingsRow label="App name" htmlFor={nameId} stretch>
          <Input id={nameId} value={name} onChange={(e) => setName(e.target.value)} />
        </SettingsRow>
        <SettingsRow label="Package name" hint="Set at creation and immutable." stretch>
          <code className="bnn-mono">{app.package_name}</code>
        </SettingsRow>
        <SettingsRow label="Platform" stretch>Android</SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="Maintenance">
        <MaintenanceRow
          label="Regroup crashes"
          hint="Merge crash groups that differ only by variable data in the exception message."
          failure="Migration failed"
          run={async () => {
            const r = await migrateCrashFingerprints(app.id)
            return r.groups_merged > 0
              ? `${r.groups_merged} of ${r.groups_processed} groups merged, ${r.crashes_reassigned} crashes reassigned.`
              : 'No groups needed merging.'
          }}
        />
        <MaintenanceRow
          label="Clean up orphaned crashes"
          hint="Delete reports left behind by removed versions and recalculate group counters."
          failure="Cleanup failed"
          run={async () => {
            const r = await cleanupOrphanedCrashes(app.id)
            return r.crashes_deleted > 0
              ? `${r.crashes_deleted} crashes deleted, ${r.groups_recalculated} groups recalculated, ${r.groups_deleted} groups deleted.`
              : 'No orphaned crashes found.'
          }}
        />
        <SettingsRow
          label="Trim historical data"
          hint="Preview and permanently remove crash reports, events and sessions older than a retention period."
        >
          <Button onClick={() => setTrimOpen(true)}>Configure</Button>
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="Danger zone">
        <SettingsRow label="Delete this application" hint="All crashes, events and versions are permanently removed.">
          <Button variant="danger" onClick={() => setConfirm('app')}>Delete app</Button>
        </SettingsRow>
      </SettingsGroup>

      {trimOpen && <TrimDialog appId={app.id} onClose={() => setTrimOpen(false)} />}
      <ConfirmDialog
        open={confirm != null}
        title={confirm === 'app' ? `Delete ${app.name}?` : 'Remove the icon?'}
        description={confirm === 'app' ? 'This action cannot be undone.' : 'The app falls back to the letter generated from its name.'}
        confirmLabel={confirm === 'app' ? 'Delete' : 'Remove'}
        loading={deleting}
        onConfirm={() => void confirmed()}
        onClose={() => setConfirm(null)}
      />
    </div>
  )
}

export default function SettingsPage() {
  const { appId } = useParams()
  const { reloadApp } = useShell()
  const state = useAsync(() => getApp(appId!), [appId], { key: `app-settings:${appId}` })
  return (
    <div className="set-page">
      <h1 className="set-page__title">General</h1>
      <Loaded state={state}>
        {(app) => (
          <SettingsForm
            app={app}
            onChanged={() => {
              state.reload()
              /* The sidebar reads the app too, so a rename or a new icon has to reach both. */
              reloadApp()
            }}
          />
        )}
      </Loaded>
    </div>
  )
}
