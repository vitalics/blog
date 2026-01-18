import defaultTheme from './themes/default.json'
import amberTheme from './themes/amber.json'
import neutralTheme from './themes/neutral.json'
import notebookTheme from './themes/notebook.json'
import candylandTheme from './themes/candyland.json'
import bubblegumTheme from './themes/bubblegum.json'
import monoTheme from './themes/mono.json'
import doom64Theme from './themes/doom64.json'

export interface ThemeColors {
  background: string
  foreground: string
  card: string
  cardForeground: string
  popover: string
  popoverForeground: string
  primary: string
  primaryForeground: string
  secondary: string
  secondaryForeground: string
  muted: string
  mutedForeground: string
  accent: string
  accentForeground: string
  destructive: string
  destructiveForeground: string
  border: string
  input: string
  ring: string
}

export interface Theme {
  name: string
  label: string
  light: ThemeColors
  dark: ThemeColors
}

// Load themes from JSON files
export const THEMES: Record<string, Theme> = {
  default: defaultTheme as Theme,
  amber: amberTheme as Theme,
  neutral: neutralTheme as Theme,
  notebook: notebookTheme as Theme,
  candyland: candylandTheme as Theme,
  bubblegum: bubblegumTheme as Theme,
  mono: monoTheme as Theme,
  doom64: doom64Theme as Theme,
}

export function getTheme(name: string): Theme {
  return THEMES[name] || THEMES.default
}

export function getAllThemes(): Theme[] {
  return Object.values(THEMES)
}
