import {
  createContext,
  useCallback,
  useContext,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react'
import { cn } from './primitives'
import { IconCheck, IconChevronDown, IconClose, IconUpload } from './Icon'
import { Portal, useDismiss } from './portal'

/* -------------------------------------------------------------- Input */
export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  prefix?: ReactNode
  suffix?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  status?: 'error'
  allowClear?: boolean
  onClear?: () => void
}

export function Input({
  prefix,
  suffix,
  size = 'md',
  status,
  allowClear,
  onClear,
  className,
  value,
  ...rest
}: InputProps) {
  const showClear = allowClear && value != null && String(value).length > 0
  return (
    <span
      className={cn(
        'bnn-input',
        `bnn-input--${size}`,
        status === 'error' && 'is-error',
        className,
      )}
    >
      {prefix && <span className="bnn-input__prefix">{prefix}</span>}
      <input className="bnn-input__el" value={value} {...rest} />
      {showClear && (
        <button
          type="button"
          className="bnn-input__clear"
          onClick={onClear}
          tabIndex={-1}
          aria-label="clear"
        >
          <IconClose size={13} />
        </button>
      )}
      {suffix && <span className="bnn-input__suffix">{suffix}</span>}
    </span>
  )
}

export function Password({ ...props }: InputProps) {
  const [shown, setShown] = useState(false)
  return (
    <Input
      {...props}
      type={shown ? 'text' : 'password'}
      suffix={
        <button
          type="button"
          className="bnn-input__toggle"
          onClick={() => setShown((s) => !s)}
          tabIndex={-1}
        >
          {shown ? 'Hide' : 'Show'}
        </button>
      }
    />
  )
}

/* ----------------------------------------------------------- Textarea */
export function Textarea({
  size = 'md',
  status,
  className,
  rows = 4,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  size?: 'sm' | 'md' | 'lg'
  status?: 'error'
}) {
  return (
    <textarea
      rows={rows}
      className={cn(
        'bnn-textarea',
        `bnn-input--${size}`,
        status === 'error' && 'is-error',
        className,
      )}
      {...rest}
    />
  )
}

/* ------------------------------------------------------------- Select */
export interface SelectOption {
  label: ReactNode
  value: string | number
  disabled?: boolean
}

export interface SelectProps {
  options: SelectOption[]
  value?: string | number | null
  onChange?: (value: string | number) => void
  placeholder?: string
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  allowClear?: boolean
  status?: 'error'
  style?: React.CSSProperties
  className?: string
}

export function Select({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  size = 'md',
  disabled,
  allowClear,
  status,
  style,
  className,
}: SelectProps) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const open = rect != null
  const close = useCallback(() => setRect(null), [])
  useDismiss(open, [ref, menuRef], close)
  const selected = options.find((o) => o.value === value)

  return (
    <div
      ref={ref}
      className={cn(
        'bnn-select',
        `bnn-select--${size}`,
        open && 'is-open',
        disabled && 'is-disabled',
        status === 'error' && 'is-error',
        className,
      )}
      style={style}
    >
      <button
        type="button"
        className="bnn-select__control"
        disabled={disabled}
        onClick={() =>
          setRect((r) => (r ? null : ref.current!.getBoundingClientRect()))
        }
      >
        <span className={cn('bnn-select__value', !selected && 'is-placeholder')}>
          {selected ? selected.label : placeholder}
        </span>
        {allowClear && selected ? (
          <span
            className="bnn-select__clear"
            onClick={(e) => {
              e.stopPropagation()
              onChange?.('' as never)
            }}
          >
            <IconClose size={13} />
          </span>
        ) : (
          <IconChevronDown size={15} className="bnn-select__arrow" />
        )}
      </button>
      {open && (
        <Portal>
          <div
            ref={menuRef}
            className="bnn-select__menu"
            style={{
              position: 'fixed',
              top: rect.bottom + 4,
              left: rect.left,
              right: 'auto',
              minWidth: rect.width,
              maxWidth: Math.max(rect.width, 360),
            }}
          >
            {options.length === 0 && (
              <div className="bnn-select__empty">No options</div>
            )}
            {options.map((o) => (
              <button
                type="button"
                key={String(o.value)}
                className={cn(
                  'bnn-select__option',
                  o.value === value && 'is-selected',
                  o.disabled && 'is-disabled',
                )}
                disabled={o.disabled}
                onClick={() => {
                  onChange?.(o.value)
                  close()
                }}
              >
                <span>{o.label}</span>
                {o.value === value && <IconCheck size={14} />}
              </button>
            ))}
          </div>
        </Portal>
      )}
    </div>
  )
}

