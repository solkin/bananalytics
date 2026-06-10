import { useState } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import {
  Button,
  Card,
  Checkbox,
  Descriptions,
  Divider,
  Drawer,
  Form,
  FormItem,
  Icons,
  Input,
  Modal,
  Popconfirm,
  Switch,
  Table,
  Tag,
  Text,
  Textarea,
  UploadDragger,
  toast,
  type Column,
} from '@/ui'
import type { AppVersion } from '@/types'
import {
  createDownloadToken,
  createVersion,
  deleteApk,
  deleteVersion,
  getApkDownloadUrl,
  getAppMembers,
  getDistributionVersions,
  getMappingDownloadUrl,
  getVersions,
  notifyTesters,
  updateVersion,
  uploadApk,
  uploadMapping,
  type AppMember,
} from '@/api/apps'
import { useAuth } from '@/context/AuthContext'
import { useAsync, Loaded, errorText } from '../async'
import { fmtBytes, fmtDateTime, shortDate } from '../format'
import type { ShellContext } from '../layout/AppShell'
import './pages.css'

const versionTitle = (v: AppVersion) =>
  v.version_name ? `${v.version_name} (${v.version_code})` : `Build ${v.version_code}`

/* ------------------------------------------------- New release modal */
function NewReleaseModal({
  appId,
  open,
  onClose,
  onCreated,
}: {
  appId: string
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [notes, setNotes] = useState('')
  const [apk, setApk] = useState<File | null>(null)
  const [mapping, setMapping] = useState<File | null>(null)
  const [creating, setCreating] = useState(false)
  const codeNum = Number(code)
  const valid = code.trim() !== '' && Number.isInteger(codeNum) && codeNum > 0

  const create = async () => {
    if (!valid) return toast.error('Version code must be a positive number')
    setCreating(true)
    try {
      const version = await createVersion(appId, codeNum, name.trim() || undefined, mapping ?? undefined)
      if (apk) await uploadApk(appId, version.id, apk)
      if (notes.trim()) await updateVersion(appId, version.id, { release_notes: notes.trim() })
      toast.success('Release created')
      onClose()
      onCreated()
    } catch (e) {
      toast.error(errorText(e, 'Failed to create release'))
    } finally {
      setCreating(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New release"
      width={560}
      okText="Create release"
      onOk={create}
      confirmLoading={creating}
    >
      <Form>
        <FormItem label="Version name">
          <Input placeholder="1.2.3" value={name} onChange={(e) => setName(e.target.value)} />
        </FormItem>
        <FormItem label="Version code" required>
          <Input type="number" min={1} placeholder="123" value={code} onChange={(e) => setCode(e.target.value)} />
        </FormItem>
        <FormItem label="Release notes">
          <Textarea rows={3} placeholder="What's new in this version…" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormItem>
        <FormItem label="APK file" help="Optional — you can upload it later.">
          <UploadDragger
            accept=".apk"
            title={apk ? apk.name : 'Click or drag APK file'}
            hint={apk ? fmtBytes(apk.size) : 'Up to 200 MB'}
            onFiles={(files) => setApk(files[0] ?? null)}
          />
        </FormItem>
        <FormItem label="Mapping file" help="Optional — ProGuard / R8 mapping for stack trace deobfuscation.">
          <UploadDragger
            accept=".txt,.map"
            title={mapping ? mapping.name : 'Click or drag mapping.txt'}
            onFiles={(files) => setMapping(files[0] ?? null)}
          />
        </FormItem>
      </Form>
    </Modal>
  )
}

/* ---------------------------------------------- Notify testers modal */
function NotifyTestersModal({
  appId,
  version,
  open,
  onClose,
  onPublish,
}: {
  appId: string
  version: AppVersion
  open: boolean
  onClose: () => void
  onPublish: () => Promise<void>
}) {
  const members = useAsync(() => getAppMembers(appId), [appId])
  const [selected, setSelected] = useState<string[] | null>(null)
  const [working, setWorking] = useState(false)
  const list = members.data ?? []
  const emails = selected ?? list.map((m) => m.email)

  const toggle = (email: string, on: boolean) =>
    setSelected(on ? [...emails, email] : emails.filter((e) => e !== email))

  const publish = async (notify: boolean) => {
    setWorking(true)
    try {
      await onPublish()
      if (notify && emails.length > 0) {
        const result = await notifyTesters(appId, version.id, emails)
        if (result.sent > 0) toast.success(`Notified ${result.sent} ${result.sent === 1 ? 'tester' : 'testers'}`)
        if (result.failed > 0) toast.warning(`Failed to notify ${result.failed}`)
      }
      onClose()
    } catch (e) {
      toast.error(errorText(e, 'Failed to publish'))
    } finally {
      setWorking(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Notify testers"
      width={500}
      footer={
        <>
          <Button onClick={() => publish(false)} disabled={working}>Skip</Button>
          <Button
            variant="primary"
            icon={<Icons.IconSend size={14} />}
            loading={working}
            disabled={emails.length === 0}
            onClick={() => publish(true)}
          >
            Notify & publish
          </Button>
        </>
      }
    >
      <div className="rel-notify">
        <Text>
          <Text strong>{versionTitle(version)}</Text> is ready for testing. Select who should receive an email:
        </Text>
        <div className="rel-notify__bulk">
          <Button size="sm" onClick={() => setSelected(list.map((m) => m.email))}>Select all</Button>
          <Button size="sm" onClick={() => setSelected([])}>Deselect all</Button>
          <Text type="tertiary" size="sm">{emails.length} of {list.length} selected</Text>
        </div>
        <div className="rel-notify__list">
          <Loaded state={members} emptyText="No members">
            {(items: AppMember[]) => (
              <>
                {items.map((m) => (
                  <div key={m.email} className="rel-notify__row">
                    <Checkbox checked={emails.includes(m.email)} onChange={(on) => toggle(m.email, on)}>
                      <span className="rel-notify__who">
                        <span>{m.name || m.email}</span>
                        {m.name && <Text type="tertiary" size="sm">{m.email}</Text>}
                      </span>
                    </Checkbox>
                    <Tag>{m.role}</Tag>
                  </div>
                ))}
              </>
            )}
          </Loaded>
        </div>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------ Release drawer */
function ReleaseDrawer({
  appId,
  version,
  smtpConfigured,
  onClose,
  onChanged,
  onUpdated,
}: {
  appId: string
  version: AppVersion
  smtpConfigured: boolean
  onClose: () => void
  onChanged: () => void
  onUpdated: (v: AppVersion) => void
}) {
  const [notes, setNotes] = useState(version.release_notes ?? '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<'apk' | 'mapping' | null>(null)
  const [link, setLink] = useState<string | null>(null)
  const [notifyOpen, setNotifyOpen] = useState(false)

  const apply = async (data: Parameters<typeof updateVersion>[2], ok: string) => {
    try {
      const updated = await updateVersion(appId, version.id, data)
      onUpdated(updated)
      onChanged()
      toast.success(ok)
    } catch (e) {
      toast.error(errorText(e, 'Failed to update release'))
    }
  }

  const togglePublished = (on: boolean) => {
    if (on && smtpConfigured) setNotifyOpen(true)
    else void apply({ published_for_testers: on }, on ? 'Published for testers' : 'Unpublished')
  }

  const saveNotes = async () => {
    setSaving(true)
    await apply({ release_notes: notes }, 'Release notes saved')
    setSaving(false)
  }

  const upload = async (kind: 'apk' | 'mapping', file: File) => {
    setUploading(kind)
    try {
      const updated = kind === 'apk'
        ? await uploadApk(appId, version.id, file)
        : await uploadMapping(appId, version.id, file)
      onUpdated(updated)
      onChanged()
      toast.success(kind === 'apk' ? 'APK uploaded' : 'Mapping uploaded')
    } catch (e) {
      toast.error(errorText(e, 'Upload failed'))
    } finally {
      setUploading(null)
    }
  }

  const removeApk = async () => {
    try {
      await deleteApk(appId, version.id)
      onUpdated({ ...version, has_apk: false, apk_size: null, apk_filename: null, apk_uploaded_at: null })
      onChanged()
      toast.success('APK deleted')
    } catch (e) {
      toast.error(errorText(e, 'Failed to delete APK'))
    }
  }

  const removeVersion = async () => {
    try {
      await deleteVersion(appId, version.id)
      toast.success('Release deleted')
      onClose()
      onChanged()
    } catch (e) {
      toast.error(errorText(e, 'Failed to delete release'))
    }
  }

  const createLink = async () => {
    try {
      const token = await createDownloadToken(appId, version.id, 24)
      setLink(`${window.location.origin}${token.download_url}`)
    } catch (e) {
      toast.error(errorText(e, 'Failed to create link'))
    }
  }

  return (
    <Drawer open onClose={onClose} title={versionTitle(version)} width={480}>
      <div className="rel-drawer">
        <Descriptions
          column={1}
          size="sm"
          items={[
            { label: 'Version code', value: <Text mono>{version.version_code}</Text> },
            { label: 'Version name', value: version.version_name || '—' },
            { label: 'Created', value: fmtDateTime(version.created_at) },
          ]}
        />

        <Divider>Settings</Divider>
        <div className="rel-toggles">
          <div className="rel-toggles__row">
            <div>
              <Text strong>Published for testers</Text>
              <div><Text type="tertiary" size="sm">Visible on the install page for testers.</Text></div>
            </div>
            <Switch checked={version.published_for_testers} onChange={togglePublished} />
          </div>
          <div className="rel-toggles__row">
            <div>
              <Text strong>Crash reporting</Text>
              <div><Text type="tertiary" size="sm">Accept crash reports from this version.</Text></div>
            </div>
            <Switch checked={!version.mute_crashes} onChange={(on) => void apply({ mute_crashes: !on }, 'Settings updated')} />
          </div>
          <div className="rel-toggles__row">
            <div>
              <Text strong>Analytics events</Text>
              <div><Text type="tertiary" size="sm">Accept analytics events from this version.</Text></div>
            </div>
            <Switch checked={!version.mute_events} onChange={(on) => void apply({ mute_events: !on }, 'Settings updated')} />
          </div>
        </div>

        <Divider>Release notes</Divider>
        <Textarea rows={3} placeholder="What's new in this version…" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div>
          <Button loading={saving} disabled={notes === (version.release_notes ?? '')} onClick={saveNotes}>
            Save notes
          </Button>
        </div>

        <Divider>APK</Divider>
        {version.has_apk && (
          <>
            <Descriptions
              column={1}
              size="sm"
              items={[
                { label: 'File', value: version.apk_filename ?? '—' },
                { label: 'Size', value: fmtBytes(version.apk_size) },
                { label: 'Uploaded', value: version.apk_uploaded_at ? fmtDateTime(version.apk_uploaded_at) : '—' },
              ]}
            />
            <div className="rel-actions">
              <Button
                icon={<Icons.IconDownload size={14} />}
                onClick={() => window.open(getApkDownloadUrl(appId, version.id), '_blank')}
              >
                Download
              </Button>
              <Button icon={<Icons.IconExternalLink size={14} />} onClick={createLink}>Share link</Button>
              <Popconfirm title="Delete APK?" okText="Delete" okDanger onConfirm={removeApk}>
                <Button variant="danger" icon={<Icons.IconTrash size={14} />}>Delete</Button>
              </Popconfirm>
            </div>
            {link && (
              <div className="rel-link">
                <Input
                  value={link}
                  readOnly
                  suffix={
                    <button
                      type="button"
                      className="bnn-input__toggle"
                      onClick={() => {
                        navigator.clipboard?.writeText(link)
                        toast.success('Link copied — valid for 24 hours')
                      }}
                    >
                      Copy
                    </button>
                  }
                />
              </div>
            )}
          </>
        )}
        <UploadDragger
          accept=".apk"
          disabled={uploading != null}
          title={uploading === 'apk' ? 'Uploading…' : version.has_apk ? 'Click or drag to replace APK' : 'Click or drag APK file'}
          hint="Up to 200 MB"
          onFiles={(files) => files[0] && void upload('apk', files[0])}
        />

        <Divider>Mapping</Divider>
        {version.has_mapping && (
          <div className="rel-actions">
            <Button
              icon={<Icons.IconDownload size={14} />}
              onClick={() => window.open(getMappingDownloadUrl(appId, version.id), '_blank')}
            >
              Download mapping
            </Button>
          </div>
        )}
        <UploadDragger
          accept=".txt,.map"
          disabled={uploading != null}
          title={uploading === 'mapping' ? 'Uploading…' : version.has_mapping ? 'Click or drag to replace mapping.txt' : 'Click or drag mapping.txt'}
          onFiles={(files) => files[0] && void upload('mapping', files[0])}
        />

        <Divider>Danger zone</Divider>
        <Popconfirm
          title="Delete this release?"
          description="Events and sessions of this version are removed; crashes are unlinked but preserved."
          okText="Delete"
          okDanger
          onConfirm={removeVersion}
        >
          <Button variant="danger" icon={<Icons.IconTrash size={14} />} block>Delete release</Button>
        </Popconfirm>
      </div>

      {notifyOpen && (
        <NotifyTestersModal
          appId={appId}
          version={version}
          open
          onClose={() => setNotifyOpen(false)}
          onPublish={async () => {
            const updated = await updateVersion(appId, version.id, { published_for_testers: true })
            onUpdated(updated)
            onChanged()
          }}
        />
      )}
    </Drawer>
  )
}

/* ---------------------------------------------------- Tester install view */
function InstallView({ appId }: { appId: string }) {
  const state = useAsync(() => getDistributionVersions(appId), [appId])
  return (
    <div className="pg">
      <Loaded state={state} emptyText="No builds available for testing yet">
        {(versions) => (
          <>
            {versions.map((v) => (
              <Card key={v.id}>
                <div className="rel-install">
                  <div className="rel-install__info">
                    <div className="rel-install__title">
                      <Text strong size="lg">{v.version_name || `Version ${v.version_code}`}</Text>
                      <Tag tone="primary">v{v.version_code}</Tag>
                    </div>
                    <Text type="secondary" size="sm">
                      {v.apk_uploaded_at ? `Published ${shortDate(v.apk_uploaded_at)}` : `Created ${shortDate(v.created_at)}`}
                      {v.apk_size != null && ` • ${fmtBytes(v.apk_size)}`}
                    </Text>
                    {v.release_notes && (
                      <div className="rel-install__notes">
                        <Text strong size="sm">What's new</Text>
                        <div className="rel-install__notes-body">{v.release_notes}</div>
                      </div>
                    )}
                  </div>
                  <div className="rel-install__action">
                    <Button
                      variant="primary"
                      size="lg"
                      icon={<Icons.IconDownload size={16} />}
                      disabled={!v.has_apk}
                      onClick={() => window.open(getApkDownloadUrl(appId, v.id), '_blank')}
                    >
                      Download
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </>
        )}
      </Loaded>
    </div>
  )
}

/* ------------------------------------------------------------- Page */
export default function ReleasesPage() {
  const { appId } = useParams()
  const { role } = useOutletContext<ShellContext>()
  const { config } = useAuth()
  const state = useAsync(() => getVersions(appId!), [appId])
  const [createOpen, setCreateOpen] = useState(false)
  const [sel, setSel] = useState<AppVersion | null>(null)

  if (role === 'tester') return <InstallView appId={appId!} />

  const columns: Column<AppVersion>[] = [
    {
      key: 'release', title: 'Release',
      render: (r) => (
        <div className="pg-titlecell">
          <span className="pg-titlecell__main">{r.version_name || '—'} ({r.version_code})</span>
          <span className="pg-titlecell__sub">{r.release_notes || 'No release notes'}</span>
        </div>
      ),
    },
    { key: 'date', title: 'Created', align: 'right', sorter: (a, b) => a.created_at.localeCompare(b.created_at), render: (r) => <Text type="secondary">{shortDate(r.created_at)}</Text> },
    { key: 'size', title: 'APK', align: 'right', render: (r) => <Text type="secondary">{r.has_apk ? fmtBytes(r.apk_size) : 'No APK'}</Text> },
    { key: 'mapping', title: 'Mapping', align: 'right', render: (r) => <Tag tone={r.has_mapping ? 'success' : 'neutral'}>{r.has_mapping ? 'Yes' : 'No'}</Tag> },
    { key: 'status', title: 'Status', align: 'right', render: (r) => <Tag tone={r.published_for_testers ? 'primary' : 'neutral'}>{r.published_for_testers ? 'Published' : 'Draft'}</Tag> },
    {
      key: 'apk', title: '', align: 'right',
      render: (r) => r.has_apk
        ? (
          <Button
            size="sm"
            icon={<Icons.IconDownload size={14} />}
            onClick={(e) => {
              e.stopPropagation()
              window.open(getApkDownloadUrl(appId!, r.id), '_blank')
            }}
          >
            APK
          </Button>
        )
        : null,
    },
  ]

  return (
    <div className="pg">
      <div className="pg-toolbar">
        <Button variant="primary" icon={<Icons.IconUpload size={15} />} onClick={() => setCreateOpen(true)}>
          New release
        </Button>
      </div>
      <Card title="Releases" padded={false}>
        <Loaded state={state} emptyText="No releases yet">
          {(versions) => (
            <Table<AppVersion>
              columns={columns}
              data={versions}
              rowKey={(r) => r.id}
              pageSize={15}
              emptyText="No releases yet"
              onRowClick={(r) => setSel(r)}
            />
          )}
        </Loaded>
      </Card>

      <NewReleaseModal appId={appId!} open={createOpen} onClose={() => setCreateOpen(false)} onCreated={state.reload} />

      {sel && (
        <ReleaseDrawer
          appId={appId!}
          version={sel}
          smtpConfigured={!!config?.smtp_configured}
          onClose={() => setSel(null)}
          onChanged={state.reload}
          onUpdated={setSel}
        />
      )}
    </div>
  )
}
