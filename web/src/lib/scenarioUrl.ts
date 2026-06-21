import type { KoResult } from '../components/Bracket';

/** A scenario map: match key -> result. (Group what-if keys by fixture id, knockout by `m{n}`.) */
export type ScenarioMap = Record<string, KoResult>;

interface Encoded {
  v: 1;
  /** Group what-if entries: key -> [h, a]. */
  g: Record<string, number[]>;
  /** Knockout entries: key -> [h, a] or [h, a, et(0|1), penH(-1=none), penA(-1=none)]. */
  k: Record<string, number[]>;
}

const toB64Url = (s: string) =>
  btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64Url = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));

function packResult(r: KoResult): number[] {
  const arr = [r.h as number, r.a as number];
  if (r.et || r.penH != null || r.penA != null) arr.push(r.et ? 1 : 0, r.penH ?? -1, r.penA ?? -1);
  return arr;
}

function unpackResult(arr: number[]): KoResult {
  const r: KoResult = { h: arr[0], a: arr[1] };
  if (arr.length > 2) {
    r.et = arr[2] === 1;
    if ((arr[3] ?? -1) >= 0) r.penH = arr[3];
    if ((arr[4] ?? -1) >= 0) r.penA = arr[4];
  }
  return r;
}

function packMap(m: ScenarioMap): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const [k, v] of Object.entries(m)) {
    if (typeof v.h === 'number' && typeof v.a === 'number') out[k] = packResult(v);
  }
  return out;
}

function unpackMap(m: Record<string, number[]> | undefined): ScenarioMap {
  const out: ScenarioMap = {};
  for (const [k, arr] of Object.entries(m ?? {})) if (Array.isArray(arr) && arr.length >= 2) out[k] = unpackResult(arr);
  return out;
}

/** Encode a group + knockout scenario into a compact URL-safe token (empty string if nothing set). */
export function encodeScenario(group: ScenarioMap, ko: ScenarioMap): string {
  const g = packMap(group);
  const k = packMap(ko);
  if (Object.keys(g).length === 0 && Object.keys(k).length === 0) return '';
  return toB64Url(JSON.stringify({ v: 1, g, k } satisfies Encoded));
}

/** Decode a token back into group + knockout scenario maps, or null if malformed. */
export function decodeScenario(token: string): { group: ScenarioMap; ko: ScenarioMap } | null {
  try {
    const obj = JSON.parse(fromB64Url(token)) as Partial<Encoded>;
    if (!obj || obj.v !== 1) return null;
    return { group: unpackMap(obj.g), ko: unpackMap(obj.k) };
  } catch {
    return null;
  }
}

/** Read a scenario from the current URL hash (`#s=…`), if present. */
export function readScenarioFromHash(): { group: ScenarioMap; ko: ScenarioMap } | null {
  if (typeof window === 'undefined') return null;
  const m = window.location.hash.match(/[#&]s=([^&]+)/);
  return m ? decodeScenario(m[1]!) : null;
}

/** Full shareable URL for the given scenario (no hash when empty). */
export function scenarioShareUrl(group: ScenarioMap, ko: ScenarioMap): string {
  const enc = encodeScenario(group, ko);
  const { origin, pathname, search } = window.location;
  return `${origin}${pathname}${search}${enc ? `#s=${enc}` : ''}`;
}
