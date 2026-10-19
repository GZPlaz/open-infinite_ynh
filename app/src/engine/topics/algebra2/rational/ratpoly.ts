/** Polynomial arithmetic for rational expressions: division, gcd, rational roots and factored display. */
import { Frac, gcdAll, lcm } from '../../../fraction';
import { Poly } from '../../../polynomial';
import { pow } from '../../../tex';

export const X = Poly.of(0, 1);
export const ONE = Poly.of(1);

export function monomial(c: Frac | number, k: number): Poly {
  return new Poly([...Array.from({ length: k }, () => 0), c]);
}

export function divmod(a: Poly, b: Poly): { q: Poly; r: Poly } {
  if (b.isZero()) throw new Error('divmod: division by zero polynomial');
  let r = a;
  const qc: Frac[] = Array.from({ length: Math.max(0, a.degree - b.degree + 1) }, () => Frac.ZERO);
  while (!r.isZero() && r.degree >= b.degree) {
    const k = r.degree - b.degree;
    const c = r.lead().div(b.lead());
    qc[k] = c;
    r = r.sub(b.mul(monomial(c, k)));
  }
  return { q: new Poly(qc), r };
}

export function exactDiv(a: Poly, b: Poly): Poly {
  const { q, r } = divmod(a, b);
  if (!r.isZero()) throw new Error('exactDiv: nonzero remainder');
  return q;
}

/**
 * Monic gcd, built from common rational roots (plus a common irreducible
 * leftover). Exact and overflow-free for the split polynomials used here.
 */
export function pgcd(a: Poly, b: Poly): Poly {
  if (a.isZero()) return b.isZero() ? ONE : b.scale(b.lead().inv());
  if (b.isZero()) return a.scale(a.lead().inv());
  const ra = rationalRoots(a);
  const rb = rationalRoots(b);
  const left = [...rb.roots];
  let g = ONE;
  for (const r of ra.roots) {
    const k = left.findIndex((x) => x.eq(r));
    if (k < 0) continue;
    left.splice(k, 1);
    g = g.mul(Poly.linear(1, r.neg()));
  }
  if (ra.rest.degree > 0 && ra.rest.eq(rb.rest)) g = g.mul(ra.rest.scale(ra.rest.lead().inv()));
  return g;
}

/** p = c · prim with prim integral, coefficient gcd 1 and positive leading coefficient. */
export function primitive(p: Poly): { c: Frac; p: Poly } {
  if (p.isZero()) return { c: Frac.ZERO, p };
  const L = p.c.reduce((acc, x) => lcm(acc, x.d), 1);
  const ints = p.c.map((x) => x.mul(L).n);
  const g = gcdAll(ints) * (p.lead().sign < 0 ? -1 : 1);
  return { c: new Frac(g, L), p: new Poly(ints.map((x) => x / g)) };
}

function divisors(n: number): number[] {
  n = Math.abs(n);
  const small: number[] = [];
  const large: number[] = [];
  for (let d = 1; d * d <= n; d++) {
    if (n % d) continue;
    small.push(d);
    if (d * d !== n) large.unshift(n / d);
  }
  return [...small, ...large];
}

/** Exact root test with a floating-point pre-filter (avoids overflow on hopeless candidates). */
function isRoot(P: Poly, r: Frac): boolean {
  const x = r.value;
  let scale = 0;
  for (let i = 0; i <= P.degree; i++) scale += Math.abs(P.coef(i).value) * Math.abs(x) ** i;
  if (Math.abs(P.evalNum(x)) > 1e-6 * scale) return false;
  try {
    return P.eval(r).isZero();
  } catch {
    return false;
  }
}

/** Rational roots (with multiplicity) and the part without rational roots. */
export function rationalRoots(p: Poly): { roots: Frac[]; rest: Poly } {
  let P = primitive(p).p;
  const roots: Frac[] = [];
  outer: while (P.degree > 0) {
    if (P.coef(0).isZero()) {
      roots.push(Frac.ZERO);
      P = exactDiv(P, X);
      continue;
    }
    for (const q of divisors(P.lead().n)) {
      for (const n of divisors(P.coef(0).n)) {
        for (const s of [1, -1]) {
          const r = new Frac(s * n, q);
          if (isRoot(P, r)) {
            roots.push(r);
            P = primitive(exactDiv(P, Poly.linear(r.d, -r.n))).p;
            continue outer;
          }
        }
      }
    }
    break;
  }
  return { roots, rest: P };
}

export interface Factored {
  /** Constant factor. */
  c: Frac;
  /** Primitive integer factors (linear `dx − n`, or a leftover without rational roots) with multiplicities. */
  factors: Array<{ f: Poly; m: number }>;
}

