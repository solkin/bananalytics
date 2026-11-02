import type { ReactNode } from 'react'
import { Icons } from '@/ui'

/* The app's navigation. Paths are relative to /apps/:appId; `keys` is the
   shortcut that goes there, pressed one key after the other. */

export interface NavLeaf {
  label: string
  path: string
  icon: ReactNode
  keys?: string[]
}

export interface NavGroup {
  /** Omitted for the lone item above the named groups. */
  label?: string
  items: NavLeaf[]
}

const icon = { size: 15 }

export const NAV: NavGroup[] = [
  {
    items: [{ label: 'Getting started', path: 'getting-started', icon: <Icons.IconBook {...icon} /> }],
  },
  {
    label: 'Analytics',
    items: [
      { label: 'Overview', path: 'analytics/overview', icon: <Icons.IconOverview {...icon} />, keys: ['G', 'O'] },
      { label: 'Events', path: 'analytics/events', icon: <Icons.IconEvents {...icon} />, keys: ['G', 'E'] },
      { label: 'Devices', path: 'analytics/devices', icon: <Icons.IconDevices {...icon} />, keys: ['G', 'D'] },
    ],
  },
  {
    label: 'Diagnostics',
    items: [
      { label: 'Issues', path: 'diagnostics/issues', icon: <Icons.IconIssues {...icon} />, keys: ['G', 'I'] },
      { label: 'Mappings', path: 'diagnostics/mappings', icon: <Icons.IconMappings {...icon} />, keys: ['G', 'M'] },
    ],
  },
  {
    label: 'Distribution',
    items: [{ label: 'Releases', path: 'distribution/releases', icon: <Icons.IconReleases {...icon} />, keys: ['G', 'R'] }],
  },
  {
    label: 'Settings',
    items: [
      { label: 'General', path: 'settings/general', icon: <Icons.IconGeneral {...icon} />, keys: ['G', 'S'] },
      { label: 'API keys', path: 'settings/api-keys', icon: <Icons.IconKey {...icon} /> },
      { label: 'People', path: 'settings/people', icon: <Icons.IconPeople {...icon} /> },
    ],
  },
]

/** Testers only install builds; viewers see everything except administration. */
export function navForRole(role: string | null): NavGroup[] {
  if (role === 'tester') return NAV.filter((g) => g.label === 'Distribution')
  if (role === 'viewer') return NAV.filter((g) => g.label !== 'Settings')
  return NAV
}

/** The page a role lands on and whether it may open a given app path. */
export function startPath(role: string | null) {
  return role === 'tester' ? 'distribution/releases' : 'analytics/overview'
}

export function canOpen(role: string | null, rel: string) {
  if (role === 'tester') return rel === 'distribution/releases'
  if (role === 'viewer') return !rel.startsWith('settings/')
  return true
}
