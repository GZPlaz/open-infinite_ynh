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

export const VERIFIERS: Record<string, Verifier> = {
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
