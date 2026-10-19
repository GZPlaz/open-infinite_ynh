/** Shared helpers for the precalculus pack: interval notation, exact surds, special angles, polar grids. */
import { DiagramBuilder } from '../../diagram';
import { Frac, type FracLike } from '../../fraction';
import { simplifySqrt } from '../../radical';
import { num } from '../../tex';

// ---------------------------------------------------------------- intervals

/** Interval endpoint: numeric value and its LaTeX. */
export interface End {
  v: number;
  tex: string;
}

export const INF: End = { v: Infinity, tex: '\\infty' };
export const NINF: End = { v: -Infinity, tex: '-\\infty' };
export const end = (x: FracLike): End => ({ v: Frac.of(x).value, tex: num(x) });
export const endTex = (v: number, tex: string): End => ({ v, tex });

export interface Interval {
  lo: End;
  hi: End;
  loC: boolean;
  hiC: boolean;
}

export const iv = (lo: End, hi: End, loC = false, hiC = false): Interval => ({ lo, hi, loC: loC && Number.isFinite(lo.v), hiC: hiC && Number.isFinite(hi.v) });
export const ALL: Interval[] = [iv(NINF, INF)];

/** `(-\infty, 2) \cup (2, \infty)`; a degenerate closed interval prints as `\{a\}`. */
export function intervalTex(list: readonly Interval[]): string {
  if (list.length === 0) return '\\varnothing';
  return list
    .map((i) => (i.lo.v === i.hi.v ? `\\{${i.lo.tex}\\}` : `${i.loC ? '[' : '('}${i.lo.tex}, ${i.hi.tex}${i.hiC ? ']' : ')'}`))
    .join(' \\cup ');
}

/** Everything except the given (sorted, distinct) points. */
export function allExcept(points: readonly End[]): Interval[] {
  const pts = [...points].sort((a, b) => a.v - b.v);
  const out: Interval[] = [];
  let prev = NINF;
  for (const p of pts) {
    out.push(iv(prev, p));
    prev = p;
  }
  out.push(iv(prev, INF));
  return out;
}

// ---------------------------------------------------------------- surds q·√s

export class Surd {
  private constructor(
    readonly q: Frac,
    readonly s: number,
  ) {}

  static of(q: FracLike, s = 1): Surd {
    const f = Frac.of(q);
    if (f.isZero()) return new Surd(Frac.ZERO, 1);
    const { out, inside } = simplifySqrt(s);
    return new Surd(f.mul(out), inside);
  }

  mul(o: Surd | FracLike): Surd {
    if (!(o instanceof Surd)) return Surd.of(this.q.mul(o), this.s);
    return Surd.of(this.q.mul(o.q), this.s * o.s);
  }

  neg(): Surd {
    return Surd.of(this.q.neg(), this.s);
  }

  abs(): Surd {
    return Surd.of(this.q.abs(), this.s);
  }

  isZero(): boolean {
    return this.q.isZero();
  }

  get sign(): number {
    return this.q.sign;
  }

  get value(): number {
    return this.q.value * Math.sqrt(this.s);
  }

  eq(o: Surd): boolean {
    return this.q.eq(o.q) && this.s === o.s;
  }

  /** `-2\sqrt{3}`, `\frac{\sqrt{2}}{2}`, `\frac{3}{4}`. */
  toTex(): string {
    if (this.s === 1) return num(this.q);
    const a = this.q.abs();
    const top = `${a.n === 1 ? '' : a.n}\\sqrt{${this.s}}`;
    const body = a.d === 1 ? top : `\\frac{${top}}{${a.d}}`;
    return this.q.sign < 0 ? `-${body}` : body;
  }

  /** Coefficient of a symbol: `''` for 1, `-` for −1, `2\sqrt{3}` … (sign included). */
  coefTex(): string {
    if (this.s === 1 && this.q.abs().eq(1)) return this.q.sign < 0 ? '-' : '';
    return this.toTex();
  }
}

/** a + bi with surd parts: `-2\sqrt{3} + 2i`, `\frac{\sqrt{2}}{2} - \frac{\sqrt{2}}{2}i`, `-4i`. */
export function complexTex(re: Surd, im: Surd): string {
  const imMag = (s: Surd): string => {
    const a = s.abs();
    if (a.s === 1 && a.q.eq(1)) return 'i';
    return `${a.toTex()}i`;
  };
  if (im.isZero()) return re.toTex();
  if (re.isZero()) return im.sign < 0 ? `-${imMag(im)}` : imMag(im);
  return `${re.toTex()} ${im.sign < 0 ? '-' : '+'} ${imMag(im)}`;
}

