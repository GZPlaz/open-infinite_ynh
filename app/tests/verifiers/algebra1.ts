/** Answer verifiers for the Algebra 1 pack. */
import { expect } from 'vitest';
import type { Diagram } from '../../src/engine/diagram';
import type { ProblemContent } from '../../src/engine/types';
import { close, evalReal, listItems, mathSegments, onlyMath, RELATIONS, splitTop, stripUnits } from '../evaluator';
import { answerValues, chainHolds, curvePoints, sides, VERIFIERS as BASE, type Verifier } from '../verify';

/** `name = value` assignments among the question's math segments. */
function assignments(segs: string[]): Record<string, number> {
  const env: Record<string, number> = {};
  for (const s of segs) {
    const mm = /^([a-zA-Z])\s*=\s*(.+)$/.exec(s.trim());
    if (mm) env[mm[1]!] = evalReal(mm[2]!);
  }
  return env;
}

/** Numbers given in a word problem, in order: `$12$` math segments and `\$4.50` prices. */
function givenNumbers(rich: string): number[] {
  const out: number[] = [];
  const re = /(?<!\\)\$([^$]+)\$|\\\$(\d+(?:\.\d+)?)/g;
  let mm: RegExpExecArray | null;
  while ((mm = re.exec(rich))) {
    if (mm[2] !== undefined) out.push(Number(mm[2]));
    else {
      const t = stripUnits(mm[1]!.replace(/\\%/g, '\\cdot 0.01'));
      // skip symbolic segments such as `x` or `t`
      if (/^[a-zA-Z]$/.test(t.trim())) continue;
      out.push(evalReal(t));
    }
  }
  return out;
}

const value = (t: string) => evalReal(stripUnits(t).replace(/\\%/g, '\\cdot 0.01'));
const answerNumbers = (rich: string) => answerValues(rich).map(value);

/** F(x, y) = lhs − rhs of an equation or inequality in x and y. */
function relation(tex: string): { F: (x: number, y: number) => number; rel: string } {
  const { parts, rels } = splitTop(tex, RELATIONS);
  expect(rels.length, `one relation in ${tex}`).toBe(1);
  const [l, r] = parts as [string, string];
  return { F: (x, y) => evalReal(l, { vars: { x, y } }) - evalReal(r, { vars: { x, y } }), rel: rels[0]! };
}

function holds(v: number, rel: string): boolean {
  const eps = 1e-9;
  if (rel === '<') return v < -eps;
  if (rel === '>') return v > eps;
  if (rel === '\\le' || rel === '\\leq') return v <= eps;
  if (rel === '\\ge' || rel === '\\geq') return v >= -eps;
  return Math.abs(v) <= eps;
}

function pointInPolygon(x: number, y: number, poly: ReadonlyArray<readonly [number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function fills(d: Diagram | undefined): Array<ReadonlyArray<readonly [number, number]>> {
  return (d?.items ?? []).filter((it) => it.t === 'path' && it.fill).map((it) => (it as { pts: Array<readonly [number, number]> }).pts);
}

function curvePaths(d: Diagram | undefined): Array<{ pts: ReadonlyArray<readonly [number, number]>; dash: boolean }> {
  const out: Array<{ pts: ReadonlyArray<readonly [number, number]>; dash: boolean }> = [];
  for (const it of d?.items ?? []) if (it.t === 'path' && it.role === 'curve') out.push({ pts: it.pts, dash: it.dash === true });
  return out;
}

/** Points of the curve paths, with long straight pieces subdivided. */
function densePoints(d: Diagram | undefined): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const { pts } of curvePaths(d)) {
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = pts[i]!;
      out.push([x, y]);
      const nxt = pts[i + 1];
      if (!nxt) continue;
      const L = Math.hypot(nxt[0] - x, nxt[1] - y);
      const n = Math.ceil(L / 0.05);
      for (let k = 1; k < n; k++) out.push([x + ((nxt[0] - x) * k) / n, y + ((nxt[1] - y) * k) / n]);
    }
  }
  return out;
}

