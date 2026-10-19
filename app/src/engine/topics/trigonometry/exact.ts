/**
 * Exact trigonometric values in simplified radical form.
 *
 * `Exact` is a sum of rational multiples of square roots of square-free
 * integers (e.g. (√6 − √2)/4, 2 + √3); it is closed under +, −, × and division
 * by sums of at most two terms (denominators are always rationalized), which
 * covers every special-angle value, sum/difference and double-angle formula.
 * Half-angle values that cannot be denested are carried as `Val`s with a
 * nested-radical LaTeX form (√(2 − √2)/2).
 */
import { Frac, gcd, lcm, type FracLike } from '../../fraction';
import { isPerfectSquare, simplifySqrt } from '../../radical';

export class Exact {
  /** radicand → coefficient (non-zero coefficients only, radicands square-free). */
  readonly terms: ReadonlyMap<number, Frac>;

  private constructor(terms: Map<number, Frac>) {
    this.terms = terms;
  }

  private static build(entries: Iterable<[number, Frac]>): Exact {
    const m = new Map<number, Frac>();
    for (const [r, c] of entries) {
      const prev = m.get(r) ?? Frac.ZERO;
      const next = prev.add(c);
      if (next.isZero()) m.delete(r);
      else m.set(r, next);
    }
    return new Exact(m);
  }

  /** coef·√rad, simplified. */
  static of(coef: FracLike, rad = 1): Exact {
    const { out, inside } = simplifySqrt(rad);
    return Exact.build([[inside, Frac.of(coef).mul(out)]]);
  }

  static readonly ZERO = Exact.of(0);
  static readonly ONE = Exact.of(1);

  /** √(rational) in simplest form. */
  static sqrtFrac(f: FracLike): Exact {
    const q = Frac.of(f);
    if (q.sign < 0) throw new Error('Exact.sqrtFrac: negative');
    const { out, inside } = simplifySqrt(q.n * q.d);
    return Exact.of(new Frac(out, q.d), inside);
  }

  add(o: Exact): Exact {
    return Exact.build([...this.terms, ...o.terms]);
  }

  neg(): Exact {
    return Exact.build([...this.terms].map(([r, c]) => [r, c.neg()] as [number, Frac]));
  }

  sub(o: Exact): Exact {
    return this.add(o.neg());
  }

  scale(k: FracLike): Exact {
    return Exact.build([...this.terms].map(([r, c]) => [r, c.mul(k)] as [number, Frac]));
  }

  mul(o: Exact): Exact {
    const out: Array<[number, Frac]> = [];
    for (const [r1, c1] of this.terms)
      for (const [r2, c2] of o.terms) {
        const { out: k, inside } = simplifySqrt(r1 * r2);
        out.push([inside, c1.mul(c2).mul(k)]);
      }
    return Exact.build(out);
  }

  /** Division with a rationalized result; the divisor may have at most two terms. */
  div(o: Exact): Exact {
    if (o.isZero()) throw new Error('Exact.div: division by zero');
    const t = [...o.terms];
    if (t.length === 1) {
      const [r, c] = t[0]!;
      return this.mul(Exact.of(1, r)).scale(new Frac(1, r).div(c));
    }
    if (t.length === 2) {
      const conj = Exact.build([t[0]!, [t[1]![0], t[1]![1].neg()]]);
      const den = o.mul(conj);
      if (!den.isRational()) throw new Error('Exact.div: conjugate did not rationalize');
      return this.mul(conj).scale(den.rational().inv());
    }
    throw new Error('Exact.div: divisor with more than two terms');
  }

  isZero(): boolean {
    return this.terms.size === 0;
  }

  isRational(): boolean {
    return this.terms.size === 0 || (this.terms.size === 1 && this.terms.has(1));
  }

  rational(): Frac {
    return this.terms.get(1) ?? Frac.ZERO;
  }

  get value(): number {
    let s = 0;
    for (const [r, c] of this.terms) s += c.value * Math.sqrt(r);
    return s;
  }

  eq(o: Exact): boolean {
    return this.sub(o).isZero();
  }

