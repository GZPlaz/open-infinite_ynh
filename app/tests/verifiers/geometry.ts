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

export const VERIFIERS: Record<string, Verifier> = {
  'geometry.solve': solveCheck,

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
