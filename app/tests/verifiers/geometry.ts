/**
 * Geometry pack verifiers. Most figure problems use `geometry.solve`: the
 * answer's assignments (x = 7, AC = 23, y ≈ 12.4) are plugged into the
 * theorem's equations, every expression the equations use must be visible in
 * the question or figure, and the figure itself must match the solved values
 * (drawn angles equal the labelled measures, labelled lengths are drawn to a
 * common scale).
 */
import { expect } from 'vitest';
import type { Diagram } from '../../src/engine/diagram';
import type { ProblemContent } from '../../src/engine/types';
import { close, evalReal, mathSegments, splitTop, stripUnits } from '../evaluator';
import { hasTable, parseBlocks, type Block } from '../../src/engine/richtext';
import type { Verifier } from '../verify';

type Pt = [number, number];
type Env = Record<string, number>;

const norm = (s: string) => s.replace(/\s+/g, '');
const noDeg = (s: string) => s.replace(/\^\{?\\circ\}?/g, '');

function labelsOf(d: Diagram | undefined): string[] {
  return (d?.items ?? []).flatMap((it) => (it.t === 'label' ? [it.tex] : []));
}

/** Everything the student can read: question math + text and figure labels. */
function visible(p: ProblemContent): string {
  return norm([p.question, ...labelsOf(p.diagram)].join(' | '));
}

interface Assignment {
  lhs: string;
  value: number;
  approx: boolean;
}

/** `x = 7, y \approx 2.3` / `$x = 7$, $AC = 23$` → assignments. */
export function assignments(rich: string): Assignment[] {
  const out: Assignment[] = [];
  for (const seg of mathSegments(rich)) {
    for (const item of splitTop(seg, [',']).parts) {
      const { parts, rels } = splitTop(item, ['=', '\\approx']);
      if (rels.length === 0) {
        // a bare value: the unnamed unknown (lhs '')
        out.push({ lhs: '', value: evalReal(noDeg(stripUnits(item))), approx: false });
        continue;
      }
      const rhs = noDeg(stripUnits(parts[parts.length - 1]!));
      out.push({ lhs: norm(parts[0]!), value: evalReal(rhs), approx: rels.includes('\\approx') });
    }
  }
  return out;
}

function sub(a: Pt, b: Pt): Pt {
  return [a[0] - b[0], a[1] - b[1]];
}

