import './Sparkline.css'

/** A trend small enough to sit beside a number: no axes, no labels. Decorative,
 *  so the number next to it has to carry the meaning. */
export function Sparkline({
  data,
  width = 56,
  height = 16,
}: {
  /** Values in chronological order. */
  data: number[]
  width?: number
  height?: number
}) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const inset = 1
  const points = data
    .map((value, i) => {
      const x = inset + (i / (data.length - 1)) * (width - inset * 2)
      const y = height - inset - ((value - min) / range) * (height - inset * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg className="bnn-sparkline" width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" aria-hidden>
      <polyline points={points} />
    </svg>
  )
}
