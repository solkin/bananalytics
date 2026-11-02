import { useParams } from 'react-router-dom'
import { Button } from '@/ui'
import { getApkDownloadUrl, getDistributionVersions } from '@/api/apps'
import { useAsync, Loaded } from '../async'
import { fmtBytes, shortDate } from '../format'
import './releases.css'

/** What a tester sees instead of Releases: the builds to install, newest first. */
export default function InstallPage() {
  const { appId } = useParams()
  const state = useAsync(() => getDistributionVersions(appId!), [appId])
  return (
    <section className="rel-install">
      <h1 className="rel-install__title">Releases</h1>
      <Loaded state={state} emptyText="No builds available for testing yet">
        {(versions) => (
          <ul className="rel-install__list">
            {versions.map((v, i) => (
              <li className="rel-build" key={v.id}>
                <div className="rel-build__text">
                  <h2 className="rel-build__name">
                    {v.version_name || `Version ${v.version_code}`} <span className="rel-faint">{v.version_code}</span>
                  </h2>
                  <div className="rel-build__meta">
                    {v.apk_uploaded_at ? `Published ${shortDate(v.apk_uploaded_at)}` : `Created ${shortDate(v.created_at)}`}
                    {v.has_apk ? ` · ${fmtBytes(v.apk_size)}` : ' · No APK yet'}
                  </div>
                  {v.release_notes && <p className="rel-build__notes">{v.release_notes}</p>}
                </div>
                <Button
                  variant={i === 0 ? 'primary' : 'secondary'}
                  size="lg"
                  disabled={!v.has_apk}
                  aria-label={`Download ${v.version_name || v.version_code}`}
                  onClick={() => window.open(getApkDownloadUrl(appId!, v.id), '_blank')}
                >
                  Download
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Loaded>
    </section>
  )
}
