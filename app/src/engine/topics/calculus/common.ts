/**
 * Shared helpers for the calculus generators: a tiny closed algebra of terms
 * c·xᵖ·(atoms) that can be differentiated and rendered tidily, plus small
 * formatting utilities.
 */
import { Frac, gcdAll, type FracLike } from '../../fraction';
import { distinctDistractors, offset } from '../../generator';
import { Poly } from '../../polynomial';
import { simplifySqrt } from '../../radical';
import type { Rng } from '../../rng';
import { num } from '../../tex';
import type { RichText } from '../../types';

export const DYDX = '\\frac{dy}{dx}';

/** `ax` with tidy unit coefficients. */
export function lin(a: number, v = 'x'): string {
  return a === 1 ? v : a === -1 ? `-${v}` : `${a}${v}`;
}

/** Coefficient in front of a non-constant factor: `''`, `-`, `3`, `\frac{1}{2}`. */
export const lead = (k: FracLike): string => {
  const f = Frac.of(k);
  return f.eq(1) ? '' : f.eq(-1) ? '-' : num(f);
};

/** Wrap a polynomial in brackets when it has more than one term. */
export function polyFactor(p: Poly, v = 'x'): string {
  const terms = p.c.filter((c) => !c.isZero()).length;
  return terms > 1 ? `(${p.toTex(v)})` : p.toTex(v);
}

export interface Signed {
  neg: boolean;
  body: string;
}

/** `a - b + c` from signed magnitudes. */
export function joinSigned(ts: readonly Signed[]): string {
  if (!ts.length) return '0';
  return ts.map((t, i) => (i === 0 ? `${t.neg ? '-' : ''}${t.body}` : `${t.neg ? ' - ' : ' + '}${t.body}`)).join('');
}

/** Integer content of a polynomial with integer coefficients (sign of the leading coefficient). */
export function content(p: Poly): number {
  const g = gcdAll(p.c.map((c) => c.n)) || 1;
  return p.lead().sign < 0 ? -g : g;
}

// ---------------------------------------------------------------- terms c·x^p·atoms

export type AtomFn = 'exp' | 'sin' | 'cos' | 'ln';
export interface Atom {
  fn: AtomFn;
  /** sin(ax), cos(ax), e^{ax}; ignored for ln x. */
  a: number;
}
export interface FTerm {
  c: Frac;
  p: Frac;
  atoms: Atom[];
}

const RANK: Record<AtomFn, number> = { exp: 0, sin: 1, cos: 1, ln: 2 };

export const ft = (c: FracLike, p: FracLike = 0, atoms: Atom[] = []): FTerm => ({
  c: Frac.of(c),
  p: Frac.of(p),
  atoms: [...atoms].sort((x, y) => RANK[x.fn] - RANK[y.fn]),
});
export const atom = (fn: AtomFn, a = 1): Atom => ({ fn, a });

export function atomTex(at: Atom, v = 'x'): string {
  switch (at.fn) {
    case 'exp':
      return `e^{${lin(at.a, v)}}`;
    case 'ln':
      return `\\ln ${v}`;
    default:
      return at.a === 1 ? `\\${at.fn} ${v}` : `\\${at.fn}(${lin(at.a, v)})`;
  }
}

function xPart(p: Frac, v: string): string {
  if (p.eq(1)) return v;
  if (p.isInt()) return `${v}^{${p.n}}`;
  if (p.eq(new Frac(1, 2))) return `\\sqrt{${v}}`;
  return `${v}^{${p.toTex()}}`;
}

/** Glue a coefficient to the factors that follow it (`\cdot` before a digit). */
function glue(coef: string, rest: string): string {
  if (!coef) return rest;
  if (!rest) return coef;
  return /^\d/.test(rest) ? `${coef} \\cdot ${rest}` : `${coef}${rest}`;
}

/** Magnitude of a term (its sign is handled by the caller). */
export function ftermMag(t: FTerm, v = 'x'): string {
  const c = t.c.abs();
  const top = (t.p.sign > 0 ? xPart(t.p, v) : '') + t.atoms.map((a) => atomTex(a, v)).join('');
  if (t.p.sign < 0) {
    const numer = c.n === 1 && top ? top : glue(String(c.n), top);
    return `\\frac{${numer}}{${c.d === 1 ? '' : c.d}${xPart(t.p.neg(), v)}}`;
  }
  if (!top) return c.toTex();
  return glue(c.eq(1) ? '' : c.toTex(), top);
}

const key = (t: FTerm) => `${t.p.toString()}|${t.atoms.map((a) => `${a.fn}${a.a}`).join(',')}`;

/** Combine like terms (first occurrence order) and drop zeros. */
export function fnorm(ts: readonly FTerm[]): FTerm[] {
  const out: FTerm[] = [];
  for (const t of ts) {
    const k = key(t);
    const i = out.findIndex((o) => key(o) === k);
    if (i >= 0) out[i] = { ...out[i]!, c: out[i]!.c.add(t.c) };
    else out.push(t);
  }
  return out.filter((t) => !t.c.isZero());
}