function angleAt(a: Pt, v: Pt, c: Pt): number {
  const u = [a[0] - v[0], a[1] - v[1]];
  const w = [c[0] - v[0], c[1] - v[1]];
  const cos = (u[0]! * w[0]! + u[1]! * w[1]!) / (Math.hypot(u[0]!, u[1]!) * Math.hypot(w[0]!, w[1]!));
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

function residual(eq: string, env: Env): number {
  const { parts, rels } = splitTop(eq, ['=']);
  expect(rels.length, `one '=' in ${eq}`).toBe(1);
  return evalReal(parts[0]!, { vars: env }) - evalReal(parts[1]!, { vars: env });
}

/** Bound for |f| when the approximate variables are off by up to 0.05. */
function slack(f: (e: Env) => number, env: Env, approx: string[]): number {
  let s = 0;
  for (const v of approx) {
    const h = 1e-4;
    const d = (f({ ...env, [v]: env[v]! + h }) - f({ ...env, [v]: env[v]! - h })) / (2 * h);
    s += Math.abs(d) * 0.0500001;
  }
  return s * 1.05;
}

export function solveCheck(p: ProblemContent): void {
  const c = p.check!;
  const names = Object.fromEntries(Object.entries((c.names as Record<string, string> | undefined) ?? {}).map(([k, v]) => [norm(k), v]));
  const env: Env = {};
  const approx: string[] = [];
  const as = assignments(p.answer);
  expect(as.length, `answer assignments in ${p.answer}`).toBeGreaterThan(0);
  for (const a of as) {
    const v = names[a.lhs] ?? (/^[a-zA-Z](_\{?\w+\}?)?$/.test(a.lhs) ? a.lhs : undefined);
    expect(v, `answer item "${a.lhs}" is not checked (${p.answer})`).toBeDefined();
    env[v!] = a.value;
    if (a.approx) approx.push(v!);
  }
  // variables the answer does not state (e.g. x when only a measure is asked for) are solved from the equations
  const eqList = (c.eqs as string[] | undefined) ?? [];
  for (let guard = 0; guard < 4; guard++) {
    let missing: string | null = null;
    for (const eq of eqList) {
      try {
        residual(eq, env);
      } catch (e) {
        const mm = /unbound variable (\S+)/.exec((e as Error).message);
        if (!mm) throw e;
        missing = mm[1]!;
        // solve this equation for the missing variable if it is the only one missing (linear in it)
        try {
          const f = (v: number) => residual(eq, { ...env, [missing!]: v });
          const f0 = f(0);
          const f1 = f(1);
          const root = -f0 / (f1 - f0);
          expect(Math.abs(f(2.7) - (f0 + 2.7 * (f1 - f0))) < 1e-7 * Math.max(1, Math.abs(f0)), `${eq} linear in ${missing}`).toBe(true);
          env[missing] = root;
          break;
        } catch {
          missing = null;
        }
      }
    }
    if (!missing) break;
  }
  const shown = visible(p);
  for (const g of (c.given as string[] | undefined) ?? []) expect(shown.includes(norm(g)), `"${g}" not shown in question/figure`).toBe(true);
  const eqs = (c.eqs as string[] | undefined) ?? [];
  for (const eq of eqs) {
    const f = (e: Env) => residual(eq, e);
    const r = f(env);
    const tol = 1e-7 * Math.max(1, ...Object.values(env).map(Math.abs)) + slack(f, env, approx);
    expect(Math.abs(r) <= tol, `${eq} fails at ${JSON.stringify(env)} (residual ${r}) — ${p.answer}`).toBe(true);
  }
  const relTol = approx.length ? 0.012 : 1e-6;
  for (const [a, v, q, e] of (c.angles as Array<[Pt, Pt, Pt, string]> | undefined) ?? []) {
    const want = evalReal(noDeg(e), { vars: env });
    const got = angleAt(a, v, q);
    expect(Math.abs(got - want) <= relTol * Math.max(1, want), `figure angle ${got} vs ${e} = ${want}`).toBe(true);
  }
  for (const [ctr, a, q, e] of (c.arcs as Array<[Pt, Pt, Pt, string]> | undefined) ?? []) {
    const want = evalReal(noDeg(e), { vars: env });
    const t1 = Math.atan2(a[1] - ctr[1], a[0] - ctr[0]);
    const t2 = Math.atan2(q[1] - ctr[1], q[0] - ctr[0]);
    const got = ((((t2 - t1) * 180) / Math.PI) % 360 + 360) % 360;
    expect(Math.abs(got - want) <= relTol * Math.max(1, want) || Math.abs(got - want) > 359.99, `figure arc ${got} vs ${e} = ${want}`).toBe(true);
  }
  const lengths = (c.lengths as Array<[Pt, Pt, string]> | undefined) ?? [];
  const ratios = lengths.map(([a, q, e]) => {
    const want = evalReal(noDeg(e), { vars: env });
    expect(want, `length ${e} positive`).toBeGreaterThan(0);
    return Math.hypot(a[0] - q[0], a[1] - q[1]) / want;
  });
  if (ratios.length > 1) {
    const lo = Math.min(...ratios);
    const hi = Math.max(...ratios);
    expect(hi / lo <= 1 + relTol, `figure lengths not to scale: ${lengths.map((l) => l[2]).join(', ')} → ${ratios.join(', ')}`).toBe(true);
  }
  // a second group of labelled lengths drawn to its own common scale
  const group = (c.ratios as Array<[Pt, Pt, string]> | undefined) ?? [];
  if (group.length > 1) {
    const rs = group.map(([a, q, e]) => Math.hypot(a[0] - q[0], a[1] - q[1]) / evalReal(noDeg(e), { vars: env }));
    expect(Math.max(...rs) / Math.min(...rs) <= 1 + relTol, `figure lengths not to scale: ${group.map((l) => l[2]).join(', ')}`).toBe(true);
  }
  for (const [lhs, e] of Object.entries((c.positive as Record<string, string> | undefined) ?? {})) {
    expect(evalReal(noDeg(e), { vars: env }), `${lhs} = ${e} must be positive`).toBeGreaterThan(0);
  }
  expect(eqs.length + lengths.length + ((c.angles as unknown[]) ?? []).length + ((c.arcs as unknown[]) ?? []).length, 'something verified').toBeGreaterThan(0);
}

/** Ordered pairs in a math string (as numbers). */
export function tuplesIn(tex: string): number[][] {
  return [...tex.matchAll(/\\left\(((?:[^()]|\([^()]*\))*?)\\right\)/g)].map((mm) => splitTop(mm[1]!, [',']).parts.map((t) => evalReal(t)));
}

function classifyAngle(v: number): string {
  return Math.abs(v - 90) < 1e-9 ? 'Right' : Math.abs(v - 180) < 1e-9 ? 'Straight' : v < 90 ? 'Acute' : 'Obtuse';
}

/** Linear equation in x, y → coefficients of l − r = ax + by + c. */
function lineOf(eq: string): { a: number; b: number; c: number; slope: number; at: (x: number, y: number) => number } {
  const { parts, rels } = splitTop(eq, ['=']);
  expect(rels.length, eq).toBe(1);
  const at = (x: number, y: number) => evalReal(parts[0]!, { vars: { x, y } }) - evalReal(parts[1]!, { vars: { x, y } });
  const c = at(0, 0);
  const a = at(1, 0) - c;
  const b = at(0, 1) - c;
  expect(close(at(2.3, -1.7), a * 2.3 - b * 1.7 + c), `${eq} is linear`).toBe(true);
  return { a, b, c, slope: -a / b, at };
}

type Rel = string;
function transversalRelation(I: Pt[], u: Pt, t: Pt, L1: Pt, L2: Pt): Rel {
  const cross = (v: Pt, w: Pt) => v[0] * w[1] - v[1] * w[0];
  const d = (P: Pt, Q: Pt): Pt => [P[0] - Q[0], P[1] - Q[1]];
  const info = (L: Pt) => {
    const k = Math.hypot(...d(L, I[0]!)) < Math.hypot(...d(L, I[1]!)) ? 0 : 1;
    const side = Math.sign(cross(t, d(L, I[k]!)));
    const above = cross(u, d(L, I[k]!)) > 0;
    const interior = Math.sign(cross(u, d(L, I[0]!))) !== Math.sign(cross(u, d(L, I[1]!)));
    return { k, side, above, interior };
  };
  const a = info(L1);
  const b = info(L2);
  if (a.k === b.k) return a.side !== b.side && a.above !== b.above ? 'Vertical angles' : 'Linear pair';
  if (a.side === b.side && a.above === b.above) return 'Corresponding angles';
  if (a.interior && b.interior) return a.side === b.side ? 'Same-side interior angles' : 'Alternate interior angles';
  if (!a.interior && !b.interior) return a.side === b.side ? 'Same-side exterior angles' : 'Alternate exterior angles';
  return '?';
}

function triangleClass(sides: number[], angles: number[]): string {
  const eq = (a: number, b: number) => Math.abs(a - b) < 1e-6 * Math.max(1, a);
  const [a, b, c] = [...sides].sort((x, y) => x - y) as [number, number, number];
  if (eq(a, c)) return 'Equilateral';
  const side = eq(a, b) || eq(b, c) ? 'isosceles' : 'scalene';
  const big = Math.max(...angles);
  const kind = Math.abs(big - 90) < 1e-6 ? 'Right' : big > 90 ? 'Obtuse' : 'Acute';
  return `${kind} ${side}`;
}

/** Pure numbers among the question's math segments. */
function questionNumbers(p: ProblemContent): number[] {
  return mathSegments(p.question)
    .filter((s) => /^-?[\d.]+$/.test(s.trim()))
    .map(Number);
}

/** Postulate implied by the congruent parts S (sides, side i opposite vertex i) and A (angles). */
function congruenceCriterion(S: number[], A: number[], right: number | null): string {
  const has = (xs: number[], i: number) => xs.includes(i);
  if (S.length === 3) return 'SSS';
  if (A.length >= 2 && S.length >= 1) {
    // a side between the two known angles (not opposite either) gives ASA, otherwise AAS
    const s = S[0]!;
    return A.length >= 3 || !has(A, s) ? 'ASA' : 'AAS';
  }
  if (S.length === 2) {
    const k = [0, 1, 2].find((i) => !has(S, i))!;
    if (has(A, k)) return 'SAS';
    if (right !== null && has(A, right) && has(S, right)) return 'HL';
  }
  return 'Not enough information';
}

const POLY_N: Record<string, number> = { triangle: 3, quadrilateral: 4, pentagon: 5, hexagon: 6, heptagon: 7, octagon: 8, nonagon: 9, decagon: 10, hendecagon: 11, dodecagon: 12 };

/** f(x, y) = lhs − rhs of an equation in x and y. */
function curveFn(eq: string): (x: number, y: number) => number {
  const { parts, rels } = splitTop(eq, ['=']);
  expect(rels.length, eq).toBe(1);
  return (x, y) => evalReal(parts[0]!, { vars: { x, y } }) - evalReal(parts[1]!, { vars: { x, y } });
}

/** The equation holds on the circle (h, k, r) and nowhere near its center. */
function expectCircle(eq: string, h: number, k: number, r: number, what: string): void {
  const f = curveFn(eq);
  for (const t of [0.3, 1.1, 2.2, 3.5, 4.4, 5.9]) expect(Math.abs(f(h + r * Math.cos(t), k + r * Math.sin(t))) < 1e-7 * Math.max(1, r * r), `${what}: point at t=${t}`).toBe(true);
  expect(Math.abs(f(h, k)) > 1e-6, `${what}: center not on the curve`).toBe(true);
  expect(Math.abs(f(h + 2 * r, k)) > 1e-6, `${what}: 2r away not on the curve`).toBe(true);
}

export const VERIFIERS: Record<string, Verifier> = {
  'geometry.solve': solveCheck,

  /** Circle equations: build the circle from the question's data and test the answer (or vice versa). */
  'geometry.circleEq'(p) {
    const c = p.check!;
    const qs = mathSegments(p.question);
    if (c.task === 'write') {
      const T = tuplesIn(qs.join(' '));
      let h: number;
      let k: number;
      let r: number;
      if (c.mode === 'radius') {
        [h, k] = T[0] as [number, number];
        r = evalReal(qs[1]!);
      } else if (c.mode === 'point') {
        [h, k] = T[0] as [number, number];
        r = Math.hypot(T[1]![0]! - h, T[1]![1]! - k);
      } else {
        h = (T[0]![0]! + T[1]![0]!) / 2;
        k = (T[0]![1]! + T[1]![1]!) / 2;
        r = Math.hypot(T[1]![0]! - h, T[1]![1]! - k);
      }
      expectCircle(mathSegments(p.answer)[0]!, h, k, r, `${p.question} → ${p.answer}`);
    } else {
      const as = mathSegments(p.answer);
      const [h, k] = tuplesIn(as[0]!)[0] as [number, number];
      const r = evalReal(as[1]!);
      expectCircle(qs[0]!, h, k, r, `${p.question} → ${p.answer}`);
    }
  },

  /** Polygon angle facts, with n read from the question. */
  'geometry.polygon'(p) {
    const c = p.check!;
    const ans = assignments(p.answer)[0]!;
    if (c.task === 'sides') {
      const v = evalReal(noDeg(mathSegments(p.question)[0]!));
      const ext = /exterior/.test(p.question) ? v : 180 - v;
      expect(ans.lhs).toBe('n');
      expect(close(ans.value, 360 / ext), p.question).toBe(true);
      return;
    }
    const word = Object.keys(POLY_N).find((w) => new RegExp(`\\b${w}\\b`).test(p.question));
    const n = word ? POLY_N[word]! : Number(/\$(\d+)\$-gon/.exec(p.question)![1]);
    expect(n).toBe(c.n);
    const want = c.task === 'sum' ? (n - 2) * 180 : /exterior/.test(p.question) ? 360 / n : ((n - 2) * 180) / n;
    expect(close(ans.value, want), `${p.question} → ${p.answer}`).toBe(true);
  },

  /** Acute / right / obtuse / not a triangle from the listed side lengths. */
  'geometry.converse'(p) {
    const v = splitTop(mathSegments(p.question)[0]!, [',']).parts.map((t) => evalReal(t)).sort((a, b) => a - b);
    expect(v.length).toBe(3);
    const sq = v.map((x) => Math.round(x * x));
    const want = v[0]! + v[1]! <= v[2]! + 1e-12 ? 'Not a triangle' : sq[0]! + sq[1]! === sq[2]! ? 'Right' : sq[0]! + sq[1]! > sq[2]! ? 'Acute' : 'Obtuse';
    expect(p.answer, p.question).toBe(want);
  },

  /** The drawn triangles are congruent; the criterion follows from the marked plus shared/vertical parts. */
  'geometry.congruence'(p) {
    const c = p.check!;
    const T1 = c.T1 as Pt[];
    const T2 = c.T2 as Pt[];
    const d = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const side = (T: Pt[], i: number) => d(T[(i + 1) % 3]!, T[(i + 2) % 3]!);
    const angle = (T: Pt[], i: number) => angleAt(T[(i + 1) % 3]!, T[i]!, T[(i + 2) % 3]!);
    for (let i = 0; i < 3; i++) expect(close(side(T1, i), side(T2, i)), 'drawn triangles congruent').toBe(true);
    const S = [...(c.S as number[])];
    const A = [...(c.A as number[])];
    const same = (a: Pt, b: Pt) => d(a, b) < 1e-9;
    for (let i = 0; i < 3; i++) {
      const [a1, b1] = [T1[(i + 1) % 3]!, T1[(i + 2) % 3]!];
      const [a2, b2] = [T2[(i + 1) % 3]!, T2[(i + 2) % 3]!];
      if ((same(a1, a2) && same(b1, b2)) || (same(a1, b2) && same(b1, a2))) S.push(i);
      if (same(T1[i]!, T2[i]!)) {
        // vertical angles: each ray of one angle is opposite a ray of the other
        const u = [sub(T1[(i + 1) % 3]!, T1[i]!), sub(T1[(i + 2) % 3]!, T1[i]!)];
        const w = [sub(T2[(i + 1) % 3]!, T2[i]!), sub(T2[(i + 2) % 3]!, T2[i]!)];
        const opposite = (x: Pt, y: Pt) => Math.abs(x[0] * y[1] - x[1] * y[0]) < 1e-9 * Math.hypot(...x) * Math.hypot(...y) && x[0] * y[0] + x[1] * y[1] < 0;
        if ((opposite(u[0]!, w[0]!) && opposite(u[1]!, w[1]!)) || (opposite(u[0]!, w[1]!) && opposite(u[1]!, w[0]!))) A.push(i);
      }
    }
    const right = [0, 1, 2].find((i) => Math.abs(angle(T1, i) - 90) < 1e-6) ?? null;
    expect(p.answer, JSON.stringify({ S, A, right })).toBe(congruenceCriterion([...new Set(S)], [...new Set(A)], right));
  },

  /** Classification from the drawn triangle, or from side lengths via the converse of the Pythagorean theorem. */
  'geometry.classifyTriangle'(p) {
    const c = p.check!;
    if (c.pts) {
      const P = c.pts as Pt[];
      const sides = [0, 1, 2].map((i) => Math.hypot(P[(i + 1) % 3]![0] - P[(i + 2) % 3]![0], P[(i + 1) % 3]![1] - P[(i + 2) % 3]![1]));
      const angles = [0, 1, 2].map((i) => angleAt(P[(i + 1) % 3]!, P[i]!, P[(i + 2) % 3]!));
      expect(p.answer).toBe(triangleClass(sides, angles));
    } else {
      const s = questionNumbers(p).sort((a, b) => a - b);
      expect(s.length).toBe(3);
      expect(s[0]! + s[1]! > s[2]!).toBe(true);
      const d = s[0]! ** 2 + s[1]! ** 2 - s[2]! ** 2;
      const big = d === 0 ? 90 : d > 0 ? 60 : 120;
      expect(p.answer).toBe(triangleClass(s, [big]));
    }
  },

  /** |a − b| < x < a + b from the two given sides. */
  'geometry.ineqRange'(p) {
    const [a, b] = questionNumbers(p) as [number, number];
    const { parts, rels } = splitTop(mathSegments(p.answer)[0]!, ['<', '\\le']);
    expect(rels).toEqual(['<', '<']);
    expect(parts[1]).toBe('x');
    expect(close(evalReal(parts[0]!), Math.abs(a - b)) && close(evalReal(parts[2]!), a + b), `${p.question} → ${p.answer}`).toBe(true);
  },

  /** Sides ordered by opposite angles, or angles by opposite sides. */
  'geometry.order'(p) {
    const c = p.check!;
    const shown = visible(p);
    const items = splitTop(mathSegments(p.answer)[0]!, [',']).parts;
    if (c.angles) {
      const ang = c.angles as Record<string, number>;
      const names = Object.keys(ang);
      expect(close(names.reduce((s, n) => s + ang[n]!, 0), 180)).toBe(true);
      expect(names.filter((n) => shown.includes(norm(`${ang[n]}^\\circ`))).length).toBeGreaterThanOrEqual(2);
      const opp = (side: string) => names.find((n) => !side.includes(n))!;
      const vals = items.map((it) => ang[opp(/\\overline\{(\w+)\}/.exec(it)![1]!)]!);
      vals.slice(1).forEach((v, i) => expect(v, p.answer).toBeGreaterThan(vals[i]!));
    } else {
      const sides = c.sides as Record<string, number>;
      Object.values(sides).forEach((v) => expect(shown.includes(`|${v}|`) || shown.includes(`|${v}`)).toBe(true));
      const vals = items.map((it) => {
        const v = /\\angle (\w)/.exec(it)![1]!;
        return sides[Object.keys(sides).find((k) => !k.includes(v))!]!;
      });
      vals.slice(1).forEach((v, i) => expect(v, p.answer).toBeGreaterThan(vals[i]!));
    }
  },

  /** Average of the three vertices listed in the question. */
  'geometry.centroid'(p) {
    const V = tuplesIn(mathSegments(p.question).join(' '));
    expect(V.length).toBe(3);
    const G = tuplesIn(mathSegments(p.answer).join(' '))[0]!;
    expect(close(G[0]!, (V[0]![0]! + V[1]![0]! + V[2]![0]!) / 3) && close(G[1]!, (V[0]![1]! + V[1]![1]! + V[2]![1]!) / 3), p.answer).toBe(true);
  },

  /** Relationship of two numbered angles, read from where their numbers sit in the figure. */
  'geometry.transversal'(p) {
    const c = p.check!;
    const pair = c.pair as number[];
    const at = (n: number) => {
      const it = p.diagram!.items.find((i) => i.t === 'label' && i.tex === String(n));
      expect(it, `label ${n}`).toBeDefined();
      return (it as unknown as { p: Pt }).p;
    };
    expect(p.question).toContain(`\\angle ${pair[0]}`);
    expect(p.question).toContain(`\\angle ${pair[1]}`);
    expect(p.answer).toBe(transversalRelation(c.I as Pt[], c.u as Pt, c.t as Pt, at(pair[0]!), at(pair[1]!)));
  },

  /** Slopes and equations of parallel / perpendicular lines, from the question's equations. */
  'geometry.lines'(p) {
    const task = p.check!.task;
    const segs = mathSegments(p.question).filter((s) => s.includes('='));
    if (task === 'slope') {
      const L = lineOf(segs[0]!);
      const want = /perpendicular/.test(p.question) ? -1 / L.slope : L.slope;
      const got = assignments(p.answer);
      expect(got[0]!.lhs).toBe('m');
      expect(close(got[0]!.value, want), `${p.question} → ${p.answer}`).toBe(true);
    } else if (task === 'classify') {
      const [A, B] = segs.map(lineOf) as [ReturnType<typeof lineOf>, ReturnType<typeof lineOf>];
      const same = [-3, 0, 2.5].every((x) => close(B.at(x, A.slope * x - A.c / A.b), 0));
      const want = same ? 'Same line' : close(A.slope, B.slope) ? 'Parallel' : close(A.slope * B.slope, -1) ? 'Perpendicular' : 'Neither';
      expect(p.answer, p.question).toBe(want);
    } else {
      const P = tuplesIn(mathSegments(p.question).join(' '))[0]!;
      const L = lineOf(segs[0]!);
      const ans = mathSegments(p.answer)[0]!;
      expect(ans.startsWith('y ='), ans).toBe(true);
      const A = lineOf(ans);
      const want = /perpendicular/.test(p.question) ? -1 / L.slope : L.slope;
      expect(close(A.slope, want), `${p.question} → ${p.answer}`).toBe(true);
      expect(close(A.at(P[0]!, P[1]!), 0), `passes through (${P.join(', ')})`).toBe(true);
    }
  },

  /** The question gives midpoint M then endpoint; the answer is the other endpoint. */
  'geometry.endpoint'(p) {
    const q = tuplesIn(mathSegments(p.question).join(' '));
    expect(q.length, p.question).toBe(2);
    const [M, A] = q as [number[], number[]];
    const got = tuplesIn(mathSegments(p.answer).join(' '));
    expect(got.length).toBe(1);
    const E = got[0]!;
    expect(close((A[0]! + E[0]!) / 2, M[0]!) && close((A[1]! + E[1]!) / 2, M[1]!), `${p.question} → ${p.answer}`).toBe(true);
  },

  /** Angle class from the drawn rays (figure) or the stated measure. */
  'geometry.classifyAngle'(p) {
    const c = p.check!;
    let v: number;
    if (c.pts) {
      const [a, o, b] = c.pts as [Pt, Pt, Pt];
      v = angleAt(a, o, b);
      if (Math.abs(v - 90) < 1e-4) v = 90;
      if (Math.abs(v - 180) < 1e-4) v = 180;
      // a right angle must carry the square mark
      if (v === 90) expect(c.right).toBe(true);
    } else {
      const seg = mathSegments(p.question)[0]!;
      v = evalReal(noDeg(splitTop(seg, ['=']).parts[1]!));
    }
    expect(p.answer).toBe(classifyAngle(v));
  },
};

export { angleAt, close, labelsOf, noDeg, norm, visible };

// ================================================================ two-column proofs
//
// The checker reads the rendered proof table (and the Given / Prove lines of the
// question), parses every statement, checks that it is true in the figure, and
// that its reason really justifies it from earlier statements and the figure.

type Tri3 = [Pt, Pt, Pt];

type St =
  | { k: 'segc'; a: string; b: string }
  | { k: 'angc'; a: string; b: string }
  | { k: 'tric' | 'sim'; a: string; b: string }
  | { k: 'par' | 'perp'; a: string; b: string }
  | { k: 'mid'; p: string; s: string }
  | { k: 'bis'; ray: string; ang: string }
  | { k: 'supp' | 'rights'; a: string; b: string }
  | { k: 'rtri'; a: string; b: string }
  | { k: 'eq'; tex: string };

interface ProofFig {
  points: Record<string, Pt>;
  lines: Record<string, [Pt, Pt]>;
  numbered: Record<string, Tri3>;
}

const squash = (s: string) => s.replace(/\s+/g, '').replace(/\\ /g, '');

export function parseStatement(tex: string): St {
  const s = squash(tex);
  let mm: RegExpExecArray | null;
  if ((mm = /^\\overline\{(\w+)\}\\cong\\overline\{(\w+)\}$/.exec(s))) return { k: 'segc', a: mm[1]!, b: mm[2]! };
  if ((mm = /^\\angle(\w+)\\cong\\angle(\w+)$/.exec(s))) return { k: 'angc', a: mm[1]!, b: mm[2]! };
  if ((mm = /^\\triangle(\w+)\\cong\\triangle(\w+)$/.exec(s))) return { k: 'tric', a: mm[1]!, b: mm[2]! };
  if ((mm = /^\\triangle(\w+)\\sim\\triangle(\w+)$/.exec(s))) return { k: 'sim', a: mm[1]!, b: mm[2]! };
  const line = '(?:\\\\overline\\{(\\w+)\\}|([a-z]))';
  if ((mm = new RegExp(`^${line}\\\\parallel${line}$`).exec(s))) return { k: 'par', a: mm[1] ?? mm[2]!, b: mm[3] ?? mm[4]! };
  if ((mm = /^\\overline\{(\w+)\}\\perp\\overline\{(\w+)\}$/.exec(s))) return { k: 'perp', a: mm[1]!, b: mm[2]! };
  if ((mm = /^(\w)\\text\{isthemidpointof\}\\overline\{(\w+)\}$/.exec(s))) return { k: 'mid', p: mm[1]!, s: mm[2]! };
  if ((mm = /^\\overrightarrow\{(\w+)\}\\text\{bisects\}\\angle(\w+)$/.exec(s))) return { k: 'bis', ray: mm[1]!, ang: mm[2]! };
  if ((mm = /^\\angle(\w+)\\text\{and\}\\angle(\w+)\\text\{aresupplementary\}$/.exec(s))) return { k: 'supp', a: mm[1]!, b: mm[2]! };
  if ((mm = /^\\angle(\w+)\\text\{and\}\\angle(\w+)\\text\{arerightangles\}$/.exec(s))) return { k: 'rights', a: mm[1]!, b: mm[2]! };
  if ((mm = /^\\triangle(\w+)\\text\{and\}\\triangle(\w+)\\text\{arerighttriangles\}$/.exec(s))) return { k: 'rtri', a: mm[1]!, b: mm[2]! };
  if (s.includes('=') && !s.includes('\\cong')) return { k: 'eq', tex: tex.trim() };
  throw new Error(`unparsed statement: ${tex}`);
}

/** Rows of a proof table (rich-text `| … | … |` lines): [statement tex, reason text]. */
export function parseTable(rich: string): Array<[string, string]> {
  const tables = parseBlocks(rich).filter((bl): bl is Extract<Block, { kind: 'table' }> => bl.kind === 'table');
  expect(tables.length, `one table in ${rich}`).toBe(1);
  const t = tables[0]!;
  expect(t.header, 'header').toEqual(['Statements', 'Reasons']);
  return t.rows.map((cells, i) => {
    expect(cells.length, `two cells in row ${i + 1}`).toBe(2);
    const mm = /^(\d+)\.\s*\$(.*)\$$/.exec(cells[0]!);
    if (!mm) throw new Error(`statement cell ${cells[0]}`);
    expect(Number(mm[1]), 'row numbers').toBe(i + 1);
    return [mm[2]!, cells[1]!];
  });
}

const dist2 = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const unitv = (v: Pt): Pt => {
  const l = Math.hypot(v[0], v[1]);
  return [v[0] / l, v[1] / l];
};
const crossv = (a: Pt, b: Pt) => a[0] * b[1] - a[1] * b[0];
const dotv = (a: Pt, b: Pt) => a[0] * b[0] + a[1] * b[1];
const sameDir = (a: Pt, b: Pt) => Math.abs(crossv(unitv(a), unitv(b))) < 1e-7 && dotv(a, b) > 0;
const opposite = (a: Pt, b: Pt) => Math.abs(crossv(unitv(a), unitv(b))) < 1e-7 && dotv(a, b) < 0;
const near = (a: Pt, b: Pt) => dist2(a, b) < 1e-7;

class ProofChecker {
  constructor(readonly fig: ProofFig) {}

  pt(n: string): Pt {
    const p = this.fig.points[n];
    if (!p) throw new Error(`unknown point ${n}`);
    return p;
  }
  angle(name: string): Tri3 {
    if (/^\d+$/.test(name)) {
      const t = this.fig.numbered[name];
      if (!t) throw new Error(`unknown angle ${name}`);
      return t;
    }
    if (name.length !== 3) throw new Error(`bad angle ${name}`);
    return [this.pt(name[0]!), this.pt(name[1]!), this.pt(name[2]!)];
  }
  measure(name: string): number {
    const [a, v, c] = this.angle(name);
    return angleAt(a, v, c);
  }
  sameAngle(x: string, y: string): boolean {
    return this.sameTri(this.angle(x), this.angle(y));
  }
  sameTri([a1, v1, c1]: Tri3, [a2, v2, c2]: Tri3): boolean {
    if (!near(v1, v2)) return false;
    const r1 = [sub(a1, v1), sub(c1, v1)];
    const r2 = [sub(a2, v2), sub(c2, v2)];
    return (sameDir(r1[0]!, r2[0]!) && sameDir(r1[1]!, r2[1]!)) || (sameDir(r1[0]!, r2[1]!) && sameDir(r1[1]!, r2[0]!));
  }
  segLen(s: string): number {
    return dist2(this.pt(s[0]!), this.pt(s[1]!));
  }
  line(ref: string): [Pt, Pt] {
    if (ref.length === 1) {
      const l = this.fig.lines[ref];
      if (!l) throw new Error(`unknown line ${ref}`);
      return l;
    }
    return [this.pt(ref[0]!), this.pt(ref[1]!)];
  }
  onLine(p: Pt, [a, b]: [Pt, Pt]): boolean {
    return Math.abs(crossv(unitv(sub(b, a)), sub(p, a))) < 1e-7;
  }
  alongLine(v: Pt, [a, b]: [Pt, Pt]): boolean {
    return Math.abs(crossv(unitv(sub(b, a)), unitv(v))) < 1e-7;
  }
  vertical(x: string, y: string): boolean {
    const [a1, v1, c1] = this.angle(x);
    const [a2, v2, c2] = this.angle(y);
    if (!near(v1, v2)) return false;
    const r1 = [sub(a1, v1), sub(c1, v1)];
    const r2 = [sub(a2, v2), sub(c2, v2)];
    return (opposite(r1[0]!, r2[0]!) && opposite(r1[1]!, r2[1]!)) || (opposite(r1[0]!, r2[1]!) && opposite(r1[1]!, r2[0]!));
  }
  linearPair(x: string, y: string): boolean {
    const [a1, v1, c1] = this.angle(x);
    const [a2, v2, c2] = this.angle(y);
    if (!near(v1, v2)) return false;
    const r1 = [sub(a1, v1), sub(c1, v1)];
    const r2 = [sub(a2, v2), sub(c2, v2)];
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) if (sameDir(r1[i]!, r2[j]!) && opposite(r1[1 - i]!, r2[1 - j]!)) return true;
    return false;
  }
  /** Relation of two angles formed by lines l1, l2 and the transversal through their vertices. */
  relation(x: string, y: string, l1: [Pt, Pt], l2: [Pt, Pt]): string | null {
    const A = this.angle(x);
    const B = this.angle(y);
    let [p, q] = [A, B];
    let [m1, m2] = [l1, l2];
    if (!this.onLine(p[1], m1)) [m1, m2] = [m2, m1];
    if (!this.onLine(p[1], m1) || !this.onLine(q[1], m2) || this.onLine(p[1], m2) || this.onLine(q[1], m1)) return null;
    const t = sub(q[1], p[1]);
    const split = (tri: Tri3, lineSeg: [Pt, Pt]) => {
      const rays = [sub(tri[0], tri[1]), sub(tri[2], tri[1])];
      const ti = rays.findIndex((r) => this.alongLine(r, [p[1], q[1]]));
      if (ti < 0 || !this.alongLine(rays[1 - ti]!, lineSeg)) return null;
      return { tr: rays[ti]!, lr: rays[1 - ti]! };
    };
    const s1 = split(p, m1);
    const s2 = split(q, m2);
    if (!s1 || !s2) return null;
    const in1 = dotv(s1.tr, t) > 0;
    const in2 = dotv(s2.tr, t) < 0;
    const same = Math.sign(crossv(t, s1.lr)) === Math.sign(crossv(t, s2.lr));
    if (in1 && in2) return same ? 'ssi' : 'altInt';
    if (!in1 && !in2) return same ? 'sse' : 'altExt';
    return same ? 'corr' : null;
  }

  /** Is the statement true in the figure? */
  holds(st: St, linearValue: (tex: string) => number): boolean {
    const eqA = (u: number, v: number) => Math.abs(u - v) < 1e-6 * Math.max(1, u, v);
    switch (st.k) {
      case 'segc':
        return eqA(this.segLen(st.a), this.segLen(st.b));
      case 'angc':
        return eqA(this.measure(st.a), this.measure(st.b));
      case 'tric':
      case 'sim': {
        const r = [0, 1, 2].map((k) => this.segLen(st.b[(k + 1) % 3]! + st.b[(k + 2) % 3]!) / this.segLen(st.a[(k + 1) % 3]! + st.a[(k + 2) % 3]!));
        return eqA(r[0]!, r[1]!) && eqA(r[1]!, r[2]!) && (st.k === 'sim' || eqA(r[0]!, 1));
      }
      case 'par':
      case 'perp': {
        const [a, b] = this.line(st.a);
        const [c, d] = this.line(st.b);
        const u = unitv(sub(b, a));
        const w = unitv(sub(d, c));
        return st.k === 'par' ? Math.abs(crossv(u, w)) < 1e-7 && !this.onLine(c, [a, b]) : Math.abs(dotv(u, w)) < 1e-7;
      }
      case 'mid':
        return near(this.pt(st.p), [(this.pt(st.s[0]!)[0] + this.pt(st.s[1]!)[0]) / 2, (this.pt(st.s[0]!)[1] + this.pt(st.s[1]!)[1]) / 2]);
      case 'bis': {
        const [A, V, C] = [this.pt(st.ang[0]!), this.pt(st.ang[1]!), this.pt(st.ang[2]!)];
        const D = this.pt(st.ray[1]!);
        return st.ray[0] === st.ang[1] && eqA(angleAt(A, V, D), angleAt(D, V, C)) && eqA(angleAt(A, V, D) * 2, angleAt(A, V, C));
      }
      case 'supp':
        return eqA(this.measure(st.a) + this.measure(st.b), 180);
      case 'rights':
        return eqA(this.measure(st.a), 90) && eqA(this.measure(st.b), 90);
      case 'rtri':
        return [st.a, st.b].every((t) => [0, 1, 2].some((k) => eqA(angleAt(this.pt(t[(k + 1) % 3]!), this.pt(t[k]!), this.pt(t[(k + 2) % 3]!)), 90)));
      case 'eq':
        return Math.abs(linearValue(st.tex)) < 1e-6;
    }
  }
}

