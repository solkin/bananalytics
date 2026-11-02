import { useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { cn } from './cn'
import { Kbd } from './Kbd'
import { Portal, useEsc } from './portal'
import { uiStrings } from './strings'
import './CommandPalette.css'

export interface Command {
  id: string
  label: string
  group: string
  /** Shortcut in order of pressing, such as ['G', 'O'] or ['R']. */
  keys?: string[]
  icon?: ReactNode
  run: () => void
}

function Body({ commands, onClose }: { commands: Command[]; onClose: () => void }) {
  const id = useId()
  const ref = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  useEsc(true, onClose, ref)

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return needle ? commands.filter((c) => c.label.toLowerCase().includes(needle)) : commands
  }, [commands, query])
  const groups = useMemo(() => [...new Set(visible.map((c) => c.group))], [visible])
  /* Options render by group, so that order is the one arrow keys must walk. */
  const ordered = useMemo(
    () => groups.flatMap((group) => visible.filter((c) => c.group === group)),
    [groups, visible],
  )
  const current = Math.min(active, ordered.length - 1)

  useLayoutEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [current])

  const run = (command?: Command) => {
    if (!command) return
    onClose()
    command.run()
  }

  return (
    <div className="bnn-palette-overlay" onMouseDown={onClose}>
      <div
        ref={ref}
        className="bnn-palette"
        role="dialog"
        aria-modal="true"
        aria-label={uiStrings.commandPalette}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          className="bnn-palette__input"
          role="combobox"
          aria-label={uiStrings.commandPalette}
          aria-expanded
          aria-controls={`${id}-list`}
          aria-activedescendant={ordered[current] ? `${id}-${ordered[current].id}` : undefined}
          placeholder={uiStrings.commandPlaceholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault()
              if (!ordered.length) return
              setActive((current + (e.key === 'ArrowDown' ? 1 : -1) + ordered.length) % ordered.length)
            } else if (e.key === 'Enter') {
              e.preventDefault()
              run(ordered[current])
            }
          }}
        />
        <div ref={listRef} id={`${id}-list`} className="bnn-palette__list" role="listbox" aria-label={uiStrings.commandPalette}>
          {groups.map((group) => (
            <div key={group} role="group" aria-labelledby={`${id}-${group}`}>
              <div id={`${id}-${group}`} className="bnn-palette__group">{group}</div>
              {visible
                .filter((c) => c.group === group)
                .map((command) => (
                  <div
                    key={command.id}
                    id={`${id}-${command.id}`}
                    role="option"
                    aria-selected={command === ordered[current]}
                    className={cn('bnn-palette__option', command === ordered[current] && 'is-active')}
                    onMouseEnter={() => setActive(ordered.indexOf(command))}
                    onClick={() => run(command)}
                  >
                    {command.icon}
                    <span className="bnn-palette__label">{command.label}</span>
                    {command.keys && (
                      <span className="bnn-palette__keys">
                        {command.keys.map((key) => <Kbd key={key}>{key}</Kbd>)}
                      </span>
                    )}
                  </div>
                ))}
            </div>
          ))}
          {ordered.length === 0 && <div className="bnn-palette__empty">{uiStrings.noCommands}</div>}
        </div>
      </div>
    </div>
  )
}

/** Search across everything the current screen can do. */
export function CommandPalette({
  open,
  commands,
  onClose,
}: {
  open: boolean
  commands: Command[]
  onClose: () => void
}) {
  if (!open) return null
  return (
    <Portal modal>
      <Body commands={commands} onClose={onClose} />
    </Portal>
  )
}
