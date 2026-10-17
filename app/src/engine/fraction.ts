/** Exact rational arithmetic for answer keys (no floating-point drift). */

export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

export function lcm(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return Math.abs((a / gcd(a, b)) * b);
}

export function gcdAll(values: readonly number[]): number {
  return values.reduce((g, v) => gcd(g, v), 0);
}

export type FracLike = Frac | number;

export class Frac {
  readonly n: number;
  readonly d: number;

  constructor(n: number, d = 1) {
    if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d)) {
      throw new Error(`Frac: non-integer parts ${n}/${d}`);
    }
    if (d === 0) throw new Error('Frac: zero denominator');
    if (d < 0) {
      n = -n;
      d = -d;
    }
    const g = gcd(n, d) || 1;
    this.n = n / g + 0; // `+ 0` turns -0 into 0
    this.d = d / g;
  }

  static of(x: FracLike): Frac {
    return x instanceof Frac ? x : new Frac(x, 1);
  }

  static readonly ZERO = new Frac(0);
  static readonly ONE = new Frac(1);

  add(o: FracLike): Frac {
    const b = Frac.of(o);
    return new Frac(this.n * b.d + b.n * this.d, this.d * b.d);
  }

  sub(o: FracLike): Frac {
    return this.add(Frac.of(o).neg());
  }

  mul(o: FracLike): Frac {
    const b = Frac.of(o);
    return new Frac(this.n * b.n, this.d * b.d);
  }

  div(o: FracLike): Frac {
    const b = Frac.of(o);
    if (b.n === 0) throw new Error('Frac: division by zero');
    return new Frac(this.n * b.d, this.d * b.n);
  }

  neg(): Frac {
    return new Frac(-this.n, this.d);
  }

  abs(): Frac {
    return new Frac(Math.abs(this.n), this.d);
  }

  inv(): Frac {
    return Frac.ONE.div(this);
  }

  pow(k: number): Frac {
    if (!Number.isInteger(k)) throw new Error('Frac.pow: integer exponents only');
    if (k < 0) return this.inv().pow(-k);
    let r = Frac.ONE;
    for (let i = 0; i < k; i++) r = r.mul(this);
    return r;
  }

  eq(o: FracLike): boolean {
    const b = Frac.of(o);
    return this.n === b.n && this.d === b.d;
  }

  cmp(o: FracLike): number {
    const b = Frac.of(o);
    return Math.sign(this.n * b.d - b.n * this.d);
  }

  get sign(): number {
    return Math.sign(this.n);
  }

  isInt(): boolean {
    return this.d === 1;
  }

  isZero(): boolean {
    return this.n === 0;
  }

  get value(): number {
    return this.n / this.d;
  }

  /** LaTeX: `5`, `-5`, `\frac{3}{4}`, `-\frac{3}{4}`. */
  toTex(): string {
    if (this.d === 1) return String(this.n);
    const body = `\\frac{${Math.abs(this.n)}}{${this.d}}`;
    return this.n < 0 ? `-${body}` : body;
  }

  /** Mixed-number LaTeX for improper fractions: `2\frac{1}{3}`. */
  toMixedTex(): string {
    if (this.d === 1 || Math.abs(this.n) < this.d) return this.toTex();
    const whole = Math.trunc(Math.abs(this.n) / this.d);
    const rem = Math.abs(this.n) % this.d;
    return `${this.n < 0 ? '-' : ''}${whole}\\frac{${rem}}{${this.d}}`;
  }

  toString(): string {
    return this.d === 1 ? String(this.n) : `${this.n}/${this.d}`;
  }
}

export const frac = (n: number, d = 1): Frac => new Frac(n, d);
