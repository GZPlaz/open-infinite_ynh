/** Figures shared by the trigonometry generators. */
import { add, DiagramBuilder, dirDeg, mul, rotate, sub, unit, type Diagram, type Pt, type Window } from '../../diagram';
import { Frac } from '../../fraction';
import type { Rng } from '../../rng';
import { piLabel } from './exact';

// ---------------------------------------------------------------- oblique triangles

export interface Tri {
  /** Angles in degrees. */
  A: number;
  B: number;
  C: number;
  a: number;
  b: number;
  c: number;
}

export interface TriLabels {
  names: [string, string, string];
  /** Labels for the sides opposite A, B, C (empty = unlabelled). */
  sides: [string, string, string];
  /** Labels for the angles at A, B, C (empty = no arc). */
  angles: [string, string, string];
}

/** A triangle drawn to scale with vertex names, side lengths and angle marks. */
export function triangleFigure(rng: Rng, t: Tri, labels: TriLabels, alt: string): Diagram {
  const rad = (d: number) => (d * Math.PI) / 180;
  let P: Pt[] = [
    [0, 0],
    [t.c, 0],
    [t.b * Math.cos(rad(t.A)), t.b * Math.sin(rad(t.A))],
  ];
  const turn = rng.int(-25, 25);
  const flip = rng.bool();
  P = P.map((p) => rotate(flip ? [-p[0], p[1]] : p, turn));
  const xs = P.map((p) => p[0]);
  const ys = P.map((p) => p[1]);
  const extent = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const b = new DiagramBuilder(170 / extent);
  const inside: Pt = [(P[0]![0] + P[1]![0] + P[2]![0]) / 3, (P[0]![1] + P[1]![1] + P[2]![1]) / 3];
  b.polygon(P, { weight: 1.4 });
  const angles = [t.A, t.B, t.C];
  for (let i = 0; i < 3; i++) {
    const v = P[i]!;
    const p = P[(i + 1) % 3]!;
    const q = P[(i + 2) % 3]!;
    const away = add(v, mul(unit(sub(v, inside)), b.px(11)));
    b.label(away, labels.names[i]!, 'c');
    if (Math.abs(angles[i]! - 90) < 1e-9) b.rightAngle(v, p, q, 10);
    else if (labels.angles[i]) {
      const r = angles[i]! < 35 ? 26 : 18;
      b.angleArc(v, p, q, r);
      const dir = DiagramBuilder.bisector(v, p, q);
      const dist = angles[i]! < 35 ? 44 : angles[i]! > 100 ? 26 : 34;
      b.label(add(v, mul(dir, b.px(dist))), labels.angles[i]!, 'c', { small: true });
    }
    // side opposite vertex i joins the other two vertices
    if (labels.sides[i]) b.sideLabel(p, q, labels.sides[i]!, inside);
  }
  return b.build(alt);
}

// ---------------------------------------------------------------- standard position

export interface StdPositionFigure {
  /** Angle in degrees (any real); drawn with a rotation spiral. */
  deg?: number;
  /** Label for the rotation (e.g. `\theta`). */
  thetaLabel?: string;
  /** Reference-angle arc and label between the terminal side and the x-axis. */
  refLabel?: string;
}

/** Axes, terminal side and rotation arrow for an angle in standard position. */
export function standardPosition(f: StdPositionFigure, alt: string): Diagram {
  const b = new DiagramBuilder(58);
  const R = 1.35;
  b.arrow([-R, 0], [R, 0], { both: true, ink: 'axis', weight: 1 });
  b.arrow([0, -R], [0, R], { both: true, ink: 'axis', weight: 1 });
  b.label([R, 0], 'x', 'e', { ink: 'axis' });
  b.label([0, R], 'y', 'n', { ink: 'axis' });
  if (f.deg !== undefined) {
    const d = f.deg;
    b.segment([0, 0], [1.2, 0], { weight: 1.6 });
    b.arrow([0, 0], mul(dirDeg(d), 1.2), { ink: 'accent', weight: 1.6 });
    // spiral from the initial side to the terminal side
    const turns = Math.abs(d) / 360;
    const r0 = 0.22;
    const growth = turns > 1 ? 0.5 / turns : 0.12;
    const n = Math.max(12, Math.ceil(Math.abs(d) / 4));
    const pts: Pt[] = [];
    for (let i = 0; i <= n; i++) {
      const a = (d * i) / n;
      pts.push(mul(dirDeg(a), r0 + (growth * Math.abs(a)) / 360));
    }
    b.path(pts, { ink: 'accent', weight: 1 });
    const last = pts[pts.length - 1]!;
    const prev = pts[pts.length - 2]!;
    b.arrow(prev, last, { ink: 'accent', weight: 1 });
    if (f.thetaLabel) {
      const mid = pts[Math.floor(n / Math.max(2, 2 * Math.ceil(turns)))]!;
      b.label(mul(mid, 1 + b.px(12) / Math.hypot(mid[0], mid[1])), f.thetaLabel, 'c', { ink: 'accent' });
    }
    if (f.refLabel) {
      const a = ((d % 360) + 360) % 360;
      const axis = a < 90 || a > 270 ? 0 : 180;
      const r = 0.72;
      const lo = Math.min(a, axis === 0 && a > 270 ? 360 : axis);
      const hi = Math.max(a, axis === 0 && a > 270 ? 360 : axis);
      b.arc([0, 0], r, lo, hi, 'ink', 1);
      b.label(mul(dirDeg((lo + hi) / 2), r + b.px(16)), f.refLabel, 'c', { small: true });
    }
  }
  return b.build(alt);
}

