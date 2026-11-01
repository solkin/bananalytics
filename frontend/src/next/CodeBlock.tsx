import { Button, Icons, toast } from '@/ui'
import './codeblock.css'

export function CodeBlock({ code }: { code: string }) {
  const copy = () => {
    navigator.clipboard?.writeText(code)
    toast.success('Copied to clipboard')
  }
  return (
    <div className="cb">
      <div className="cb__toolbar">
        <Button size="sm" icon={<Icons.IconCopy size={13} />} onClick={copy}>
          Copy
        </Button>
      </div>
      <pre className="stacktrace">{code}</pre>
    </div>
  )
}
