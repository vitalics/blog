import { AArrowDown, ALargeSmall, AArrowUp } from 'lucide-react'

/**
 * Centralized font size configuration
 * Used across the application for consistent font sizing
 */

export const FONT_SIZES = [
  { value: 'small', label: 'Small', size: '14px', icon: AArrowDown },
  { value: 'medium', label: 'Medium', size: '16px', icon: ALargeSmall },
  { value: 'large', label: 'Large', size: '18px', icon: AArrowUp },
  { value: 'x-large', label: 'Extra Large', size: '20px', icon: AArrowUp },
] as const

export type FontSize = typeof FONT_SIZES[number]['value']

/**
 * Get font size configuration by value
 */
export function getFontSize(value: FontSize) {
  return FONT_SIZES.find(fs => fs.value === value) || FONT_SIZES[1] // default to medium
}

/**
 * Get all available font sizes
 */
export function getAllFontSizes() {
  return FONT_SIZES
}
