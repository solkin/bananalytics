import type { ReactNode } from 'react'
import { Icons } from '@/ui'

/* Sidebar navigation — App Center structure, mapped to the features
   Bananalytics actually supports. Paths are relative to the app base
   (/next/apps/:appId). */

export interface NavLeaf {
  label: string
  path: string
  icon?: ReactNode
}

export interface NavGroup {
  label: string
  icon: ReactNode
  items: NavLeaf[]
}

/* Standalone top-level items (no group header). */
export const TOP: NavLeaf[] = [
  { label: 'Getting started', path: 'getting-started', icon: <Icons.IconBook size={16} /> },
]

export const NAV: NavGroup[] = [
  {
    label: 'Analytics',
    icon: <Icons.IconChart size={16} />,
    items: [
      { label: 'Overview', path: 'analytics/overview' },
      { label: 'Events', path: 'analytics/events' },
      { label: 'Devices', path: 'analytics/devices' },
    ],
  },
  {
    label: 'Diagnostics',
    icon: <Icons.IconBug size={16} />,
    items: [
      { label: 'Issues', path: 'diagnostics/issues' },
      { label: 'Mappings', path: 'diagnostics/mappings' },
    ],
  },
  {
    label: 'Distribution',
    icon: <Icons.IconPackage size={16} />,
    items: [{ label: 'Releases', path: 'distribution/releases' }],
  },
  {
    label: 'Settings',
    icon: <Icons.IconSettings size={16} />,
    items: [
      { label: 'General', path: 'settings/general' },
      { label: 'People', path: 'settings/people' },
    ],
  },
]

export interface ActiveMatch {
  group?: string
  leaf: NavLeaf
}

/* `rel` is the path after /next/apps/:appId/. Longest-prefix match so
   detail routes (e.g. analytics/events/:name) resolve to their leaf. */
export function findActive(rel: string): ActiveMatch | null {
  let best: ActiveMatch | null = null
  const consider = (m: ActiveMatch) => {
    const p = m.leaf.path
    if (rel === p || rel.startsWith(p + '/')) {
      if (!best || p.length > best.leaf.path.length) best = m
    }
  }
  for (const t of TOP) consider({ leaf: t })
  for (const group of NAV) for (const leaf of group.items) consider({ group: group.label, leaf })
  return best
}
