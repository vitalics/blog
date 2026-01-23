/**
 * Mapping of blog themes to Giscus themes
 * 
 * Available Giscus themes:
 * - light / dark (default)
 * - light_high_contrast / dark_high_contrast
 * - light_protanopia / dark_protanopia (color blind friendly)
 * - light_tritanopia / dark_tritanopia (color blind friendly)
 * - transparent_dark
 * - preferred_color_scheme
 * - custom CSS URL
 * - GitHub themes: nobilis_light, cobalt, dark_dimmed, etc.
 * - Community themes: gruvbox_light, gruvbox_dark, etc.
 */

export interface GiscusThemeMapping {
  light: string
  dark: string
}

export const GISCUS_THEME_MAP: Record<string, GiscusThemeMapping> = {
  default: {
    light: 'light',
    dark: 'dark',
  },
  amber: {
    light: 'light',
    dark: 'dark',
  },
  neutral: {
    light: 'light',
    dark: 'dark',
  },
  notebook: {
    light: 'light',
    dark: 'dark',
  },
  candyland: {
    light: 'light',
    dark: 'dark',
  },
  bubblegum: {
    light: 'light',
    dark: 'dark',
  },
  mono: {
    light: 'light',
    dark: 'dark',
  },
  doom64: {
    light: 'gruvbox_light',
    dark: 'gruvbox_dark',
  },
}

/**
 * Get the appropriate Giscus theme based on blog theme and resolved theme mode
 */
export function getGiscusTheme(
  blogThemeName: string,
  resolvedTheme: 'light' | 'dark'
): string {
  const mapping = GISCUS_THEME_MAP[blogThemeName] || GISCUS_THEME_MAP.default
  return mapping[resolvedTheme]
}
