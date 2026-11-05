import type { TokenAccess } from '@/api/tokens'

/** Access levels in order, each including the ones before it. */
export const ACCESS_OPTIONS: { value: TokenAccess; scope: string; label: string; hint: string }[] = [
  { value: 'read', scope: 'mcp:read', label: 'Read only', hint: 'Crashes, analytics and releases.' },
  {
    value: 'write',
    scope: 'mcp:write',
    label: 'Read and write',
    hint: 'Also add apps, versions and keys, upload builds and mappings, resolve issues.',
  },
  { value: 'manage', scope: 'mcp:manage', label: 'Full access', hint: 'Also invite people, email testers and delete data.' },
]

/** The highest level a granted scope string names. */
export const accessLabel = (scope: string) => {
  const scopes = scope.split(' ')
  return ACCESS_OPTIONS.reduce((level, option) => (scopes.includes(option.scope) ? option : level)).label
}
