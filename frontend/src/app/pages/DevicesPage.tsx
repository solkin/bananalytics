import { useParams } from 'react-router-dom'
import { LineChart, PageHeader } from '@/ui'
import { getDeviceStats, getEventVersions, getUniqueSessionsByVersion } from '@/api/events'
import { useAsync, Loaded } from '../async'
import { AnalyticsFilters } from '../AnalyticsFilters'
import { Distribution } from '../Distribution'
import { useStickyFilters } from '../filters'
import { fromTo } from '../format'
import { forVersion, versionSeries } from '../series'
import './analytics.css'

const DEVICE_ROWS = 8

export default function DevicesPage() {
  const { appId } = useParams()
  const { get, set } = useStickyFilters(`devices_filters_${appId}`)
  const days = Number(get('days', '28')) || 28
  const version = get('version') ? Number(get('version')) : undefined

  const versions = useAsync(() => getEventVersions(appId!), [appId], { key: `event-versions:${appId}` })
  const devices = useAsync(
    () => getDeviceStats(appId!, { limit: DEVICE_ROWS, version, ...fromTo(days) }),
    [appId, version, days],
    { key: `device-stats:${appId}:${DEVICE_ROWS}:${version ?? 'all'}:${days}` },
  )
  const sessions = useAsync(() => getUniqueSessionsByVersion(appId!, fromTo(days)), [appId, days], { key: `sessions-unique:${appId}:${days}` })

  return (
    <section aria-label="Devices">
      <PageHeader title="Devices" className="an-header">
        <AnalyticsFilters days={days} version={version} versions={versions.data ?? []} onChange={set} />
      </PageHeader>
      <div className="an-section">
        <h2 className="an-heading">Active devices per version</h2>
        <Loaded state={sessions}>
          {(rows) => (
            <LineChart
              height={180}
              label={`Active devices per version over the last ${days} days`}
              series={versionSeries(forVersion(rows, version), days)}
            />
          )}
        </Loaded>
      </div>
      <Loaded state={devices}>{(stats) => <Distribution stats={stats} />}</Loaded>
    </section>
  )
}
