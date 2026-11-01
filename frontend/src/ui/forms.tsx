import {
  createContext,
  useContext,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type AriaAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react'
import { cn } from './primitives'
import { IconCheck, IconClose, IconUpload } from './Icon'
import { FieldContext, useField } from './field'
import { uiStrings } from './strings'

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
  disabled,
  ...rest
}: InputProps) {
  const field = useField()
  const showClear = allowClear && value != null && String(value).length > 0
  return (
    <span
      className={cn(
        'bnn-input',
        `bnn-input--${size}`,
        (status === 'error' || field['aria-invalid']) && 'is-error',
        disabled && 'is-disabled',
        className,
      )}
    >
      {prefix && <span className="bnn-input__prefix">{prefix}</span>}
      <input {...field} className="bnn-input__el" value={value} disabled={disabled} {...rest} />
      {showClear && !disabled && (
        <button
          type="button"
          className="bnn-input__clear"
          onClick={onClear}
          aria-label={uiStrings.clear}
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
          disabled={props.disabled}
          aria-label={shown ? uiStrings.hidePassword : uiStrings.showPassword}
          aria-pressed={shown}
          onClick={() => setShown((s) => !s)}
        >
          {shown ? uiStrings.hide : uiStrings.show}
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
  const field = useField()
  return (
    <textarea
      {...field}
      rows={rows}
      className={cn(
        'bnn-textarea',
        `bnn-input--${size}`,
        (status === 'error' || field['aria-invalid']) && 'is-error',
        className,
      )}
      {...rest}
    />
  )
}

export { Select } from './Select'
export type { SelectProps, SelectOption } from './Select'

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
  const field = useField()
  return (
    <label className={cn('bnn-checkbox', disabled && 'is-disabled', className)}>
      <input
        {...field}
        aria-labelledby={children ? undefined : field['aria-labelledby']}
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
  ...aria
}: {
  checked?: boolean
  onChange?: (checked: boolean) => void
  disabled?: boolean
  size?: 'sm' | 'md'
  className?: string
} & AriaAttributes) {
  const field = useField()
  return (
    <button
      type="button"
      {...field}
      {...aria}
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
  const field = useField()
  const name = useId()
  return (
    <div {...field} className={cn('bnn-radio-group', className)} role="radiogroup">
      {options.map((o) => (
        <label
          key={String(o.value)}
          className={cn('bnn-radio', o.disabled && 'is-disabled')}
        >
          <input
            type="radio"
            name={name}
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
  const field = useField()
  return (
    <span className={cn('bnn-input', `bnn-input--${size}`, disabled && 'is-disabled', className)}>
      <input
        {...field}
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
  const labelId = `${id}-label`
  const descriptionId = error || help ? `${id}-description` : undefined
  return (
    <FieldContext.Provider value={{
      id,
      labelId: label ? labelId : undefined,
      descriptionId,
      required,
      invalid: Boolean(error),
    }}>
      <div
        className={cn(
          'bnn-form-item',
          `bnn-form-item--${layout}`,
          Boolean(error) && 'has-error',
          className,
        )}
      >
        {label && (
          <label id={labelId} className="bnn-form-item__label" htmlFor={id}>
            {required && <span className="bnn-form-item__req">*</span>}
            {label}
          </label>
        )}
        <div className="bnn-form-item__control">
          {children}
          {error ? (
            <div id={descriptionId} className="bnn-form-item__error">{error}</div>
          ) : help ? (
            <div id={descriptionId} className="bnn-form-item__help">{help}</div>
          ) : null}
        </div>
      </div>
    </FieldContext.Provider>
  )
}

/* ------------------------------------------------------------- Upload */
export function UploadDragger({
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
        {...field}
        ref={inputRef}
        disabled={disabled}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => {
          if (e.target.files?.length) onFiles?.(e.target.files)
          e.target.value = ''
        }}
      />
      <IconUpload size={26} className="bnn-upload-dragger__icon" />
      <div className="bnn-upload-dragger__title">{title}</div>
      {hint && <div className="bnn-upload-dragger__hint">{hint}</div>}
    </div>
  )
}
