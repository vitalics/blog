import type { ManifestOptions } from 'vite-plugin-pwa';
import { name, defaultMeta } from './socials';

/**
 * Defines the configuration for PWA webmanifest.
 */
export const manifest: Partial<ManifestOptions> = {
  name, // Change this to your website's name.
  short_name: name, // Change this to your website's short name.
  description:
    defaultMeta.description, // Change this to your websites description.
  theme_color: "#d4d4d8", // Change this to your primary color.
  background_color: "#262626", // Change this to your background color.
  display: "minimal-ui",
  icons: [
    {
      src: "/favicon.ico",
      sizes: "32x32",
      type: "image/ico"
    },
    {
      src: "/apple-touch-icon.png",
      sizes: "57x57",
      type: "image/png"
    },
    {
      src: "/apple-touch-icon-precomposed.png",
      sizes: "180x180",
      type: "image/png",
    },
    {
      src: "/favicon-512-512.png",
      sizes: "512x512",
      type: "image/png",
    },
  ]
}