/**
 * Figure and expression helpers shared by the geometry generators: congruence
 * tick marks, angle arcs, parallel arrows, vertex names, random placement,
 * and "(ax + b)°"-style labels whose value at the solution is known.
 */
import { add, angleOf, centroid, DiagramBuilder, dirDeg, len, mid, mul, posToward, rotate, sub, unit, type Pt } from '../../diagram';
import { distinctDistractors, offset } from '../../generator';
import type { Rng } from '../../rng';
import { linear } from '../../tex';

// ---------------------------------------------------------------- placement

/** Rotate (by `turn` degrees) and optionally mirror a set of model points about their centroid. */
export function orient(pts: readonly Pt[], turn: number, flip: boolean): Pt[] {
  const c = centroid(pts);
  return pts.map((p) => {
    const q: Pt = flip ? [2 * c[0] - p[0], p[1]] : p;
    return rotate(q, turn, c);
  });
}

/** Random placement: a small tilt plus an optional mirror image. */
export function randomOrient(rng: Rng, pts: readonly Pt[], maxTurn = 20, allowFlip = true): Pt[] {
  return orient(pts, rng.int(-maxTurn, maxTurn), allowFlip && rng.bool());
}

/** Builder whose scale makes the larger extent of `pts` about `sizePx` pixels. */
export function fitted(pts: readonly Pt[], sizePx = 150): DiagramBuilder {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const ext = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1e-9);
  return new DiagramBuilder(sizePx / ext);
}

// ---------------------------------------------------------------- marks

/** `n` congruence tick marks across segment ac at its midpoint. */
export function ticks(b: DiagramBuilder, a: Pt, c: Pt, n = 1, at = 0.5): void {
  if (n <= 0) return;
  const m = add(a, mul(sub(c, a), at));
  const d = unit(sub(c, a));
  const nrm: Pt = [-d[1], d[0]];
  const gap = b.px(3.5);
  const h = b.px(5);
  for (let i = 0; i < n; i++) {
    const center = add(m, mul(d, (i - (n - 1) / 2) * gap));
    b.segment(add(center, mul(nrm, h)), add(center, mul(nrm, -h)), { weight: 1 });
  }
}

/** `n` concentric arcs marking congruent angles at v (between rays va and vc). */
export function angleMarks(b: DiagramBuilder, v: Pt, a: Pt, c: Pt, n = 1, radiusPx = 13): void {
  for (let i = 0; i < n; i++) b.angleArc(v, a, c, radiusPx + i * 3.5);
}

/** `n` arrowhead chevrons at the middle of segment ac, pointing from a to c (parallel marks). */
export function parallelMarks(b: DiagramBuilder, a: Pt, c: Pt, n = 1, at = 0.5): void {
  const d = unit(sub(c, a));
  const nrm: Pt = [-d[1], d[0]];
  const m = add(a, mul(sub(c, a), at));
  const s = b.px(5);
  for (let i = 0; i < n; i++) {
    const tip = add(m, mul(d, (i - (n - 1) / 2) * b.px(5) + s / 2));
    b.path([add(add(tip, mul(d, -s)), mul(nrm, s * 0.8)), tip, add(add(tip, mul(d, -s)), mul(nrm, -s * 0.8))], { weight: 1.1 });
  }
}

/** Names of points, each pushed away from `inside` (default: their centroid). */
export function nameVertices(b: DiagramBuilder, pts: readonly Pt[], labels: readonly string[], inside?: Pt, gapPx = 9): void {
  const c = inside ?? centroid(pts);
  pts.forEach((p, i) => {
    const away = sub(p, c);
    const dir = len(away) < 1e-9 ? ([0, 1] as Pt) : unit(away);
    b.label(add(p, mul(dir, b.px(gapPx))), labels[i]!, 'c');
  });
}

/** Label for one point, placed in direction `dir` (a vector) from it. */
export function nameAt(b: DiagramBuilder, p: Pt, label: string, dir: Pt, gapPx = 9): void {
  b.label(add(p, mul(unit(dir), b.px(gapPx))), label, 'c');
}

/** Approximate rendered width (px) of a label. */
export function labelWidthPx(tex: string): number {
  const plain = tex
    .replace(/\\sqrt\{([^}]*)\}/g, '√$1')
    .replace(/\^\\circ/g, '°')
    .replace(/\\[a-zA-Z]+/g, '')
    .replace(/[{}]/g, '');
  return plain.length * 13 * 0.6 + 2;
}

/**
 * Angle arc at v from ray va to ray vc, with `tex` placed inside the angle
 * along its bisector, far enough out that the label clears both rays.
 */
export function angleLabel(b: DiagramBuilder, v: Pt, a: Pt, c: Pt, tex: string, opts: { radiusPx?: number; arc?: boolean; minPx?: number; maxPx?: number } = {}): void {
  if (opts.arc !== false) b.angleArc(v, a, c, opts.radiusPx ?? 15);
  const u1 = unit(sub(a, v));
  const u2 = unit(sub(c, v));
  const cos = Math.max(-1, Math.min(1, u1[0] * u2[0] + u1[1] * u2[1]));
  const half = Math.acos(cos) / 2;
  const w = labelWidthPx(tex);
  const need = (w / 2 + 7) / Math.max(Math.sin(half), 0.15);
  const dist = Math.min(opts.maxPx ?? 95, Math.max(opts.minPx ?? (opts.radiusPx ?? 15) + 13, need));
  const bis = DiagramBuilder.bisector(v, a, c);
  b.label(add(v, mul(bis, b.px(dist))), tex, 'c');
}

