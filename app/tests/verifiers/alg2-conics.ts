/**
 * Verifiers for the conic-sections pack. Every check works from the RENDERED
 * strings: the conic's coefficients are recovered by evaluating the printed
 * equation at sample points, its features are recomputed from them and
 * compared with the printed answer (or the printed givens), and defining
 * distance properties (focus/directrix, focal sums and differences) are
 * checked on points of the curve.
 */
import { expect } from 'vitest';
import type { ProblemContent } from '../../src/engine/types';
import { curvePoints, type Verifier } from '../verify';
import { evalReal, listItems, mathSegments, splitTop } from '../evaluator';

type P2 = [number, number];
/** a·x + b·y + c = 0 */
type Line = [number, number, number];
/** A x² + B xy + C y² + D x + E y + F */
interface Q {
  A: number;
  B: number;
  C: number;
  D: number;
  E: number;
  F: number;
}

const TOL = 1e-6;
const near = (a: number, b: number, tol = TOL) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

function sidesOf(eq: string): [string, string] {
  const { parts, rels } = splitTop(eq, ['=']);
  expect(rels.length, `one '=' in ${eq}`).toBe(1);
  return [parts[0]!, parts[1]!];
}

/** G(x, y) = left − right of a rendered equation. */
function fnOf(eq: string): (x: number, y: number) => number {
  const [l, r] = sidesOf(eq);
  return (x, y) => evalReal(l, { vars: { x, y } }) - evalReal(r, { vars: { x, y } });
}

const qEval = (q: Q, x: number, y: number) => q.A * x * x + q.B * x * y + q.C * y * y + q.D * x + q.E * y + q.F;

/** Coefficients of a second-degree equation, recovered from its values (and checked at other points). */
function coeffs(eq: string): Q {
  const g = fnOf(eq);
  const F = g(0, 0);
  const px = g(1, 0);
  const mx = g(-1, 0);
  const py = g(0, 1);
  const my = g(0, -1);
  const A = (px + mx) / 2 - F;
  const D = (px - mx) / 2;
  const C = (py + my) / 2 - F;
  const E = (py - my) / 2;
  const B = g(1, 1) - A - C - D - E - F;
  const raw: Q = { A, B, C, D, E, F };
  const scale = Math.max(...Object.values(raw).map(Math.abs));
  expect(scale, `non-trivial equation ${eq}`).toBeGreaterThan(1e-9);
  const q = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Math.abs(v / scale) < 1e-10 ? 0 : v / scale])) as unknown as Q;
  for (const [x, y] of [
    [2.3, -1.7],
    [-3.1, 2.9],
    [0.7, 4.3],
    [-5.2, -2.4],
  ] as P2[]) {
    expect(Math.abs(g(x, y) / scale - qEval(q, x, y)), `second-degree in x, y: ${eq}`).toBeLessThan(1e-7 * (1 + x * x + y * y));
  }
  return q;
}

/** a·x + b·y + c = 0 from a rendered linear equation. */
function lineOf(eq: string): Line {
  const g = fnOf(eq);
  const c = g(0, 0);
  const a = g(1, 0) - c;
  const b = g(0, 1) - c;
  expect(Math.abs(g(2.7, -1.9) - (2.7 * a - 1.9 * b + c)), `linear: ${eq}`).toBeLessThan(1e-7 * (1 + Math.abs(a) + Math.abs(b) + Math.abs(c)));
  expect(Math.abs(a) + Math.abs(b), `line ${eq}`).toBeGreaterThan(1e-9);
  return [a, b, c];
}

function sameLine(l: Line, m: Line): boolean {
  const n1 = Math.hypot(...l);
  const n2 = Math.hypot(...m);
  const tol = 1e-7 * n1 * n2;
  return Math.abs(l[0] * m[1] - l[1] * m[0]) <= tol && Math.abs(l[0] * m[2] - l[2] * m[0]) <= tol && Math.abs(l[1] * m[2] - l[2] * m[1]) <= tol;
}

function pointOf(tex: string): P2 {
  const items = listItems(tex);
  expect(items.length, `ordered pair ${tex}`).toBe(2);
  return [evalReal(items[0]!), evalReal(items[1]!)];
}

