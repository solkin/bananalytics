import { useLayoutEffect, useMemo, useState, type MouseEvent } from 'react'
import { cn } from './cn'
import { EmptyState } from './EmptyState'
import './LineChart.css'

export interface ChartPoint {
  label: string
  value: number
}

export interface ChartSeries {
  label: string
  data: ChartPoint[]
  /** Dashed, for an aggregate such as "Other". */
  dashed?: boolean
}

/* Lines stay apart in lightness rather than hue, so the chart keeps working
   without colour. A chart shows at most this many, plus one dashed aggregate. */
const SERIES_TOKENS = ['--bnn-chart-1', '--bnn-chart-2', '--bnn-chart-3']
const PAD = { left: 36, right: 8, top: 8, bottom: 24 }
const MIN_LABEL_GAP = 96
const DEFAULT_WIDTH = 600

function useMeasure() {
  const [element, setElement] = useState<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(DEFAULT_WIDTH)
  useLayoutEffect(() => {
    if (!element) return
    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.width
      if (measured && measured > 0) setWidth(measured)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])
  return { ref: setElement, width }
}

/** A round maximum, so the axis reads 0, 2k, 4k rather than 0, 1937, 3874. */
function niceMax(value: number) {
  if (value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude >= value) ?? 10
  return step * magnitude
}

function compact(value: number) {
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1).replace('.0', '')}k`
  return String(Math.round(value * 10) / 10)
}

export function LineChart({
  series,
  label,
  height = 208,
  legend = true,
  format = (value) => value.toLocaleString('en-US'),
  className,
}: {
  series: ChartSeries[]
  /** Describes the chart for assistive technology. */
  label: string
  height?: number
  legend?: boolean
  format?: (value: number) => string
  className?: string
}) {
  const { ref, width } = useMeasure()
  const [hover, setHover] = useState<number | null>(null)
  const count = Math.max(0, ...series.map((s) => s.data.length))
  const axis = series.find((s) => s.data.length === count)?.data ?? []
  const max = useMemo(() => niceMax(Math.max(0, ...series.flatMap((s) => s.data.map((d) => d.value)))), [series])

  if (!count) {
    return (
      <div className={cn('bnn-linechart__empty', className)} style={{ minHeight: height }}>
        <EmptyState />
      </div>
    )
  }

  const innerWidth = Math.max(1, width - PAD.left - PAD.right)
  const innerHeight = Math.max(1, height - PAD.top - PAD.bottom)
  const x = (i: number) => PAD.left + (count <= 1 ? innerWidth / 2 : (i / (count - 1)) * innerWidth)
  const y = (value: number) => PAD.top + innerHeight - (value / max) * innerHeight
  const color = (i: number) => `var(${SERIES_TOKENS[Math.min(i, SERIES_TOKENS.length - 1)]})`
  const labelEvery = Math.max(1, Math.ceil(count / Math.max(2, Math.floor(innerWidth / MIN_LABEL_GAP))))

  const track = (e: MouseEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - box.left - PAD.left) / innerWidth
    setHover(Math.max(0, Math.min(count - 1, Math.round(ratio * (count - 1)))))
  }

  return (
    <figure className={cn('bnn-linechart', className)}>
      {legend && series.length > 1 && (
        <figcaption className="bnn-linechart__legend">
          {series.map((s, i) => (
            <span key={s.label} className="bnn-linechart__key">
              <svg width="12" height="2" aria-hidden>
                <line x1="0" x2="12" y1="1" y2="1" stroke={color(i)} strokeWidth="2" strokeDasharray={s.dashed ? '3 2' : undefined} />
              </svg>
              {s.label}
            </span>
          ))}
        </figcaption>
      )}
      <div ref={ref} className="bnn-linechart__plot" style={{ height }}>
        <svg
          className="bnn-chart"
          role="img"
          aria-label={label}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          onMouseMove={track}
          onMouseLeave={() => setHover(null)}
        >
          {[0, 0.5, 1].map((share) => (
            <g key={share}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(max * share)}
                y2={y(max * share)}
                className={share === 0 ? 'bnn-linechart__baseline' : 'bnn-linechart__grid'}
              />
              <text x={PAD.left - 8} y={y(max * share) + 4} textAnchor="end" className="bnn-linechart__axis">
                {compact(max * share)}
              </text>
            </g>
          ))}
          {axis.map((point, i) =>
            /* The last label always shows, so the axis says where it ends; the
               regular one right before it gives way when they would collide. */
            i === count - 1 || (i % labelEvery === 0 && count - 1 - i >= labelEvery) ? (
              <text
                key={i}
                x={x(i)}
                y={height - 6}
                textAnchor={i === 0 ? 'start' : i === count - 1 ? 'end' : 'middle'}
                className="bnn-linechart__axis"
              >
                {point.label}
              </text>
            ) : null,
          )}
          {series.map((s, i) => (
            <polyline
              key={s.label}
              points={s.data.map((d, index) => `${x(index)},${y(d.value)}`).join(' ')}
              fill="none"
              stroke={color(i)}
              strokeWidth="1.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={s.dashed ? '4 3' : undefined}
            />
          ))}
          {hover != null && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerHeight} className="bnn-linechart__cursor" />
              {series.map((s, i) =>
                s.data[hover] ? (
                  <circle key={s.label} cx={x(hover)} cy={y(s.data[hover].value)} r="3" fill={color(i)} stroke="var(--bnn-surface)" strokeWidth="1.5" />
                ) : null,
              )}
            </g>
          )}
        </svg>
        {hover != null && (
          <div
            className="bnn-linechart__tip"
            style={x(hover) > width / 2 ? { right: width - x(hover) + 8 } : { left: x(hover) + 8 }}
          >
            <div className="bnn-linechart__tip-title">{axis[hover]?.label}</div>
            {series.map((s, i) => (
              <div key={s.label} className="bnn-linechart__tip-row">
                <span className="bnn-linechart__tip-dot" style={{ background: color(i) }} />
                <span className="bnn-linechart__tip-name">{s.label}</span>
                <span className="bnn-linechart__tip-value">{format(s.data[hover]?.value ?? 0)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </figure>
  )
}
