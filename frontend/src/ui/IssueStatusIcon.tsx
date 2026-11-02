import './IssueStatusIcon.css'

export type IssueStatus = 'open' | 'resolved' | 'ignored'

/** Shape carries the state as well as colour, so it survives colour blindness. */
export function IssueStatusIcon({ status, label }: { status: IssueStatus; label?: string }) {
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true }
  return (
    <svg className={`bnn-issue-status is-${status}`} width="14" height="14" viewBox="0 0 16 16" fill="none" {...a11y}>
      {status === 'resolved' ? (
        <>
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path d="m5 8.2 2.1 2.1L11 6" stroke="var(--bnn-surface)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.75" />
          {status === 'ignored' && <path d="m4 12 8-8" stroke="currentColor" strokeWidth="1.75" />}
        </>
      )}
    </svg>
  )
}
