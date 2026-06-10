import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Card, Form, FormItem, Icons, Input, Popconfirm, Statistic, Text, toast } from '@/ui'
import type { App } from '@/types'
import { deleteApp, getApp, regenerateApiKey, updateApp } from '@/api/apps'
import {
  cleanupOrphanedCrashes,
  migrateCrashFingerprints,
  type CleanupResult,
  type MigrationResult,
} from '@/api/crashes'
import { useAsync, Loaded, errorText } from '../async'
import './pages.css'

function MaintenanceCard({ appId }: { appId: string }) {
  const [migrating, setMigrating] = useState(false)
  const [migration, setMigration] = useState<MigrationResult | null>(null)
  const [cleaning, setCleaning] = useState(false)
  const [cleanup, setCleanup] = useState<CleanupResult | null>(null)

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
      </div>
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