/** Measures in an equation (`AB`, `m\angle ABC`, `m\angle 1`) as evaluator variables. */
class MeasureVars {
  readonly keys: string[] = [];
  readonly values: number[] = [];
  constructor(readonly c: ProofChecker) {}
  private idx(kind: 'seg' | 'ang', name: string): number {
    for (let i = 0; i < this.keys.length; i++) {
      const k = this.keys[i]!;
      if (kind === 'seg' && k === `s:${[...name].sort().join('')}`) return i;
      if (kind === 'ang' && k.startsWith('a:') && this.c.sameAngle(k.slice(2), name)) return i;
    }
    this.keys.push(kind === 'seg' ? `s:${[...name].sort().join('')}` : `a:${name}`);
    this.values.push(kind === 'seg' ? this.c.segLen(name) : this.c.measure(name));
    return this.keys.length - 1;
  }
  /** Equation tex → evaluator tex with v_{i} variables. */
  rewrite(tex: string): string {
    return tex
      .replace(/\^\{?\\circ\}?/g, '')
      .replace(/m\\angle\s*(\d+|[A-Z]{3})/g, (_, n: string) => ` v_{${this.idx('ang', n)}} `)
      .replace(/(?<![\\A-Za-z])([A-Z]{2})(?![A-Za-z])/g, (_, n: string) => ` v_{${this.idx('seg', n)}} `);
  }
  env(vals: number[]): Record<string, number> {
    return Object.fromEntries(vals.map((v, i) => [`v_${i}`, v]));
  }
}

