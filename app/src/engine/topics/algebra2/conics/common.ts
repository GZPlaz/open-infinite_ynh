/** Shared helpers for the conic-section generators (formatting and graphing). */
import { graphPlane, type Diagram, type DiagramBuilder, type Window } from '../../../diagram';
import { Frac, gcdAll, type FracLike } from '../../../fraction';
import { isPerfectSquare, sqrtTex } from '../../../radical';
import { num, sum, type Term } from '../../../tex';

export const CATEGORY = 'Conic Sections';
export const RANGE = 10;

/** `x - 2`, `x + \frac{1}{2}`, `x`. */
export function shiftTex(v: string, h: FracLike): string {
  return sum([{ coef: 1, sym: v }, { coef: Frac.of(h).neg() }]);
}

/** `(x - 2)^{2}`, `x^{2}`, `\left(x + \frac{1}{2}\right)^{2}`. */
export function sqTex(v: string, h: FracLike): string {
  const f = Frac.of(h);
  if (f.isZero()) return `${v}^{2}`;
  const inner = shiftTex(v, f);
  return f.isInt() ? `(${inner})^{2}` : `\\left(${inner}\\right)^{2}`;
}

/** `\frac{(x - 2)^{2}}{9}`, or the bare square when the denominator is 1. */
export function overTex(v: string, h: FracLike, den: number): string {
  const sq = sqTex(v, h);
  return den === 1 ? sq : `\\frac{${sq}}{${den}}`;
}

/** Ordered pair from LaTeX coordinates. */
export function ptTex(x: FracLike | string, y: FracLike | string): string {
  const s = (v: FracLike | string) => (typeof v === 'string' ? v : num(v));
  return `\\left(${s(x)}, ${s(y)}\\right)`;
}

/** base ± √sq as LaTeX: `5`, `2 + \sqrt{5}`, `-2\sqrt{3}`. */
export function plusRoot(base: FracLike, sign: 1 | -1, sq: number): string {
  const b = Frac.of(base);
  if (isPerfectSquare(sq)) return num(b.add(sign * Math.round(Math.sqrt(sq))));
  const rad = sqrtTex(sq);
  if (b.isZero()) return sign > 0 ? rad : `-${rad}`;
  return `${num(b)} ${sign > 0 ? '+' : '-'} ${rad}`;
}

/** Square root of a non-negative integer in simplest form. */
export function rootTex(sq: number): string {
  return sqrtTex(sq);
}

/** `Label: content; Label: content`. */
export function fields(items: ReadonlyArray<readonly [string, string]>): string {
  return items.map(([l, c]) => `${l}: ${c}`).join('; ');
}

/** `ax² + cy² + dx + ey + f` with integer coefficients, as LaTeX. */
export function generalTex(c: { A: number; B?: number; C: number; D: number; E: number; F: number }, ySquaredFirst = false): string {
  const sq: Term[] = [
    { coef: c.A, sym: 'x^{2}' },
    { coef: c.C, sym: 'y^{2}' },
  ];
  if (ySquaredFirst) sq.reverse();
  return sum([...sq.slice(0, 1), ...(c.B ? [{ coef: c.B, sym: 'xy' }] : []), ...sq.slice(1), { coef: c.D, sym: 'x' }, { coef: c.E, sym: 'y' }, { coef: c.F }]);
}

/** Divide integer coefficients by their gcd (and make the first non-zero one positive when `positive`). */
export function primitive<T extends Record<string, number>>(c: T, positive = true): T {
  const vals = Object.values(c);
  const g = gcdAll(vals) || 1;
  const first = vals.find((v) => v !== 0) ?? 1;
  const s = positive && first < 0 ? -1 : 1;
  const out = {} as Record<string, number>;
  for (const [k, v] of Object.entries(c)) out[k] = (s * v) / g + 0;
  return out as T;
}

/** Least common multiple of denominators. */
export function lcmDen(values: readonly Frac[]): number {
  let l = 1;
  for (const v of values) {
    const d = v.d;
    let a = l;
    let b = d;
    while (b) [a, b] = [b, a % b];
    l = (l / a) * d;
  }
  return l;
}

export function plane(): { b: DiagramBuilder; w: Window } {
  return graphPlane(RANGE, 2, 10);
}

export function blankPlane(): Diagram {
  return plane().b.build('Blank coordinate plane');
}

/** Dashed line a·x + b·y + c = 0 clipped to the window (no-op when it misses the window). */
export function dashedLine(b: DiagramBuilder, w: Window, a: number, bb: number, c: number): void {
  if (Math.abs(bb) < 1e-12) {
    const x = -c / a;
    if (x >= w.x0 && x <= w.x1) b.segment([x, w.y0], [x, w.y1], { dash: true, ink: 'muted', weight: 1 });
    return;
  }
  const y = (x: number) => (-c - a * x) / bb;
  let lo = w.x0;
  let hi = w.x1;
  if (Math.abs(a) > 1e-12) {
    const xa = (-c - bb * w.y0) / a;
    const xb = (-c - bb * w.y1) / a;
    lo = Math.max(lo, Math.min(xa, xb));
    hi = Math.min(hi, Math.max(xa, xb));
  } else if (y(0) < w.y0 || y(0) > w.y1) return;
  if (hi - lo < 1e-9) return;
  b.segment([lo, y(lo)], [hi, y(hi)], { dash: true, ink: 'muted', weight: 1 });
}

export const fr = (n: number, d = 1): Frac => new Frac(n, d);
