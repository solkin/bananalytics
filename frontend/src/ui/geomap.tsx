import { useEffect, useMemo, useRef, useState } from 'react'
import { cn, SkeletonBlock } from './primitives'

/* World choropleth — the geographic twin of BarList. Outlines are projected
   at build time (see scripts/gen-worldmap.mjs), so this file only paints
   them: no projection maths, no dependencies, same zero-dep rule as charts. */

const STEPS = 5

type GeoData = typeof import('./worldmap.data')

/* The outlines are ~25 KB gzipped — a fifth of the whole bundle — and only two
   pages draw them, so they are fetched on first paint instead of shipping in
   the main chunk. Cached at module level: later mounts render immediately. */
let cached: GeoData | null = null

function useWorldData(): GeoData | null {
  const [geo, setGeo] = useState(cached)
  useEffect(() => {
    if (cached) return
    let alive = true
    import('./worldmap.data').then((m) => {
      cached = m
      if (alive) setGeo(m)
    })
    return () => {
      alive = false
    }
  }, [])
  return geo
}

/** Country shade 1..STEPS for a value. */
function toneScale(values: number[]): (v: number) => number {
  const max = Math.max(...values, 0)
  const min = Math.min(...values, max)
  if (max <= 0) return () => 1
  // Country traffic spans orders of magnitude — a couple of markets against a
  // long tail of a few sessions each. On a linear ramp everything but the
  // leaders collapses into the palest step; ranking them by quantile instead
  // would flatten the leaders. A log ramp keeps both ends readable, and
  // normalising by the observed range makes it adapt to flat data too.
  const lo = Math.log(Math.max(min, 1))
  const span = Math.log(max) - lo
  if (span <= 0) return () => STEPS
  return (v) =>
    Math.min(STEPS, 1 + Math.floor(((Math.log(Math.max(v, 1)) - lo) / span) * STEPS))
}

export interface WorldMapProps {
  /** Value per ISO 3166-1 alpha-2 country code, uppercase. */
  values: Record<string, number>
  /** Code to human name for the tooltip. Defaults to the bare code. */
  nameOf?: (code: string) => string
  /** Formats the tooltip value. */
  format?: (value: number) => string
  /** Cap on the rendered height; the map keeps its aspect ratio. */
  height?: number
  className?: string
}

export function WorldMap({
  values,
  nameOf = (c) => c,
  format = String,
  height = 300,
  className,
}: WorldMapProps) {
  const geo = useWorldData()
  const box = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<{ code: string; x: number; y: number } | null>(null)
  const tone = useMemo(
    () => toneScale(Object.values(values).filter((v) => v > 0)),
    [values]
  )

  if (!geo) return <SkeletonBlock height={height} width="100%" />

  const fill = (code: string) => {
    const v = values[code]
    return `var(--bnn-geo-${v ? tone(v) : 0})`
  }

  /* One handler on the <svg> rather than 200 closures on the shapes. */
  const onMove = (e: React.MouseEvent) => {
    const code = (e.target as SVGElement).getAttribute?.('data-code')
    const rect = box.current?.getBoundingClientRect()
    if (!code || !rect) return setHover(null)
    setHover({ code, x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  const dots = Object.keys(geo.WORLD_DOTS).filter((c) => values[c])
  const hovered = hover ? values[hover.code] : undefined

  return (
    <div
      ref={box}
      className={cn('bnn-geomap', className)}
      style={{ maxWidth: (height * geo.WORLD_WIDTH) / geo.WORLD_HEIGHT }}
    >
      <svg
        viewBox={`0 0 ${geo.WORLD_WIDTH} ${geo.WORLD_HEIGHT}`}
        className="bnn-geomap__svg"
        role="img"
        aria-label="World map shaded by value per country"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {Object.entries(geo.WORLD_PATHS).map(([code, d]) => (
          <path key={code} d={d} data-code={code} className="bnn-geomap__shape" fill={fill(code)} />
        ))}
        {/* Countries with no polygon at this scale — Singapore, Hong Kong,
            island states — would silently vanish, so they get a marker. */}
        {dots.map((code) => (
          <circle
            key={code}
            cx={geo.WORLD_DOTS[code][0]}
            cy={geo.WORLD_DOTS[code][1]}
            r={3}
            data-code={code}
            className="bnn-geomap__dot"
            fill={fill(code)}
          />
        ))}
      </svg>

      {hover && (
        <div className="bnn-geomap__tip" style={{ left: hover.x, top: hover.y }}>
          <div className="bnn-chart__tip">
            <div className="bnn-chart__tip-label">{nameOf(hover.code)}</div>
            <div className="bnn-chart__tip-value">{hovered ? format(hovered) : 'No data'}</div>
          </div>
        </div>
      )}

      <div className="bnn-geomap__legend">
        <span>Fewer</span>
        {Array.from({ length: STEPS }, (_, i) => (
          <i key={i} style={{ background: `var(--bnn-geo-${i + 1})` }} />
        ))}
        <span>More</span>
      </div>
    </div>
  )
}
