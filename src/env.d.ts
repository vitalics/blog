/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_POSTHOG: string
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
