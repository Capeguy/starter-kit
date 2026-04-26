'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { CommandPalette } from './command-palette'

/**
 * Cmd+K command palette provider.
 *
 * Owns the palette's open/closed state and registers a single global
 * keydown listener so any deep component can toggle the overlay via
 * `useCommandPalette().open()`. Keyboard shortcut is Cmd+K on macOS,
 * Ctrl+K elsewhere; pressing it again while open closes the palette
 * (toggle). Esc-to-close is handled by the underlying cmdk Dialog.
 */
interface CommandPaletteContextValue {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(
  null,
)

export const useCommandPalette = (): CommandPaletteContextValue => {
  const ctx = useContext(CommandPaletteContext)
  if (!ctx) {
    throw new Error(
      'useCommandPalette must be used inside <CommandPaletteProvider>',
    )
  }
  return ctx
}

interface CommandPaletteProviderProps {
  children: React.ReactNode
}

export const CommandPaletteProvider = ({
  children,
}: CommandPaletteProviderProps) => {
  const [isOpen, setIsOpen] = useState(false)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen((prev) => !prev), [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd+K on macOS, Ctrl+K elsewhere. We accept either modifier on every
      // platform so power users on a non-Mac keyboard attached to a Mac (or
      // vice versa) still get the shortcut.
      const isToggleShortcut =
        event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)
      if (!isToggleShortcut) return
      event.preventDefault()
      setIsOpen((prev) => !prev)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const value = useMemo<CommandPaletteContextValue>(
    () => ({ isOpen, open, close, toggle }),
    [isOpen, open, close, toggle],
  )

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <CommandPalette isOpen={isOpen} onClose={close} />
    </CommandPaletteContext.Provider>
  )
}
