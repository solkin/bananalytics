import { toast } from '@/ui'

/** Copies text and says so. The clipboard API does not exist on plain HTTP,
 *  which a self-hosted install may well use, so failure is an ordinary outcome. */
export async function copyText(text: string, success = 'Copied to clipboard'): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(success)
    return true
  } catch {
    toast.error('Could not copy. Select the text and copy it manually.')
    return false
  }
}
