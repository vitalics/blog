import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--base-font-family)', 'system-ui', 'sans-serif'],
        mono: ['var(--code-font-family)', 'ui-monospace', 'monospace'],
      },
      keyframes: {
        shutter: {
          '0%':   { opacity: '0.9' },
          '40%':  { opacity: '0.6' },
          '100%': { opacity: '0' },
        },
      },
      animation: {
        shutter: 'shutter 0.7s ease-out forwards',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
export default config