/** Shaded region of the figure agrees with the system of inequalities `rows` (x, y). */
function expectShading(rows: string[], d: Diagram | undefined, range: number, what: string): void {
  const rels = rows.map(relation);
  const polys = fills(d);
  expect(polys.length, `${what}: shading drawn`).toBeGreaterThan(0);
  // boundary lines: every curve point lies on a boundary, dashed exactly when strict
  for (const { pts, dash } of curvePaths(d)) {
    const k = rels.findIndex((r) => pts.every(([x, y]) => Math.abs(r.F(x, y)) < 1e-6));
    expect(k, `${what}: curve not on a boundary`).toBeGreaterThanOrEqual(0);
    expect(dash, `${what}: boundary style`).toBe(rels[k]!.rel === '<' || rels[k]!.rel === '>');
  }
  // every boundary is drawn
  rels.forEach((r, i) => expect(curvePaths(d).some(({ pts }) => pts.every(([x, y]) => Math.abs(r.F(x, y)) < 1e-6)), `${what}: boundary ${i} drawn`).toBe(true));
  let shaded = 0;
  for (let gx = -range + 0.37; gx < range; gx += 0.61) {
    for (let gy = -range + 0.29; gy < range; gy += 0.61) {
      // stay clear of the boundaries, where the sampled shading is approximate
      const near = rels.some((r) => {
        const g = Math.hypot(r.F(gx + 1, gy) - r.F(gx, gy), r.F(gx, gy + 1) - r.F(gx, gy)) || 1;
        return Math.abs(r.F(gx, gy)) / g < 0.25;
      });
      if (near) continue;
      const inside = polys.some((p) => pointInPolygon(gx, gy, p));
      const truth = rels.every((r) => holds(r.F(gx, gy), r.rel));
      expect(inside, `${what}: shading at (${gx.toFixed(2)}, ${gy.toFixed(2)})`).toBe(truth);
      if (inside) shaded++;
    }
  }
  expect(shaded, `${what}: visible shaded region`).toBeGreaterThan(3);
}

/** Domain or range answer: "All real numbers", `x = 2`, `-3 \le x < 4`, `y \ge 1`. */
function intervalOf(seg: string | null, text: string, v: string): { lo: number; hi: number; loOpen: boolean; hiOpen: boolean } {
  if (seg === null) {
    expect(/all real numbers/i.test(text), text).toBe(true);
    return { lo: -Infinity, hi: Infinity, loOpen: true, hiOpen: true };
  }
  const { parts, rels } = splitTop(seg, RELATIONS);
  if (rels.length === 1 && rels[0] === '=') {
    expect(parts[0]).toBe(v);
    const c = evalReal(parts[1]!);
    return { lo: c, hi: c, loOpen: false, hiOpen: false };
  }
  const iv = { lo: -Infinity, hi: Infinity, loOpen: true, hiOpen: true };
  const at = parts.indexOf(v);
  expect(at, `${v} in ${seg}`).toBeGreaterThanOrEqual(0);
  rels.forEach((r, i) => {
    // parts[i] r parts[i+1]
    const leftIsVar = parts[i] === v;
    const other = evalReal(leftIsVar ? parts[i + 1]! : parts[i]!);
    const strict = r === '<' || r === '>';
    const less = r === '<' || r === '\\le';
    // v < c  or  c < v
    const upper = leftIsVar ? less : !less;
    if (upper) {
      iv.hi = other;
      iv.hiOpen = strict;
    } else {
      iv.lo = other;
      iv.loOpen = strict;
    }
  });
  return iv;
}

const COIN: Record<string, number> = { pennies: 0.01, nickels: 0.05, dimes: 0.1, quarters: 0.25 };

