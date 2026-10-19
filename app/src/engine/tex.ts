/**
 * LaTeX formatting helpers shared by all generators.
 *
 * They exist so that no generator ever prints "+ -3", "1x", "x^1" or "0x":
 * every sum goes through `sum()`, which handles signs and unit coefficients.
 */
import { Frac, type FracLike } from './fraction';

/** One term of a sum: coefficient × symbolic part (`''` for a constant). */
export interface Term {
  coef: FracLike;
  sym?: string;
}

function magnitudeTex(c: Frac, sym: string): string {
  const a = c.abs();
  if (!sym) return a.toTex();
  if (a.eq(1)) return sym;
  return `${a.toTex()}${sym}`;
}

/** `3x^{2} - x + \frac{1}{2}`. Zero terms are dropped; an empty sum is `0`. */
export function sum(terms: readonly Term[]): string {
  let out = '';
  for (const t of terms) {
    const c = Frac.of(t.coef);
    if (c.isZero()) continue;
    const mag = magnitudeTex(c, t.sym ?? '');
    if (!out) out = c.sign < 0 ? `-${mag}` : mag;
    else out += c.sign < 0 ? ` - ${mag}` : ` + ${mag}`;
  }
  return out || '0';
}

/** Single term with coefficient: `-x`, `4y`, `\frac{1}{2}x`. */
export function term(coef: FracLike, sym = ''): string {
  return sum([{ coef, sym }]);
}

/** `v`, `v^{k}`, or `''` for k = 0. */
export function pow(v: string, k: FracLike): string {
  const e = Frac.of(k);
  if (e.isZero()) return '';
  if (e.eq(1)) return v;
  return `${v}^{${e.toTex()}}`;
}

/** `a·v + b` in tidy form. */
export function linear(a: FracLike, b: FracLike, v = 'x'): string {
  return sum([{ coef: a, sym: v }, { coef: b }]);
}

/** Number as LaTeX. */
export function num(x: FracLike): string {
  return Frac.of(x).toTex();
}

/** Always parenthesised, for substitution: `(2)`, `(-3)`, `\left(\frac{1}{2}\right)`. */
export function paren(x: FracLike): string {
  const f = Frac.of(x);
  return f.isInt() ? `(${f.toTex()})` : `\\left(${f.toTex()}\\right)`;
}

/** Parenthesised only when negative or fractional: `5`, `(-3)`. */
export function parenNeg(x: FracLike): string {
  const f = Frac.of(x);
  return f.sign < 0 || !f.isInt() ? paren(f) : f.toTex();
}

/** Coefficient applied to a bracketed expression: `3(x + 2)`, `-(x + 2)`, `(x + 2)`. */
export function scaled(mult: FracLike, inner: string): string {
  const m = Frac.of(mult);
  if (m.eq(1)) return `(${inner})`;
  if (m.eq(-1)) return `-(${inner})`;
  return `${m.toTex()}(${inner})`;
}

/** Round half away from zero. */
export function roundTo(v: number, places: number): number {
  const f = 10 ** places;
  const r = (Math.sign(v) * Math.round(Math.abs(v) * f + 1e-9)) / f;
  return r === 0 ? 0 : r;
}

/** Rounded decimal without trailing zeros: `13.4`, `9`, `-0.25`. */
export function decimal(v: number, places = 1): string {
  return String(roundTo(v, places));
}

/** Upright text inside math. */
export function text(s: string): string {
  return `\\text{${s}}`;
}

/** Number followed by a unit: `12\text{ cm}`, `48\text{ cm}^{2}`. */
export function withUnit(value: string, unit: string | undefined, power = 1): string {
  if (!unit) return value;
  return power === 1 ? `${value}\\text{ ${unit}}` : `${value}\\text{ ${unit}}^{${power}}`;
}

/** Inline math segment for rich text. */
export function m(tex: string): string {
  return `$${tex}$`;
}

/** Fraction from two LaTeX strings. */
export function fracTex(numer: string, denom: string): string {
  return `\\frac{${numer}}{${denom}}`;
}

/** Comma-separated set: `\left\{ 2, -3 \right\}`. */
export function setTex(items: readonly string[]): string {
  return `\\left\\{ ${items.join(', ')} \\right\\}`;
}

/** Ordered pair / tuple. */
export function tuple(items: readonly FracLike[] | readonly string[]): string {
  const parts = items.map((x) => (typeof x === 'string' ? x : num(x)));
  return `\\left(${parts.join(', ')}\\right)`;
}