const ALG_SAMPLES = [-2.3, 0.7, 3.1];

/** Check a full proof; returns an error message or null when the proof is valid. */
export function checkProof(rows: Array<[string, string]>, givens: string[], prove: string, fig: ProofFig): string | null {
  const c = new ProofChecker(fig);
  const mv = new MeasureVars(c);
  const algebra = rows.some(([s]) => /(?<![a-z\\])x(?![a-z])/.test(s) && !/\\angle|\\overline/.test(s));
  const sts: St[] = [];
  try {
    for (const [s] of rows) sts.push(parseStatement(s));
  } catch (e) {
    return (e as Error).message;
  }
  const sides = (tex: string) => {
    const { parts, rels } = splitTop(tex, ['=']);
    if (rels.length !== 1) throw new Error(`not one '=': ${tex}`);
    return [parts[0]!, parts[1]!] as const;
  };
  // equation as a function of a sample index (algebra: x; geometry: measure vars)
  const nVars = () => mv.keys.length;
  const samples = (k: number): Record<string, number> =>
    algebra ? { x: ALG_SAMPLES[k] ?? 1 } : mv.env(Array.from({ length: nVars() + 8 }, (_, i) => (k === 3 ? 1 : Math.sin(1.7 * i + 2.1 * k + 0.4) * 3 + 1.3 * k)));
  const sideFn = (t: string) => (k: number) => evalReal(algebra ? t : mv.rewrite(t), { vars: samples(k) });
  const fns = (tex: string) => {
    const [l, r] = sides(tex);
    return [sideFn(l), sideFn(r)] as const;
  };
  const same = (f: (k: number) => number, g: (k: number) => number) => [0, 1, 2].every((k) => Math.abs(f(k) - g(k)) < 1e-7 * Math.max(1, Math.abs(f(k))));
  // linear form of an equation (geometry): coefficient vector over measure vars + constant
  const linForm = (tex: string): number[] => {
    const [l, r] = sides(mv.rewrite(tex));
    const f = (vals: number[]) => evalReal(l, { vars: mv.env(vals) }) - evalReal(r, { vars: mv.env(vals) });
    const n = nVars();
    const zero = Array(n).fill(0) as number[];
    const c0 = f(zero);
    const coefs = zero.map((_, i) => f(zero.map((z, j) => (j === i ? 1 : z))) - c0);
    const test = zero.map((_, i) => 0.3 + i * 0.7);
    if (Math.abs(f(test) - (c0 + coefs.reduce((s, a, i) => s + a * test[i]!, 0))) > 1e-6) throw new Error(`nonlinear ${tex}`);
    return [...coefs, c0];
  };
  const vecOf = (st: St): number[] | null => {
    if (st.k === 'eq') return linForm(st.tex);
    if (st.k === 'segc') return linForm(`${st.a} = ${st.b}`);
    if (st.k === 'angc') return linForm(`m\\angle ${st.a} = m\\angle ${st.b}`);
    if (st.k === 'supp') return linForm(`m\\angle ${st.a} + m\\angle ${st.b} = 180`);
    return null;
  };
  const inSpan = (target: number[], basis: number[][]): boolean => {
    const n = target.length;
    const pad = (v: number[]) => [...v.slice(0, -1), ...Array(n - v.length).fill(0), v[v.length - 1]!];
    const rowsM = basis.map(pad).map((v) => [...v]);
    // Gaussian elimination, then reduce the target
    const piv: number[] = [];
    let r = 0;
    for (let col = 0; col < n && r < rowsM.length; col++) {
      let best = r;
      for (let i = r; i < rowsM.length; i++) if (Math.abs(rowsM[i]![col]!) > Math.abs(rowsM[best]![col]!)) best = i;
      if (Math.abs(rowsM[best]![col]!) < 1e-9) continue;
      [rowsM[r], rowsM[best]] = [rowsM[best]!, rowsM[r]!];
      for (let i = 0; i < rowsM.length; i++) {
        if (i === r) continue;
        const f = rowsM[i]![col]! / rowsM[r]![col]!;
        for (let j = 0; j < n; j++) rowsM[i]![j]! -= f * rowsM[r]![j]!;
      }
      piv.push(col);
      r++;
    }
    const t = [...target];
    piv.forEach((col, i) => {
      const f = t[col]! / rowsM[i]![col]!;
      for (let j = 0; j < n; j++) t[j]! -= f * rowsM[i]![j]!;
    });
    return t.every((v) => Math.abs(v) < 1e-7);
  };
  const isSeg = (st: St, a: string, b: string) => st.k === 'segc' && ((sameSegName(st.a, a) && sameSegName(st.b, b)) || (sameSegName(st.a, b) && sameSegName(st.b, a)));
  const sameSegName = (x: string, y: string) => [...x].sort().join('') === [...y].sort().join('');
  const congOf = (st: St, x: string, y: string, kind: 'segc' | 'angc') =>
    st.k === kind && (kind === 'segc' ? isSeg(st, x, y) : (c.sameAngle(st.a, x) && c.sameAngle(st.b, y)) || (c.sameAngle(st.a, y) && c.sameAngle(st.b, x)));
  const norms = givens.map(squash);
  const triAngle = (t: string, k: number): Tri3 => [c.pt(t[(k + 1) % 3]!), c.pt(t[k]!), c.pt(t[(k + 2) % 3]!)];

  for (let i = 0; i < rows.length; i++) {
    const [stTex, reason] = rows[i]!;
    const st = sts[i]!;
    const prior = sts.slice(0, i);
    const where = `row ${i + 1} (${stTex} | ${reason})`;
    try {
      if (algebra) {
        if (st.k !== 'eq') return `${where}: not an equation`;
        // every equation has the solution of the given one
        const [l0, r0] = fns(rows[0]![0]);
        const [l, r] = fns(stTex);
        const root = (f: (k: number) => number, g: (k: number) => number) => {
          const d0 = f(0) - g(0);
          const d1 = f(1) - g(1);
          return ALG_SAMPLES[0]! - (d0 * (ALG_SAMPLES[1]! - ALG_SAMPLES[0]!)) / (d1 - d0);
        };
        if (Math.abs(root(l, r) - root(l0, r0)) > 1e-7) return `${where}: not equivalent to the given equation`;
      } else if (
        !c.holds(st, (t) => {
          const [l, r] = sides(mv.rewrite(t));
          return evalReal(l, { vars: mv.env(mv.values) }) - evalReal(r, { vars: mv.env(mv.values) });
        })
      )
        return `${where}: false in the figure`;

      // in algebraic proofs each step follows from the line just above it
      const prevEqs = (algebra ? prior.slice(-1) : prior).filter((p): p is { k: 'eq'; tex: string } => p.k === 'eq');
      const ok = ((): boolean => {
        switch (reason) {
          case 'Given':
            return norms.includes(squash(stTex));
          case 'Reflexive Property':
            if (st.k === 'segc') return sameSegName(st.a, st.b);
            if (st.k === 'angc') return c.sameAngle(st.a, st.b);
            if (st.k === 'eq') return squash(sides(st.tex)[0]) === squash(sides(st.tex)[1]);
            return false;
          case 'Symmetric Property of Equality': {
            if (st.k !== 'eq') return false;
            const [l, r] = fns(st.tex);
            return prevEqs.some((p) => {
              const [pl, pr] = fns(p.tex);
              return same(l, pr) && same(r, pl) && squash(p.tex) !== squash(st.tex);
            });
          }
          case 'Transitive Property': {
            if (st.k !== 'segc' && st.k !== 'angc') return false;
            const kind = st.k;
            const pairs = prior.filter((p) => p.k === kind) as Array<{ a: string; b: string }>;
            const eqName = (x: string, y: string) => (kind === 'segc' ? sameSegName(x, y) : c.sameAngle(x, y));
            for (const p1 of pairs)
              for (const p2 of pairs) {
                if (p1 === p2) continue;
                for (const [x, y] of [[p1.a, p1.b], [p1.b, p1.a]] as const)
                  for (const [y2, z] of [[p2.a, p2.b], [p2.b, p2.a]] as const)
                    if (eqName(y, y2) && !eqName(x, y) && !eqName(y, z) && ((eqName(x, st.a) && eqName(z, st.b)) || (eqName(x, st.b) && eqName(z, st.a)))) return true;
              }
            return false;
          }
          case 'Substitution Property': {
            if (st.k !== 'eq' || algebra) return false;
            const target = linForm(st.tex);
            const basis = prior.map(vecOf).filter((v): v is number[] => v !== null);
            if (basis.some((v) => inSpan(target, [v]))) return false;
            return inSpan(target, basis);
          }
          case 'Definition of Congruent Segments':
          case 'Definition of Congruent Angles': {
            const kind = reason === 'Definition of Congruent Segments' ? 'segc' : 'angc';
            const target = vecOf(st);
            if (!target) return false;
            if (st.k === kind) return prevEqs.some((p) => inSpan(linForm(p.tex), [target]) && inSpan(target, [linForm(p.tex)]));
            if (st.k !== 'eq') return false;
            // a single measure on each side
            if (!sides(st.tex).every((side) => /^(m\\angle\s*\w+|[A-Z]{2})$/.test(side.trim()))) return false;
            const nz = target.slice(0, -1).filter((v) => Math.abs(v) > 1e-9);
            if (nz.length !== 2 || Math.abs(target[target.length - 1]!) > 1e-9) return false;
            return prior.some((p) => p.k === kind && inSpan(vecOf(p)!, [target]) && inSpan(target, [vecOf(p)!]));
          }
          case 'Definition of Midpoint':
            return st.k === 'segc' && prior.some((p) => p.k === 'mid' && isSeg(st, p.s[0]! + p.p, p.p + p.s[1]!));
          case 'Definition of Angle Bisector':
            return st.k === 'angc' && prior.some((p) => p.k === 'bis' && congOf(st, p.ang[0]! + p.ang[1]! + p.ray[1]!, p.ray[1]! + p.ang[1]! + p.ang[2]!, 'angc'));
          case 'Segment Addition Postulate': {
            if (st.k !== 'eq') return false;
            const names = [...squash(st.tex).matchAll(/(?<![\\A-Za-z])([A-Z]{2})(?![A-Za-z])/g)].map((x) => x[1]!);
            if (names.length !== 3) return false;
            const v = linForm(st.tex);
            if (Math.abs(v[v.length - 1]!) > 1e-9) return false;
            // which one is the whole?  the two parts share the middle point
            for (let w = 0; w < 3; w++) {
              const parts = names.filter((_, j) => j !== w);
              const shared = [...parts[0]!].find((ch) => parts[1]!.includes(ch));
              if (!shared) continue;
              const ends = [...parts[0]!, ...parts[1]!].filter((ch) => ch !== shared);
              if (!sameSegName(ends.join(''), names[w]!)) continue;
              const [X, Y, Z] = [c.pt(ends[0]!), c.pt(shared), c.pt(ends[1]!)];
              const between = Math.abs(dist2(X, Y) + dist2(Y, Z) - dist2(X, Z)) < 1e-7;
              const exp = linForm(`${parts[0]} + ${parts[1]} = ${names[w]}`);
              if (between && (inSpan(v, [exp]) && inSpan(exp, [v]))) return true;
            }
            return false;
          }
          case 'Angle Addition Postulate': {
            if (st.k !== 'eq') return false;
            const names = [...squash(st.tex).matchAll(/m\\angle(\d+|[A-Z]{3})/g)].map((x) => x[1]!);
            if (names.length !== 3) return false;
            const v = linForm(st.tex);
            for (let w = 0; w < 3; w++) {
              const parts = names.filter((_, j) => j !== w);
              const exp = linForm(`m\\angle ${parts[0]} + m\\angle ${parts[1]} = m\\angle ${names[w]}`);
              if (!(inSpan(v, [exp]) && inSpan(exp, [v]))) continue;
              const [a1, v1, c1] = c.angle(parts[0]!);
              const [a2, v2, c2] = c.angle(parts[1]!);
              const W = c.angle(names[w]!);
              if (!near(v1, v2) || !near(v1, W[1])) continue;
              const r1 = [sub(a1, v1), sub(c1, v1)];
              const r2 = [sub(a2, v2), sub(c2, v2)];
              for (let i1 = 0; i1 < 2; i1++)
                for (let i2 = 0; i2 < 2; i2++)
                  if (sameDir(r1[i1]!, r2[i2]!)) {
                    const outer: Tri3 = [add2(v1, r1[1 - i1]!), v1, add2(v1, r2[1 - i2]!)];
                    if (c.sameTri(outer, W) && Math.abs(c.measure(parts[0]!) + c.measure(parts[1]!) - c.measure(names[w]!)) < 1e-6) return true;
                  }
            }
            return false;
          }
          case 'Vertical Angles Theorem':
            return st.k === 'angc' && c.vertical(st.a, st.b);
          case 'Linear Pair Postulate':
            return st.k === 'supp' && c.linearPair(st.a, st.b);
          case 'Definition of Supplementary Angles': {
            if (st.k === 'eq') {
              const v = linForm(st.tex);
              return prior.some((p) => p.k === 'supp' && inSpan(vecOf(p)!, [v]) && inSpan(v, [vecOf(p)!]));
            }
            if (st.k === 'supp') return prevEqs.some((p) => inSpan(linForm(p.tex), [vecOf(st)!]) && inSpan(vecOf(st)!, [linForm(p.tex)]));
            return false;
          }
          case 'Congruent Supplements Theorem': {
            if (st.k !== 'angc') return false;
            const supps = prior.filter((p) => p.k === 'supp') as Array<{ a: string; b: string }>;
            const partner = (x: string) => supps.flatMap((p) => (c.sameAngle(p.a, x) ? [p.b] : c.sameAngle(p.b, x) ? [p.a] : []));
            return partner(st.a).some((b1) => partner(st.b).some((b2) => c.sameAngle(b1, b2) || prior.some((p) => congOf(p, b1, b2, 'angc'))));
          }
          case 'Definition of Perpendicular Lines': {
            if (st.k !== 'rights') return false;
            return prior.some((p) => {
              if (p.k !== 'perp') return false;
              const l1 = c.line(p.a);
              const l2 = c.line(p.b);
              return [st.a, st.b].every((n) => {
                const [a, v, cc] = c.angle(n);
                const r = [sub(a, v), sub(cc, v)];
                return c.onLine(v, l1) && c.onLine(v, l2) && ((c.alongLine(r[0]!, l1) && c.alongLine(r[1]!, l2)) || (c.alongLine(r[0]!, l2) && c.alongLine(r[1]!, l1)));
              });
            });
          }
          case 'Right Angles Congruence Theorem': {
            if (st.k !== 'angc') return false;
            const rights = prior.flatMap((p) => (p.k === 'rights' ? [p.a, p.b] : []));
            return [st.a, st.b].every((n) => rights.some((r) => c.sameAngle(r, n)));
          }
          case 'Definition of Right Triangle': {
            if (st.k !== 'rtri') return false;
            const rights = prior.flatMap((p) => (p.k === 'rights' ? [p.a, p.b] : []));
            return [st.a, st.b].every((t) => [0, 1, 2].some((k) => rights.some((r) => c.sameTri(c.angle(r), triAngle(t, k)))));
          }
          case 'Corresponding Angles Postulate':
          case 'Alternate Interior Angles Theorem':
          case 'Alternate Exterior Angles Theorem':
          case 'Same-Side Interior Angles Theorem': {
            const want = { 'Corresponding Angles Postulate': 'corr', 'Alternate Interior Angles Theorem': 'altInt', 'Alternate Exterior Angles Theorem': 'altExt', 'Same-Side Interior Angles Theorem': 'ssi' }[reason]!;
            if (want === 'ssi' ? st.k !== 'supp' : st.k !== 'angc') return false;
            const s2 = st as { a: string; b: string };
            return prior.some((p) => p.k === 'par' && c.relation(s2.a, s2.b, c.line(p.a), c.line(p.b)) === want);
          }
          case 'Converse of the Corresponding Angles Postulate':
          case 'Converse of the Alternate Interior Angles Theorem':
          case 'Converse of the Alternate Exterior Angles Theorem':
          case 'Converse of the Same-Side Interior Angles Theorem': {
            if (st.k !== 'par') return false;
            const want = { 'Converse of the Corresponding Angles Postulate': 'corr', 'Converse of the Alternate Interior Angles Theorem': 'altInt', 'Converse of the Alternate Exterior Angles Theorem': 'altExt', 'Converse of the Same-Side Interior Angles Theorem': 'ssi' }[reason]!;
            const kind = want === 'ssi' ? 'supp' : 'angc';
            return prior.some((p) => p.k === kind && c.relation((p as { a: string }).a, (p as { b: string }).b, c.line(st.a), c.line(st.b)) === want);
          }
          case 'SSS':
          case 'SAS':
          case 'ASA':
          case 'AAS':
          case 'HL': {
            if (st.k !== 'tric') return false;
            const [T1, T2] = [st.a, st.b];
            const S: number[] = [];
            const A: number[] = [];
            for (let k = 0; k < 3; k++) {
              const [i, j] = [(k + 1) % 3, (k + 2) % 3];
              const s1 = T1[i]! + T1[j]!;
              const s2 = T2[i]! + T2[j]!;
              if (prior.some((p) => p.k === 'segc' && ((sameSegName(p.a, s1) && sameSegName(p.b, s2)) || (sameSegName(p.b, s1) && sameSegName(p.a, s2)))))
                S.push(k);
              if (prior.some((p) => p.k === 'angc' && ((c.sameTri(c.angle(p.a), triAngle(T1, k)) && c.sameTri(c.angle(p.b), triAngle(T2, k))) || (c.sameTri(c.angle(p.b), triAngle(T1, k)) && c.sameTri(c.angle(p.a), triAngle(T2, k))))))
                A.push(k);
            }
            let rightIdx: number | null = null;
            const rt = prior.some((p) => p.k === 'rtri' && [...p.a].sort().join('') === [...T1].sort().join('') && [...p.b].sort().join('') === [...T2].sort().join(''));
            if (rt) {
              const k = [0, 1, 2].find((kk) => Math.abs(angleAt(...triAngle(T1, kk)) - 90) < 1e-6 && Math.abs(angleAt(...triAngle(T2, kk)) - 90) < 1e-6);
              if (k !== undefined) {
                rightIdx = k;
                if (!A.includes(k)) A.push(k);
              }
            }
            return congruenceCriterion(S, A, rightIdx) === reason;
          }
          case 'CPCTC':
          case 'Definition of Similar Triangles': {
            const kind = reason === 'CPCTC' ? 'tric' : 'sim';
            const tris = prior.filter((p) => p.k === kind) as Array<{ a: string; b: string }>;
            return tris.some(({ a: T1, b: T2 }) => {
              const map = (s: string) => [...s].map((ch) => (T1.includes(ch) ? T2[T1.indexOf(ch)]! : '?')).join('');
              if (kind === 'tric') {
                const inT1 = (x: string) => [...x].every((ch) => T1.includes(ch));
                if (st.k === 'segc') return (inT1(st.a) && sameSegName(map(st.a), st.b)) || (inT1(st.b) && sameSegName(map(st.b), st.a));
                if (st.k === 'angc') return [0, 1, 2].some((k) => (c.sameTri(c.angle(st.a), triAngle(T1, k)) && c.sameTri(c.angle(st.b), triAngle(T2, k))) || (c.sameTri(c.angle(st.b), triAngle(T1, k)) && c.sameTri(c.angle(st.a), triAngle(T2, k))));
                return false;
              }
              if (st.k !== 'eq') return false;
              const fr = [...squash(st.tex).matchAll(/\\frac\{([A-Z]{2})\}\{([A-Z]{2})\}/g)].map((x) => [x[1]!, x[2]!] as const);
              if (fr.length !== 2) return false;
              // both ratios are (side of T1) / (corresponding side of T2), or both the other way
              const inT1 = (x: string) => [...x].every((ch) => T1.includes(ch));
              const fwd = fr.every(([n, d]) => inT1(n) && sameSegName(map(n), d));
              const inv = (s: string) => [...s].map((ch) => (T2.includes(ch) ? T1[T2.indexOf(ch)]! : '?')).join('');
              const inT2 = (x: string) => [...x].every((ch) => T2.includes(ch));
              const bwd = fr.every(([n, d]) => inT2(n) && sameSegName(inv(n), d));
              return fwd || bwd;
            });
          }
          case 'AA Similarity': {
            if (st.k !== 'sim') return false;
            let count = 0;
            for (let k = 0; k < 3; k++)
              if (
                prior.some(
                  (p) =>
                    p.k === 'angc' &&
                    ((c.sameTri(c.angle(p.a), triAngle(st.a, k)) && c.sameTri(c.angle(p.b), triAngle(st.b, k))) || (c.sameTri(c.angle(p.b), triAngle(st.a, k)) && c.sameTri(c.angle(p.a), triAngle(st.b, k)))),
                )
              )
                count++;
            return count >= 2;
          }
          // ---- properties of equality (algebra, and simplifying measure equations)
          case 'Distributive Property':
          case 'Simplify':
          case 'Addition Property of Equality':
          case 'Subtraction Property of Equality':
          case 'Multiplication Property of Equality':
          case 'Division Property of Equality': {
            if (st.k !== 'eq') return false;
            const [l, r] = fns(st.tex);
            return prevEqs.some((p) => {
              const [pl, pr] = fns(p.tex);
              const parens = (t: string) => (t.match(/\(/g) ?? []).length;
              if (same(l, pl) && same(r, pr)) {
                if (squash(p.tex) === squash(st.tex)) return false;
                if (reason === 'Distributive Property') return parens(st.tex) < parens(p.tex);
                return reason === 'Simplify' && parens(st.tex) === parens(p.tex);
              }
              const dl = [0, 1, 2].map((k) => l(k) - pl(k));
              const dr = [0, 1, 2].map((k) => r(k) - pr(k));
              if (dl.every((v, k) => Math.abs(v - dr[k]!) < 1e-7 * Math.max(1, Math.abs(v)))) {
                if (dl.every((v) => Math.abs(v) < 1e-9)) return false;
                // the added quantity: a constant or a multiple of x (or of one measure)
                const varying = Math.abs(dl[0]! - dl[1]!) > 1e-9 || Math.abs(dl[1]! - dl[2]!) > 1e-9;
                // sign of the added quantity: constant, a multiple of x, or a (positive) measure
                let sign: number;
                if (!varying) sign = Math.sign(dl[0]!);
                else if (algebra) {
                  const slope = (dl[2]! - dl[0]!) / (ALG_SAMPLES[2]! - ALG_SAMPLES[0]!);
                  if (Math.abs(dl[0]! - slope * ALG_SAMPLES[0]!) > 1e-7) return false; // must be a pure multiple of x
                  sign = Math.sign(slope);
                } else sign = Math.sign(l(3) - pl(3));
                return reason === (sign > 0 ? 'Addition Property of Equality' : 'Subtraction Property of Equality');
              }
              // both sides scaled by the same factor k
              const ref = [0, 1, 2].flatMap((k) => [[l(k), pl(k)], [r(k), pr(k)]]).find(([, b]) => Math.abs(b!) > 1e-6);
              if (ref) {
                const k = ref[0]! / ref[1]!;
                const scaled = [0, 1, 2].every((j) => Math.abs(l(j) - k * pl(j)) < 1e-7 * Math.max(1, Math.abs(l(j))) && Math.abs(r(j) - k * pr(j)) < 1e-7 * Math.max(1, Math.abs(r(j))));
                if (!scaled) return false;
                if (Math.abs(Math.abs(k) - 1) < 1e-9) return false;
                return reason === (Math.abs(k) > 1 ? 'Multiplication Property of Equality' : 'Division Property of Equality');
              }
              return false;
            });
          }
          default:
            return false;
        }
      })();
      if (!ok) return `${where}: reason does not justify the statement`;
    } catch (e) {
      return `${where}: ${(e as Error).message}`;
    }
  }
  if (squash(rows[rows.length - 1]![0]) !== squash(prove)) return `last statement is not the Prove statement (${prove})`;
  return null;
}

const add2 = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];

