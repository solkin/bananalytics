import { useState } from 'react'
import { Button } from '@/ui'
import { copyText } from './clipboard'
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
          onClick={() => void copyText(code).then(setCopied)}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </span>
      <pre className="code-block__code" tabIndex={0} aria-label={label}><code>{code}</code></pre>
    </div>
  )
}