export function ftex(ts: readonly FTerm[], v = 'x'): string {
  return joinSigned(fnorm(ts).map((t) => ({ neg: t.c.sign < 0, body: ftermMag(t, v) })));
}

/** Derivative of one term. */
export function fderivTerm(t: FTerm): FTerm[] {
  const out: FTerm[] = [];
  if (!t.p.isZero()) out.push(ft(t.c.mul(t.p), t.p.sub(1), t.atoms));
  t.atoms.forEach((a, i) => {
    const others = t.atoms.filter((_, j) => j !== i);
    switch (a.fn) {
      case 'exp':
        out.push(ft(t.c.mul(a.a), t.p, [...others, a]));
        break;
      case 'sin':
        out.push(ft(t.c.mul(a.a), t.p, [...others, atom('cos', a.a)]));
        break;
      case 'cos':
        out.push(ft(t.c.mul(-a.a), t.p, [...others, atom('sin', a.a)]));
        break;
      case 'ln':
        out.push(ft(t.c, t.p.sub(1), others));
        break;
    }
  });
  return out;
}

export function fderiv(ts: readonly FTerm[]): FTerm[] {
  return fnorm(ts.flatMap(fderivTerm));
}

export function fmul(a: readonly FTerm[], b: readonly FTerm[]): FTerm[] {
  return fnorm(a.flatMap((x) => b.map((y) => ft(x.c.mul(y.c), x.p.add(y.p), [...x.atoms, ...y.atoms]))));
}

export function fscale(a: readonly FTerm[], k: FracLike): FTerm[] {
  return a.map((t) => ({ ...t, c: t.c.mul(k) }));
}

export const fpoly = (p: Poly): FTerm[] => p.c.map((c, i) => ft(c, i)).filter((t) => !t.c.isZero()).reverse();

/** Fallback distractor: tweak the first coefficient. */
export function ftweak(ts: readonly FTerm[], k: number): FTerm[] {
  const n = fnorm(ts);
  if (!n.length) return [ft(offset(k))];
  return [{ ...n[0]!, c: n[0]!.c.add(offset(k)) }, ...n.slice(1)];
}

/** Distractors for a `lhs = …` answer from alternative right-hand sides. */
export function lhsDistractors(lhsTex: string, answerRhs: string, wrongs: Array<string | null | undefined>, fallback: (k: number) => string | null): RichText[] {
  const wrap = (r: string) => `$\\displaystyle ${lhsTex} = ${r}$`;
  return distinctDistractors(
    wrap(answerRhs),
    wrongs.map((w) => (w ? wrap(w) : null)),
    (k) => {
      const f = fallback(k);
      return f ? wrap(f) : null;
    },
  );
}

// ---------------------------------------------------------------- exact numbers

/** ±√q for a non-negative rational q, simplified: `\frac{2\sqrt{3}}{3}`. */
export function sqrtFracTex(q: Frac): string {
  if (q.sign < 0) throw new Error('sqrtFracTex: negative');
  const { out, inside } = simplifySqrt(q.n * q.d);
  const coef = new Frac(out, q.d);
  if (inside === 1) return num(coef);
  const rad = `\\sqrt{${inside}}`;
  if (coef.isInt()) return coef.eq(1) ? rad : `${coef.n}${rad}`;
  return `\\frac{${coef.n === 1 ? '' : coef.n}${rad}}{${coef.d}}`;
}

export function isSquareFrac(q: Frac): boolean {
  const r = (n: number) => Number.isInteger(Math.sqrt(n));
  return q.sign >= 0 && r(q.n) && r(q.d);
}

/** Exact multiple of π: `\frac{32\pi}{3}`, `-\pi`, `0`. */
export function piTex(k: Frac): string {
  if (k.isZero()) return '0';
  const s = k.sign < 0 ? '-' : '';
  const a = k.abs();
  const top = a.n === 1 ? '\\pi' : `${a.n}\\pi`;
  return a.d === 1 ? `${s}${top}` : `${s}\\frac{${top}}{${a.d}}`;
}

// ---------------------------------------------------------------- word problems

export const NAMES = ['Ava', 'Ben', 'Carlos', 'Dana', 'Eli', 'Fatima', 'Grace', 'Hiro', 'Imani', 'Jonah', 'Keiko', 'Luis', 'Maya', 'Noah', 'Priya', 'Quinn', 'Rosa', 'Sam', 'Tariq', 'Uma'] as const;

export function pickName(rng: Rng): string {
  return rng.pick(NAMES);
}

/** Polynomial with a random non-zero leading coefficient. */
export function randPoly(rng: Rng, deg: number, max: number, density = 0.7): Poly {
  for (;;) {
    const c = Array.from({ length: deg + 1 }, (_, i) => (i === deg ? rng.signedInt(1, max, true) : rng.bool(density) ? rng.int(-max, max) : 0));
    const p = new Poly(c);
    if (p.degree === deg) return p;
  }
}

export const frac = (n: number, d = 1) => new Frac(n, d);