/* ----------------------------------------------------------- Checkbox */
export function Checkbox({
  checked,
  onChange,
  children,
  disabled,
  className,
}: {
  checked?: boolean
  onChange?: (checked: boolean) => void
  children?: ReactNode
  disabled?: boolean
  className?: string
}) {
  return (
    <label className={cn('bnn-checkbox', disabled && 'is-disabled', className)}>
      <input
        type="checkbox"
        checked={!!checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      <span className="bnn-checkbox__box">
        <IconCheck size={12} />
      </span>
      {children && <span className="bnn-checkbox__label">{children}</span>}
    </label>
  )
}

/* ------------------------------------------------------------- Switch */
export function Switch({
  checked,
  onChange,
  disabled,
  size = 'md',
  className,
}: {
  checked?: boolean
  onChange?: (checked: boolean) => void
  disabled?: boolean
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      disabled={disabled}
      className={cn(
        'bnn-switch',
        `bnn-switch--${size}`,
        checked && 'is-on',
        className,
      )}
      onClick={() => onChange?.(!checked)}
    >
      <span className="bnn-switch__handle" />
    </button>
  )
}

/* -------------------------------------------------------------- Radio */
export interface RadioOption {
  label: ReactNode
  value: string | number
  disabled?: boolean
}

export function RadioGroup({
  options,
  value,
  onChange,
  className,
}: {
  options: RadioOption[]
  value?: string | number
  onChange?: (value: string | number) => void
  className?: string
}) {
  return (
    <div className={cn('bnn-radio-group', className)} role="radiogroup">
      {options.map((o) => (
        <label
          key={String(o.value)}
          className={cn('bnn-radio', o.disabled && 'is-disabled')}
        >
          <input
            type="radio"
            checked={o.value === value}
            disabled={o.disabled}
            onChange={() => onChange?.(o.value)}
          />
          <span className="bnn-radio__dot" />
          <span className="bnn-radio__label">{o.label}</span>
        </label>
      ))}
    </div>
  )
}

/* --------------------------------------------------------- DatePicker */
export function DatePicker({
  value,
  onChange,
  size = 'md',
  disabled,
  className,
  ...rest
}: {
  value?: string
  onChange?: (value: string) => void
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  className?: string
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'size'>) {
  return (
    <span className={cn('bnn-input', `bnn-input--${size}`, className)}>
      <input
        type="date"
        className="bnn-input__el bnn-datepicker"
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value)}
        {...rest}
      />
    </span>
  )
}

/* --------------------------------------------------------------- Form */
interface FormCtx {
  layout: 'vertical' | 'horizontal'
}
const FormContext = createContext<FormCtx>({ layout: 'vertical' })

export function Form({
  layout = 'vertical',
  onSubmit,
  children,
  className,
}: {
  layout?: 'vertical' | 'horizontal'
  onSubmit?: (e: React.FormEvent) => void
  children: ReactNode
  className?: string
}) {
  return (
    <FormContext.Provider value={{ layout }}>
      <form
        className={cn('bnn-form', `bnn-form--${layout}`, className)}
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit?.(e)
        }}
      >
        {children}
      </form>
    </FormContext.Provider>
  )
}

export function FormItem({
  label,
  required,
  error,
  help,
  children,
  className,
}: {
  label?: ReactNode
  required?: boolean
  error?: ReactNode
  help?: ReactNode
  children: ReactNode
  className?: string
}) {
  const { layout } = useContext(FormContext)
  const id = useId()
  return (
    <div
      className={cn(
        'bnn-form-item',
        `bnn-form-item--${layout}`,
        Boolean(error) && 'has-error',
        className,
      )}
    >
      {label && (
        <label className="bnn-form-item__label" htmlFor={id}>
          {required && <span className="bnn-form-item__req">*</span>}
          {label}
        </label>
      )}
      <div className="bnn-form-item__control">
        {children}
        {error ? (
          <div className="bnn-form-item__error">{error}</div>
        ) : help ? (
          <div className="bnn-form-item__help">{help}</div>
        ) : null}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- Upload */
export function UploadDragger({
  onFiles,
  accept,
  multiple,
  hint,
  title = 'Click or drag file to this area to upload',
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
  const [drag, setDrag] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div
      className={cn(
        'bnn-upload-dragger',
        drag && 'is-drag',
        disabled && 'is-disabled',
        className,
      )}
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDrag(true)
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDrag(false)
        if (!disabled && e.dataTransfer.files.length) onFiles?.(e.dataTransfer.files)
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => e.target.files && onFiles?.(e.target.files)}
      />
      <IconUpload size={26} className="bnn-upload-dragger__icon" />
      <div className="bnn-upload-dragger__title">{title}</div>
      {hint && <div className="bnn-upload-dragger__hint">{hint}</div>}
    </div>
  )
}
