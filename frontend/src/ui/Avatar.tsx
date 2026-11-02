import type { CSSProperties } from 'react'
import { cn } from './cn'
import './Avatar.css'

function initialsOf(name: string, count: number) {
  return name
    .split(/[\s@.-]+/)
    .filter(Boolean)
    .slice(0, count)
    .map((part) => part[0].toUpperCase())
    .join('')
}

/** A person (round, two initials) or an app (rounded square, one letter).
 *  Decorative: the name always appears next to it. */
export function Avatar({
  name,
  src,
  size = 20,
  shape = 'circle',
  background,
  className,
}: {
  name: string
  src?: string | null
  size?: number
  shape?: 'circle' | 'square'
  background?: string
  className?: string
}) {
  const style: CSSProperties = { width: size, height: size, fontSize: Math.round(size * 0.5), background }
  return (
    <span className={cn('bnn-avatar', `bnn-avatar--${shape}`, className)} style={style} aria-hidden>
      {src ? <img className="bnn-avatar__image" src={src} alt="" /> : initialsOf(name, shape === 'circle' ? 2 : 1)}
    </span>
  )
}
