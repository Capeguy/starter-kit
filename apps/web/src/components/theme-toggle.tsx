'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

import { Button } from '~/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/components/ui/tooltip'

type Theme = 'light' | 'dark' | 'system'

const THEME_CYCLE: Theme[] = ['light', 'dark', 'system']

const THEME_ICONS: Record<Theme, React.ReactNode> = {
  light: <Sun className="size-4" />,
  dark: <Moon className="size-4" />,
  system: <Monitor className="size-4" />,
}

const THEME_LABELS: Record<Theme, string> = {
  light: 'Light mode',
  dark: 'Dark mode',
  system: 'System theme',
}

const isTheme = (v: string | undefined): v is Theme =>
  v === 'light' || v === 'dark' || v === 'system'

export const ThemeToggle = () => {
  const { theme, setTheme } = useTheme()
  const current: Theme = isTheme(theme) ? theme : 'system'

  const cycle = () => {
    const next = THEME_CYCLE[(THEME_CYCLE.indexOf(current) + 1) % 3]
    if (next) setTheme(next)
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={cycle}
          aria-label={`Theme: ${THEME_LABELS[current]}, click to cycle`}
        >
          {THEME_ICONS[current]}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{THEME_LABELS[current]}</TooltipContent>
    </Tooltip>
  )
}
