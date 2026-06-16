/**
 * Build-time embed chrome flags (Vite env). These are baked into the bundle at
 * build time, so toggling one means rebuilding the frontend.
 */

/**
 * Whether to hide the "Open in RecViz" link in the embed topbar.
 *
 * Driven by the build-time env var `VITE_EMBED_HIDE_OPEN_IN_LINK`. Vite exposes
 * env vars as strings (or `undefined` when unset), so we accept the raw value
 * and treat only the literal `"true"` (case-insensitive) as "hide". The DEFAULT
 * is to SHOW the link — only an explicit `=true` hides it — which keeps the
 * dev / e2e flow unaffected while a host (e.g. Citi prod) opts in via
 * `.env.local`.
 */
export function parseHideOpenInLinkFlag(raw: unknown): boolean {
  return typeof raw === 'string' && raw.toLowerCase() === 'true'
}
