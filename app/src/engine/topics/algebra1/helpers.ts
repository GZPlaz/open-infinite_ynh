/** Shared helpers for the Algebra 1 topics (names, number lines, lines in the plane). */
import { DiagramBuilder, graphPlane, numberLine, plot, type Diagram, type Window } from '../../diagram';
import { Frac, type FracLike } from '../../fraction';
import type { Rng } from '../../rng';
import { num, sum } from '../../tex';

/** Gender-neutral first names for word problems. */
export const NAMES = [
  'Alex', 'Jordan', 'Sam', 'Taylor', 'Riley', 'Morgan', 'Casey', 'Jamie', 'Avery', 'Quinn',
  'Rowan', 'Skyler', 'Devon', 'Emerson', 'Hayden', 'Kai', 'Logan', 'Parker', 'Reese', 'Sasha',
  'Ari', 'Noor', 'Mateo', 'Priya', 'Kenji', 'Amara', 'Tariq', 'Lena', 'Diego', 'Mei',
] as const;

export function twoNames(rng: Rng): [string, string] {
  const [a, b] = rng.sample(NAMES, 2);
  return [a!, b!];
}

// ---------------------------------------------------------------- inequalities

export type Rel = '<' | '>' | '\\le' | '\\ge';
export const FLIP: Record<Rel, Rel> = { '<': '>', '>': '<', '\\le': '\\ge', '\\ge': '\\le' };
export const STRICT_SWAP: Record<Rel, Rel> = { '<': '\\le', '\\le': '<', '>': '\\ge', '\\ge': '>' };
export const isStrict = (r: Rel): boolean => r === '<' || r === '>';
export const isLess = (r: Rel): boolean => r === '<' || r === '\\le';

/** A (possibly unbounded) interval of the real line. */
export interface Interval {
  lo: number;
  hi: number;
  loOpen: boolean;
  hiOpen: boolean;
}

/**
 * Number line spanning the interesting points, with the solution set drawn
 * (thick accent segments/rays, open or closed dots at the endpoints).
 */
export function numberLineGraph(points: number[], set: Interval[]): { blank: Diagram; solved: Diagram } {
  const finite = points.filter((p) => Number.isFinite(p));
  const minP = finite.length ? Math.min(...finite) : 0;
  const maxP = finite.length ? Math.max(...finite) : 0;
  const center = Math.round((minP + maxP) / 2);
  let lo = Math.min(center - 5, Math.floor(minP) - 2);
  let hi = Math.max(center + 5, Math.ceil(maxP) + 2);
  if (hi - lo > 14) {
    lo = Math.floor(minP) - 2;
    hi = Math.ceil(maxP) + 2;
  }
  const blank = numberLine(lo, hi).build('Blank number line');
  const b = numberLine(lo, hi);
  const L = lo - 0.7;
  const H = hi + 0.7;
  for (const iv of set) {
    const s = Math.max(iv.lo, L);
    const e = Math.min(iv.hi, H);
    if (iv.hi === Infinity && iv.lo === -Infinity) b.arrow([L, 0], [H, 0], { ink: 'accent', weight: 3, both: true });
    else if (iv.hi === Infinity) b.arrow([s, 0], [H, 0], { ink: 'accent', weight: 3 });
    else if (iv.lo === -Infinity) b.arrow([e, 0], [L, 0], { ink: 'accent', weight: 3 });
    else b.segment([s, 0], [e, 0], { ink: 'accent', weight: 3 });
  }
  for (const iv of set) {
    if (Number.isFinite(iv.lo)) b.dot([iv.lo, 0], iv.loOpen, 'accent');
    if (Number.isFinite(iv.hi) && iv.hi !== iv.lo) b.dot([iv.hi, 0], iv.hiOpen, 'accent');
  }
  return { blank, solved: b.build('Number line with the solution graphed') };
}

// ---------------------------------------------------------------- lines

/** A line: y = m·x + b, or the vertical line x = c (m = null). */
export interface Line {
  m: Frac | null;
  b: Frac;
}

export const lineY = (m: FracLike, b: FracLike): Line => ({ m: Frac.of(m), b: Frac.of(b) });
export const lineX = (c: FracLike): Line => ({ m: null, b: Frac.of(c) });

/** `y = \frac{2}{3}x - 1`, `y = -4`, `x = 3`. */
export function slopeInterceptTex(l: Line, y = 'y', x = 'x'): string {
  if (l.m === null) return `${x} = ${num(l.b)}`;
  return `${y} = ${sum([{ coef: l.m, sym: x }, { coef: l.b }])}`;
}

/** Standard form A x + B y = C with integers, A ≥ 0 (B > 0 when A = 0), gcd 1. */
export function standardForm(l: Line): { A: number; B: number; C: number } {
  if (l.m === null) return { A: l.b.d, B: 0, C: l.b.n };
  // y = (p/q)x + (r/s)  ⇒  -p·s·x + q·s·y = r·q   (scaled to integers)
  const den = (l.m.d * l.b.d) / gcdInt(l.m.d, l.b.d);
  let A = -l.m.mul(den).value;
  let B = den;
  let C = l.b.mul(den).value;
  const g = gcdInt(gcdInt(A, B), C) || 1;
  A /= g;
  B /= g;
  C /= g;
  if (A < 0 || (A === 0 && B < 0)) {
    A = -A;
    B = -B;
    C = -C;
  }
  return { A, B, C };
}

function gcdInt(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

export function standardTex(A: number, B: number, C: number, x = 'x', y = 'y'): string {
  return `${sum([{ coef: A, sym: x }, { coef: B, sym: y }])} = ${C}`;
}

/** Draw a line across the window (role 'curve'), vertical lines included. */
export function drawLine(b: DiagramBuilder, l: Line, w: Window, style: { dash?: boolean } = {}): void {
  if (l.m === null) {
    const c = l.b.value;
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 40; i++) pts.push([c, w.y0 + ((w.y1 - w.y0) * i) / 40]);
    b.path(pts, { weight: 1.8, ink: 'accent', role: 'curve', ...style });
    return;
  }
  const m = l.m.value;
  const k = l.b.value;
  plot(b, (x) => m * x + k, w, style);
}

/** Two lattice points on the line inside ±r (for marking a graph), or null. */
export function latticePoints(l: Line, r: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  if (l.m === null) {
    if (!l.b.isInt()) return out;
    for (let y = -r; y <= r; y++) out.push([l.b.value, y]);
    return out;
  }
  for (let x = -r; x <= r; x++) {
    const y = l.m.mul(x).add(l.b);
    if (y.isInt() && Math.abs(y.value) <= r) out.push([x, y.value]);
  }
  return out;
}

/** Blank plane and plane with the given lines graphed. */
export function planeWith(range: number, draw: (b: DiagramBuilder, w: Window) => void, alt: string): { blank: Diagram; solved: Diagram } {
  const blank = graphPlane(range, 2).b.build('Blank coordinate plane');
  const { b, w } = graphPlane(range, 2);
  draw(b, w);
  return { blank, solved: b.build(alt) };
}

/** Value of y on the line at x. */
export function lineAt(l: Line, x: FracLike): Frac {
  if (l.m === null) throw new Error('vertical line');
  return l.m.mul(x).add(l.b);
}
