import { Breakdown, EmptyState, WorldMap, type BreakdownItem } from '@/ui'
import type { DeviceStatItem, DeviceStats } from '@/api/events'
import { androidVersion, countryName, fmtK, isCountryCode, languageName } from './format'
import './distribution.css'

/** How many rows the list beside the map shows; the map itself uses them all. */
const COUNTRY_ROWS = 8

const percent = (count: number, total: number) => `${Math.round((count / (total || 1)) * 100)}%`

function shares(items: DeviceStatItem[], label: (name: string) => string = (name) => name): BreakdownItem[] {
  const total = items.reduce((sum, item) => sum + item.count, 0)
  return items.map((item) => ({ label: label(item.name), value: item.count, display: percent(item.count, total) }))
}

/** Where the sessions came from and what they ran on. Shared by Overview and
 *  Devices so the two screens cannot drift apart. */
export function Distribution({ stats }: { stats: DeviceStats }) {
  const total = stats.countries.reduce((sum, item) => sum + item.count, 0)
  /* "Unknown" has no place on a map, so it stays in the list only. */
  const mapValues = Object.fromEntries(
    stats.countries.filter((item) => isCountryCode(item.name)).map((item) => [item.name, item.count]),
  )
  const breakdowns = [
    { title: 'Top devices', items: shares(stats.models) },
    { title: 'OS versions', items: shares(stats.os_versions, androidVersion) },
    { title: 'Languages', items: shares(stats.languages, languageName) },
  ]
  return (
    <>
      <section className="dist-section" aria-labelledby="dist-country">
        <h2 id="dist-country" className="dist-heading">Country or region</h2>
        {stats.countries.length ? (
          <div className="dist-geo">
            <WorldMap
              className="dist-geo__map"
              values={mapValues}
              nameOf={countryName}
              format={(value) => `${fmtK(value)} sessions`}
            />
            <ul className="dist-geo__list">
              {stats.countries.slice(0, COUNTRY_ROWS).map((item) => (
                <li className="dist-country" key={item.name}>
                  <span className="dist-country__name">{countryName(item.name)}</span>
                  <span className="dist-country__value">{fmtK(item.count)}</span>
                  <span className="dist-country__share">{percent(item.count, total)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : <EmptyState title="No data yet" />}
      </section>
      <section className="dist-section dist-breakdowns" aria-label="Device breakdown">
        {breakdowns.map((b) => (
          <div key={b.title}>
            <h2 className="dist-heading">{b.title}</h2>
            {b.items.length ? <Breakdown items={b.items} /> : <EmptyState title="No data yet" />}
          </div>
        ))}
      </section>
    </>
  )
}