// ---------------------------------------------------------------- special angles (θ = t·π)

/** Reduce t (angle t·π) to [0, 2). */
export function reduceTurn(t: Frac): Frac {
  let r = t;
  while (r.cmp(2) >= 0) r = r.sub(2);
  while (r.sign < 0) r = r.add(2);
  return r;
}

const SPECIAL: Array<[number, Surd]> = [
  [0, Surd.of(0)],
  [0.5, Surd.of(new Frac(1, 2))],
  [Math.SQRT1_2, Surd.of(new Frac(1, 2), 2)],
  [Math.sqrt(3) / 2, Surd.of(new Frac(1, 2), 3)],
  [1, Surd.of(1)],
];

function exactUnit(v: number): Surd {
  const hit = SPECIAL.find(([x]) => Math.abs(Math.abs(v) - x) < 1e-9);
  if (!hit) throw new Error(`not a special value: ${v}`);
  return v < 0 ? hit[1].neg() : hit[1];
}

/** Exact cos and sin of t·π for multiples of π/6 and π/4. */
export function trigExact(t: Frac): { cos: Surd; sin: Surd } {
  const a = t.value * Math.PI;
  return { cos: exactUnit(Math.cos(a)), sin: exactUnit(Math.sin(a)) };
}

/** Angle t·π in radians (`\frac{5\pi}{6}`) or degrees (`150^\circ`). */
export function angleTex(t: Frac, degrees = false): string {
  if (degrees) {
    const d = t.mul(180);
    return `${num(d)}^\\circ`;
  }
  if (t.isZero()) return '0';
  const a = t.abs();
  const top = a.n === 1 ? '\\pi' : `${a.n}\\pi`;
  const body = a.d === 1 ? top : `\\frac{${top}}{${a.d}}`;
  return t.sign < 0 ? `-${body}` : body;
}

/** `\cos\frac{\pi}{3} + i\sin\frac{\pi}{3}` wrapped with a modulus: `2\left(…\right)`. */
export function cisTex(r: Surd, t: Frac, degrees = false): string {
  const a = angleTex(t, degrees);
  const sp = /^\\/.test(a) ? '' : ' ';
  const inner = `\\cos${sp}${a} + i\\sin${sp}${a}`;
  if (r.s === 1 && r.q.eq(1)) return inner;
  return `${r.toTex()}\\left(${inner}\\right)`;
}

// ---------------------------------------------------------------- figures

/** Polar grid: rings at r = 1 … R, rays every 30°, axis arrows. */
export function polarPlane(R: number, scale = 13): DiagramBuilder {
  const b = new DiagramBuilder(scale);
  for (let r = 1; r <= R; r++) b.circle([0, 0], r, { ink: 'grid', weight: r === R ? 0.8 : 0.5 });
  for (let deg = 0; deg < 180; deg += 30) {
    if (deg === 0 || deg === 90) continue;
    const c = Math.cos((deg * Math.PI) / 180) * R;
    const s = Math.sin((deg * Math.PI) / 180) * R;
    b.segment([-c, -s], [c, s], { ink: 'grid', weight: 0.5 });
  }
  b.arrow([-R - 0.6, 0], [R + 0.6, 0], { both: true, ink: 'axis', weight: 1 });
  b.arrow([0, -R - 0.6], [0, R + 0.6], { both: true, ink: 'axis', weight: 1 });
  for (let r = 2; r <= R; r += 2) b.label([r, 0], String(r), 'se', { ink: 'muted', small: true });
  b.label([R + 0.6, 0], '0', 'e', { ink: 'muted', small: true });
  b.label([0, R + 0.6], '\\pi/2', 'n', { ink: 'muted', small: true });
  b.label([-R - 0.6, 0], '\\pi', 'w', { ink: 'muted', small: true });
  b.label([0, -R - 0.6], '3\\pi/2', 's', { ink: 'muted', small: true });
  return b;
}

/** `\frac{a}{den}` with the sign in front: `-\frac{3}{x - 2}`. */
export function signedFrac(n: number, den: string): string {
  return `${n < 0 ? '-' : ''}\\frac{${Math.abs(n)}}{${den}}`;
}

/** Ordinal: 1st, 2nd, 3rd, 4th … */
export function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th';
  return `${n}${s}`;
}
