import { useParams } from 'react-router-dom'
import { AreaChart, Card, Statistic, type ChartPoint } from '@/ui'
import { getEventStats } from '@/api/events'
import { useAsync, Loaded } from '../async'
import { fmtK, fromTo, shortDate } from '../format'
import { useDetailCrumb } from '../layout/useDetailCrumb'
import './pages.css'

export default function EventDetailPage() {
  const { appId, name = '' } = useParams()
  const decoded = decodeURIComponent(name)
  useDetailCrumb(decoded)
  const state = useAsync(() => getEventStats(appId!, decoded, fromTo(28)), [appId, decoded])

  return (
    <div className="pg">
      <h1 className="bnn-pageheader__title" style={{ margin: 0 }}>{decoded}</h1>
      <Loaded state={state} emptyText="No data for this event yet">
        {(stats) => {
          const series: ChartPoint[] = stats.map((d) => ({ label: shortDate(d.date), value: d.count }))
          const total = stats.reduce((s, d) => s + d.count, 0)
          return (
            <Card title="Count">
              <div className="pg-split">
                <div className="pg-split__chart"><AreaChart data={series} height={220} /></div>
                <div className="pg-rail"><Statistic title="Last 28 days" value={fmtK(total)} /></div>
              </div>
            </Card>
          )
        }}
      </Loaded>
    </div>
  )
}
