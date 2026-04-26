'use client'

import type { InputHTMLAttributes, ReactNode } from 'react'
import { useId } from 'react'

import { cn } from './utils'

/**
 * Backwards-compatible TextField that preserves the OUI-era public API
 * (label / description / errorMessage / inputProps={{ placeholder, name, ... }})
 * while rendering on top of plain shadcn-style primitives. Consumer pages
 * pass `value` (string) and `onChange` (string => void), matching the
 * react-aria-components TextField signature they already use.
 */
export interface TextFieldClassNames {
  base?: string
  label?: string
  input?: string
  description?: string
  error?: string
  inputGroup?: string
}

export interface TextFieldProps {
  label?: ReactNode
  description?: ReactNode
  errorMessage?: ReactNode
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  isRequired?: boolean
  isDisabled?: boolean
  isReadOnly?: boolean
  isInvalid?: boolean
  className?: string
  classNames?: TextFieldClassNames
  startContent?: ReactNode
  endContent?: ReactNode
  /**
   * Forwarded to the underlying <input>. Mirrors the OUI `inputProps`
   * shape consumer pages use today (e.g. `inputProps={{ placeholder, name,
   * type: 'email', maxLength: 50 }}`).
   */
  inputProps?: Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'value' | 'defaultValue' | 'onChange' | 'disabled' | 'required' | 'readOnly'
  >
  /** Reserved for parity with the legacy API. Currently unused. */
  size?: 'sm' | 'md' | 'lg'
  /** Reserved for parity with the legacy API. Currently unused. */
  variant?: string
  id?: string
  name?: string
}

export function TextField({
  label,
  description,
  errorMessage,
  value,
  defaultValue,
  onChange,
  isRequired,
  isDisabled,
  isReadOnly,
  isInvalid,
  className,
  classNames,
  startContent,
  endContent,
  inputProps,
  id,
  name,
}: TextFieldProps) {
  const generatedId = useId()
  const inputId = id ?? inputProps?.id ?? generatedId
  const descriptionId = `${inputId}-description`
  const errorId = `${inputId}-error`
  const hasError = isInvalid || errorMessage !== undefined

  const baseInputClasses =
    'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background ' +
    'file:border-0 file:bg-transparent file:text-sm file:font-medium ' +
    'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 ' +
    'focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'

  return (
    <div
      className={cn(
        'flex w-full flex-col gap-2',
        className ?? classNames?.base,
      )}
    >
      {label !== undefined && (
        <label
          htmlFor={inputId}
          className={cn(
            'text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
            classNames?.label,
          )}
        >
          {label}
          {isRequired ? (
            <span className="text-destructive ml-0.5">*</span>
          ) : null}
        </label>
      )}

      {startContent !== undefined || endContent !== undefined ? (
        <div
          className={cn(
            'relative flex w-full items-stretch',
            classNames?.inputGroup,
          )}
        >
          {startContent !== undefined && (
            <span className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              {startContent}
            </span>
          )}
          <input
            id={inputId}
            name={name ?? inputProps?.name}
            value={value}
            defaultValue={defaultValue}
            onChange={onChange ? (e) => onChange(e.target.value) : undefined}
            required={isRequired}
            disabled={isDisabled}
            readOnly={isReadOnly}
            aria-invalid={hasError || undefined}
            aria-describedby={
              [
                description !== undefined ? descriptionId : undefined,
                hasError ? errorId : undefined,
              ]
                .filter(Boolean)
                .join(' ') || undefined
            }
            className={cn(
              baseInputClasses,
              startContent !== undefined && 'pl-10',
              endContent !== undefined && 'pr-10',
              hasError && 'border-destructive focus-visible:ring-destructive',
              classNames?.input,
            )}
            {...inputProps}
          />
          {endContent !== undefined && (
            <span className="text-muted-foreground pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
              {endContent}
            </span>
          )}
        </div>
      ) : (
        <input
          id={inputId}
          name={name ?? inputProps?.name}
          value={value}
          defaultValue={defaultValue}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          required={isRequired}
          disabled={isDisabled}
          readOnly={isReadOnly}
          aria-invalid={hasError || undefined}
          aria-describedby={
            [
              description !== undefined ? descriptionId : undefined,
              hasError ? errorId : undefined,
            ]
              .filter(Boolean)
              .join(' ') || undefined
          }
          className={cn(
            baseInputClasses,
            hasError && 'border-destructive focus-visible:ring-destructive',
            classNames?.input,
          )}
          {...inputProps}
        />
      )}

      {description !== undefined && (
        <p
          id={descriptionId}
          className={cn(
            'text-muted-foreground text-sm',
            classNames?.description,
          )}
        >
          {description}
        </p>
      )}
      {hasError && errorMessage !== undefined && (
        <p
          id={errorId}
          className={cn('text-destructive text-sm', classNames?.error)}
        >
          {errorMessage}
        </p>
      )}
    </div>
  )
}
