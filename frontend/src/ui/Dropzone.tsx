import { useRef, useState, type ReactNode } from 'react'
import { cn } from './cn'
import { useField } from './fieldContext'
import { uiStrings } from './strings'
import './Dropzone.css'

export function Dropzone({
  onFiles,
  accept,
  multiple,
  hint,
  title = uiStrings.upload,
  disabled,
  className,
}: {
  onFiles?: (files: FileList) => void
  accept?: string
  multiple?: boolean
  hint?: ReactNode
  title?: ReactNode
  disabled?: boolean
  className?: string
}) {
  const field = useField()
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div
      className={cn('bnn-dropzone', dragging && 'is-dragging', disabled && 'is-disabled', className)}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      aria-label={typeof title === 'string' ? title : undefined}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          inputRef.current?.click()
        }
      }}
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        if (!disabled && e.dataTransfer.files.length) onFiles?.(e.dataTransfer.files)
      }}
    >
      <input
        {...field}
        ref={inputRef}
        disabled={disabled}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          if (e.target.files?.length) onFiles?.(e.target.files)
          e.target.value = ''
        }}
      />
      <div className="bnn-dropzone__title">{title}</div>
      {hint && <div className="bnn-dropzone__hint">{hint}</div>}
    </div>
  )
}