// ---------------------------------------------------------------- radian graphs

/**
 * Graph paper whose x-axis is marked in multiples of π/2 (1 unit = 1 radian),
 * with an integer y-grid; the window is [x0, x1] × [-yr, yr].
 */
export function radianPlane(halfTurns: [number, number], yr: number, scale = 22): { b: DiagramBuilder; w: Window } {
  const [k0, k1] = halfTurns; // x-range in multiples of π/2
  const x0 = (k0 * Math.PI) / 2;
  const x1 = (k1 * Math.PI) / 2;
  const b = new DiagramBuilder(scale);
  for (let k = 2 * k0; k <= 2 * k1; k++) {
    if (k === 0) continue;
    const x = (k * Math.PI) / 4;
    b.segment([x, -yr], [x, yr], { ink: 'grid', weight: k % 2 === 0 ? 0.6 : 0.3 });
  }
  for (let y = -yr; y <= yr; y++) if (y !== 0) b.segment([x0, y], [x1, y], { ink: 'grid', weight: 0.5 });
  b.arrow([x0 - 0.4, 0], [x1 + 0.4, 0], { both: true, ink: 'axis', weight: 1 });
  b.arrow([0, -yr - 0.4], [0, yr + 0.4], { both: true, ink: 'axis', weight: 1 });
  b.label([x1 + 0.4, 0], 'x', 'e', { ink: 'axis' });
  b.label([0, yr + 0.4], 'y', 'n', { ink: 'axis' });
  for (let k = k0; k <= k1; k++) {
    if (k === 0) continue;
    b.label([(k * Math.PI) / 2, 0], piLabel(new Frac(k, 2)), 's', { ink: 'muted', small: true });
  }
  const every = yr > 6 ? 2 : 1;
  for (let y = every; y <= yr; y += every) {
    b.label([0, y], String(y), 'w', { ink: 'muted', small: true });
    b.label([0, -y], String(-y), 'w', { ink: 'muted', small: true });
  }
  return { b, w: { x0, x1, y0: -yr, y1: yr } };
}

// ---------------------------------------------------------------- sectors

/** A circle sector with radius and central-angle labels. */
export function sectorFigure(rng: Rng, deg: number, rLabel: string, angleLabel: string, alt: string): Diagram {
  const b = new DiagramBuilder(62);
  const start = rng.int(0, 11) * 30 + rng.int(-10, 10);
  const end = start + deg;
  const O: Pt = [0, 0];
  b.circle(O, 1, { ink: 'muted', weight: 0.8, dash: true });
  const pts: Pt[] = [O];
  const n = Math.max(8, Math.ceil(deg / 4));
  for (let i = 0; i <= n; i++) pts.push(dirDeg(start + (deg * i) / n));
  b.polygon(pts, { fill: 'accent', weight: 1.4 });
  b.dot(O);
  // radius label on the first radius
  const p1 = dirDeg(start);
  const nrm: Pt = deg <= 180 ? rotate(p1, -90) : rotate(p1, 90);
  b.label(add(mul(p1, 0.55), mul(nrm, b.px(9))), rLabel, 'c', { small: false });
  const midDir = dirDeg(start + deg / 2);
  b.arc(O, 0.24, start, end, 'ink', 1);
  b.label(mul(midDir, deg < 50 ? 0.62 : 0.42), angleLabel, 'c', { small: true });
  return b.build(alt);
}
