import { cn } from '@/ui'
import { accentFor } from './colors'
import './appicon.css'

/** The app's square mark: its uploaded icon, or the first letter of its name
 *  on a colour derived from that name. Same component in the list, the
 *  sidebar and the settings preview — only the size differs. */
export function AppIcon({
  name,
  iconUrl,
  size = 'md',
  className,
}: {
  name: string
  iconUrl?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  return (
    <span
      className={cn('app-icon', `app-icon--${size}`, className)}
      style={iconUrl ? undefined : { background: accentFor(name) }}
      aria-hidden
    >
      {iconUrl ? <img src={iconUrl} alt="" /> : name.charAt(0).toUpperCase()}
    </span>
  )
}
