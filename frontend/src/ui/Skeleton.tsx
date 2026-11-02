import './Skeleton.css'

/** A grey placeholder the shape of the content that is on its way. */
export function Skeleton({ width, height = 10 }: { width?: number | string; height?: number }) {
  return <span className="bnn-skeleton" style={{ width, height }} aria-hidden />
}
