import { Avatar } from '@/ui'

const TILES = 6

function tileFor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return `var(--bnn-tile-${(hash % TILES) + 1})`
}

/** The app's mark: its uploaded icon, or a letter on a tile derived from the name. */
export function AppIcon({ name, iconUrl, size = 20 }: { name: string; iconUrl?: string | null; size?: number }) {
  return <Avatar name={name} src={iconUrl} size={size} shape="square" background={tileFor(name)} />
}
