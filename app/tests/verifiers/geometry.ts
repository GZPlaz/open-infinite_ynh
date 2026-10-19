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
      if (rels.length === 0) continue;
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
    const v = names[a.lhs] ?? (/^[a-z](_\{?\w+\}?)?$/.test(a.lhs) ? a.lhs : undefined);
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

export const VERIFIERS: Record<string, Verifier> = {
  'geometry.solve': solveCheck,

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
