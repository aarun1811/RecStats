/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** AG Grid + AG Charts Enterprise license key (one key covers both). Build-time only. */
  readonly VITE_AG_GRID_LICENSE_KEY: string
  /** Backend API base URL; empty string = same-origin (prod served by FastAPI). */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
