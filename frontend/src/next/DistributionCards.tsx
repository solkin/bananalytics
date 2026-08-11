import { BarList, Card, Empty, Icons, Tooltip, type BarListItem } from '@/ui'
import type { DeviceStats, DeviceStatItem } from '@/api/events'
import { fmtK } from './format'

/** Counts to a share-of-total bar list. */
export function toBars(items: DeviceStatItem[]): BarListItem[] {
  const total = items.reduce((s, i) => s + i.count, 0) || 1
  return items.map((i) => ({
    label: i.name,
    value: i.count,
    display: fmtK(i.count),
    secondary: `${Math.round((i.count / total) * 100)}%`,
  }))
}

/** The "?" next to a card title. It exists to explain the number, so it
 *  always carries the explanation. */
export function CardHelp({ text }: { text: string }) {
  return (
    <Tooltip title={text}>
      <span className="pg-help">
        <Icons.IconHelp size={15} />
      </span>
    </Tooltip>
  )
}

const CARDS = [
  {
    key: 'models' as const,
    title: 'Top devices',
    help: 'Device models seen in the selected period, by number of sessions.',
  },
  {
    key: 'os_versions' as const,
    title: 'OS versions',
    help: 'Android versions those sessions ran on.',
  },
  {
    key: 'countries' as const,
    title: 'Country / Region',
    help: 'Where the sessions came from, by device locale region.',
  },
  {
    key: 'languages' as const,
    title: 'Languages',
    help: 'Device language of those sessions.',
  },
]

/** The four device breakdowns, shared by Overview and Devices so the two
 *  pages cannot drift apart in wording or layout. */
export function DistributionCards({ stats }: { stats: DeviceStats }) {
  return (
    <>
      {[CARDS.slice(0, 2), CARDS.slice(2)].map((row, i) => (
        <div className="pg-grid2" key={i}>
          {row.map((c) => {
            const items = stats[c.key]
            return (
              <Card key={c.key} title={c.title} extra={<CardHelp text={c.help} />}>
                {items.length ? (
                  <BarList items={toBars(items)} />
                ) : (
                  <Empty description="No data yet" />
                )}
              </Card>
            )
          })}
        </div>
      ))}
    </>
  )
}
