/** Shared helpers for the Algebra 2 "Polynomial Functions" topics. */
import { Frac, gcdAll, type FracLike } from '../../../fraction';
import { Poly } from '../../../polynomial';
import { simplifySqrt } from '../../../radical';
import type { Rng } from '../../../rng';
import { pow, term } from '../../../tex';
import type { Difficulty } from '../../../types';
import { formatRoots } from '../quadratic-formula';

export const CATEGORY = 'Polynomial Functions';

/** c·x^k */
export function mono(c: FracLike, k: number): Poly {
  return new Poly([...Array.from({ length: k }, () => 0), c]);
}

/** Random integer polynomial of exact degree with `nTerms` non-zero terms. */
export function randPoly(rng: Rng, degree: number, max: number, nTerms: number, opts: { constant?: boolean; negatives?: boolean } = {}): Poly {
  const neg = opts.negatives ?? true;
  const c: number[] = Array.from({ length: degree + 1 }, () => 0);
  c[degree] = rng.signedInt(1, max, neg);
  const pool = Array.from({ length: degree }, (_, i) => i);
  const others = rng.sample(pool, Math.min(nTerms - 1, pool.length));
  if (opts.constant && degree > 0 && !others.includes(0)) {
    if (others.length && others.length >= nTerms - 1) others[others.length - 1] = 0;
    else others.push(0);
  }
  others.forEach((i) => (c[i] = rng.signedInt(1, max, neg)));
  return new Poly(c);
}

/** Polynomial long division: n = d·q + r with deg r < deg d. */
export function divMod(n: Poly, d: Poly): { q: Poly; r: Poly } {
  let r = n;
  const q: Frac[] = Array.from({ length: Math.max(0, n.degree - d.degree + 1) }, () => Frac.ZERO);
  while (!r.isZero() && r.degree >= d.degree) {
    const k = r.degree - d.degree;
    const c = r.lead().div(d.lead());
    q[k] = c;
    r = r.sub(d.mul(mono(c, k)));
  }
  return { q: new Poly(q), r };
}

/** Rows of synthetic division of `p` by (x − r). */
export function synthetic(p: Poly, r: FracLike): { coeffs: Frac[]; mults: Frac[]; out: Frac[] } {
  const coeffs: Frac[] = [];
  for (let i = p.degree; i >= 0; i--) coeffs.push(p.coef(i));
  const out: Frac[] = [];
  const mults: Frac[] = [];
  coeffs.forEach((c, i) => {
    if (i === 0) out.push(c);
    else {
      const mlt = out[i - 1]!.mul(r);
      mults.push(mlt);
      out.push(c.add(mlt));
    }
  });
  return { coeffs, mults, out };
}

/** Synthetic-division tableau as a KaTeX array. */
export function syntheticTex(p: Poly, r: FracLike): string {
  const { coeffs, mults, out } = synthetic(p, r);
  const cols = 'r'.repeat(coeffs.length);
  const row1 = [Frac.of(r).toTex(), ...coeffs.map((c) => c.toTex())].join(' & ');
  const row2 = ['', '', ...mults.map((c) => c.toTex())].join(' & ');
  const row3 = ['', ...out.map((c) => c.toTex())].join(' & ');
  return `\\begin{array}{r|${cols}} ${row1} \\\\ ${row2} \\\\ \\hline ${row3} \\end{array}`;
}

/** `c·sym(inner)` as the first term or a signed later term: `3x^{2}(x + 1)`, ` - (x + 1)`. */
export function timesTex(c: FracLike, sym: string, inner: string, first: boolean): string {
  const f = Frac.of(c);
  const mag = f.abs();
  const body = `${mag.eq(1) ? '' : mag.toTex()}${sym}(${inner})`;
  if (first) return `${f.sign < 0 ? '-' : ''}${body}`;
  return `${f.sign < 0 ? ' - ' : ' + '}${body}`;
}

/** Integer content (gcd of the coefficients) of an integer polynomial. */
export function contentOf(p: Poly): number {
  return gcdAll(p.c.map((x) => x.n)) || 1;
}

/** Primitive integer polynomial with a positive leading coefficient. */
export function primitive(p: Poly): Poly {
  const g = contentOf(p) * (p.lead().sign < 0 ? -1 : 1);
  return p.scale(new Frac(1, g));
}

// ---------------------------------------------------------------- factored forms

export interface Factor {
  p: Poly;
  e: number;
}

/** k · x^mono · ∏ p^e */
export interface Factored {
  k: number;
  mono: number;
  factors: Factor[];
}

const X = Poly.of(0, 1);

function merged(f: Factored): Factored {
  let monoDeg = f.mono;
  const out: Factor[] = [];
  for (const x of f.factors) {
    if (x.p.eq(X)) {
      monoDeg += x.e;
      continue;
    }
    const m = out.find((o) => o.p.eq(x.p));
    if (m) m.e += x.e;
    else out.push({ p: x.p, e: x.e });
  }
  return { k: f.k, mono: monoDeg, factors: out };
}

