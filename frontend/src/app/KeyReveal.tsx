import { useState } from 'react'
import { Button } from '@/ui'
import { copyText } from './clipboard'
import './keyreveal.css'

/** The one moment a secret is readable: right after it was created. */
export function KeyReveal({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="key-reveal">
      <code className="key-reveal__value bnn-mono">{value}</code>
      <Button
        onClick={() => {
          /* The key cannot be shown again, so a failed copy must not read as done. */
          void copyText(value).then(setCopied)
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  )
}