/** Word problems: re-derive the answer from the numbers given in the question. */
const WORD: Record<string, (g: number[], q: string) => number[]> = {
  'work.together': ([a, b]) => [(a! * b!) / (a! + b!)],
  'work.alone': ([a, t]) => [(a! * t!) / (a! - t!)],
  'work.drain': ([a, b]) => [(a! * b!) / (b! - a!)],
  'drt.opposite': ([r1, r2, D]) => [D! / (r1! + r2!)],
  'drt.toward': ([D, r1, r2]) => [D! / (r1! + r2!)],
  'drt.catchup': ([r1, h, r2]) => [(r1! * h!) / (r2! - r1!)],
  'drt.roundtrip': ([r1, r2, T]) => [(T! * r1! * r2!) / (r1! + r2!)],
  'drt.speeds': ([k, t, D]) => [(D! / t! - k!) / 2, (D! / t! + k!) / 2],
  'mix.water': ([V, q, r]) => [(V! * (q! - r!)) / r!],
  'mix.solution': ([p, V, q, r]) => [(V! * (q! - r!)) / (r! - p!)],
  'mix.value': ([pa, pb, W, pm]) => {
    const a = (W! * (pm! - pb!)) / (pa! - pb!);
    return [a, W! - a];
  },
  'sys.numbers': ([S, D]) => [(S! + D!) / 2, (S! - D!) / 2],
  'sys.tickets': ([N, R, pa, pc]) => {
    const a = (R! - pc! * N!) / (pa! - pc!);
    return [a, N! - a];
  },
  'sys.purchases': ([a1, b1, c1, a2, b2, c2]) => {
    const det = a1! * b2! - a2! * b1!;
    return [(c1! * b2! - c2! * b1!) / det, (a1! * c2! - a2! * c1!) / det];
  },
  'sys.coins': ([N, V], q) => {
    const mm = /all (\w+) and (\w+)/.exec(q)!;
    const v1 = COIN[mm[1]!]!;
    const v2 = COIN[mm[2]!]!;
    const y = (V! - v1 * N!) / (v2 - v1);
    return [N! - y, y];
  },
  'sys.current': ([d, t1, t2]) => [(d! / t1! + d! / t2!) / 2, (d! / t1! - d! / t2!) / 2],
};

/** Pairs of a discrete relation from the question (ordered pairs, table or mapping diagram). */
function relationPairs(p: ProblemContent): Array<[number, number]> {
  if (p.diagram) {
    const labels = p.diagram.items.filter((it) => it.t === 'label' && /^-?\d+$/.test(it.tex)) as Array<{ p: readonly [number, number]; tex: string }>;
    const left = labels.filter((l) => Math.abs(l.p[0]) < 1e-9);
    const right = labels.filter((l) => Math.abs(l.p[0] - 4) < 1e-9);
    const near = (ls: typeof labels, y: number) => Number(ls.reduce((a, b2) => (Math.abs(b2.p[1] - y) < Math.abs(a.p[1] - y) ? b2 : a)).tex);
    return p.diagram.items.filter((it) => it.t === 'arrow').map((a) => {
      const ar = a as { from: readonly [number, number]; to: readonly [number, number] };
      return [near(left, ar.from[1]), near(right, ar.to[1])];
    });
  }
  const q = onlyMath(p.question);
  if (q.includes('\\begin{array}')) {
    const rows = q.replace(/\\begin\{array\}\{[^}]*\}|\\end\{array\}|\\hline/g, '').split('\\\\').map((r) => r.split('&').map((c) => c.trim()));
    const xs = rows[0]!.slice(1).map((c) => evalReal(c));
    const ys = rows[1]!.slice(1).map((c) => evalReal(c));
    return xs.map((x, i) => [x, ys[i]!]);
  }
  return [...q.matchAll(/\((-?\d+), (-?\d+)\)/g)].map((mm) => [Number(mm[1]), Number(mm[2])]);
}

const setValues = (seg: string) => listItems(seg).map((t) => evalReal(t)).sort((a, b) => a - b);
const uniq = (xs: number[]) => [...new Set(xs)].sort((a, b) => a - b);

