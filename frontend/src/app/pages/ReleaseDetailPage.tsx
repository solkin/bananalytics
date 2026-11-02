import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Button,
  ConfirmDialog,
  DetailPanel,
  EmptyState,
  FileButton,
  Loading,
  Switch,
  Textarea,
  toast,
} from '@/ui'
import type { AppVersion } from '@/types'
import {
  createDownloadToken,
  deleteApk,
  deleteVersion,
  getApkDownloadUrl,
  getMappingDownloadUrl,
  updateVersion,
  uploadApk,
  uploadMapping,
} from '@/api/apps'
import { useAuth } from '@/context/AuthContext'
import { errorText } from '../async'
import { fmtBytes, fmtDateTime } from '../format'
import { KeyReveal } from '../KeyReveal'
import { MAPPING_ACCEPT } from './MappingsPage'
import { NotifyTestersDialog, useReleases, versionTitle } from './ReleasesPage'

const SHARE_LINK_HOURS = 24

export default function ReleaseDetailPage() {
  const { appId, versionId } = useParams()
  const { role, versions, loading, reload, close } = useReleases()
  const version = versions.find((v) => v.id === versionId)

  if (!version) {
    return (
      <DetailPanel title="Release" onClose={close} label="Release details">
        {loading ? <Loading /> : <EmptyState title="This release no longer exists" />}
      </DetailPanel>
    )
  }
  return <ReleaseDetail key={version.id} appId={appId!} version={version} canManage={role === 'admin'} reload={reload} close={close} />
}

function ToggleRow({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  disabled: boolean
  onChange: (on: boolean) => void
}) {
  return (
    <div className="rel-toggle">
      <div className="rel-toggle__text">
        <div className="rel-toggle__label">{label}</div>
        <div className="rel-toggle__hint">{hint}</div>
      </div>
      <Switch aria-label={label} checked={checked} disabled={disabled} onChange={onChange} />
    </div>
  )
}

