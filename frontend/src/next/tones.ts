import type { TagTone } from '@/ui'

/* Which Tag tone a domain value gets.
   The semantic tones — success, warning, danger — are reserved for states
   that really are good or bad. Categorical values (a role, a platform) take
   neutral or the purple accent, so green keeps meaning "fine". */

/** Crash issue lifecycle: open is the working state, not a good one. */
export const issueStatusTone = (status: string): TagTone =>
  status === 'resolved' ? 'success' : status === 'ignored' ? 'neutral' : 'primary'

/** App membership role — three categories, no ranking. */
export const roleTone = (role: string): TagTone =>
  role === 'admin' ? 'primary' : role === 'tester' ? 'purple' : 'neutral'

/** A missing mapping is actionable, so it warns. */
export const mappingTone = (present: boolean): TagTone => (present ? 'success' : 'warning')
