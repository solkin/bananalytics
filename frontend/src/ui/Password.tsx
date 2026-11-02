import { useState } from 'react'
import { Input, type InputProps } from './Input'
import { uiStrings } from './strings'

export function Password(props: InputProps) {
  const [shown, setShown] = useState(false)
  return (
    <Input
      {...props}
      type={shown ? 'text' : 'password'}
      suffix={
        <button
          type="button"
          className="bnn-input__button"
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
