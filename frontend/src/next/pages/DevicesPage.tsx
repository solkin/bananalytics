import { useParams } from 'react-router-dom'
import { Card, MultiAreaChart, Select } from '@/ui'
import { getDeviceStats, getEventVersions, getUniqueSessionsByVersion } from '@/api/events'
import { useAsync, Loaded } from '../async'
import { DistributionCards } from '../DistributionCards'
import { fromTo, versionLabel } from '../format'
import { useStickyFilters } from '../filters'
import { versionSeries } from '../series'
import './pages.css'

const DAY_OPTIONS = [
  { label: 'Last 7 days', value: '7' },
  { label: 'Last 28 days', value: '28' },
  { label: 'Last 90 days', value: '90' },
]

export default function DevicesPage() {
  const { appId } = useParams()
  const { get, set } = useStickyFilters(`devices_filters_${appId}`)
  const days = Number(get('days', '28')) || 28
  const version = get('version') ? Number(get('version')) : undefined

  const versions = useAsync(() => getEventVersions(appId!), [appId], { key: `event-versions:${appId}` })
  const dev = useAsync(() => getDeviceStats(appId!, { limit: 8, version }), [appId, version], { key: `device-stats:${appId}:8:${version ?? 'all'}` })
  const sess = useAsync(() => getUniqueSessionsByVersion(appId!, fromTo(days)), [appId, days], { key: `sessions-unique:${appId}:${days}` })

  return (
    <div className="pg">
      <div className="pg-toolbar">
        <div className="pg-filter">
          <span className="pg-filter__label">Version</span>
          <Select
            style={{ width: 180 }}
            placeholder="All versions"
            allowClear
            value={version ?? null}
            onChange={(v) => set({ version: v === '' ? undefined : String(v) })}
            options={(versions.data ?? []).map((v) => ({ label: versionLabel(v), value: v.version_code }))}
          />
        </div>
        <div className="pg-filter">
          <span className="pg-filter__label">Time</span>
          <Select style={{ width: 150 }} value={String(days)} onChange={(v) => set({ days: String(v) })} options={DAY_OPTIONS} />
        </div>
      </div>

      <Card title="Active devices per version">
        <MultiAreaChart height={220} series={versionSeries(sess.data ?? [], days)} />
      </Card>

      <Loaded state={dev}>{(d) => <DistributionCards stats={d} />}</Loaded>
    </div>
  )
}