/** Given and Prove statements of a proof question (the inline text before any table). */
function proofQuestion(p: ProblemContent): { givens: string[]; prove: string } {
  const inline = parseBlocks(p.question).filter((bl) => bl.kind === 'inline');
  expect(inline.length).toBe(1);
  const text = (inline[0] as { text: string }).text;
  const gi = text.indexOf('Given:');
  const pi = text.indexOf('Prove:');
  expect(gi >= 0 && pi > gi, 'Given … Prove …').toBe(true);
  const givens = mathSegments(text.slice(gi, pi));
  const prove = mathSegments(text.slice(pi));
  expect(givens.length).toBeGreaterThan(0);
  expect(prove.length).toBe(1);
  return { givens, prove: prove[0]! };
}

/** Fill the `(a) __________` blanks of a question's table from an answer like `(a) SAS; (b) $\overline{AB} \cong \overline{CD}$`. */
function fillBlanks(question: string, answer: string): string {
  const entries = answer.split(/;\s*(?=\([a-z]\) )/).map((e) => {
    const mm = /^\(([a-z])\) (.*)$/.exec(e.trim());
    expect(mm, `answer entry ${e}`).not.toBeNull();
    return [mm![1]!, mm![2]!.trim()] as const;
  });
  const lines = question.split('\n').filter((l) => /^\s*\|/.test(l));
  let out = lines.join('\n');
  for (const [letter, content] of entries) {
    const mark = `(${letter}) __________`;
    expect(out.split(mark).length, `blank (${letter}) once in the table`).toBe(2);
    out = out.replace(mark, content);
  }
  expect(out.includes('__________'), 'every blank answered').toBe(false);
  return out;
}

