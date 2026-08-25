import { BarList, Card, Empty, Icons, Tooltip, WorldMap, type BarListItem } from '@/ui'
import type { DeviceStats, DeviceStatItem } from '@/api/events'
import { androidVersion, countryFlag, countryName, fmtK, isCountryCode } from './format'

/** How many rows the list beside the map shows; the map itself uses them all. */
const COUNTRY_ROWS = 8

/** Counts to a share-of-total bar list. */
export function toBars(
  items: DeviceStatItem[],
  label: (name: string) => string = (n) => n,
): BarListItem[] {
  const total = items.reduce((s, i) => s + i.count, 0) || 1
  return items.map((i) => ({
    label: label(i.name),
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
    help: 'Android versions those sessions ran on. Devices report an API level; the release it belongs to is shown alongside it.',
    label: androidVersion,
  },
  {
    key: 'languages' as const,
    title: 'Languages',
    help: 'Device language of those sessions.',
  },
]

/** Sessions per ISO country code. "Unknown" has no place on a map, so it is
 *  dropped here and stays visible in the list beside it. */
function mapValues(items: DeviceStatItem[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const i of items) if (isCountryCode(i.name)) out[i.name] = i.count
  return out
}

function countryRows(items: DeviceStatItem[]): BarListItem[] {
  const total = items.reduce((s, i) => s + i.count, 0) || 1
  return items.slice(0, COUNTRY_ROWS).map((i) => ({
    label: (
      <>
        {isCountryCode(i.name) && (
          <span className="pg-geo__flag" aria-hidden>
            {countryFlag(i.name)}
          </span>
        )}
        {countryName(i.name)}
      </>
    ),
    value: i.count,
    display: fmtK(i.count),
    secondary: `${Math.round((i.count / total) * 100)}%`,
  }))
}

/** Where the sessions came from: the map answers "where", the list "how many". */
function CountryCard({ items }: { items: DeviceStatItem[] }) {
  return (
    <Card
      title="Country / Region"
      extra={<CardHelp text="Where the sessions came from, by device locale region." />}
    >
      {items.length ? (
        <div className="pg-geo">
          <WorldMap
            values={mapValues(items)}
            nameOf={countryName}
            format={(v) => `${fmtK(v)} sessions`}
            height={320}
          />
          {/* The map already encodes magnitude by shade; bars would say it twice. */}
          <BarList items={countryRows(items)} showBar={false} />
        </div>
      ) : (
        <Empty description="No data yet" />
      )}
    </Card>
  )
}

/** The device breakdowns, shared by Overview and Devices so the two pages
 *  cannot drift apart in wording or layout. */
export function DistributionCards({ stats }: { stats: DeviceStats }) {
  return (
    <>
      <CountryCard items={stats.countries} />
      <div className="pg-grid3">
        {CARDS.map((c) => {
          const items = stats[c.key]
          return (
            <Card key={c.key} title={c.title} extra={<CardHelp text={c.help} />}>
              {items.length ? (
                <BarList items={toBars(items, c.label)} />
              ) : (
                <Empty description="No data yet" />
              )}
            </Card>
          )
        })}
      </div>
    </>
  )
}
