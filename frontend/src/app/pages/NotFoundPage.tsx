import { EmptyState } from '@/ui'

/** A path inside an app that nothing is mounted on. */
export default function NotFoundPage() {
  return <EmptyState title="Page not found" description="Pick a section in the sidebar." />
}
