/** Shared helpers for the quadratic-function topics. */
import { Frac, gcdAll, lcm } from '../../../fraction';
import { attempt } from '../../../generator';
import { Poly } from '../../../polynomial';
import type { Rng } from '../../../rng';
import { num } from '../../../tex';
import { formatRoots } from '../quadratic-formula';

export const CATEGORY_QUAD = 'Quadratic Functions and Inequalities';

/** Integer coefficients [a, b, c] proportional to a rational quadratic (sign of a kept). */
export function intTriple(p: Poly): [number, number, number] {
  const cs = [p.coef(2), p.coef(1), p.coef(0)];
  const L = cs.reduce((acc, c) => lcm(acc, c.d), 1);
  const ints = cs.map((c) => c.mul(L).value);
  const g = gcdAll(ints) || 1;
  return ints.map((x) => x / g + 0) as [number, number, number];
}

/** Exact roots of a·x² + b·x + c (integers) as LaTeX, simplest form. */
export function rootsTex(a: number, b: number, c: number): string[] {
  return formatRoots(-b, b * b - 4 * a * c, 2 * a);
}

export interface Cx {
  re: number;
  im: number;
}

/** Numeric roots (complex allowed), one entry for a double root. */
export function rootValues(a: number, b: number, c: number): Cx[] {
  const D = b * b - 4 * a * c;
  if (D === 0) return [{ re: -b / (2 * a), im: 0 }];
  if (D > 0) return [{ re: (-b + Math.sqrt(D)) / (2 * a), im: 0 }, { re: (-b - Math.sqrt(D)) / (2 * a), im: 0 }];
  const s = Math.sqrt(-D) / (2 * Math.abs(a));
  return [{ re: -b / (2 * a), im: s }, { re: -b / (2 * a), im: -s }];
}

/**
 * The equation std = 0 rewritten with terms on both sides, e.g. `3x² + 5 = -7x`.
 * The left side minus the right side is exactly ±std.
 */
export function rearranged(rng: Rng, std: Poly, v: string): string {
  return attempt('quadratic-rearrange', () => {
    const shift = Poly.of(rng.bool(0.6) ? rng.int(-9, 9) : 0, rng.int(-6, 6), rng.bool(0.3) ? rng.int(-3, 3) : 0);
    const left = std.add(shift);
    const right = shift;
    const leftTerms = left.c.filter((x) => !x.isZero()).length;
    const rightTerms = right.c.filter((x) => !x.isZero()).length;
    if (rightTerms === 0 || leftTerms === 0 || leftTerms + rightTerms < 3) return null;
    if (left.c.some((x) => Math.abs(x.value) > 60)) return null;
    return rng.bool() ? `${left.toTex(v)} = ${right.toTex(v)}` : `${right.toTex(v)} = ${left.toTex(v)}`;
  });
}

/** `(x - 3)`, `\left(x + \frac{1}{2}\right)` — the binomial v − h, bracketed. */
export function shiftTex(v: string, h: Frac): string {
  const inner = h.isZero() ? v : `${v} ${h.sign > 0 ? '-' : '+'} ${num(h.abs())}`;
  return h.isInt() ? `(${inner})` : `\\left(${inner}\\right)`;
}

/** `a(v - h)^{2} + k` with tidy coefficients. */
export function vertexFormTex(a: Frac, h: Frac, k: Frac, v = 'x'): string {
  const sq = h.isZero() ? `${v}^{2}` : `${shiftTex(v, h)}^{2}`;
  const lead = a.eq(1) ? '' : a.eq(-1) ? '-' : a.toTex();
  const tail = k.isZero() ? '' : ` ${k.sign > 0 ? '+' : '-'} ${num(k.abs())}`;
  return `${lead}${sq}${tail}`;
}

/** Square `(v + p)^{2}` for a Frac shift p (v + p). */
export function squareTex(v: string, p: Frac): string {
  return `${shiftTex(v, p.neg())}^{2}`;
}

/** Simplified-radical value of ±√K for a rational K as a LaTeX magnitude (`\frac{\sqrt{5}}{2}`, `3i`). */
export function sqrtFracTex(K: Frac): string {
  // √(p/q) = √(pq)/q
  const [r] = formatRoots(0, K.n * K.d, K.d);
  return r!;
}

export { Frac };
