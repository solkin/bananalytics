import { Icons, toast } from '@/ui'
import './codeblock.css'

export function CodeBlock({ code }: { code: string }) {
  const copy = () => {
    navigator.clipboard?.writeText(code)
    toast.success('Copied to clipboard')
  }
  return (
    <div className="cb">
      <button className="cb__copy" type="button" onClick={copy}>
        <Icons.IconCopy size={13} />
        <span>Copy</span>
      </button>
      <pre className="stacktrace">{code}</pre>
    </div>
  )
}
