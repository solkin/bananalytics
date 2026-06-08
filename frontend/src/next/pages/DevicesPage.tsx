import { useParams } from 'react-router-dom'
import { AreaChart, BarList, Card, Text, type BarListItem, type ChartPoint } from '@/ui'
import { getDeviceStats, getUniqueSessionsByVersion } from '@/api/events'
import { useAsync, Loaded } from '../async'
import { fmtK, fromTo, shortDate } from '../format'
import './pages.css'

function toBars(items: { name: string; count: number }[]): BarListItem[] {
  const total = items.reduce((s, i) => s + i.count, 0) || 1
  return items.map((i) => ({ label: i.name, value: i.count, display: fmtK(i.count), secondary: `${Math.round((i.count / total) * 100)}%` }))
}
function byDate(rows: { date: string; count: number }[]): ChartPoint[] {
  const m = new Map<string, number>()
  for (const r of rows) m.set(r.date, (m.get(r.date) || 0) + r.count)
  return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([date, v]) => ({ label: shortDate(date), value: v }))
}

export default function DevicesPage() {
  const { appId } = useParams()
  const dev = useAsync(() => getDeviceStats(appId!, { limit: 8 }), [appId])
  const sess = useAsync(() => getUniqueSessionsByVersion(appId!, fromTo(28)), [appId])

  return (
    <div className="pg">
      <Card title="Active devices">
        <AreaChart data={byDate(sess.data ?? [])} height={220} />
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