/** Bounds of a graphed relation: curve extremes, with arrowheads meaning unbounded. */
function graphedSets(d: Diagram): { domain: { lo: number; hi: number; loOpen: boolean; hiOpen: boolean }; range: { lo: number; hi: number; loOpen: boolean; hiOpen: boolean }; fn: boolean } {
  const pts = densePoints(d);
  const arrows = d.items.filter((it) => it.t === 'arrow' && it.ink === 'accent') as Array<{ from: readonly [number, number]; to: readonly [number, number] }>;
  const dirs = arrows.map((a) => [a.to[0] - a.from[0], a.to[1] - a.from[1]] as const);
  // every arrowhead sits on the curve
  arrows.forEach((a) => expect(pts.some(([x, y]) => Math.hypot(x - a.to[0], y - a.to[1]) < 1e-9), 'arrow at the end of the curve').toBe(true));
  const openDots = d.items.filter((it) => it.t === 'dot' && it.open) as Array<{ p: readonly [number, number] }>;
  const side = (k: 0 | 1, sign: 1 | -1) => {
    const unbounded = dirs.some((v) => sign * v[k] > 1e-6 * Math.hypot(v[0], v[1]) && Math.abs(v[k]) > 0.05 * Math.hypot(v[0], v[1]));
    if (unbounded) return { value: sign * Infinity, open: true };
    const target = sign > 0 ? Math.max(...pts.map((p) => p[k])) : Math.min(...pts.map((p) => p[k]));
    const hits = pts.filter((p) => Math.abs(p[k] - target) < 1e-6);
    const open = hits.every((h) => openDots.some((o) => Math.hypot(o.p[0] - h[0], o.p[1] - h[1]) < 1e-6));
    return { value: target, open };
  };
  const iv = (k: 0 | 1) => {
    const lo = side(k, -1);
    const hi = side(k, 1);
    return { lo: lo.value, hi: hi.value, loOpen: lo.open, hiOpen: hi.open };
  };
  // vertical line test: intersect the drawn paths with many vertical lines
  const segs: Array<[readonly [number, number], readonly [number, number]]> = [];
  for (const { pts: path } of curvePaths(d)) for (let i = 0; i + 1 < path.length; i++) segs.push([path[i]!, path[i + 1]!]);
  let fn = !segs.some(([a, b2]) => Math.abs(a[0] - b2[0]) < 1e-12 && Math.abs(a[1] - b2[1]) > 1e-9);
  for (let c = -20.0137; c < 20 && fn; c += 0.05) {
    const ys: number[] = [];
    for (const [a, b2] of segs) {
      const lo = Math.min(a[0], b2[0]);
      const hi = Math.max(a[0], b2[0]);
      if (c < lo || c > hi || hi === lo) continue;
      ys.push(a[1] + ((b2[1] - a[1]) * (c - a[0])) / (b2[0] - a[0]));
    }
    if (ys.length && Math.max(...ys) - Math.min(...ys) > 1e-3) fn = false;
  }
  return { domain: iv(0), range: iv(1), fn };
}

function expectInterval(got: ReturnType<typeof intervalOf>, want: ReturnType<typeof intervalOf>, what: string): void {
  expect(close(got.lo, want.lo, 1e-6) && close(got.hi, want.hi, 1e-6), `${what}: bounds ${JSON.stringify(got)} vs ${JSON.stringify(want)}`).toBe(true);
  if (Number.isFinite(want.lo) && want.lo !== want.hi) expect(got.loOpen, `${what}: lower strictness`).toBe(want.loOpen);
  if (Number.isFinite(want.hi) && want.lo !== want.hi) expect(got.hiOpen, `${what}: upper strictness`).toBe(want.hiOpen);
}

/** "Domain: …; Range: …; Function" → parts. */
function domainRangeParts(answer: string): { dom: string; ran: string; verdict: string | null } {
  const parts = answer.split(/;\s*/);
  expect(parts[0]).toMatch(/^Domain: /);
  expect(parts[1]).toMatch(/^Range: /);
  return { dom: parts[0]!.slice(8), ran: parts[1]!.slice(7), verdict: parts[2] ?? null };
}

/** Every ordered pair written in the rich text (`(1, 2)` or `\\left(1, 2\\right)`). */
function pairsIn(rich: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const seg of mathSegments(rich)) {
    for (const mm of seg.matchAll(/(?:\\left)?\(([^()]*)(?:\\right)?\)/g)) {
      const items = mm[1]!.replace(/\\right$/, '').split(',');
      if (items.length === 2) out.push([evalReal(items[0]!), evalReal(items[1]!)]);
    }
  }
  return out;
}

function onPolyline(pt: readonly [number, number], d: Diagram | undefined): boolean {
  for (const { pts } of curvePaths(d)) {
    for (let i = 0; i + 1 < pts.length; i++) {
      const [a, b2] = [pts[i]!, pts[i + 1]!];
      const vx = b2[0] - a[0];
      const vy = b2[1] - a[1];
      const L2 = vx * vx + vy * vy || 1;
      const t = Math.max(0, Math.min(1, ((pt[0] - a[0]) * vx + (pt[1] - a[1]) * vy) / L2));
      if (Math.hypot(a[0] + t * vx - pt[0], a[1] + t * vy - pt[1]) < 1e-6) return true;
    }
  }
  return false;
}

