'use client'

import { Button } from '@opengovsg/oui/button'
import { Tooltip, TooltipTrigger } from '@opengovsg/oui/tooltip'
import { useTheme } from 'next-themes'
import { BiDesktop, BiMoon, BiSun } from 'react-icons/bi'

type Theme = 'light' | 'dark' | 'system'

const THEME_CYCLE: Theme[] = ['light', 'dark', 'system']

const THEME_ICONS: Record<Theme, React.ReactNode> = {
  light: <BiSun className="h-5 w-5" />,
  dark: <BiMoon className="h-5 w-5" />,
  system: <BiDesktop className="h-5 w-5" />,
}

const THEME_LABELS: Record<Theme, string> = {
  light: 'Light mode',
  dark: 'Dark mode',
  system: 'System theme',
}

function isTheme(value: string | undefined): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system'
}

export const ThemeToggle = () => {
  const { theme, setTheme } = useTheme()

  const currentTheme: Theme = isTheme(theme) ? theme : 'system'

  const cycleTheme = () => {
    const currentIndex = THEME_CYCLE.indexOf(currentTheme)
    const nextIndex = (currentIndex + 1) % THEME_CYCLE.length
    const nextTheme = THEME_CYCLE[nextIndex]
    if (nextTheme) setTheme(nextTheme)
  }

  return (
    <TooltipTrigger delay={500}>
      <Button
        variant="clear"
        size="md"
        onPress={cycleTheme}
        aria-label={`Theme: ${THEME_LABELS[currentTheme]}, click to cycle`}
      >
        {THEME_ICONS[currentTheme]}
      </Button>
      <Tooltip>{THEME_LABELS[currentTheme]}</Tooltip>
    </TooltipTrigger>
  )
}
