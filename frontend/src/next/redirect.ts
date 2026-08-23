import type { Location } from 'react-router-dom'

/**
 * Where an interrupted navigation should resume. A link from email (a build,
 * an invitation) points deep into an app, so a sign-in on the way there must
 * hand the visitor back to that page instead of dropping them on the home page.
 */
export function redirectTarget(location: Location): string {
  const from = (location.state as { from?: Location } | null)?.from
  if (!from || from.pathname === '/login' || from.pathname === '/register') return '/'
  return `${from.pathname}${from.search}${from.hash}`
}
