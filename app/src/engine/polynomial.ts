/** Single-variable polynomials with exact rational coefficients. */
import { Frac, type FracLike } from './fraction';
import { pow, sum, type Term } from './tex';

export class Poly {
  /** c[i] is the coefficient of x^i; trailing zeros are trimmed. */
  readonly c: readonly Frac[];

  constructor(coeffs: readonly FracLike[]) {
    const c = coeffs.map((x) => Frac.of(x));
    while (c.length > 0 && c[c.length - 1]!.isZero()) c.pop();
    this.c = c;
  }

  /** From ascending coefficients `[c0, c1, c2, …]`. */
  static of(...ascending: FracLike[]): Poly {
    return new Poly(ascending);
  }

  /** From descending coefficients `[…, c2, c1, c0]`. */
  static desc(...descending: FracLike[]): Poly {
    return new Poly(descending.slice().reverse());
  }

  /** The linear factor `a·x + b`. */
  static linear(a: FracLike, b: FracLike): Poly {
    return new Poly([b, a]);
  }

  /** Product of linear factors (x - r) for each root. */
  static fromRoots(roots: readonly FracLike[]): Poly {
    return roots.reduce<Poly>((p, r) => p.mul(Poly.linear(1, Frac.of(r).neg())), Poly.of(1));
  }

  get degree(): number {
    return this.c.length - 1;
  }

  isZero(): boolean {
    return this.c.length === 0;
  }

  coef(i: number): Frac {
    return this.c[i] ?? Frac.ZERO;
  }

  lead(): Frac {
    return this.coef(this.degree);
  }

  add(o: Poly): Poly {
    const n = Math.max(this.c.length, o.c.length);
    return new Poly(Array.from({ length: n }, (_, i) => this.coef(i).add(o.coef(i))));
  }

  sub(o: Poly): Poly {
    return this.add(o.scale(-1));
  }

  scale(k: FracLike): Poly {
    return new Poly(this.c.map((x) => x.mul(k)));
  }

  mul(o: Poly): Poly {
    if (this.isZero() || o.isZero()) return new Poly([]);
    const out: Frac[] = Array.from({ length: this.c.length + o.c.length - 1 }, () => Frac.ZERO);
    this.c.forEach((a, i) => o.c.forEach((b, j) => (out[i + j] = out[i + j]!.add(a.mul(b)))));
    return new Poly(out);
  }

  powInt(k: number): Poly {
    let r = Poly.of(1);
    for (let i = 0; i < k; i++) r = r.mul(this);
    return r;
  }

  derivative(): Poly {
    return new Poly(this.c.slice(1).map((x, i) => x.mul(i + 1)));
  }

  /** Antiderivative with zero constant term. */
  antiderivative(): Poly {
    return new Poly([Frac.ZERO, ...this.c.map((x, i) => x.div(i + 1))]);
  }

  eval(x: FracLike): Frac {
    return this.c.reduceRight<Frac>((acc, ci) => acc.mul(x).add(ci), Frac.ZERO);
  }

  evalNum(x: number): number {
    return this.c.reduceRight((acc, ci) => acc * x + ci.value, 0);
  }

  isIntegral(): boolean {
    return this.c.every((x) => x.isInt());
  }

  /** Terms in descending order of degree (for `sum()`). */
  terms(v = 'x'): Term[] {
    const out: Term[] = [];
    for (let i = this.degree; i >= 0; i--) out.push({ coef: this.coef(i), sym: pow(v, i) });
    return out;
  }

  toTex(v = 'x'): string {
    return sum(this.terms(v));
  }

  eq(o: Poly): boolean {
    return this.c.length === o.c.length && this.c.every((x, i) => x.eq(o.c[i]!));
  }
}
