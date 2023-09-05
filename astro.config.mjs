import { readFileSync } from "node:fs";
import { defineConfig, sharpImageService } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

import tailwind from "@astrojs/tailwind";
import astroExpressiveCode from 'astro-expressive-code';
import remarkToc from 'remark-toc';

import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeToc from 'rehype-toc';

/** @type {import('astro-expressive-code').AstroExpressiveCodeOptions} */
const astroExpressiveCodeOptions = {
  styleOverrides: {
    codeFontSize: '1rem',
  },

};

// https://astro.build/config
export default defineConfig({
  site: 'https://example.com',
  integrations: [astroExpressiveCode(astroExpressiveCodeOptions), mdx(), sitemap(), tailwind()],
  image: {
    service: sharpImageService()
  },
  markdown: {
    syntaxHighlight: 'prism',
    remarkPlugins: [
      remarkToc,
    ],
    rehypePlugins: [
      rehypeSlug,
      [rehypeAutolinkHeadings, { behavior: 'append' }],
      [rehypeToc, { headings: ['h1', 'h2'] }],
    ],
  },
  compressHTML: true,
  build: {
    inlineStylesheets: "auto"
  },
  vite: {
    plugins: [rawFonts([".ttf", ".woff"])],
    optimizeDeps: {
      exclude: ["@resvg/resvg-js"]
    }
  }
});

// vite plugin to import fonts
function rawFonts(ext) {
  return {
    name: "vite-plugin-raw-fonts",
    transform(_, id) {
      if (ext.some(e => id.endsWith(e))) {
        const buffer = readFileSync(id);
        return {
          code: `export default ${JSON.stringify(buffer)}`,
          map: null
        };
      }
    }
  };
}