function curveOnEquation(eq: string, d: Diagram | undefined): void {
  const { F } = relation(eq);
  const pts = curvePoints(d);
  expect(pts.length, 'curve drawn').toBeGreaterThan(5);
  for (const [x, y] of pts) expect(Math.abs(F(x, y)) < 1e-6, `(${x}, ${y}) on ${eq}`).toBe(true);
}

/** Slope of the line F(x, y) = 0 (null when vertical). */
function slopeOf(F: (x: number, y: number) => number): number | null {
  const a = F(1, 0) - F(0, 0);
  const b2 = F(0, 1) - F(0, 0);
  return Math.abs(b2) < 1e-12 ? null : -a / b2;
}

export const VERIFIERS: Record<string, Verifier> = {
  /** Solving a system by graphing: the solution checks out and the figure shows the lines and the intersection. */
  'algebra1.graphSystem'(p) {
    BASE.system!(p);
    const rows = onlyMath(p.question)
      .replace(/\\begin\{aligned\}|\\end\{aligned\}/g, '')
      .split('\\\\')
      .map((r) => r.replace(/&/g, '').trim());
    const Fs = rows.map((r) => relation(r).F);
    const paths = curvePaths(p.answerDiagram);
    expect(paths.length).toBeGreaterThan(0);
    for (const { pts } of paths) expect(Fs.some((F) => pts.every(([x, y]) => Math.abs(F(x, y)) < 1e-6)), 'graphed line is one of the equations').toBe(true);
    Fs.forEach((F, i) => expect(paths.some(({ pts }) => pts.every(([x, y]) => Math.abs(F(x, y)) < 1e-6)), `line ${i} graphed`).toBe(true));
    const sol = p.check!.solution;
    if (Array.isArray(sol)) {
      const dots = p.answerDiagram!.items.filter((it) => it.t === 'dot') as Array<{ p: readonly [number, number] }>;
      expect(dots.some((dd) => close(dd.p[0], sol[0] as number) && close(dd.p[1], sol[1] as number)), 'intersection marked').toBe(true);
    }
  },

  'algebra1.slope'(p) {
    const pts = p.diagram ? (p.diagram.items.filter((it) => it.t === 'dot') as Array<{ p: readonly [number, number] }>).map((dd) => [dd.p[0], dd.p[1]] as [number, number]) : pairsIn(p.question);
    expect(pts.length).toBe(2);
    const [[x1, y1], [x2, y2]] = pts as [[number, number], [number, number]];
    if (p.diagram) pts.forEach((q) => expect(onPolyline(q, p.diagram), 'marked point on the line').toBe(true));
    if (x1 === x2) expect(p.answer).toBe('Undefined');
    else expect(close(evalReal(onlyMath(p.answer)), (y2 - y1) / (x2 - x1)), `${p.question} → ${p.answer}`).toBe(true);
  },

  'algebra1.lineGraph'(p) {
    const eq = onlyMath(p.question);
    curveOnEquation(eq, p.answerDiagram);
    const { F } = relation(eq);
    const pts = pairsIn(p.answer);
    expect(pts.length).toBe(2);
    expect(pts[0]![0] !== pts[1]![0] || pts[0]![1] !== pts[1]![1], 'distinct points').toBe(true);
    for (const q of pts) {
      expect(Math.abs(F(q[0], q[1])) < 1e-9, `${p.answer} on ${eq}`).toBe(true);
      expect(onPolyline(q, p.answerDiagram), `${q} on the drawn line`).toBe(true);
    }
  },

  /** Equation of a line from point(s), a slope, a parallel/perpendicular line, or a graph. */
  'algebra1.lineThrough'(p) {
    const { F } = relation(onlyMath(p.answer));
    const segs = mathSegments(p.question);
    let pts = pairsIn(p.question);
    if (p.diagram) pts = (p.diagram.items.filter((it) => it.t === 'dot') as Array<{ p: readonly [number, number] }>).map((dd) => [dd.p[0], dd.p[1]]);
    expect(pts.length).toBeGreaterThan(0);
    for (const q of pts) expect(Math.abs(F(q[0], q[1])) < 1e-9, `${p.answer} through (${q})`).toBe(true);
    if (p.diagram) pts.forEach((q) => expect(onPolyline(q, p.diagram), 'marked point on the line').toBe(true));
    let slope: number | null | undefined;
    const given = segs.find((s2) => /m = /.test(s2));
    if (given) slope = evalReal(given.split('=')[1]!);
    const line = segs.find((s2) => /[xy]/.test(s2) && s2.includes('='));
    if (line && /parallel|perpendicular/.test(p.question)) {
      const g = slopeOf(relation(line).F);
      slope = /parallel/.test(p.question) ? g : g === null ? 0 : Math.abs(g) < 1e-12 ? null : -1 / g;
    }
    if (pts.length < 2) expect(slope, 'a slope is determined').not.toBe(undefined);
    const P = pts[0]!;
    if (slope !== undefined) {
      if (slope === null) expect(Math.abs(F(P[0], P[1] + 1)) < 1e-9, 'vertical').toBe(true);
      else expect(Math.abs(F(P[0] + 1, P[1] + slope)) < 1e-9, `slope ${slope}`).toBe(true);
    }
    // a genuine line, not an identity
    expect(Math.abs(F(1, 0) - F(0, 0)) + Math.abs(F(0, 1) - F(0, 0)), 'non-degenerate').toBeGreaterThan(1e-9);
  },

  'algebra1.absGraph'(p) {
    const eq = onlyMath(p.question);
    curveOnEquation(eq, p.answerDiagram);
    const [V] = pairsIn(p.answer);
    const { F } = relation(eq);
    expect(Math.abs(F(V![0], V![1])) < 1e-9, `vertex ${V} on ${eq}`).toBe(true);
    const ys = curvePoints(p.answerDiagram).map((q) => q[1]);
    const up = /opens up/.test(p.answer);
    expect(/opens (up|down)/.test(p.answer)).toBe(true);
    if (up) expect(Math.min(...ys)).toBeGreaterThanOrEqual(V![1] - 1e-9);
    else expect(Math.max(...ys)).toBeLessThanOrEqual(V![1] + 1e-9);
  },

  /** Shaded half-plane(s) agree with the question's inequality (or aligned system of inequalities). */
  'algebra1.shading'(p) {
    const q = onlyMath(p.question);
    const rows = q.includes('\\begin{aligned}')
      ? q
          .replace(/\\begin\{aligned\}|\\end\{aligned\}/g, '')
          .split('\\\\')
          .map((r) => r.replace(/&/g, '').trim())
      : [q];
    expectShading(rows, p.answerDiagram, p.check!.range as number, p.question);
    if (rows.length === 1) {
      const strict = /[<>]/.test(relation(q).rel);
      expect(p.answer.startsWith(strict ? 'Dashed' : 'Solid'), p.answer).toBe(true);
    }
  },

  /** "y varies directly/inversely with x, and y = a when x = b. …" */
  'algebra1.variation'(p) {
    const segs = mathSegments(p.question);
    const [Y, X] = segs as [string, string];
    const direct = /directly/.test(p.question);
    const env = assignments(segs.slice(2, 4));
    const k = direct ? env[Y]! / env[X]! : env[Y]! * env[X]!;
    const law = (x: number) => (direct ? k * x : k / x);
    const task = p.check!.task as string;
    const ans = onlyMath(p.answer);
    if (task === 'constant') {
      expect(ans.startsWith('k =')).toBe(true);
      expect(close(evalReal(ans.slice(3)), k), `${p.question} → ${p.answer}`).toBe(true);
    } else if (task === 'equation') {
      const [l, r] = sides(ans);
      expect(l).toBe(Y);
      for (const x of [-2.5, 1.3, 4.1]) expect(close(evalReal(r, { vars: { [X]: x } }), law(x)), `${p.answer} at ${X}=${x}`).toBe(true);
    } else {
      const target = segs[4]!;
      const known = assignments([segs[5]!]);
      const [l, r] = sides(ans);
      expect(l).toBe(target);
      const got = evalReal(r);
      if (target === Y) expect(close(got, law(known[X]!)), `${p.question} → ${p.answer}`).toBe(true);
      else expect(close(law(got), known[Y]!), `${p.question} → ${p.answer}`).toBe(true);
    }
  },

  'algebra1.relation'(p) {
    const pairs = relationPairs(p);
    expect(pairs.length).toBeGreaterThan(2);
    const { dom, ran, verdict } = domainRangeParts(p.answer);
    expect(setValues(onlyMath(dom)), `domain of ${JSON.stringify(pairs)}`).toEqual(uniq(pairs.map((q) => q[0])));
    expect(setValues(onlyMath(ran)), `range of ${JSON.stringify(pairs)}`).toEqual(uniq(pairs.map((q) => q[1])));
    const isFn = pairs.every(([x, y]) => pairs.every(([x2, y2]) => x !== x2 || y === y2));
    if (p.check!.verdict) expect(verdict).toBe(isFn ? 'Function' : 'Not a function');
    else expect(verdict).toBe(null);
  },

  'algebra1.contRelation'(p) {
    const g = graphedSets(p.diagram!);
    const { dom, ran, verdict } = domainRangeParts(p.answer);
    const segOf = (r: string) => (mathSegments(r).length ? onlyMath(r) : null);
    expectInterval(intervalOf(segOf(dom), dom, 'x'), g.domain, `domain in ${p.answer}`);
    expectInterval(intervalOf(segOf(ran), ran, 'y'), g.range, `range in ${p.answer}`);
    if (p.check!.verdict) expect(verdict, p.answer).toBe(g.fn ? 'Function' : 'Not a function');
    // the figure stays inside the plane
    const R = p.check!.range as number;
    densePoints(p.diagram).forEach(([x, y]) => expect(Math.max(Math.abs(x), Math.abs(y))).toBeLessThanOrEqual(R + 1e-9));
  },

  /** `f(x) = …; Find f(arg)`: the answer equals the definition evaluated at arg (symbolically for expressions). */
  'algebra1.evalfn'(p) {
    const [def, call] = mathSegments(p.question) as [string, string];
    const dm = /^([a-z])\(([a-z])\) = (.+)$/.exec(def)!;
    const [, name, v, body] = dm as unknown as [string, string, string, string];
    expect(call.startsWith(`${name}(`) && call.endsWith(')'), call).toBe(true);
    const arg = call.slice(2, -1);
    const [lhs, rhsTex] = sides(onlyMath(p.answer));
    expect(lhs).toBe(call);
    const letters = [...new Set(arg.match(/[a-z]/g) ?? [])];
    if (letters.length === 0) {
      const want = evalReal(body, { vars: { [v]: evalReal(arg) } });
      expect(close(evalReal(rhsTex), want), `${p.question} → ${p.answer}`).toBe(true);
    } else {
      const t = letters[0]!;
      for (const tv of [-2.3, -0.7, 0.4, 1.9, 3.2]) {
        const want = evalReal(body, { vars: { [v]: evalReal(arg, { vars: { [t]: tv } }) } });
        expect(close(evalReal(rhsTex, { vars: { [t]: tv } }), want), `${p.question} → ${p.answer} at ${t}=${tv}`).toBe(true);
      }
    }
  },

  'algebra1.word'(p) {
    const mode = p.check!.mode as string;
    const f = WORD[mode];
    expect(f, `word mode ${mode}`).toBeTruthy();
    const want = f!(givenNumbers(p.question), p.question);
    const got = givenNumbers(p.answer);
    expect(got.length, `${p.answer}`).toBe(want.length);
    want.forEach((w, i) => {
      expect(Number.isFinite(w) && (w > 0 || mode === 'sys.numbers'), `${p.question}: sensible answer`).toBe(true);
      expect(close(got[i]!, w, 1e-9), `${p.question} → ${p.answer}: item ${i} should be ${w}`).toBe(true);
    });
  },

  /** Expression with `; use $a = 2$, …`: the answer and every worked step equal its value. */
  'algebra1.evaluate'(p) {
    const segs = mathSegments(p.question);
    const env = assignments(segs.slice(1));
    const want = evalReal(segs[0]!, { vars: env });
    expect(close(evalReal(onlyMath(p.answer)), want), `${p.question} → ${p.answer}`).toBe(true);
    for (const st of p.steps ?? []) {
      for (const s of mathSegments(st)) {
        const t = s.replace(/^=\s*/, '');
        expect(close(evalReal(t, { vars: env }), want), `step ${st}`).toBe(true);
      }
    }
  },
};

export { answerNumbers, assignments, densePoints, expectShading, givenNumbers, holds, intervalOf, relation, value, chainHolds, curvePoints, sides, BASE, listItems };
export type { ProblemContent };
