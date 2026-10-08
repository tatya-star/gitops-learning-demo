/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_COMMIT_SHA?: string
  readonly VITE_IMAGE_NAME?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}