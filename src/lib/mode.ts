// Which calculator the widget opens on.
//
// The host page's embed snippet is fixed markup pasted into a WildApricot
// content gadget, so the only per-link thing a page can vary is its own query
// string: linking straight to the inflation calculator means
// .../rates-page?mode=inflation. data-mode on the mount element sets the
// default for a page that always wants one of the two.

export const MODES = ['rates', 'inflation'] as const

export type Mode = (typeof MODES)[number]

export const DEFAULT_MODE: Mode = 'rates'

// "rate", "inflation-calculator" and the like all land where they clearly mean
// to: these come from hand-written links, not from code
function normalise(value: string | null | undefined): Mode | null {
  if (!value) return null
  const v = value.trim().toLowerCase()
  return MODES.find((mode) => v === mode || v.startsWith(mode)) ?? null
}

export function resolveMode(search: string, attr?: string): Mode {
  const params = new URLSearchParams(search)
  return normalise(params.get('mode')) ?? normalise(attr) ?? DEFAULT_MODE
}
