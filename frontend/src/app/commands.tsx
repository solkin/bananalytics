import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type DependencyList,
  type ReactNode,
} from 'react'
import { CommandPalette, type Command } from '@/ui'

/* Everything a screen can do is registered here as a command, which makes it
   available from the palette and from its keyboard shortcut at once. */

interface Commands {
  register: (owner: string, commands: Command[]) => void
  unregister: (owner: string) => void
  open: () => void
}

const CommandsContext = createContext<Commands | null>(null)

/** Open the palette from a button. */
export function useCommandPalette() {
  const commands = useContext(CommandsContext)
  if (!commands) throw new Error('useCommandPalette requires CommandsProvider')
  return commands.open
}

/** Registers commands while the calling component is mounted. */
export function useRegisterCommands(build: () => Command[], deps: DependencyList) {
  const commands = useContext(CommandsContext)
  if (!commands) throw new Error('useRegisterCommands requires CommandsProvider')
  const owner = useId()
  const { register, unregister } = commands
  const list = useMemo(build, deps)
  useEffect(() => {
    register(owner, list)
    return () => unregister(owner)
  }, [list, owner, register, unregister])
}

const SEQUENCE_TIMEOUT_MS = 1000

function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.closest('input, textarea, select, [role="combobox"], [role="menu"]') != null)
  )
}

export function CommandsProvider({ children }: { children: ReactNode }) {
  const registry = useRef(new Map<string, Command[]>())
  const [open, setOpen] = useState(false)
  const all = useCallback(() => [...registry.current.values()].flat(), [])

  const commands = useMemo<Commands>(() => ({
    register: (owner, list) => { registry.current.set(owner, list) },
    unregister: (owner) => { registry.current.delete(owner) },
    open: () => setOpen(true),
  }), [])

  useEffect(() => {
    let pending: string | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    const clearPending = () => {
      pending = null
      clearTimeout(timer)
    }
    const handle = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        /* Screens outside an app register nothing, and an empty palette helps nobody. */
        if (!all().length) return
        e.preventDefault()
        setOpen((o) => !o)
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented || isTyping(e.target)) return
      /* A dialog owns the keyboard while it is open. */
      if (document.querySelector('[aria-modal="true"]')) return
      if (e.key.length !== 1) return
      const key = e.key.toUpperCase()
      const list = all()
      const sequence = pending ? [pending, key] : [key]
      clearPending()
      const match = list.find((c) => c.keys?.join(' ') === sequence.join(' '))
      if (match) {
        e.preventDefault()
        match.run()
      } else if (sequence.length === 1 && list.some((c) => c.keys?.length === 2 && c.keys[0] === key)) {
        pending = key
        timer = setTimeout(clearPending, SEQUENCE_TIMEOUT_MS)
      }
    }
    document.addEventListener('keydown', handle)
    return () => {
      clearPending()
      document.removeEventListener('keydown', handle)
    }
  }, [all])

  return (
    <CommandsContext.Provider value={commands}>
      {children}
      <CommandPalette open={open} commands={open ? all() : []} onClose={() => setOpen(false)} />
    </CommandsContext.Provider>
  )
}