function ReleaseDetail({
  appId,
  version,
  canManage,
  reload,
  close,
}: {
  appId: string
  version: AppVersion
  canManage: boolean
  reload: () => void
  close: () => void
}) {
  const { config } = useAuth()
  const savedNotes = version.release_notes ?? ''
  const [notes, setNotes] = useState(savedNotes)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<'apk' | 'mapping' | null>(null)
  const [notifying, setNotifying] = useState(false)
  const [link, setLink] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<'apk' | 'release' | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => setNotes(savedNotes), [savedNotes])

  const apply = async (data: Parameters<typeof updateVersion>[2], done: string) => {
    try {
      await updateVersion(appId, version.id, data)
      reload()
      toast.success(done)
    } catch (e) {
      toast.error(errorText(e, 'Failed to update release'))
    }
  }

  const togglePublished = (on: boolean) => {
    if (on && config?.smtp_configured) setNotifying(true)
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
      if (kind === 'apk') await uploadApk(appId, version.id, file)
      else await uploadMapping(appId, version.id, file)
      reload()
      toast.success(kind === 'apk' ? 'APK uploaded' : 'Mapping uploaded')
    } catch (e) {
      toast.error(errorText(e, 'Upload failed'))
    } finally {
      setUploading(null)
    }
  }

  const createLink = async () => {
    try {
      const token = await createDownloadToken(appId, version.id, SHARE_LINK_HOURS)
      setLink(`${window.location.origin}${token.download_url}`)
    } catch (e) {
      toast.error(errorText(e, 'Failed to create link'))
    }
  }

  const remove = async () => {
    setDeleting(true)
    try {
      if (confirm === 'apk') {
        await deleteApk(appId, version.id)
        toast.success('APK deleted')
        setConfirm(null)
      } else {
        await deleteVersion(appId, version.id)
        toast.success('Release deleted')
        close()
      }
      reload()
    } catch (e) {
      toast.error(errorText(e, confirm === 'apk' ? 'Failed to delete APK' : 'Failed to delete release'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <DetailPanel
      label="Release details"
      title={versionTitle(version)}
      onClose={close}
      actions={
        <>
          {version.has_apk && canManage && <Button onClick={() => void createLink()}>Share link</Button>}
          <Button variant="primary" disabled={!version.has_apk} onClick={() => window.open(getApkDownloadUrl(appId, version.id), '_blank')}>
            Download APK
          </Button>
        </>
      }
    >
      <div className="rel-detail">
        {link && (
          <div>
            <p className="rel-detail__caption">Anyone with this link can download the APK for {SHARE_LINK_HOURS} hours.</p>
            <KeyReveal value={link} />
          </div>
        )}

        <div className="rel-toggles">
          <ToggleRow
            label="Published for testers"
            hint="Visible on the install page for testers."
            checked={version.published_for_testers}
            disabled={!canManage}
            onChange={togglePublished}
          />
          <ToggleRow
            label="Crash reporting"
            hint="Accept crash reports from this version."
            checked={!version.mute_crashes}
            disabled={!canManage}
            onChange={(on) => void apply({ mute_crashes: !on }, 'Settings updated')}
          />
          <ToggleRow
            label="Analytics events"
            hint="Accept analytics events from this version."
            checked={!version.mute_events}
            disabled={!canManage}
            onChange={(on) => void apply({ mute_events: !on }, 'Settings updated')}
          />
        </div>

        <div>
          <label className="rel-detail__heading" htmlFor="release-notes">Release notes</label>
          <Textarea
            id="release-notes"
            placeholder="What's new in this version"
            value={notes}
            readOnly={!canManage}
            onChange={(e) => setNotes(e.target.value)}
          />
          {canManage && (
            <div className="rel-detail__save">
              <Button loading={saving} disabled={notes === savedNotes} onClick={() => void saveNotes()}>Save notes</Button>
            </div>
          )}
        </div>

        <div>
          <h3 className="rel-detail__heading">Files</h3>
          <div className="rel-files">
            <div className="rel-file">
              <div className="rel-file__text">
                <div className="rel-file__name">APK</div>
                <div className="rel-file__meta">
                  {version.has_apk
                    ? `${version.apk_filename ?? 'APK'} · ${fmtBytes(version.apk_size)}${version.apk_uploaded_at ? ` · ${fmtDateTime(version.apk_uploaded_at)}` : ''}`
                    : 'Not uploaded'}
                </div>
              </div>
              {canManage && (
                <div className="rel-file__actions">
                  {version.has_apk && <Button variant="ghost" onClick={() => setConfirm('apk')}>Delete</Button>}
                  <FileButton
                    variant="ghost"
                    accept=".apk"
                    aria-label={`${version.has_apk ? 'Replace' : 'Upload'} APK`}
                    loading={uploading === 'apk'}
                    disabled={uploading != null}
                    onFile={(file) => void upload('apk', file)}
                  >
                    {version.has_apk ? 'Replace' : 'Upload'}
                  </FileButton>
                </div>
              )}
            </div>
            <div className="rel-file">
              <div className="rel-file__text">
                <div className="rel-file__name">Mapping</div>
                <div className={version.has_mapping ? 'rel-file__meta' : 'rel-file__meta rel-file__meta--warning'}>
                  {version.has_mapping ? 'Available, stack traces are deobfuscated' : 'Missing, stack traces stay obfuscated'}
                </div>
              </div>
              <div className="rel-file__actions">
                {version.has_mapping && (
                  <Button variant="ghost" aria-label="Download mapping" onClick={() => window.open(getMappingDownloadUrl(appId, version.id), '_blank')}>
                    Download
                  </Button>
                )}
                {canManage && (
                  <FileButton
                    variant="ghost"
                    accept={MAPPING_ACCEPT}
                    aria-label={`${version.has_mapping ? 'Replace' : 'Upload'} mapping`}
                    loading={uploading === 'mapping'}
                    disabled={uploading != null}
                    onFile={(file) => void upload('mapping', file)}
                  >
                    {version.has_mapping ? 'Replace' : 'Upload'}
                  </FileButton>
                )}
              </div>
            </div>
          </div>
        </div>

        {canManage && (
          <div className="rel-danger">
            <div className="rel-toggle__text">
              <div className="rel-toggle__label">Delete release</div>
              <div className="rel-toggle__hint">Crashes, events, sessions, APK and mapping for this version are removed.</div>
            </div>
            <Button variant="danger" onClick={() => setConfirm('release')}>Delete</Button>
          </div>
        )}
      </div>

      {notifying && (
        <NotifyTestersDialog
          appId={appId}
          version={version}
          onClose={() => setNotifying(false)}
          onPublish={async () => {
            await updateVersion(appId, version.id, { published_for_testers: true })
            reload()
          }}
        />
      )}
      <ConfirmDialog
        open={confirm != null}
        title={confirm === 'apk' ? 'Delete this APK?' : 'Delete this release?'}
        description={
          confirm === 'apk'
            ? 'Testers will no longer be able to download this build.'
            : 'Crashes, events, sessions, APK and mapping for this version will be removed.'
        }
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={() => void remove()}
        onClose={() => setConfirm(null)}
      />
    </DetailPanel>
  )
}
