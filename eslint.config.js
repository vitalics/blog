import globals from 'globals'
import pluginJs from '@eslint/js'
import tseslint from 'typescript-eslint'
import * as mdx from 'eslint-plugin-mdx'
import eslintPluginAstro from 'eslint-plugin-astro'

/** @type {import('eslint').Linter.Config[]} */
export default [
  { files: ['**/*.{js,mjs,cjs,ts}'] },
  {
    ...mdx.flat,
    // optional, if you want to lint code blocks at the same
    processor: mdx.createRemarkProcessor({
      lintCodeBlocks: true,
      // optional, if you want to disable language mapper, set it to `false`
      // if you want to override the default language mapper inside, you can provide your own
      languageMapper: {},
    }),
  },
  {
    ...mdx.flatCodeBlocks,
    rules: {
      ...mdx.flatCodeBlocks.rules,
      // if you want to override some rules for code blocks
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
  { languageOptions: { globals: globals.browser } },
  pluginJs.configs.recommended,
  ...eslintPluginAstro.configs['flat/recommended'],
  ...tseslint.configs.recommended,
]