const samePt = (a: P2, b: P2) => near(a[0], b[0]) && near(a[1], b[1]);
const dist = (a: P2, b: P2) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const lineDist = (p: P2, l: Line) => Math.abs(l[0] * p[0] + l[1] * p[1] + l[2]) / Math.hypot(l[0], l[1]);

function sameSet<T>(got: T[], want: T[], eq: (a: T, b: T) => boolean, what: string): void {
  expect(got.length, `${what}: count`).toBe(want.length);
  const left = [...want];
  for (const g of got) {
    const k = left.findIndex((w) => eq(g, w));
    expect(k, `${what}: unexpected ${JSON.stringify(g)}`).toBeGreaterThanOrEqual(0);
    left.splice(k, 1);
  }
}

// ---------------------------------------------------------------- canonical features

interface Canon {
  type: 'parabola' | 'circle' | 'ellipse' | 'hyperbola';
  center?: P2;
  vertex?: P2;
  focus?: P2;
  directrix?: Line;
  axis?: Line;
  opens?: string;
  radius?: number;
  vertices?: P2[];
  covertices?: P2[];
  foci?: P2[];
  major?: number;
  minor?: number;
  transverse?: number;
  conjugate?: number;
  asymptotes?: Line[];
  /** Points on the curve. */
  samples: P2[];
}

function analyze(q: Q, what: string): Canon {
  expect(Math.abs(q.B), `no xy term: ${what}`).toBeLessThan(1e-9);
  const z = (v: number) => Math.abs(v) < 1e-9;
  expect(z(q.A) && z(q.C), `second degree: ${what}`).toBe(false);
  if (z(q.A) || z(q.C)) {
    const ts = [-3, -2, -1, -0.5, 0.5, 1, 2, 3];
    if (z(q.C)) {
      expect(z(q.E), `parabola needs a y term: ${what}`).toBe(false);
      const a = -q.A / q.E;
      const h = -q.D / (2 * q.A);
      const k = -(q.A * h * h + q.D * h + q.F) / q.E;
      const p = 1 / (4 * a);
      return {
        type: 'parabola',
        vertex: [h, k],
        focus: [h, k + p],
        directrix: [0, 1, -(k - p)],
        axis: [1, 0, -h],
        opens: a > 0 ? 'up' : 'down',
        samples: ts.map((t) => [h + t, k + a * t * t]),
      };
    }
    expect(z(q.D), `parabola needs an x term: ${what}`).toBe(false);
    const a = -q.C / q.D;
    const k = -q.E / (2 * q.C);
    const h = -(q.C * k * k + q.E * k + q.F) / q.D;
    const p = 1 / (4 * a);
    return {
      type: 'parabola',
      vertex: [h, k],
      focus: [h + p, k],
      directrix: [1, 0, -(h - p)],
      axis: [0, 1, -k],
      opens: a > 0 ? 'right' : 'left',
      samples: ts.map((t) => [h + a * t * t, k + t]),
    };
  }
  const h = -q.D / (2 * q.A);
  const k = -q.E / (2 * q.C);
  const R = q.A * h * h + q.C * k * k - q.F;
  const rx2 = R / q.A;
  const ry2 = R / q.C;
  const center: P2 = [h, k];
  const ts = Array.from({ length: 12 }, (_, i) => (i * Math.PI) / 6 + 0.1);
  expect(!z(rx2) && !z(ry2) && (rx2 > 0 || ry2 > 0), `non-degenerate conic: ${what}`).toBe(true);
  if (rx2 > 0 && ry2 > 0) {
    const rx = Math.sqrt(rx2);
    const ry = Math.sqrt(ry2);
    const samples = ts.map((t) => [h + rx * Math.cos(t), k + ry * Math.sin(t)] as P2);
    if (near(rx2, ry2, 1e-9)) return { type: 'circle', center, radius: rx, samples };
    const c = Math.sqrt(Math.abs(rx2 - ry2));
    const wide = rx2 > ry2;
    return {
      type: 'ellipse',
      center,
      vertices: wide ? [[h - rx, k], [h + rx, k]] : [[h, k - ry], [h, k + ry]],
      covertices: wide ? [[h, k - ry], [h, k + ry]] : [[h - rx, k], [h + rx, k]],
      foci: wide ? [[h - c, k], [h + c, k]] : [[h, k - c], [h, k + c]],
      major: 2 * Math.max(rx, ry),
      minor: 2 * Math.min(rx, ry),
      samples,
    };
  }
  const xT = rx2 > 0;
  const a = Math.sqrt(Math.abs(xT ? rx2 : ry2));
  const b = Math.sqrt(Math.abs(xT ? ry2 : rx2));
  const c = Math.hypot(a, b);
  const s = xT ? b / a : a / b;
  const us = [-1.5, -0.7, 0, 0.6, 1.4];
  const samples: P2[] = us.flatMap((u) =>
    [1, -1].map((sg) => (xT ? [h + sg * a * Math.cosh(u), k + b * Math.sinh(u)] : [h + a * Math.sinh(u) * (b / a), k + sg * a * Math.cosh(u)]) as P2),
  );
  return {
    type: 'hyperbola',
    center,
    vertices: xT ? [[h - a, k], [h + a, k]] : [[h, k - a], [h, k + a]],
    foci: xT ? [[h - c, k], [h + c, k]] : [[h, k - c], [h, k + c]],
    transverse: 2 * a,
    conjugate: 2 * b,
    asymptotes: [
      [s, -1, k - s * h],
      [-s, -1, k + s * h],
    ],
    samples,
  };
}