  /** `\frac{\sqrt{6} - \sqrt{2}}{4}`, `2 + \sqrt{3}`, `-\frac{\sqrt{3}}{2}`, `\frac{1}{2}`. */
  toTex(): string {
    if (this.isZero()) return '0';
    const entries = [...this.terms].sort((x, y) => (x[0] === 1 ? -1 : y[0] === 1 ? 1 : y[0] - x[0]));
    const D = entries.reduce((l, [, c]) => lcm(l, c.d), 1);
    let nums = entries.map(([r, c]) => [r, c.mul(D).n] as [number, number]);
    let lead = '';
    if (nums.every(([, n]) => n < 0) && (D > 1 || nums.length === 1)) {
      lead = '-';
      nums = nums.map(([r, n]) => [r, -n]);
    } else if (nums[0]![1] < 0 && nums.some(([, n]) => n > 0)) {
      const k = nums.findIndex(([, n]) => n > 0);
      nums = [nums[k]!, ...nums.filter((_, i) => i !== k)];
    }
    const termTex = (r: number, n: number) => {
      const a = Math.abs(n);
      if (r === 1) return String(a);
      return `${a === 1 ? '' : a}\\sqrt{${r}}`;
    };
    let numer = '';
    nums.forEach(([r, n], i) => {
      const t = termTex(r, n);
      numer += i === 0 ? (n < 0 ? `-${t}` : t) : n < 0 ? ` - ${t}` : ` + ${t}`;
    });
    return D === 1 ? `${lead}${numer}` : `${lead}\\frac{${numer}}{${D}}`;
  }
}

/** A displayed exact value (possibly a nested radical). */
export interface Val {
  tex: string;
  value: number;
}

export const val = (e: Exact): Val => ({ tex: e.toTex(), value: e.value });
export const negVal = (v: Val): Val => ({ tex: v.tex.startsWith('-') ? v.tex.slice(1) : `-${v.tex}`, value: -v.value });

/**
 * √x for x = A + B√w ≥ 0 (at most one irrational term), denested when
 * possible: √(2 − √3)/2 → (√6 − √2)/4; otherwise `\frac{\sqrt{2 - \sqrt{2}}}{2}`.
 */
export function sqrtExact(x: Exact): Val {
  if (x.value < -1e-12) throw new Error('sqrtExact: negative');
  if (x.isRational()) return val(Exact.sqrtFrac(x.rational()));
  const irr = [...x.terms].filter(([r]) => r !== 1);
  if (irr.length !== 1) throw new Error('sqrtExact: more than one irrational term');
  const [w, B] = irr[0]!;
  const A = x.rational();
  const disc = A.mul(A).sub(B.mul(B).mul(w));
  if (disc.sign >= 0 && isPerfectSquare(disc.n) && isPerfectSquare(disc.d)) {
    const s = new Frac(Math.round(Math.sqrt(disc.n)), Math.round(Math.sqrt(disc.d)));
    const p = A.add(s).div(2);
    const q = A.sub(s).div(2);
    const e = Exact.sqrtFrac(p).add(Exact.sqrtFrac(q).scale(B.sign));
    return val(e);
  }
  // √(A + B√w) = √(a + b√w) / D with integers a, b
  let D = 1;
  while (!A.mul(D * D).isInt() || !B.mul(D * D).isInt()) D++;
  let a = A.mul(D * D).n;
  let b = B.mul(D * D).n;
  let k = 1;
  for (let f = 2; f * f <= Math.max(Math.abs(a), Math.abs(b)); f++) {
    while (a % (f * f) === 0 && b % (f * f) === 0) {
      a /= f * f;
      b /= f * f;
      k *= f;
    }
  }
  const g = gcd(k, D);
  k /= g;
  D /= g;
  const inner = Exact.of(a).add(Exact.of(b, w)).toTex();
  const top = `${k === 1 ? '' : k}\\sqrt{${inner}}`;
  return { tex: D === 1 ? top : `\\frac{${top}}{${D}}`, value: Math.sqrt(x.value) };
}

// ---------------------------------------------------------------- special angles

export type TrigFn = 'sin' | 'cos' | 'tan' | 'csc' | 'sec' | 'cot';
export const SIX: readonly TrigFn[] = ['sin', 'cos', 'tan', 'csc', 'sec', 'cot'];
export const RECIPROCAL: Record<TrigFn, TrigFn> = { sin: 'csc', cos: 'sec', tan: 'cot', csc: 'sin', sec: 'cos', cot: 'tan' };
export const COFUNCTION: Record<TrigFn, TrigFn> = { sin: 'cos', cos: 'sin', tan: 'cot', cot: 'tan', sec: 'csc', csc: 'sec' };

const S15 = Exact.of(new Frac(1, 4), 6).sub(Exact.of(new Frac(1, 4), 2));
const S75 = Exact.of(new Frac(1, 4), 6).add(Exact.of(new Frac(1, 4), 2));
/** sin of 0°, 15°, …, 90°. */
const SIN_TABLE: Exact[] = [Exact.ZERO, S15, Exact.of(new Frac(1, 2)), Exact.of(new Frac(1, 2), 2), Exact.of(new Frac(1, 2), 3), S75, Exact.ONE];