export function factorize(p: Poly): Factored {
  if (p.isZero()) throw new Error('factorize: zero');
  const { roots, rest } = rationalRoots(p);
  const factors: Array<{ f: Poly; m: number }> = [];
  const sorted = [...roots].sort((a, b) => (a.isZero() ? -1 : b.isZero() ? 1 : a.cmp(b)));
  for (const r of sorted) {
    const f = Poly.linear(r.d, -r.n);
    const ex = factors.find((x) => x.f.eq(f));
    if (ex) ex.m++;
    else factors.push({ f, m: 1 });
  }
  if (rest.degree > 0) factors.push({ f: rest, m: 1 });
  let prod = ONE;
  for (const { f, m } of factors) prod = prod.mul(f.powInt(m));
  const c = p.lead().div(prod.lead());
  return { c, factors };
}

/** `3x(x - 2)^{2}`; `bare` when it is a single unparenthesized sum. */
export function productTex(k: number, factors: Factored['factors'], v: string): { tex: string; bare: boolean } {
  if (factors.length === 0) return { tex: String(k), bare: false };
  const xPow = factors.find((x) => x.f.eq(X))?.m ?? 0;
  const others = factors.filter((x) => !x.f.eq(X));
  if (others.length === 1 && others[0]!.m === 1 && k === 1 && xPow === 0) return { tex: others[0]!.f.toTex(v), bare: true };
  const tex = `${k === 1 ? '' : k}${xPow ? pow(v, xPow) : ''}${others.map(({ f, m }) => `(${f.toTex(v)})${m > 1 ? `^{${m}}` : ''}`).join('')}`;
  return { tex, bare: false };
}

/** Product display of a polynomial: `2(x + 3)(x - 1)`, `-(x - 4)`, `x^{2} + 1`. */
export function polyFactoredTex(p: Poly, v: string): string {
  const F = factorize(p);
  const body = productTex(Math.abs(F.c.n), F.factors, v);
  if (F.c.d !== 1) throw new Error('polyFactoredTex: non-integral polynomial');
  if (F.c.sign > 0) return body.tex;
  return body.bare ? `-(${body.tex})` : `-${body.tex}`;
}

/** A rational function N/D in lowest terms, displayed factored: `-\frac{x - 3}{2(x + 1)}`. */
export function ratTex(N: Poly, D: Poly, v: string): string {
  const { N: n, D: d } = reduce(N, D);
  if (n.isZero()) return '0';
  const fn = factorize(n);
  const fd = factorize(d);
  const c = fn.c.div(fd.c);
  const num = productTex(Math.abs(c.n), fn.factors, v);
  const den = productTex(c.d, fd.factors, v);
  const sign = c.sign < 0 ? '-' : '';
  if (den.tex === '1') return sign && num.bare ? `-(${num.tex})` : `${sign}${num.tex}`;
  return `${sign}\\frac{${num.tex}}{${den.tex}}`;
}

/** Cancel common factors. */
export function reduce(N: Poly, D: Poly): { N: Poly; D: Poly } {
  if (N.isZero()) return { N, D: ONE };
  const g = pgcd(N, D);
  return { N: exactDiv(N, g), D: exactDiv(D, g) };
}

/** Rational function value type. */
export class Rat {
  constructor(
    readonly N: Poly,
    readonly D: Poly,
  ) {}
  static of(N: Poly, D: Poly = ONE): Rat {
    const r = reduce(N, D);
    return new Rat(r.N, r.D);
  }
  add(o: Rat): Rat {
    return Rat.of(this.N.mul(o.D).add(o.N.mul(this.D)), this.D.mul(o.D));
  }
  sub(o: Rat): Rat {
    return this.add(o.neg());
  }
  neg(): Rat {
    return new Rat(this.N.scale(-1), this.D);
  }
  mul(o: Rat): Rat {
    return Rat.of(this.N.mul(o.N), this.D.mul(o.D));
  }
  div(o: Rat): Rat {
    return Rat.of(this.N.mul(o.D), this.D.mul(o.N));
  }
  inv(): Rat {
    return Rat.of(this.D, this.N);
  }
  isZero(): boolean {
    return this.N.isZero();
  }
  tex(v: string): string {
    return ratTex(this.N, this.D, v);
  }
  eq(o: Rat): boolean {
    return this.N.mul(o.D).sub(o.N.mul(this.D)).isZero();
  }
}

/** Product of polynomials. */
export function prod(ps: readonly Poly[]): Poly {
  return ps.reduce((a, b) => a.mul(b), ONE);
}

/** `x + 3` for root −3; `2x - 1` for a = 2, b = −1. */
export function lin(a: number, b: number): Poly {
  return Poly.linear(a, b);
}

/** Least common multiple of two integral polynomials (content lcm × primitive lcm). */
export function lcd(a: Poly, b: Poly): Poly {
  const pa = primitive(a);
  const pb = primitive(b);
  const g = pgcd(pa.p, pb.p);
  const l = primitive(exactDiv(pa.p.mul(pb.p), g)).p;
  return l.scale(lcm(Math.abs(pa.c.n), Math.abs(pb.c.n)) || 1);
}
