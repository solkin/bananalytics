import { useState } from 'react'
import { Button, toast } from '@/ui'
import './codeblock.css'

/** Code to read and copy. It scrolls sideways, so it has to be focusable. */
export function CodeBlock({ code, label = 'Code' }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="code-block">
      <span className="code-block__copy">
        <Button
          variant="ghost"
          aria-label={`Copy ${label.toLowerCase()}`}
          onClick={() => {
            navigator.clipboard.writeText(code).then(
              () => setCopied(true),
              () => toast.error('Could not copy. Select the text and copy it manually.'),
            )
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </span>
      <pre className="code-block__code" tabIndex={0} aria-label={label}><code>{code}</code></pre>
    </div>
  )
}
