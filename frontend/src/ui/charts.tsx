import {
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { cn } from './primitives'

/* Lightweight dependency-free SVG charts (App Center style).
   The container width is measured so the viewBox maps 1:1 to pixels —
   no stroke/text distortion, fixed height, fully responsive. */

export interface ChartPoint {
  label: string
  value: number
}

interface Geometry {
  w: number
  h: number
  padL: number
  padR: number
  padT: number
  padB: number
  innerW: number
  innerH: number
}

function useMeasure() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(600)
  useLayoutEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w && w > 0) setWidth(w)
    })
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return { ref, width }
}

function geometry(w: number, h: number): Geometry {
  const padL = 40
  const padR = 14
  const padT = 12
  const padB = 26
  return { w, h, padL, padR, padT, padB, innerW: w - padL - padR, innerH: h - padT - padB }
}

function useScales(data: ChartPoint[], g: Geometry) {
  return useMemo(() => {
    const max = Math.max(1, ...data.map((d) => d.value))
    const min = Math.min(0, ...data.map((d) => d.value))
    const x = (i: number) =>
      data.length <= 1 ? g.padL + g.innerW / 2 : g.padL + (i / (data.length - 1)) * g.innerW
    const xBand = (i: number) => g.padL + (i + 0.5) * (g.innerW / Math.max(1, data.length))
    const y = (v: number) => g.padT + g.innerH - ((v - min) / (max - min || 1)) * g.innerH
    return { max, min, x, xBand, y }
  }, [data, g])
}

function niceTicks(max: number, count = 4) {
  const step = max / count
  const mag = Math.pow(10, Math.floor(Math.log10(step || 1)))
  const norm = step / mag
  const niceStep = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag
  const ticks: number[] = []
  for (let v = 0; v <= max + niceStep / 2; v += niceStep) ticks.push(v)
  return ticks
}

function fmt(v: number) {
  if (Math.abs(v) >= 1000)
    return (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1).replace('.0', '') + 'k'
  return String(v)
}

type Scales = ReturnType<typeof useScales>

function ChartFrame({
  g,
  ticks,
  scale,
  children,
  data,
  bandLabels,
}: {
  g: Geometry
  ticks: number[]
  scale: Scales
  children: ReactNode
  data: ChartPoint[]
  bandLabels?: boolean
}) {
  const maxLabels = Math.max(2, Math.floor(g.innerW / 70))
  const labelStep = Math.ceil(data.length / maxLabels)
  return (
    <>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={g.padL} x2={g.w - g.padR} y1={scale.y(t)} y2={scale.y(t)} className="bnn-chart__grid" />
          <text x={g.padL - 8} y={scale.y(t) + 3} className="bnn-chart__axis" textAnchor="end">
            {fmt(t)}
          </text>
        </g>
      ))}
      {children}
      {data.map((d, i) =>
        i % labelStep === 0 ? (
          <text
            key={i}
            x={bandLabels ? scale.xBand(i) : scale.x(i)}
            y={g.h - 8}
            className="bnn-chart__axis"
            textAnchor="middle"
          >
            {d.label}
          </text>
        ) : null,
      )}
    </>
  )
}

function Hover({
  g,
  data,
  scale,
  band,
  color,
}: {
  g: Geometry
  data: ChartPoint[]
  scale: Scales
  band?: boolean
  color: string
}) {
  const [idx, setIdx] = useState<number | null>(null)
  const px = (i: number) => (band ? scale.xBand(i) : scale.x(i))
  const slot = g.innerW / Math.max(1, data.length)
  return (
    <>
      {idx != null && data[idx] && (
        <g pointerEvents="none">
          <line x1={px(idx)} x2={px(idx)} y1={g.padT} y2={g.h - g.padB} className="bnn-chart__cursor" />
          {!band && (
            <circle cx={px(idx)} cy={scale.y(data[idx].value)} r={4} fill={color} stroke="#fff" strokeWidth={2} />
          )}
        </g>
      )}
      {data.map((_, i) => (
        <rect
          key={i}
          x={band ? g.padL + i * slot : px(i) - slot / 2}
          y={g.padT}
          width={slot}
          height={g.innerH}
          fill="transparent"
          onMouseEnter={() => setIdx(i)}
          onMouseLeave={() => setIdx(null)}
        />
      ))}
      {idx != null && data[idx] && (
        <foreignObject
          x={Math.min(Math.max(px(idx) - 50, 0), g.w - 100)}
          y={Math.max(scale.y(data[idx].value) - 48, 0)}
          width={100}
          height={42}
          pointerEvents="none"
        >
          <div className="bnn-chart__tip">
            <div className="bnn-chart__tip-label">{data[idx].label}</div>
            <div className="bnn-chart__tip-value">{fmt(data[idx].value)}</div>
          </div>
        </foreignObject>
      )}
    </>
  )
}

