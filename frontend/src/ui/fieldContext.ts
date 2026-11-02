import { createContext, useContext } from 'react'

export const FieldContext = createContext<{
  id: string
  labelId?: string
  descriptionId?: string
  required?: boolean
  invalid?: boolean
}>({ id: '' })

/** The attributes that tie a control to the Field wrapped around it. */
export function useField() {
  const field = useContext(FieldContext)
  return {
    id: field.id || undefined,
    'aria-labelledby': field.labelId,
    'aria-describedby': field.descriptionId,
    'aria-required': field.required || undefined,
    'aria-invalid': field.invalid || undefined,
  }
}
