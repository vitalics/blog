import { readFileSync } from "node:fs";
import { defineConfig, sharpImageService } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import partytown from "@astrojs/partytown";
import vercel from "@astrojs/vercel/static";
import { VitePWA } from "vite-plugin-pwa";

import tailwind from "@astrojs/tailwind";
import astroExpressiveCode from "astro-expressive-code";
import remarkToc from "remark-toc";

import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeToc from "rehype-toc";

import { manifest } from "./src/data/manifest";

/** @type {import('astro-expressive-code').AstroExpressiveCodeOptions} */
const astroExpressiveCodeOptions = {
  styleOverrides: {
    codeFontSize: "1rem",
  },
  shiki: true,
};

// https://astro.build/config
export default defineConfig({
  site: "https://blog-vitaliharadkou.vercel.app/",
  integrations: [
    astroExpressiveCode(astroExpressiveCodeOptions),
    mdx(),
    sitemap(),
    tailwind(),
    partytown({
      // Adds dataLayer.push as a forwarding-event.
      config: {
        forward: ["dataLayer.push"],
      },
    }),
    vercel({
      analytics: true,
      imagesConfig: {
        sizes: [320, 640, 1280],
      },
      imageService: true,
    }),
  ],
  image: {
    service: sharpImageService(),
  },
  markdown: {
    syntaxHighlight: "prism",
    remarkPlugins: [remarkToc],
    rehypePlugins: [
      rehypeSlug,
      [rehypeAutolinkHeadings, { behavior: "append" }],
      [rehypeToc, { headings: ["h1", "h2"] }],
    ],
  },
  compressHTML: true,
  build: {
    inlineStylesheets: "auto",
  },
  vite: {
    plugins: [
      rawFonts([".ttf", ".woff"]),
      VitePWA({
        registerType: "autoUpdate",
        manifest,
        workbox: {
          globDirectory: "dist",
          globPatterns: [
            "**/*.{js,css,svg,png,jpg,jpeg,gif,webp,woff,woff2,ttf,eot,ico}",
          ],
          // Don't fallback on document based (e.g. `/some-page`) requests
          // This removes an errant console.log message from showing up.
          navigateFallback: null,
        },
      }),
    ],
    optimizeDeps: {
      exclude: ["@resvg/resvg-js"],
    },
  },
});

// vite plugin to import fonts
function rawFonts(ext) {
  return {
    name: "vite-plugin-raw-fonts",
    transform(_, id) {
      if (ext.some((e) => id.endsWith(e))) {
        const buffer = readFileSync(id);
        return {
          code: `export default ${JSON.stringify(buffer)}`,
          map: null,
        };
      }
    },
  };
}
