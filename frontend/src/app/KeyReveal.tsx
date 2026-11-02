import { useState } from 'react'
import { Button, toast } from '@/ui'
import './keyreveal.css'

/** The one moment a secret is readable: right after it was created. */
export function KeyReveal({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="key-reveal">
      <code className="key-reveal__value bnn-mono">{value}</code>
      <Button
        onClick={() => {
          /* The key cannot be shown again, so claiming a copy that failed would lose it. */
          navigator.clipboard.writeText(value).then(
            () => setCopied(true),
            () => toast.error('Could not copy. Select the key and copy it manually.'),
          )
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  )
}
