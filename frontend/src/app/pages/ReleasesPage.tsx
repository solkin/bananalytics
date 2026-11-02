import { useEffect, useState } from 'react'
import { Outlet, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import {
  Button,
  Checkbox,
  DataList,
  Dialog,
  Dropzone,
  Field,
  Form,
  Input,
  PageHeader,
  SplitView,
  Status,
  Textarea,
  toast,
  type DataListColumn,
} from '@/ui'
import type { AppVersion } from '@/types'
import {
  createVersion,
  getAppMembers,
  getVersions,
  notifyTesters,
  updateVersion,
  uploadApk,
  type AppMember,
} from '@/api/apps'
import { useAsync, Loaded, errorText } from '../async'
import { useRegisterCommands } from '../commands'
import { fmtBytes, shortDate } from '../format'
import { useShell, type ShellContext } from '../layout/AppShell'
import { MAPPING_ACCEPT } from './MappingsPage'
import './releases.css'

export const versionTitle = (v: AppVersion) =>
  v.version_name ? `${v.version_name} (${v.version_code})` : `Build ${v.version_code}`

export interface ReleasesContext extends ShellContext {
  versions: AppVersion[]
  loading: boolean
  reload: () => void
  close: () => void
}

export function useReleases() {
  return useOutletContext<ReleasesContext>()
}

const NEW_RELEASE_FORM = 'new-release'

function NewReleaseDialog({ appId, onClose, onCreated }: { appId: string; onClose: () => void; onCreated: (version: AppVersion) => void }) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [notes, setNotes] = useState('')
  const [apk, setApk] = useState<File | null>(null)
  const [mapping, setMapping] = useState<File | null>(null)
  const [creating, setCreating] = useState(false)

  const create = async () => {
    const versionCode = Number(code)
    if (!code.trim() || !Number.isInteger(versionCode) || versionCode <= 0) {
      return toast.error('Version code must be a positive number')
    }
    setCreating(true)
    try {
      let version = await createVersion(appId, versionCode, name.trim() || undefined, mapping ?? undefined)
      if (apk) version = await uploadApk(appId, version.id, apk)
      if (notes.trim()) version = await updateVersion(appId, version.id, { release_notes: notes.trim() })
      toast.success('Release created')
      onCreated(version)
    } catch (e) {
      toast.error(errorText(e, 'Failed to create release'))
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog
      open
      onClose={creating ? undefined : onClose}
      title="New release"
      width={520}
      footer={
        <>
          <Button onClick={onClose} disabled={creating}>Cancel</Button>
          <Button variant="primary" loading={creating} type="submit" form={NEW_RELEASE_FORM}>Create release</Button>
        </>
      }
    >
      <Form id={NEW_RELEASE_FORM} onSubmit={create}>
        <div className="rel-pair">
          <Field label="Version name">
            <Input placeholder="1.2.3" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Version code" required>
            <Input type="number" min={1} placeholder="123" value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
        </div>
        <Field label="Release notes">
          <Textarea placeholder="What's new in this version" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div className="rel-pair">
          <Dropzone
            accept=".apk"
            title={apk ? apk.name : 'APK file'}
            hint={apk ? fmtBytes(apk.size) : 'Optional, up to 200 MB'}
            onFiles={(files) => setApk(files[0] ?? null)}
          />
          <Dropzone
            accept={MAPPING_ACCEPT}
            title={mapping ? mapping.name : 'Mapping file'}
            hint={mapping ? fmtBytes(mapping.size) : 'Optional, .txt, .map or .gz'}
            onFiles={(files) => setMapping(files[0] ?? null)}
          />
        </div>
      </Form>
    </Dialog>
  )
}

/** Publishes a build, offering to email the people who can install it. */
export function NotifyTestersDialog({
  appId,
  version,
  onClose,
  onPublish,
}: {
  appId: string
  version: AppVersion
  onClose: () => void
  onPublish: () => Promise<void>
}) {
  const members = useAsync(() => getAppMembers(appId), [appId])
  const [selected, setSelected] = useState<string[] | null>(null)
  const [working, setWorking] = useState(false)
  const list = members.data ?? []
  const emails = selected ?? list.map((m) => m.email)
  const allSelected = list.length > 0 && emails.length === list.length

  const publish = async (notify: boolean) => {
    setWorking(true)
    try {
      await onPublish()
      if (notify && emails.length > 0) {
        const result = await notifyTesters(appId, version.id, emails)
        if (result.sent > 0) toast.success(`Notified ${result.sent} ${result.sent === 1 ? 'person' : 'people'}`)
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
    <Dialog
      open
      onClose={working ? undefined : onClose}
      title="Notify testers"
      footer={
        <>
          <Button onClick={() => void publish(false)} disabled={working}>Skip</Button>
          <Button variant="primary" loading={working} disabled={emails.length === 0} onClick={() => void publish(true)}>
            Notify and publish
          </Button>
        </>
      }
    >
      <p className="rel-notify__text">{versionTitle(version)} is ready for testing. Select who should receive an email.</p>
      <div className="rel-notify__bulk">
        <span>{emails.length} of {list.length} selected</span>
        <Button variant="ghost" onClick={() => setSelected(allSelected ? [] : list.map((m) => m.email))}>
          {allSelected ? 'Deselect all' : 'Select all'}
        </Button>
      </div>
      <Loaded state={members} emptyText="No members">
        {(items: AppMember[]) => (
          <ul className="rel-notify__list">
            {items.map((m) => (
              <li key={m.email}>
                <Checkbox
                  className="rel-notify__person"
                  checked={emails.includes(m.email)}
                  onChange={(on) => setSelected(on ? [...emails, m.email] : emails.filter((e) => e !== m.email))}
                >
                  <span className="rel-notify__who">
                    <span className="rel-notify__name">{m.name || m.email}</span>
                    {m.name && <span className="rel-notify__email">{m.email}</span>}
                  </span>
                  <span className="rel-notify__role">{m.role}</span>
                </Checkbox>
              </li>
            ))}
          </ul>
        )}
      </Loaded>
    </Dialog>
  )
}

const COLUMNS: DataListColumn<AppVersion>[] = [
  {
    key: 'version',
    title: 'Version',
    width: 136,
    render: (r) => (
      <span className="rel-version">
        <strong>{r.version_name || '—'}</strong> <span className="rel-faint">{r.version_code}</span>
      </span>
    ),
  },
  {
    key: 'notes',
    title: 'Notes',
    render: (r) => (
      <span className="rel-notes">
        <span className={r.release_notes ? 'rel-notes__text' : 'rel-notes__text rel-faint'}>{r.release_notes || 'No release notes'}</span>
        {!r.has_mapping && <Status tone="warning">No mapping</Status>}
      </span>
    ),
  },
  {
    key: 'status',
    title: 'Status',
    width: 108,
    render: (r) => <Status tone={r.published_for_testers ? 'positive' : 'neutral'}>{r.published_for_testers ? 'Published' : 'Draft'}</Status>,
  },
  { key: 'apk', title: 'APK', width: 84, align: 'right', optional: true, render: (r) => <span className="rel-muted">{r.has_apk ? fmtBytes(r.apk_size) : 'No APK'}</span> },
  {
    key: 'created',
    title: 'Created',
    width: 84,
    align: 'right',
    optional: true,
    sorter: (a, b) => a.created_at.localeCompare(b.created_at),
    render: (r) => <span className="rel-faint">{shortDate(r.created_at)}</span>,
  },
]

export default function ReleasesPage() {
  const shell = useShell()
  const navigate = useNavigate()
  const { appId, versionId } = useParams()
  /* Keyed so that a reload after an edit keeps the list and the panel on screen. */
  const state = useAsync(() => getVersions(appId!), [appId], { key: `versions:${appId}` })
  const [createOpen, setCreateOpen] = useState(false)
  /* A new release opens once the refreshed list has it, not before. */
  const [openWhenListed, setOpenWhenListed] = useState<string | null>(null)
  const listPath = `/apps/${appId}/distribution/releases`
  const canManage = shell.role === 'admin'

  useEffect(() => {
    if (!openWhenListed || !state.data?.some((v) => v.id === openWhenListed)) return
    setOpenWhenListed(null)
    navigate(`${listPath}/${openWhenListed}`)
  }, [openWhenListed, state.data, navigate, listPath])

  useRegisterCommands(
    () => (canManage ? [{ id: 'release-new', group: 'Releases', label: 'New release', keys: ['C'], run: () => setCreateOpen(true) }] : []),
    [canManage],
  )

  return (
    <>
      <SplitView
        list={
          <section aria-label="Releases">
            <PageHeader title="Releases" className="rel-header">
              {canManage && <Button variant="primary" onClick={() => setCreateOpen(true)}>New release</Button>}
            </PageHeader>
            <Loaded state={state} emptyText="No releases yet">
              {(versions) => (
                <DataList
                  label="Releases"
                  columns={COLUMNS}
                  data={versions}
                  rowKey={(r) => r.id}
                  selectedKey={versionId}
                  onRowClick={(r) => navigate(`${listPath}/${r.id}`)}
                />
              )}
            </Loaded>
          </section>
        }
        detail={
          versionId ? (
            <Outlet
              context={{
                ...shell,
                versions: state.data ?? [],
                loading: state.loading,
                reload: state.reload,
                close: () => navigate(listPath),
              } satisfies ReleasesContext}
            />
          ) : undefined
        }
      />
      {createOpen && (
        <NewReleaseDialog
          appId={appId!}
          onClose={() => setCreateOpen(false)}
          onCreated={(version) => {
            setCreateOpen(false)
            setOpenWhenListed(version.id)
            state.reload()
          }}
        />
      )}
    </>
  )
}
