/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** AG Grid + AG Charts Enterprise license key (one key covers both). Build-time only. */
  readonly VITE_AG_GRID_LICENSE_KEY: string
  /** Backend API base URL; empty string = same-origin (prod served by FastAPI). */
  readonly VITE_API_BASE_URL?: string
  /**
   * When "true", hide the "Open in RecViz" link in the embed topbar (so
   * embedded users can't jump out to the standalone app). Build-time only;
   * default (unset) shows the link. See src/lib/embed-config.ts.
   */
  readonly VITE_EMBED_HIDE_OPEN_IN_LINK?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