export const mod360 = (d: number): number => ((d % 360) + 360) % 360;

/** Exact sin of a multiple of 15°. */
export function sinExact(deg: number): Exact {
  if (!Number.isInteger(deg / 15)) throw new Error(`sinExact: ${deg} is not a multiple of 15`);
  const a = mod360(deg);
  if (a <= 90) return SIN_TABLE[a / 15]!;
  if (a <= 180) return SIN_TABLE[(180 - a) / 15]!;
  if (a <= 270) return SIN_TABLE[(a - 180) / 15]!.neg();
  return SIN_TABLE[(360 - a) / 15]!.neg();
}

export const cosExact = (deg: number): Exact => sinExact(deg + 90);

/** Exact value of any of the six functions at a multiple of 15°; null when undefined. */
export function trigExact(fn: TrigFn, deg: number): Exact | null {
  const s = sinExact(deg);
  const c = cosExact(deg);
  const q = (n: Exact, d: Exact) => (d.isZero() ? null : n.div(d));
  switch (fn) {
    case 'sin':
      return s;
    case 'cos':
      return c;
    case 'tan':
      return q(s, c);
    case 'cot':
      return q(c, s);
    case 'sec':
      return q(Exact.ONE, c);
    case 'csc':
      return q(Exact.ONE, s);
  }
}

export const FN_VALUE: Record<TrigFn, (x: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  csc: (x) => 1 / Math.sin(x),
  sec: (x) => 1 / Math.cos(x),
  cot: (x) => Math.cos(x) / Math.sin(x),
};

// ---------------------------------------------------------------- angle formatting

export type AngleUnit = 'deg' | 'rad';

/** `\frac{5\pi}{6}`, `-\frac{\pi}{4}`, `3\pi`, `\pi`, `0` for the angle (k)·π. */
export function piTex(k: FracLike): string {
  const f = Frac.of(k);
  if (f.isZero()) return '0';
  const sign = f.sign < 0 ? '-' : '';
  const n = Math.abs(f.n);
  const top = n === 1 ? '\\pi' : `${n}\\pi`;
  return f.d === 1 ? `${sign}${top}` : `${sign}\\frac{${top}}{${f.d}}`;
}

/** Plain-text-friendly label for figures: `3\pi/2`, `-\pi`, `2\pi`. */
export function piLabel(k: FracLike): string {
  const f = Frac.of(k);
  if (f.isZero()) return '0';
  const sign = f.sign < 0 ? '-' : '';
  const n = Math.abs(f.n);
  const top = n === 1 ? '\\pi' : `${n}\\pi`;
  return f.d === 1 ? `${sign}${top}` : `${sign}${top}/${f.d}`;
}

export function degTex(d: number): string {
  return `${d}^\\circ`;
}

/** Degrees (integer or exact multiple of a radian fraction) in the requested unit. */
export function angleTex(deg: number, unit: AngleUnit): string {
  if (unit === 'deg') return degTex(deg);
  return piTex(radFrac(deg));
}

/** deg/180 as an exact fraction (deg may be a multiple of 0.5). */
export function radFrac(deg: number): Frac {
  const twice = Math.round(deg * 2);
  if (Math.abs(twice / 2 - deg) > 1e-9) throw new Error(`radFrac: ${deg}`);
  return new Frac(twice, 360);
}

/** `\sin 210^\circ`, `\cos\left(-\frac{\pi}{3}\right)`, `\tan(-45^\circ)`. */
export function fnAt(fn: TrigFn, arg: string): string {
  if (arg.startsWith('-')) return arg.includes('\\frac') ? `\\${fn}\\left(${arg}\\right)` : `\\${fn}(${arg})`;
  return `\\${fn} ${arg}`;
}

export const QUADRANTS = ['I', 'II', 'III', 'IV'] as const;

/** Quadrant index 0–3 of a non-quadrantal angle in degrees. */
export function quadrantOf(deg: number): number {
  const a = mod360(deg);
  if (a % 90 === 0) throw new Error(`quadrantOf: quadrantal angle ${deg}`);
  return Math.floor(a / 90);
}

export function referenceAngle(deg: number): number {
  const a = mod360(deg);
  if (a <= 90) return a;
  if (a <= 180) return 180 - a;
  if (a <= 270) return a - 180;
  return 360 - a;
}
