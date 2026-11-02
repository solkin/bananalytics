import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from './cn'
import { Skeleton } from './Skeleton'
import './WorldMap.css'

/* World choropleth. Outlines are projected at build time (see
   scripts/gen-worldmap.mjs), so this file only paints them. */

const STEPS = 5

type GeoData = typeof import('./worldmap.data')

/* The outlines are about 25 KB gzipped and only two screens draw them, so they
   are fetched on first paint instead of shipping in the main chunk. */
let cached: GeoData | null = null

function useWorldData(): GeoData | null {
  const [geo, setGeo] = useState(cached)
  useEffect(() => {
    if (cached) return
    let alive = true
    import('./worldmap.data').then((data) => {
      cached = data
      if (alive) setGeo(data)
    })
    return () => {
      alive = false
    }
  }, [])
  return geo
}

/** Country shade 1..STEPS for a value. Traffic spans orders of magnitude, so a
 *  linear ramp would collapse everything but the leaders into the palest step. */
function toneScale(values: number[]): (value: number) => number {
  const max = Math.max(...values, 0)
  const min = Math.min(...values, max)
  if (max <= 0) return () => 1
  const low = Math.log(Math.max(min, 1))
  const span = Math.log(max) - low
  if (span <= 0) return () => STEPS
  return (value) => Math.min(STEPS, 1 + Math.floor(((Math.log(Math.max(value, 1)) - low) / span) * STEPS))
}

export function WorldMap({
  values,
  nameOf = (code) => code,
  format = String,
  noDataLabel = 'No data',
  className,
}: {
  /** Value per ISO 3166-1 alpha-2 country code, uppercase. */
  values: Record<string, number>
  nameOf?: (code: string) => string
  format?: (value: number) => string
  noDataLabel?: string
  className?: string
}) {
  const geo = useWorldData()
  const box = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<{ code: string; x: number; y: number } | null>(null)
  const tone = useMemo(() => toneScale(Object.values(values).filter((v) => v > 0)), [values])

  if (!geo) return <Skeleton width="100%" height={280} />

  const fill = (code: string) => `var(--bnn-geo-${values[code] ? tone(values[code]) : 0})`

  /* One handler on the svg rather than 200 closures on the shapes. */
  const move = (e: React.MouseEvent) => {
    const code = (e.target as SVGElement).getAttribute?.('data-code')
    const rect = box.current?.getBoundingClientRect()
    if (!code || !rect) return setHover(null)
    setHover({ code, x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  const dots = Object.keys(geo.WORLD_DOTS).filter((code) => values[code])
  const hovered = hover ? values[hover.code] : undefined

  return (
    <div ref={box} className={cn('bnn-worldmap', className)}>
      <svg
        viewBox={`0 0 ${geo.WORLD_WIDTH} ${geo.WORLD_HEIGHT}`}
        className="bnn-worldmap__svg"
        role="img"
        aria-label="World map shaded by value per country"
        onMouseMove={move}
        onMouseLeave={() => setHover(null)}
      >
        {Object.entries(geo.WORLD_PATHS).map(([code, d]) => (
          <path key={code} d={d} data-code={code} className="bnn-worldmap__shape" fill={fill(code)} />
        ))}
        {/* Countries with no polygon at this scale, such as Singapore, would
            silently vanish, so they get a marker. */}
        {dots.map((code) => (
          <circle key={code} cx={geo.WORLD_DOTS[code][0]} cy={geo.WORLD_DOTS[code][1]} r={3} data-code={code} className="bnn-worldmap__shape" fill={fill(code)} />
        ))}
      </svg>
      {hover && (
        <div className="bnn-worldmap__tip" style={{ left: hover.x, top: hover.y }}>
          <div className="bnn-worldmap__tip-name">{nameOf(hover.code)}</div>
          <div>{hovered ? format(hovered) : noDataLabel}</div>
        </div>
      )}
    </div>
  )
}