/** Label placed beside segment ac (outside, relative to `inside`), offset further for long labels. */
export function sideText(b: DiagramBuilder, a: Pt, c: Pt, tex: string, inside: Pt): void {
  b.sideLabel(a, c, tex, inside);
}

/** Line through p and q drawn past both points with arrowheads. */
export function line(b: DiagramBuilder, p: Pt, q: Pt, extend = 0.25, opts: { weight?: number; ink?: 'ink' | 'accent' | 'muted' } = {}): void {
  const d = sub(q, p);
  b.arrow(add(p, mul(d, -extend)), add(q, mul(d, extend)), { both: true, weight: opts.weight ?? 1.3, ink: opts.ink });
}

/** Ray from p through q (arrowhead beyond q). */
export function ray(b: DiagramBuilder, p: Pt, q: Pt, extend = 0.2): void {
  b.arrow(p, add(q, mul(sub(q, p), extend)), { weight: 1.3 });
}

export { add, angleOf, centroid, dirDeg, len, mid, mul, posToward, rotate, sub, unit };

// ---------------------------------------------------------------- measures

/** Angle at v between rays va and vc, in degrees (0…180). */
export function angleAt(a: Pt, v: Pt, c: Pt): number {
  const u = sub(a, v);
  const w = sub(c, v);
  const cos = (u[0] * w[0] + u[1] * w[1]) / (len(u) * len(w));
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

export const dist = (a: Pt, b: Pt): number => len(sub(a, b));

/** Point at angle `deg` on the circle (c, r). */
export const onCircle = (c: Pt, r: number, deg: number): Pt => add(c, mul(dirDeg(deg), r));

// ---------------------------------------------------------------- expressions

export interface Lin {
  a: number;
  b: number;
}

/** LaTeX of a·v + b. */
export const linTex = (e: Lin, v = 'x'): string => linear(e.a, e.b, v);

/** Value of a·x + b. */
export const linVal = (e: Lin, x: number): number => e.a * x + e.b;

/**
 * A linear expression a·x + b (a in [aMin, aMax]) that equals `value` at `x`,
 * with |b| ≤ bMax and b ≠ 0 unless `allowZeroB`.
 */
export function linFor(rng: Rng, value: number, x: number, opts: { aMin?: number; aMax?: number; bMax?: number; allowZeroB?: boolean; avoidA?: number[] } = {}): Lin | null {
  const aMin = opts.aMin ?? 1;
  const aMax = opts.aMax ?? 5;
  const bMax = opts.bMax ?? 60;
  const choices: number[] = [];
  for (let a = aMin; a <= aMax; a++) if (!(opts.avoidA ?? []).includes(a)) choices.push(a);
  for (const a of rng.shuffle(choices)) {
    const b = value - a * x;
    if (Math.abs(b) > bMax) continue;
    if (b === 0 && !opts.allowZeroB && a === 1) continue;
    if (b === 0 && !opts.allowZeroB) continue;
    return { a, b };
  }
  return null;
}

/** Degree label: `40^\circ`, `x^\circ`, `3x^\circ`, `(3x + 5)^\circ`. */
export function degTex(e: string): string {
  return /^[-\d]*[a-z]?$/.test(e) ? `${e}^\\circ` : `(${e})^\\circ`;
}

/** Degree label of a linear expression. */
export const linDeg = (e: Lin, v = 'x'): string => degTex(linTex(e, v));

/** Name of three-letter angle at the middle letter: `\angle ABC`. */
export const angleName = (p: string, v: string, q: string): string => `\\angle ${p}${v}${q}`;

/** Letters for figures; avoid I and O. */
export const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'.split('');

/** `k` distinct consecutive-looking letters, e.g. ["J", "K", "L"]. */
export function letters(rng: Rng, k: number): string[] {
  const start = rng.int(0, LETTERS.length - k);
  return LETTERS.slice(start, start + k);
}

/** `k` distinct random letters. */
export function randomLetters(rng: Rng, k: number, exclude: readonly string[] = []): string[] {
  return rng.sample(
    LETTERS.filter((l) => !exclude.includes(l) && l !== 'X'),
    k,
  );
}

/** Solve-for-x answer like `x = 7`. */
export const eqTex = (lhs: string, value: string): string => `${lhs} = ${value}`;

// ---------------------------------------------------------------- choices

/** Integer-valued wrong answers (common mistakes), deduplicated and topped up with nearby values. */
export function numChoices(fmt: (v: number) => string, correct: number, wrongs: ReadonlyArray<number | null | undefined>, opts: { step?: number; integer?: boolean; positive?: boolean } = {}): string[] {
  const integer = opts.integer ?? Number.isInteger(correct);
  const ok = (w: number | null | undefined): w is number =>
    w !== null && w !== undefined && Number.isFinite(w) && Math.abs(w - correct) > 1e-9 && (!integer || Math.abs(w - Math.round(w)) < 1e-9) && (opts.positive === false || w > 0);
  const ans = fmt(correct);
  const step = opts.step ?? 1;
  return distinctDistractors(
    ans,
    wrongs.filter(ok).map((w) => fmt(integer ? Math.round(w) : w)),
    (k) => {
      const v = correct + offset(k) * step;
      return opts.positive === false || v > 0 ? fmt(v) : null;
    },
  );
}

/** Substitution `3(4) - 5` for a·x + b at x (x shown in parentheses). */
export function linSubTex(e: Lin, x: number): string {
  const xs = x < 0 ? `(${x})` : String(x);
  const head = e.a === 1 ? xs : e.a === -1 ? `-${xs}` : `${e.a}(${x})`;
  return e.b === 0 ? head : `${head} ${e.b < 0 ? '-' : '+'} ${Math.abs(e.b)}`;
}
