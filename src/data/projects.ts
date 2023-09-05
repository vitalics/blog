export type Project = {
  name: string;
  url: string;
  description: string;
  languages: string[];
  role: 'author' | 'contributor'
};
export default [
  {
    "name": "rslike",
    "url": "https://github.com/vitalics/rslike",
    "description": '🦀 Rust-like standard javascript typesafe library to remove undefined behavior.' + 'Includes several packages like "std", "cmp", "dbg"',
    "languages": [
      "TypeScript"
    ],
    "role": "author"
  },
  {
    "name": "Telegraph",
    "url": "https://github.com/vitalics/Telegraph",
    "description": "⚛️ use JSX for building telegram bots",
    "languages": [
      "TypeScript",
      "⚛️ React"
    ],
    "role": "author"
  },
  {
    "name": "playwright-angular-selectors",
    "url": "https://github.com/vitalics/playwright-angular-selectors",
    "description": "🛡️ Angular selectors engine for playwright",
    "languages": [
      "TypeScript",
      "🎭 Playwright",
      "🛡️ Angular"
    ],
    "role": "author"
  },
  {
    "name": "playwright",
    "url": "https://github.com/microsoft/playwright",
    "description": "Playwright is a framework for Web Testing and Automation. It allows testing Chromium, Firefox and WebKit with a single API.",
    "languages": [
      "TypeScript",
    ],
    "role": "contributor"
  },
  {
    "name": "DevExpress/testcafe",
    "url": "https://github.com/DevExpress/testcafe",
    "description": "A Node.js tool to automate end-to-end web testing.",
    "languages": [
      "TypeScript",
    ],
    "role": "contributor"
  },
] satisfies Project[];
