export interface CodeTheme {
  name: string
  label: string
  light: string
  dark: string
}

export const CODE_THEMES: Record<string, CodeTheme> = {
  github: {
    name: 'github',
    label: 'GitHub',
    light: 'github-light',
    dark: 'github-dark',
  },
  'github-dimmed': {
    name: 'github-dimmed',
    label: 'GitHub Dimmed',
    light: 'github-light',
    dark: 'github-dark-dimmed',
  },
  'one-dark': {
    name: 'one-dark',
    label: 'One Dark Pro',
    light: 'one-light',
    dark: 'one-dark-pro',
  },
  dracula: {
    name: 'dracula',
    label: 'Dracula',
    light: 'github-light',
    dark: 'dracula',
  },
  'night-owl': {
    name: 'night-owl',
    label: 'Night Owl',
    light: 'github-light',
    dark: 'night-owl',
  },
  monokai: {
    name: 'monokai',
    label: 'Monokai',
    light: 'github-light',
    dark: 'monokai',
  },
  'nord': {
    name: 'nord',
    label: 'Nord',
    light: 'github-light',
    dark: 'nord',
  },
  'catppuccin': {
    name: 'catppuccin',
    label: 'Catppuccin',
    light: 'catppuccin-latte',
    dark: 'catppuccin-mocha',
  },
  'rose-pine': {
    name: 'rose-pine',
    label: 'Rosé Pine',
    light: 'github-light',
    dark: 'rose-pine',
  },
  'tokyo-night': {
    name: 'tokyo-night',
    label: 'Tokyo Night',
    light: 'github-light',
    dark: 'tokyo-night',
  },
  'material': {
    name: 'material',
    label: 'Material Theme',
    light: 'material-theme-lighter',
    dark: 'material-theme-darker',
  },
  'vitesse': {
    name: 'vitesse',
    label: 'Vitesse',
    light: 'vitesse-light',
    dark: 'vitesse-dark',
  },
  'min': {
    name: 'min',
    label: 'Min',
    light: 'min-light',
    dark: 'min-dark',
  },
}

export function getCodeTheme(name: string): CodeTheme {
  return CODE_THEMES[name] || CODE_THEMES.github
}

export function getAllCodeThemes(): CodeTheme[] {
  return Object.values(CODE_THEMES)
}
