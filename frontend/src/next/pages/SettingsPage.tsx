import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Card, Form, FormItem, Icons, Input, Popconfirm, Text, toast } from '@/ui'
import type { App } from '@/types'
import { deleteApp, getApp, regenerateApiKey, updateApp } from '@/api/apps'
import { useAsync, Loaded } from '../async'
import './pages.css'

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
    navigate('/next')
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
