import { Select } from '@/ui'
import type { VersionInfo } from '@/api/events'
import { versionLabel } from './format'
import './pages/analytics.css'

const DAY_OPTIONS = [
  { label: 'Last 7 days', value: '7' },
  { label: 'Last 28 days', value: '28' },
  { label: 'Last 90 days', value: '90' },
]

/** The version and period chips that every analytics screen shares. */
export function AnalyticsFilters({
  days,
  version,
  versions,
  onChange,
}: {
  days: number
  version?: number
  versions: VersionInfo[]
  onChange: (updates: Record<string, string | undefined>) => void
}) {
  return (
    <div className="an-filters">
      <Select
        variant="chip"
        name="Version"
        aria-label="Version"
        placeholder="All"
        allowClear
        value={version ?? null}
        onChange={(v) => onChange({ version: v === '' ? undefined : String(v) })}
        options={versions.map((v) => ({ label: versionLabel(v), value: v.version_code }))}
      />
      <Select
        variant="chip"
        aria-label="Period"
        value={String(days)}
        onChange={(v) => onChange({ days: String(v) })}
        options={DAY_OPTIONS}
      />
    </div>
  )
}
