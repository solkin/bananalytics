import { Tooltip } from './Tooltip'
import './DayBars.css'

export interface DayBarPoint {
  label: string
  value: number
}

/** One thin bar per day. The first and last labels are the time axis. */
export function DayBars({ data, label, height = 56 }: { data: DayBarPoint[]; label: string; height?: number }) {
  if (!data.length) return null
  const peak = Math.max(1, ...data.map((d) => d.value))
  return (
    <figure className="bnn-daybars" aria-label={label} role="img">
      <div className="bnn-daybars__bars" style={{ height }}>
        {data.map((d, i) => (
          <Tooltip key={i} title={`${d.label}: ${d.value.toLocaleString('en-US')}`}>
            <span className="bnn-daybars__slot">
              <span className="bnn-daybars__bar" style={{ height: `${Math.max(2, (d.value / peak) * 100)}%` }} />
            </span>
          </Tooltip>
        ))}
      </div>
      <figcaption className="bnn-daybars__axis" aria-hidden>
        <span>{data[0].label}</span>
        <span>{data[data.length - 1].label}</span>
      </figcaption>
    </figure>
  )
}