Object.assign(VERIFIERS, {
  'geometry.proof'(p: ProblemContent) {
    const c = p.check!;
    const fig: ProofFig = { points: (c.points ?? {}) as Record<string, Pt>, lines: (c.lines ?? {}) as Record<string, [Pt, Pt]>, numbered: (c.numbered ?? {}) as Record<string, Tri3> };
    const { givens, prove } = proofQuestion(p);
    if (c.mode === 'full') {
      expect(hasTable(p.question), 'no table in the question').toBe(false);
      const rows = parseTable(p.answer);
      const ws = parseBlocks(p.workspace ?? '');
      expect(ws.length, 'workspace is one table').toBe(1);
      const blank = ws[0] as Extract<Block, { kind: 'table' }>;
      expect(blank.header).toEqual(['Statements', 'Reasons']);
      expect(blank.rows.length, 'workspace has one row per proof step').toBe(rows.length);
      blank.rows.forEach((r, i) => expect(r, 'empty workspace row').toEqual([`${i + 1}.`, '']));
      const err = checkProof(rows, givens, prove, fig);
      expect(err, `${p.question}\n${p.answer}`).toBeNull();
    } else {
      expect(p.workspace, 'fill-in mode has no workspace').toBeUndefined();
      const rows = parseTable(fillBlanks(p.question, p.answer));
      const err = checkProof(rows, givens, prove, fig);
      expect(err, `${p.question}\n${p.answer}`).toBeNull();
      for (const d of p.distractors ?? []) {
        const bad = checkProof(parseTable(fillBlanks(p.question, d)), givens, prove, fig);
        expect(bad, `distractor makes a valid proof: ${d}`).not.toBeNull();
      }
    }
  },
} satisfies Record<string, Verifier>);