// ---------------------------------------------------------------- labelled fields

interface Field {
  math: string[];
  text: string;
}

/** `Label: $…$; Label: $…$ and $…$; Label: word` → map of lower-case labels. */
function parseFields(rich: string): Map<string, Field> {
  const parts: string[] = [];
  let inMath = false;
  let cur = '';
  for (let i = 0; i < rich.length; i++) {
    const ch = rich[i]!;
    if (ch === '$' && rich[i - 1] !== '\\') inMath = !inMath;
    if (ch === ';' && !inMath) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  parts.push(cur);
  const out = new Map<string, Field>();
  for (const part of parts) {
    const k = part.indexOf(':');
    expect(k, `labelled field: ${part}`).toBeGreaterThan(0);
    const label = part.slice(0, k).trim().toLowerCase();
    const body = part.slice(k + 1);
    out.set(label, { math: mathSegments(body), text: body.replace(/\$[^$]*\$/g, '').replace(/\band\b/g, '').trim().toLowerCase() });
  }
  return out;
}

const one = (f: Field, what: string) => {
  expect(f.math.length, `${what}: one math item`).toBe(1);
  return f.math[0]!;
};
const valueOf = (tex: string) => evalReal(tex.replace(/^.*=/, ''));

/** Compare a stated feature with the recomputed one. Returns false for an unknown label. */
function checkFeature(label: string, f: Field, c: Canon, what: string): boolean {
  const ctx = `${what} [${label}]`;
  const pts = () => f.math.map(pointOf);
  switch (label) {
    case 'vertex':
      if (c.type === 'parabola') expect(samePt(pointOf(one(f, ctx)), c.vertex!), ctx).toBe(true);
      else expect(c.vertices!.some((v) => samePt(v, pointOf(one(f, ctx)))), ctx).toBe(true);
      return true;
    case 'focus':
      if (c.type === 'parabola') expect(samePt(pointOf(one(f, ctx)), c.focus!), ctx).toBe(true);
      else expect(c.foci!.some((v) => samePt(v, pointOf(one(f, ctx)))), ctx).toBe(true);
      return true;
    case 'co-vertex':
      expect(c.covertices!.some((v) => samePt(v, pointOf(one(f, ctx)))), ctx).toBe(true);
      return true;
    case 'directrix':
      expect(sameLine(lineOf(one(f, ctx)), c.directrix!), ctx).toBe(true);
      return true;
    case 'axis of symmetry':
      expect(sameLine(lineOf(one(f, ctx)), c.axis!), ctx).toBe(true);
      return true;
    case 'opens':
      expect(f.text, ctx).toBe(c.opens);
      return true;
    case 'center':
      expect(samePt(pointOf(one(f, ctx)), c.center!), ctx).toBe(true);
      return true;
    case 'radius':
      expect(near(valueOf(one(f, ctx)), c.radius!), ctx).toBe(true);
      return true;
    case 'vertices':
      sameSet(pts(), c.vertices!, samePt, ctx);
      return true;
    case 'co-vertices':
      sameSet(pts(), c.covertices!, samePt, ctx);
      return true;
    case 'foci':
      sameSet(pts(), c.foci!, samePt, ctx);
      return true;
    case 'major axis length':
      expect(near(valueOf(one(f, ctx)), c.major!), ctx).toBe(true);
      return true;
    case 'minor axis length':
      expect(near(valueOf(one(f, ctx)), c.minor!), ctx).toBe(true);
      return true;
    case 'transverse axis length':
      expect(near(valueOf(one(f, ctx)), c.transverse!), ctx).toBe(true);
      return true;
    case 'conjugate axis length':
      expect(near(valueOf(one(f, ctx)), c.conjugate!), ctx).toBe(true);
      return true;
    case 'asymptotes':
      sameSet(f.math.map(lineOf), c.asymptotes!, sameLine, ctx);
      return true;
    default:
      return false;
  }
}

/** Defining distance properties, using the stated features, on points of the curve G = 0. */
function definingProperty(fields: Map<string, Field>, c: Canon, g: (x: number, y: number) => number, gScale: number, what: string): void {
  for (const s of c.samples) expect(Math.abs(g(s[0], s[1])) / gScale, `sample on curve: ${what}`).toBeLessThan(1e-7 * (1 + s[0] ** 2 + s[1] ** 2));
  const get = (l: string) => fields.get(l);
  if (c.type === 'parabola' && get('focus') && get('directrix')) {
    const F = pointOf(get('focus')!.math[0]!);
    const L = lineOf(get('directrix')!.math[0]!);
    for (const s of c.samples) expect(near(dist(s, F), lineDist(s, L)), `PF = Pd: ${what}`).toBe(true);
  }
  if (c.type === 'circle' && get('center') && get('radius')) {
    const C0 = pointOf(get('center')!.math[0]!);
    const r = valueOf(get('radius')!.math[0]!);
    for (const s of c.samples) expect(near(dist(s, C0), r), `|PC| = r: ${what}`).toBe(true);
  }
  if ((c.type === 'ellipse' || c.type === 'hyperbola') && get('foci')?.math.length === 2) {
    const [F1, F2] = get('foci')!.math.map(pointOf) as [P2, P2];
    const len = c.type === 'ellipse' ? (get('major axis length') ? valueOf(get('major axis length')!.math[0]!) : c.major!) : get('vertices') ? dist(...(get('vertices')!.math.map(pointOf) as [P2, P2])) : c.transverse!;
    for (const s of c.samples) {
      const v = c.type === 'ellipse' ? dist(s, F1) + dist(s, F2) : Math.abs(dist(s, F1) - dist(s, F2));
      expect(near(v, len), `focal ${c.type === 'ellipse' ? 'sum' : 'difference'} = ${len}: ${what}`).toBe(true);
    }
  }
}

const REQUIRED: Record<Canon['type'], string[]> = {
  parabola: ['vertex', 'focus', 'directrix', 'axis of symmetry', 'opens'],
  circle: ['center', 'radius'],
  ellipse: ['center', 'vertices', 'co-vertices', 'foci', 'major axis length', 'minor axis length'],
  hyperbola: ['center', 'vertices', 'foci', 'asymptotes'],
};

function gScaleOf(eq: string): number {
  const g = fnOf(eq);
  return Math.max(1e-12, ...[[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1]].map(([x, y]) => Math.abs(g(x!, y!))));
}

/** Graphed curve on G = 0; dashed guide lines (directrix, asymptotes) on the stated lines. */
function checkFigure(p: ProblemContent, eq: string, lines: Line[]): void {
  if (!p.answerDiagram) return;
  const g = fnOf(eq);
  const sc = gScaleOf(eq);
  const pts = curvePoints(p.answerDiagram);
  expect(pts.length, 'curve drawn').toBeGreaterThan(5);
  for (const [x, y] of pts) expect(Math.abs(g(x, y)) / sc, `(${x}, ${y}) on ${eq}`).toBeLessThan(1e-7 * (1 + x * x + y * y));
  for (const it of p.answerDiagram.items) {
    if (it.t !== 'path' || !it.dash) continue;
    for (const pt of it.pts) expect(lines.some((l) => lineDist(pt as P2, l) < 1e-6), `dashed line point ${pt.join(', ')} on a stated line`).toBe(true);
  }
}

// ---------------------------------------------------------------- systems

function solveSystem(q1: Q, q2: Q): P2[] {
  const isLine = (q: Q) => Math.abs(q.A) + Math.abs(q.B) + Math.abs(q.C) < 1e-9;
  if (isLine(q1) || isLine(q2)) {
    const [l, o] = isLine(q1) ? [q1, q2] : [q2, q1];
    const param = Math.abs(l.E) >= Math.abs(l.D) ? (t: number): P2 => [t, -(l.D * t + l.F) / l.E] : (t: number): P2 => [-(l.E * t + l.F) / l.D, t];
    const f = (t: number) => qEval(o, ...param(t));
    const f0 = f(0);
    const a = (f(1) + f(-1)) / 2 - f0;
    const b = (f(1) - f(-1)) / 2;
    const sc = Math.max(Math.abs(a), Math.abs(b), Math.abs(f0));
    if (Math.abs(a) < 1e-9 * sc) return Math.abs(b) < 1e-9 * sc ? [] : [param(-f0 / b)];
    const disc = b * b - 4 * a * f0;
    if (disc < -1e-9 * sc * sc) return [];
    if (Math.abs(disc) <= 1e-9 * sc * sc) return [param(-b / (2 * a))];
    const r = Math.sqrt(disc);
    return [param((-b + r) / (2 * a)), param((-b - r) / (2 * a))];
  }
  // Newton's method from a grid of starting points
  const roots: P2[] = [];
  for (let sx = -13; sx <= 13; sx += 1.3) {
    for (let sy = -13; sy <= 13; sy += 1.3) {
      let x = sx;
      let y = sy;
      for (let it = 0; it < 60; it++) {
        const f1 = qEval(q1, x, y);
        const f2 = qEval(q2, x, y);
        const a11 = 2 * q1.A * x + q1.B * y + q1.D;
        const a12 = q1.B * x + 2 * q1.C * y + q1.E;
        const a21 = 2 * q2.A * x + q2.B * y + q2.D;
        const a22 = q2.B * x + 2 * q2.C * y + q2.E;
        const det = a11 * a22 - a12 * a21;
        if (Math.abs(det) < 1e-14) break;
        const dx = (f1 * a22 - f2 * a12) / det;
        const dy = (a11 * f2 - a21 * f1) / det;
        x -= dx;
        y -= dy;
        if (Math.abs(dx) + Math.abs(dy) < 1e-13) break;
      }
      if (Math.abs(qEval(q1, x, y)) < 1e-9 && Math.abs(qEval(q2, x, y)) < 1e-9 && !roots.some((r) => Math.hypot(r[0] - x, r[1] - y) < 1e-5)) roots.push([x, y]);
    }
  }
  return roots;
}

function systemRows(question: string): string[] {
  const math = mathSegments(question).join(' ');
  return math
    .replace(/\\begin\{aligned\}|\\end\{aligned\}|\\left\\\{|\\right\.|\\begin\{cases\}|\\end\{cases\}/g, '')
    .split('\\\\')
    .map((r) => r.replace(/&/g, '').trim())
    .filter(Boolean);
}

const NO_SOLUTION = /no solution/i;

export const VERIFIERS: Record<string, Verifier> = {
  /** Features of the conic in the question, recomputed from its coefficients; graph on the curve. */
  'alg2-conics.props'(p) {
    const eq = mathSegments(p.question)[0]!;
    const c = analyze(coeffs(eq), eq);
    expect(c.type, eq).toBe(p.check!.conic);
    const f = parseFields(p.answer);
    for (const label of REQUIRED[c.type]) expect(f.has(label), `${p.answer} states ${label}`).toBe(true);
    for (const [label, field] of f) expect(checkFeature(label, field, c, `${eq} → ${p.answer}`), `known label ${label}`).toBe(true);
    definingProperty(f, c, fnOf(eq), gScaleOf(eq), `${eq} → ${p.answer}`);
    const lines = [...(f.get('directrix')?.math ?? []), ...(f.get('asymptotes')?.math ?? [])].map(lineOf);
    checkFigure(p, eq, lines);
  },

  /** The answer equation's features agree with every given in the question. */
  'alg2-conics.write'(p) {
    const segs = mathSegments(p.answer);
    expect(segs.length, p.answer).toBe(1);
    const eq = segs[0]!;
    const c = analyze(coeffs(eq), eq);
    expect(c.type, eq).toBe(p.check!.conic);
    const g = fnOf(eq);
    const sc = gScaleOf(eq);
    const what = `${p.question} → ${p.answer}`;
    const f = parseFields(p.question);
    expect(f.size, what).toBeGreaterThanOrEqual(2);
    for (const [label, field] of f) {
      if (checkFeature(label, field, c, what)) continue;
      if (label === 'passes through' || label === 'diameter endpoints') {
        for (const s of field.math.map(pointOf)) expect(Math.abs(g(...s)) / sc, `${what}: ${label}`).toBeLessThan(1e-7 * (1 + s[0] ** 2 + s[1] ** 2));
        if (label === 'diameter endpoints') {
          const [a, b] = field.math.map(pointOf) as [P2, P2];
          expect(field.math.length).toBe(2);
          expect(samePt([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], c.center!), `${what}: midpoint is the center`).toBe(true);
        }
      } else if (label === 'tangent to') {
        expect(near(lineDist(c.center!, lineOf(one(field, what))), c.radius!), `${what}: tangent`).toBe(true);
      } else throw new Error(`unknown given ${label} in ${p.question}`);
    }
    definingProperty(new Map(), c, g, sc, what);
  },

  /** Conic type of a general second-degree equation via the discriminant (non-degenerate, real). */
  'alg2-conics.classify'(p) {
    const eq = mathSegments(p.question)[0]!;
    const q = coeffs(eq);
    const det = q.A * (q.C * q.F - (q.E * q.E) / 4) - (q.B / 2) * ((q.B / 2) * q.F - (q.E * q.D) / 4) + (q.D / 2) * ((q.B / 2) * (q.E / 2) - (q.C * q.D) / 2);
    expect(Math.abs(det), `non-degenerate: ${eq}`).toBeGreaterThan(1e-9);
    const disc = q.B * q.B - 4 * q.A * q.C;
    let type: string;
    if (Math.abs(disc) < 1e-9) type = 'parabola';
    else if (disc > 0) type = 'hyperbola';
    else {
      expect((q.A + q.C) * det, `real ellipse: ${eq}`).toBeLessThan(0);
      type = Math.abs(q.B) < 1e-9 && near(q.A, q.C, 1e-9) ? 'circle' : 'ellipse';
    }
    expect(p.answer.replace(/\$[^$]*\$/g, '').trim().toLowerCase(), `${eq}`).toBe(type);
  },

  /** Every stated point satisfies both rendered equations, and none is missing. */
  'alg2-conics.system'(p) {
    const rows = systemRows(p.question);
    expect(rows.length, p.question).toBe(2);
    const [q1, q2] = rows.map(coeffs) as [Q, Q];
    const none = NO_SOLUTION.test(p.answer);
    const pts: P2[] = none
      ? []
      : splitTop(mathSegments(p.answer).join(', '), [','])
          .parts.reduce<string[]>((acc, s) => {
            // re-join "\left(a" "b\right)" halves split at the inner comma
            if (acc.length && (acc[acc.length - 1]!.match(/\\left\(/g)?.length ?? 0) > (acc[acc.length - 1]!.match(/\\right\)/g)?.length ?? 0)) acc[acc.length - 1] += `, ${s}`;
            else acc.push(s);
            return acc;
          }, [])
          .map(pointOf);
    if (!none) expect(pts.length, p.answer).toBeGreaterThan(0);
    for (const s of pts) for (const r of rows) {
      const g = fnOf(r);
      expect(Math.abs(g(...s)) / gScaleOf(r), `${p.answer}: (${s.join(', ')}) satisfies ${r}`).toBeLessThan(1e-9 * (1 + s[0] ** 2 + s[1] ** 2));
    }
    sameSet(pts, solveSystem(q1, q2), (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-5, `${p.question} → ${p.answer}`);
  },
};
