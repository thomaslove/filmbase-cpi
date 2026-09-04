// Shared rate-card data layer: the types, the fetch, and the few helpers used by
// both the calculator and the tables below it.

export interface Band {
  name: string;
  code: string;
  alias?: boolean;
}

// An allowance is either one card cell ("£15+", "Negotiable") or, as with the
// painters' box rental, a minimum/standard pair like the rates themselves.
export interface Allowance {
  text?: string;
  min?: number;
  rec?: number;
}

export interface Rate {
  band: string;
  min: number | null;
  rec: number | null;
  align?: string;
  note?: string;
  allowances?: Record<string, Allowance>;
}

export interface Role {
  titles: string[];
  code: string;
  subcategory?: string;
  labels?: { min?: string; rec?: string };
  allowancePeriods?: Record<string, string>;
  rates: Rate[];
}

export type Footnote = string | { marker?: string; text: string };

export interface RateData {
  published: string;
  source: string | { url: string; subcategory: string }[];
  department: string;
  // The branch that publishes the card, which is not always the department it
  // covers: the Art Department Branch issues the Set Dec card too.
  issuedBy?: string;
  // The card's own notes, in order. A plain string is a standalone line; give
  // it a marker to tie it to the figures it explains.
  footnotes?: Footnote[];
  // How the card prints a row that has a minimum and no second figure: the Art
  // and Set Dec cards pair it with "Negotiable", the Props cards print the one
  // figure on its own.
  secondFigureNegotiable?: boolean;
  bands: Band[];
  subcategories?: { code: string; name: string; footnotes?: Footnote[] }[];
  allowanceTypes?: { code: string; name: string; period: string }[];
  roles: Role[];
  labels?: { min?: string; rec?: string };
}

// The calculator and every table on the page ask for the same department file,
// so the request is shared rather than repeated per component.
const cache = new Map<string, Promise<RateData>>();

export function fetchRates(endpoint: string): Promise<RateData> {
  let pending = cache.get(endpoint);
  if (!pending) {
    pending = fetch(endpoint).then((res) => {
      if (!res.ok) throw new Error(`Failed to load rate data (${res.status})`);
      return res.json() as Promise<RateData>;
    });
    // A failed fetch must not be cached, or a retry can never succeed
    pending.catch(() => cache.delete(endpoint));
    cache.set(endpoint, pending);
  }
  return pending;
}

// Nearest, not up: on a handful of buyer rows the card's own weekly figure is
// not five times its printed daily (2,352 and 470, say -- the uplift was applied
// to each column separately), and rounding up put the daily a pound above the
// card. Nearest reproduces every printed daily exactly.
export function dailyRate(weekly: number): number {
  return Math.round(weekly / 5);
}

export function issuingBranch(data: RateData): string {
  return `BECTU ${data.issuedBy ?? `${data.department} Department Branch`}`;
}

export function currency(num: number): string {
  return (
    "£" +
    num.toLocaleString("en-GB", {
      minimumFractionDigits: Number.isInteger(num) ? 0 : 2,
    })
  );
}

// Some rows carry no figures of their own and point at another band instead.
// Follows the chain, guarding against missing targets and align cycles.
export function resolveRate(role: Role, bandCode: string): Rate | null {
  let rate: Rate | null = role.rates.find((r) => r.band === bandCode) ?? null;

  const visited = new Set<string>();
  while (rate?.align && !visited.has(rate.band)) {
    visited.add(rate.band);
    const target = role.rates.find((r) => r.band === rate!.align) ?? null;
    if (!target) break;
    rate = target;
  }

  return rate;
}
