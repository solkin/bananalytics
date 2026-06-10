import { useParams } from 'react-router-dom'
import { BarList, Card, MultiAreaChart, Select, Text, type BarListItem } from '@/ui'
import { getDeviceStats, getEventVersions, getUniqueSessionsByVersion } from '@/api/events'
import { useAsync, Loaded } from '../async'
import { fmtK, fromTo, versionLabel } from '../format'
import { useStickyFilters } from '../filters'
import { versionSeries } from '../series'
import './pages.css'

const DAY_OPTIONS = [
  { label: 'Last 7 days', value: '7' },
  { label: 'Last 28 days', value: '28' },
  { label: 'Last 90 days', value: '90' },
]

function toBars(items: { name: string; count: number }[]): BarListItem[] {
  const total = items.reduce((s, i) => s + i.count, 0) || 1
  return items.map((i) => ({ label: i.name, value: i.count, display: fmtK(i.count), secondary: `${Math.round((i.count / total) * 100)}%` }))
}

export default function DevicesPage() {
  const { appId } = useParams()
  const { get, set } = useStickyFilters(`devices_filters_${appId}`)
  const days = Number(get('days', '28')) || 28
  const version = get('version') ? Number(get('version')) : undefined

  const versions = useAsync(() => getEventVersions(appId!), [appId])
  const dev = useAsync(() => getDeviceStats(appId!, { limit: 8, version }), [appId, version])
  const sess = useAsync(() => getUniqueSessionsByVersion(appId!, fromTo(days)), [appId, days])

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

      <Loaded state={dev}>
        {(d) => (
          <>
            <div className="pg-grid2">
              <Card title="Top device models">{d.models.length ? <BarList items={toBars(d.models)} /> : <Text type="tertiary">No device data yet</Text>}</Card>
              <Card title="OS versions">{d.os_versions.length ? <BarList items={toBars(d.os_versions)} /> : <Text type="tertiary">No data yet</Text>}</Card>
            </div>
            <div className="pg-grid2">
              <Card title="Country / Region">{d.countries.length ? <BarList items={toBars(d.countries)} /> : <Text type="tertiary">No data yet</Text>}</Card>
              <Card title="Languages">{d.languages.length ? <BarList items={toBars(d.languages)} /> : <Text type="tertiary">No data yet</Text>}</Card>
            </div>
          </>
        )}
      </Loaded>
    </div>
  )
}
