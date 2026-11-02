export type StackLineKind = 'head' | 'app' | 'framework' | 'other'

export interface StackLine {
  text: string
  kind: StackLineKind
}

const FRAMEWORK_FRAME = /^\s*at (android|androidx|com\.android|com\.google\.android|dalvik|java|javax|jdk|kotlin|kotlinx|libcore|sun|okhttp3|okio|retrofit2)\./

/** Marks which lines of a stack trace are the app's own, because those are the
 *  ones worth reading first. Obfuscated frames count as the app's. */
export function parseStackTrace(trace: string): StackLine[] {
  return trace.split('\n').map((text, index) => {
    if (index === 0 || /^\s*Caused by:/.test(text)) return { text, kind: 'head' }
    if (!/^\s*at /.test(text)) return { text, kind: 'other' }
    return { text, kind: FRAMEWORK_FRAME.test(text) ? 'framework' : 'app' }
  })
}

/** "java.lang.IllegalStateException" -> "IllegalStateException". */
export function shortClassName(name: string | null): string {
  if (!name) return 'Unknown error'
  return name.split(/[.$]/).pop() || name
}
