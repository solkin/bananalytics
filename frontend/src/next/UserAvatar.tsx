import { Avatar, cn } from '@/ui'
import './useravatar.css'

/** The person's round mark: their uploaded avatar, or the first letter of the
 *  name they are listed under. Same component in the top bar, the people list
 *  and the account page — only the size differs. */
export function UserAvatar({
  name,
  avatarUrl,
  size = 28,
  className,
}: {
  /** Whatever the surrounding UI calls this person — a name or an email. */
  name: string
  avatarUrl?: string | null
  size?: number
  className?: string
}) {
  return (
    <Avatar size={size} className={cn('user-avatar', className)}>
      {avatarUrl ? <img src={avatarUrl} alt="" /> : name.trim().charAt(0).toUpperCase()}
    </Avatar>
  )
}
