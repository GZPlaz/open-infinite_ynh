/** Function models shared by the general-function topics. */
import { Frac } from '../../../fraction';
import { Poly } from '../../../polynomial';
import { isPerfectSquare } from '../../../radical';
import type { Rng } from '../../../rng';
import { num, paren, sum, type Term } from '../../../tex';

export const CATEGORY_FUNC = 'General Functions';

export type FnKind = 'poly' | 'abs' | 'rational' | 'radical';

export interface Fn {
  kind: FnKind;
  /** The body with every occurrence of the variable replaced by `arg` (already bracketed for numbers). */
  sub(arg: string): string;
  /** Exact value, or null when undefined / not rational. */
  at(x: Frac): Frac | null;
  poly?: Poly;
}

/** Terms of a polynomial in an arbitrary argument: `3(-4)^{2} - (-4)`. */
export function polySub(p: Poly, arg: string): string {
  const terms: Term[] = [];
  for (let i = p.degree; i >= 0; i--) terms.push({ coef: p.coef(i), sym: i === 0 ? '' : i === 1 ? arg : `${arg}^{${i}}` });
  return sum(terms);
}

/** p·arg + q */
function linSub(p: number, q: number, arg: string): string {
  return sum([{ coef: p, sym: arg }, { coef: q }]);
}

function tail(c: number): string {
  return c === 0 ? '' : ` ${c > 0 ? '+' : '-'} ${Math.abs(c)}`;
}

function lead(k: number): string {
  return k === 1 ? '' : k === -1 ? '-' : String(k);
}

export function polyFn(p: Poly): Fn {
  return { kind: 'poly', poly: p, sub: (arg) => polySub(p, arg), at: (x) => p.eval(x) };
}

/** k|px + q| + c */
export function absFn(k: number, p: number, q: number, c: number): Fn {
  return {
    kind: 'abs',
    sub: (arg) => `${lead(k)}|${linSub(p, q, arg)}|${tail(c)}`,
    at: (x) => x.mul(p).add(q).abs().mul(k).add(c),
  };
}

/** (px + q) / (rx + s) */
export function rationalFn(p: number, q: number, r: number, s: number): Fn {
  return {
    kind: 'rational',
    sub: (arg) => `\\frac{${linSub(p, q, arg)}}{${linSub(r, s, arg)}}`,
    at: (x) => {
      const den = x.mul(r).add(s);
      return den.isZero() ? null : x.mul(p).add(q).div(den);
    },
  };
}

/** k√(px + q) + c — exact only when px + q is a perfect square. */
export function radicalFn(k: number, p: number, q: number, c: number): Fn {
  return {
    kind: 'radical',
    sub: (arg) => `${lead(k)}\\sqrt{${linSub(p, q, arg)}}${tail(c)}`,
    at: (x) => {
      const inside = x.mul(p).add(q);
      if (inside.sign < 0 || !isPerfectSquare(inside.n) || !isPerfectSquare(inside.d)) return null;
      const root = new Frac(Math.round(Math.sqrt(inside.n)), Math.round(Math.sqrt(inside.d)));
      return root.mul(k).add(c);
    },
  };
}

/** p(u(x)) */
export function compose(p: Poly, u: Poly): Poly {
  let out = Poly.of(0);
  for (let i = p.degree; i >= 0; i--) out = out.mul(u).add(Poly.of(p.coef(i)));
  return out;
}

/** Random polynomial of the given degree with small integer coefficients. */
export function randomPoly(rng: Rng, degree: number, max: number): Poly {
  const c: number[] = [];
  for (let i = 0; i <= degree; i++) c.push(rng.int(-max, max));
  c[degree] = rng.signedInt(1, i2(degree, max), true);
  if (degree >= 2 && rng.bool(0.4)) c[degree] = rng.pick([1, -1, 2]);
  return new Poly(c);
}

function i2(degree: number, max: number): number {
  return degree >= 3 ? 2 : degree === 2 ? Math.min(4, max) : max;
}

/** Substitution argument for a number: `(-4)`, `(3)`, `\left(\frac{1}{2}\right)`. */
export const argTex = (x: Frac): string => paren(x);

export { Frac, num, Poly };
