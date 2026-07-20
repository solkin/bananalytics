import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Alert, Button, Card, Form, FormItem, Icons, Input, Modal, Popconfirm, Statistic, Text, toast } from '@/ui'
import type { App } from '@/types'
import { deleteApp, getApp, regenerateApiKey, updateApp } from '@/api/apps'
import {
  cleanupOrphanedCrashes,
  getRetentionPreview,
  migrateCrashFingerprints,
  trimOldData,
  type CleanupResult,
  type MigrationResult,
  type RetentionPreview,
  type TrimTarget,
} from '@/api/crashes'
import { useAsync, Loaded, errorText } from '../async'
import { fmtK } from '../format'
import './pages.css'

const TRIM_STEPS: Array<{ target: TrimTarget; label: string; count: keyof RetentionPreview }> = [
  { target: 'crashes', label: 'Deleting old crash reports…', count: 'crashes' },
  { target: 'events', label: 'Deleting old analytics events…', count: 'events' },
  { target: 'sessions', label: 'Deleting old sessions…', count: 'sessions' },
]

function TrimDataModal({ appId, open, onClose }: { appId: string; open: boolean; onClose: () => void }) {
  const [days, setDays] = useState('90')
  const [reviewing, setReviewing] = useState(false)
  const [preview, setPreview] = useState<RetentionPreview | null>(null)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState('')
  const [done, setDone] = useState(false)
  const [deleted, setDeleted] = useState<Record<TrimTarget, number>>({ crashes: 0, events: 0, sessions: 0 })
  const retentionDays = Number(days)
  const valid = Number.isInteger(retentionDays) && retentionDays >= 1 && retentionDays <= 3650

  const resetReview = (value: string) => {
    setDays(value)
    setPreview(null)
    setDone(false)
    setProgress(0)
    setStage('')
  }

  const review = async () => {
    if (!valid) return toast.error('Retention must be between 1 and 3650 days')
    setReviewing(true)
    setDone(false)
    setProgress(0)
    setStage('Calculating affected records…')
    setDeleted({ crashes: 0, events: 0, sessions: 0 })
    try {
      setPreview(await getRetentionPreview(appId, retentionDays))
      setStage('Review the totals before deleting data.')
    } catch (e) {
      toast.error(errorText(e, 'Failed to calculate old data'))
      setStage('')
    } finally {
      setReviewing(false)
    }
  }

  const trim = async () => {
    if (!preview || preview.total === 0) return
    setRunning(true)
    setDone(false)
    setProgress(0)
    const removed: Record<TrimTarget, number> = { crashes: 0, events: 0, sessions: 0 }
    setDeleted(removed)
    let completed = 0
    try {
      for (const step of TRIM_STEPS) {
        const expected = preview[step.count] as number
        if (expected === 0) continue
        setStage(step.label)
        let stepDone = false
        while (!stepDone) {
          const result = await trimOldData(appId, step.target, preview.cutoff)
          removed[step.target] += result.deleted
          completed += result.deleted
          stepDone = result.done
          setDeleted({ ...removed })
          setProgress(Math.min(99, Math.round((completed / preview.total) * 100)))
        }
      }
      setProgress(100)
      setStage('Historical data cleanup completed.')
      setDone(true)
      toast.success(`${fmtK(Object.values(removed).reduce((sum, count) => sum + count, 0))} records deleted`)
    } catch (e) {
      setStage('Cleanup stopped. Review the remaining data and try again.')
      setPreview(null)
      toast.error(errorText(e, 'Historical data cleanup stopped'))
    } finally {
      setRunning(false)
    }
  }

  const close = () => {
    if (!running) onClose()
  }

  return (
    <Modal
      open={open}
      onClose={running ? undefined : close}
      title="Trim historical data"
      width={560}
      footer={
        <>
          <Button onClick={close} disabled={running}>{done ? 'Done' : 'Cancel'}</Button>
          {!done && (!preview ? (
            <Button variant="primary" loading={reviewing} disabled={!valid || running} onClick={review}>
              Review data
            </Button>
          ) : preview.total > 0 ? (
            <Popconfirm
              title={`Delete ${fmtK(preview.total)} old records?`}
              description="The deletion is permanent and cannot be undone."
              okText="Start cleanup"
              okDanger
              onConfirm={trim}
            >
              <Button variant="danger" loading={running} disabled={running}>Delete old data</Button>
            </Popconfirm>
          ) : null)}
        </>
      }
    >
      <div className="set-trim">
        <Alert
          type="warning"
          message="This permanently removes historical telemetry"
          description="Releases, mappings, APK files, and application settings are kept. Crash groups are recalculated after old reports are removed."
        />
        <FormItem label="Keep recent data" help="Records older than this retention period will be deleted.">
          <Input
            type="number"
            min={1}
            max={3650}
            value={days}
            disabled={running}
            suffix={<Text type="tertiary">days</Text>}
            onChange={(e) => resetReview(e.target.value)}
          />
        </FormItem>

        {preview && (
          <div className="set-trim__preview">
            <div className="set-trim__preview-head">
              <Text strong>Records older than {new Date(preview.cutoff).toLocaleDateString()}</Text>
              <Text type="danger" strong>{fmtK(preview.total)} total</Text>
            </div>
            <div className="set-maint__stats">
              <Statistic title="Crash reports" value={preview.crashes} />
              <Statistic title="Events" value={preview.events} />
              <Statistic title="Sessions" value={preview.sessions} />
            </div>
            {preview.total === 0 && <Text type="tertiary">There is no data older than this retention period.</Text>}
          </div>
        )}

        {(running || done || progress > 0) && (
          <div className="set-trim__progress" aria-live="polite">
            <div className="set-trim__progress-head">
              <Text strong>{done ? 'Complete' : 'Cleanup progress'}</Text>
              <Text strong>{progress}%</Text>
            </div>
            <div className="set-trim__track">
              <div className="set-trim__bar" style={{ width: `${progress}%` }} />
            </div>
            <Text type="secondary" size="sm">{stage}</Text>
            {(done || Object.values(deleted).some(Boolean)) && (
              <Text type="tertiary" size="sm">
                Deleted: {fmtK(deleted.crashes)} crashes, {fmtK(deleted.events)} events, {fmtK(deleted.sessions)} sessions
              </Text>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

function MaintenanceCard({ appId }: { appId: string }) {
  const [migrating, setMigrating] = useState(false)
  const [migration, setMigration] = useState<MigrationResult | null>(null)
  const [cleaning, setCleaning] = useState(false)
  const [cleanup, setCleanup] = useState<CleanupResult | null>(null)
  const [trimOpen, setTrimOpen] = useState(false)

  const migrate = async () => {
    setMigrating(true)
    setMigration(null)
    try {
      const result = await migrateCrashFingerprints(appId)
      setMigration(result)
      toast.success(result.groups_merged > 0 ? `${result.groups_merged} groups merged` : 'No groups needed merging')
    } catch (e) {
      toast.error(errorText(e, 'Migration failed'))
    } finally {
      setMigrating(false)
    }
  }

  const clean = async () => {
    setCleaning(true)
    setCleanup(null)
    try {
      const result = await cleanupOrphanedCrashes(appId)
      setCleanup(result)
      toast.success(result.crashes_deleted > 0 ? `${result.crashes_deleted} crashes deleted` : 'No orphaned crashes found')
    } catch (e) {
      toast.error(errorText(e, 'Cleanup failed'))
    } finally {
      setCleaning(false)
    }
  }

  return (
    <Card title="Maintenance" subtitle="One-off housekeeping for crash data.">
      <div className="set-maint">
        <div className="set-maint__row">
          <div>
            <Text strong>Regroup crashes</Text>
            <div>
              <Text type="secondary" size="sm">
                Merge crash groups that differ only by variable data in the exception message (memory sizes, file paths, timestamps).
              </Text>
            </div>
          </div>
          <Button icon={<Icons.IconLayers size={15} />} loading={migrating} onClick={migrate}>Run</Button>
        </div>
        {migration && (
          <div className="set-maint__stats">
            <Statistic title="Groups processed" value={migration.groups_processed} />
            <Statistic title="Groups merged" value={migration.groups_merged} />
            <Statistic title="Crashes reassigned" value={migration.crashes_reassigned} />
          </div>
        )}
        <div className="set-maint__row">
          <div>
            <Text strong>Cleanup orphaned crashes</Text>
            <div>
              <Text type="secondary" size="sm">
                Delete crash reports left behind by removed versions and recalculate group counters.
              </Text>
            </div>
          </div>
          <Button icon={<Icons.IconReload size={15} />} loading={cleaning} onClick={clean}>Run</Button>
        </div>
        {cleanup && (
          <div className="set-maint__stats">
            <Statistic title="Crashes deleted" value={cleanup.crashes_deleted} />
            <Statistic title="Groups recalculated" value={cleanup.groups_recalculated} />
            <Statistic title="Groups deleted" value={cleanup.groups_deleted} />
          </div>
        )}
        <div className="set-maint__row">
          <div>
            <Text strong>Trim historical data</Text>
            <div>
              <Text type="secondary" size="sm">
                Preview and permanently remove crash reports, events, and sessions older than a retention period.
              </Text>
            </div>
          </div>
          <Button icon={<Icons.IconTrash size={15} />} onClick={() => setTrimOpen(true)}>Configure</Button>
        </div>
      </div>
      {trimOpen && <TrimDataModal appId={appId} open onClose={() => setTrimOpen(false)} />}
    </Card>
  )
}

function SettingsForm({ app, onChanged }: { app: App; onChanged: () => void }) {
  const navigate = useNavigate()
  const [name, setName] = useState(app.name)
  const [apiKey, setApiKey] = useState(app.api_key)

  const save = async () => {
    await updateApp(app.id, name)
    toast.success('Settings saved')
    onChanged()
  }
  const regen = async () => {
    setApiKey(await regenerateApiKey(app.id))
    toast.success('API key regenerated')
  }
  const remove = async () => {
    await deleteApp(app.id)
    toast.success('Application deleted')
    navigate('/')
  }

  return (
    <>
      <Card title="Application">
        <Form>
          <FormItem label="App name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </FormItem>
          <FormItem label="Package name" help="Set at creation and immutable.">
            <Input value={app.package_name} disabled />
          </FormItem>
          <FormItem label="Platform">
            <Input value="Android" disabled />
          </FormItem>
          <div>
            <Button variant="primary" onClick={save}>Save changes</Button>
          </div>
        </Form>
      </Card>

      <Card title="API key" subtitle="Used by the SDK to submit crashes and events.">
        <div className="pg-apikey">
          <Input value={apiKey} readOnly prefix={<Icons.IconLock size={15} />} />
          <Button icon={<Icons.IconCopy size={15} />} onClick={() => { navigator.clipboard?.writeText(apiKey); toast.success('Copied to clipboard') }}>Copy</Button>
          <Popconfirm title="Regenerate API key?" description="The old key stops working immediately." okDanger okText="Regenerate" onConfirm={regen}>
            <Button>Regenerate</Button>
          </Popconfirm>
        </div>
      </Card>

      <MaintenanceCard appId={app.id} />

      <Card title="Danger zone" className="pg-danger">
        <div className="pg-danger__row">
          <div>
            <Text strong>Delete this application</Text>
            <div><Text type="secondary" size="sm">All crashes, events and versions will be permanently removed.</Text></div>
          </div>
          <Popconfirm title={`Delete ${app.name}?`} description="This action cannot be undone." okDanger okText="Delete" onConfirm={remove}>
            <Button variant="danger" icon={<Icons.IconTrash size={15} />}>Delete app</Button>
          </Popconfirm>
        </div>
      </Card>
    </>
  )
}

export default function SettingsPage() {
  const { appId } = useParams()
  const state = useAsync(() => getApp(appId!), [appId])
  return (
    <div className="pg">
      <Loaded state={state}>{(app) => <SettingsForm app={app} onChanged={state.reload} />}</Loaded>
    </div>
  )
}
