import { useRef } from 'react'
import { Button, type ButtonProps } from './Button'

/** A button that picks one file. */
export function FileButton({
  accept,
  onFile,
  onClick,
  ...button
}: Omit<ButtonProps, 'type'> & { accept?: string; onFile: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <>
      <Button
        {...button}
        onClick={(e) => {
          onClick?.(e)
          inputRef.current?.click()
        }}
      />
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          /* Cleared so that choosing the same file again still fires. */
          e.target.value = ''
          if (file) onFile(file)
        }}
      />
    </>
  )
}
