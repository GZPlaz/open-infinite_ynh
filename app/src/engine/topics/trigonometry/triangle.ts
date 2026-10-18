/** Triangle solving helpers (law of sines / cosines) and answer formatting. */
import { decimal, roundTo } from '../../tex';
import type { Tri } from './figures';

export type Part = 'A' | 'B' | 'C' | 'a' | 'b' | 'c';
export const ANGLES = ['A', 'B', 'C'] as const;
export const SIDES = ['a', 'b', 'c'] as const;
export type Givens = Partial<Record<Part, number>>;

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export const isAngle = (p: Part): boolean => p === 'A' || p === 'B' || p === 'C';
export const partTex = (p: Part): string => (isAngle(p) ? `m\\angle ${p}` : p);

/** `m\angle B \approx 48.6^\circ`, `b = 12`, with an optional subscript (two-triangle answers). */
export function measureTex(p: Part, v: number, sub = '', unit?: string): string {
  const r = roundTo(v, 1);
  const rel = Math.abs(r - v) > 1e-9 ? '\\approx' : '=';
  const name = isAngle(p) ? `m\\angle ${p}${sub ? `_{${sub}}` : ''}` : `${p}${sub ? `_{${sub}}` : ''}`;
  return `${name} ${rel} ${decimal(v)}${isAngle(p) ? '^\\circ' : unit ? `\\text{ ${unit}}` : ''}`;
}

/** Given-value TeX (exact, as printed in the question). */
export function givenTex(p: Part, v: number, unit?: string): string {
  return `${partTex(p)} = ${v}${isAngle(p) ? '^\\circ' : unit ? `\\text{ ${unit}}` : ''}`;
}

export function fromSSS(a: number, b: number, c: number): Tri {
  const A = deg(Math.acos((b * b + c * c - a * a) / (2 * b * c)));
  const B = deg(Math.acos((a * a + c * c - b * b) / (2 * a * c)));
  return { a, b, c, A, B, C: 180 - A - B };
}

/** All triangles consistent with three givens (0, 1 or 2 for SSA). */
export function solveTriangle(g: Givens): Tri[] {
  const angles = ANGLES.filter((p) => g[p] !== undefined);
  const sides = SIDES.filter((p) => g[p] !== undefined);
  const opp = (p: Part): Part => (p === 'A' ? 'a' : p === 'B' ? 'b' : p === 'C' ? 'c' : (p.toUpperCase() as Part));
  if (sides.length === 3) return [fromSSS(g.a!, g.b!, g.c!)];
  if (angles.length >= 2) {
    const all: Record<string, number> = {};
    const sum = angles.reduce((s, p) => s + g[p]!, 0);
    for (const p of ANGLES) all[p] = g[p] ?? 180 - sum;
    if (all.A! <= 0 || all.B! <= 0 || all.C! <= 0) return [];
    const s = sides[0]!;
    const k = g[s]! / Math.sin(rad(all[opp(s)]!));
    return [{ A: all.A!, B: all.B!, C: all.C!, a: k * Math.sin(rad(all.A!)), b: k * Math.sin(rad(all.B!)), c: k * Math.sin(rad(all.C!)) }];
  }
  // one angle, two sides
  const ang = angles[0]!;
  const os = opp(ang);
  if (g[os] === undefined) {
    // SAS: law of cosines for the third side
    const [s1, s2] = sides as Part[];
    const third = Math.sqrt(g[s1!]! ** 2 + g[s2!]! ** 2 - 2 * g[s1!]! * g[s2!]! * Math.cos(rad(g[ang]!)));
    const v: Record<string, number> = { [s1!]: g[s1!]!, [s2!]: g[s2!]!, [os]: third };
    return [fromSSS(v.a!, v.b!, v.c!)];
  }
  // SSA
  const other = sides.find((s) => s !== os)!;
  const sinO = (g[other]! * Math.sin(rad(g[ang]!))) / g[os]!;
  if (sinO > 1 + 1e-12) return [];
  const cands = [deg(Math.asin(Math.min(1, sinO)))];
  if (sinO < 1 - 1e-12) cands.push(180 - cands[0]!);
  const out: Tri[] = [];
  for (const o of cands) {
    const third = 180 - g[ang]! - o;
    if (third <= 1e-9) continue;
    const all: Record<string, number> = { [ang]: g[ang]!, [opp(other)]: o };
    const missing = ANGLES.find((p) => all[p] === undefined)!;
    all[missing] = third;
    const k = g[os]! / Math.sin(rad(g[ang]!));
    out.push({ A: all.A!, B: all.B!, C: all.C!, a: k * Math.sin(rad(all.A!)), b: k * Math.sin(rad(all.B!)), c: k * Math.sin(rad(all.C!)) });
  }
  return out;
}

export const partValue = (t: Tri, p: Part): number => t[p];

/** Comma-separated answer listing the requested parts. */
export function listTex(t: Tri, parts: readonly Part[], sub = '', unit?: string): string[] {
  return parts.map((p) => measureTex(p, t[p], sub, unit));
}