export function expandFactored(f: Factored): Poly {
  let r = mono(f.k, f.mono);
  for (const { p, e } of f.factors) r = r.mul(p.powInt(e));
  return r;
}

export function factorPartTex(p: Poly, e: number, v: string): string {
  return e === 1 ? `(${p.toTex(v)})` : `(${p.toTex(v)})^{${e}}`;
}

export function factoredTex(f: Factored, v: string): string {
  const g = merged(f);
  if (g.factors.length === 0) return term(g.k, pow(v, g.mono));
  const k = Frac.of(g.k);
  const prefix = g.mono === 0 ? (k.eq(1) ? '' : k.eq(-1) ? '-' : k.toTex()) : term(k, pow(v, g.mono));
  return prefix + g.factors.map((x) => factorPartTex(x.p, x.e, v)).join('');
}

/** Order-independent identity of a factored form. */
export function factoredKey(f: Factored): string {
  const g = merged(f);
  const parts = g.factors.map((x) => `${x.p.c.map(String).join(',')}^${x.e}`).sort();
  return `${g.k}|${g.mono}|${parts.join(';')}`;
}

/** Linear factor with root n/d: d·x − n. */
export function rootFactor(r: FracLike): Poly {
  const f = Frac.of(r);
  return Poly.linear(f.d, -f.n);
}

// ---------------------------------------------------------------- conjugate pairs

export interface Cx {
  re: number;
  im: number;
}

export type PairKind = 'irrational' | 'complex';

export interface Pair {
  kind: PairKind;
  /** Monic quadratic with these two zeros. */
  quad: Poly;
  tex: [string, string];
  values: [Cx, Cx];
}

/** A conjugate pair a ± b√c or a ± b·i√c with integer a. */
export function makePair(rng: Rng, kind: PairKind, d: Difficulty): Pair {
  const amax = d === 'easy' ? 2 : 4;
  const a = rng.int(-amax, amax);
  if (kind === 'complex') {
    const b = rng.int(1, d === 'easy' ? 2 : 3);
    const c = d === 'hard' && rng.bool(0.35) ? rng.pick([2, 3, 5]) : 1;
    const quad = Poly.of(a * a + b * b * c, -2 * a, 1);
    const im = b * Math.sqrt(c);
    const t = formatRoots(2 * a, -4 * b * b * c, 2) as [string, string];
    return { kind, quad, tex: t, values: [{ re: a, im }, { re: a, im: -im }] };
  }
  const c = rng.pick([2, 3, 5, 6, 7]);
  const b = d === 'hard' ? rng.int(1, 2) : 1;
  const quad = Poly.of(a * a - b * b * c, -2 * a, 1);
  const s = b * Math.sqrt(c);
  const t = formatRoots(2 * a, 4 * b * b * c, 2) as [string, string];
  return { kind, quad, tex: t, values: [{ re: a + s, im: 0 }, { re: a - s, im: 0 }] };
}

/** Zeros of an integer quadratic a x² + b x + c as LaTeX (rational ones reduced). */
export function quadZerosTex(q: Poly): string[] {
  const a = q.coef(2).n;
  const b = q.coef(1).n;
  const c = q.coef(0).n;
  return formatRoots(-b, b * b - 4 * a * c, 2 * a);
}

/** Numeric zeros of an integer quadratic. */
export function quadZerosNum(q: Poly): Cx[] {
  const a = q.coef(2).value;
  const b = q.coef(1).value;
  const c = q.coef(0).value;
  const D = b * b - 4 * a * c;
  if (D >= 0) return [{ re: (-b + Math.sqrt(D)) / (2 * a), im: 0 }, { re: (-b - Math.sqrt(D)) / (2 * a), im: 0 }];
  const s = Math.sqrt(-D) / (2 * a);
  return [{ re: -b / (2 * a), im: s }, { re: -b / (2 * a), im: -s }];
}

export function isSquare(n: number): boolean {
  return n >= 0 && simplifySqrt(n).inside === 1;
}

export function isCube(n: number): boolean {
  const r = Math.round(Math.cbrt(Math.abs(n)));
  return r * r * r === Math.abs(n);
}

export function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th';
  return `${n}${s}`;
}

/** "a", "a or b", "a, b, or c" */
export function orList(items: readonly (string | number)[]): string {
  if (items.length <= 1) return String(items[0] ?? '');
  if (items.length === 2) return `${items[0]} or ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, or ${items[items.length - 1]}`;
}

/** Rearrange p = 0 into "left = right" by moving a few terms to the right side. */
export function rearrange(rng: Rng, p: Poly, v: string): string | null {
  const idx = p.c.map((c, i) => (c.isZero() ? -1 : i)).filter((i) => i >= 0 && i !== p.degree);
  if (idx.length === 0) return null;
  const move = rng.sample(idx, rng.int(1, idx.length));
  const right = new Poly(p.c.map((c, i) => (move.includes(i) ? c.neg() : Frac.ZERO)));
  const left = new Poly(p.c.map((c, i) => (move.includes(i) ? Frac.ZERO : c)));
  return `${left.toTex(v)} = ${right.toTex(v)}`;
}