function Svg({
  width,
  height,
  className,
  children,
  innerRef,
}: {
  width: number
  height: number
  className?: string
  children: ReactNode
  innerRef: React.RefObject<HTMLDivElement>
}) {
  return (
    <div ref={innerRef} className={cn('bnn-chart-box', className)} style={{ height }}>
      <svg className="bnn-chart" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {children}
      </svg>
    </div>
  )
}

/* ----------------------------------------------------------- AreaChart */
export function AreaChart({
  data,
  color = 'var(--bnn-chart-1)',
  height = 220,
  className,
}: {
  data: ChartPoint[]
  color?: string
  height?: number
  className?: string
}) {
  const { ref, width } = useMeasure()
  const g = geometry(width, height)
  const scale = useScales(data, g)
  const gid = useId().replace(/:/g, '')
  const ticks = niceTicks(scale.max)
  const line = data.map((d, i) => `${scale.x(i)},${scale.y(d.value)}`).join(' ')
  const area =
    data.length > 0
      ? `M ${scale.x(0)},${scale.y(scale.min)} L ${data
          .map((d, i) => `${scale.x(i)},${scale.y(d.value)}`)
          .join(' L ')} L ${scale.x(data.length - 1)},${scale.y(scale.min)} Z`
      : ''
  return (
    <Svg width={width} height={height} className={className} innerRef={ref}>
      <defs>
        <linearGradient id={`fill-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <ChartFrame g={g} ticks={ticks} scale={scale} data={data}>
        <path d={area} fill={`url(#fill-${gid})`} />
        <polyline points={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        <Hover g={g} data={data} scale={scale} color={color} />
      </ChartFrame>
    </Svg>
  )
}

/* ----------------------------------------------------------- LineChart */
export function LineChart({
  data,
  color = 'var(--bnn-chart-1)',
  height = 220,
  className,
}: {
  data: ChartPoint[]
  color?: string
  height?: number
  className?: string
}) {
  const { ref, width } = useMeasure()
  const g = geometry(width, height)
  const scale = useScales(data, g)
  const ticks = niceTicks(scale.max)
  const line = data.map((d, i) => `${scale.x(i)},${scale.y(d.value)}`).join(' ')
  return (
    <Svg width={width} height={height} className={className} innerRef={ref}>
      <ChartFrame g={g} ticks={ticks} scale={scale} data={data}>
        <polyline points={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        {data.map((d, i) => (
          <circle key={i} cx={scale.x(i)} cy={scale.y(d.value)} r={2.5} fill={color} />
        ))}
        <Hover g={g} data={data} scale={scale} color={color} />
      </ChartFrame>
    </Svg>
  )
}

/* ------------------------------------------------------------ BarChart */
export function BarChart({
  data,
  color = 'var(--bnn-chart-1)',
  height = 220,
  horizontal = false,
  className,
}: {
  data: ChartPoint[]
  color?: string
  height?: number
  horizontal?: boolean
  className?: string
}) {
  const { ref, width } = useMeasure()
  const g = geometry(width, height)
  const scale = useScales(data, g)
  const ticks = niceTicks(scale.max)
  const slot = g.innerW / Math.max(1, data.length)
  const barW = Math.min(slot * 0.62, 46)

  if (horizontal) {
    const rowH = (g.h - g.padT - g.padB) / Math.max(1, data.length)
    const maxV = Math.max(1, ...data.map((d) => d.value))
    const labelW = 90
    return (
      <Svg width={width} height={height} className={className} innerRef={ref}>
        {data.map((d, i) => {
          const avail = g.w - g.padL - g.padR - labelW
          const bw = Math.max((d.value / maxV) * avail, 1)
          const y = g.padT + i * rowH + rowH * 0.2
          return (
            <g key={i}>
              <text x={g.padL + labelW - 8} y={y + rowH * 0.32} className="bnn-chart__axis" textAnchor="end">
                {d.label}
              </text>
              <rect x={g.padL + labelW} y={y} width={bw} height={rowH * 0.6} rx={3} fill={color} className="bnn-chart__bar" />
              <text x={g.padL + labelW + bw + 6} y={y + rowH * 0.32} className="bnn-chart__axis">
                {fmt(d.value)}
              </text>
            </g>
          )
        })}
      </Svg>
    )
  }

  return (
    <Svg width={width} height={height} className={className} innerRef={ref}>
      <ChartFrame g={g} ticks={ticks} scale={scale} data={data} bandLabels>
        {data.map((d, i) => {
          const x = scale.xBand(i) - barW / 2
          const y = scale.y(d.value)
          return (
            <rect key={i} x={x} y={y} width={barW} height={g.padT + g.innerH - y} rx={3} fill={color} className="bnn-chart__bar" />
          )
        })}
        <Hover g={g} data={data} scale={scale} band color={color} />
      </ChartFrame>
    </Svg>
  )
}
