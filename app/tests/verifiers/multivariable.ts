/**
 * Multivariable calculus pack verifiers. Everything is recomputed numerically
 * from the RENDERED question: vectors and points are parsed back, functions of
 * several variables are evaluated with the shared evaluator (after mapping
 * θ, ρ, φ to single letters), partial derivatives are taken by central
 * differences, iterated integrals by Gauss–Legendre quadrature, line and
 * surface integrals by parametrisation, extrema by numeric search.
 */
import { expect } from 'vitest';
import type { ProblemContent } from '../../src/engine/types';
import { evaluate, evalReal, listItems, mathSegments, splitTop, stripUnits } from '../evaluator';
import type { Verifier } from '../verify';

type Env = Record<string, number>;
type Fn = (env: Env) => number;
type V = number[];

// ---------------------------------------------------------------- parsing helpers

/** Map Greek variables to single letters and drop display-only commands. */
export function prep(t: string): string {
  return t
    .replace(/\\displaystyle\s*/g, '')
    .replace(/\\theta/g, 'Q')
    .replace(/\\rho/g, 'R')
    .replace(/\\phi/g, 'P')
    .replace(/\\mid/g, '|')
    .replace(/\\(?:quad|qquad)/g, ' ')
    .trim();
}

/** Lenient evaluation: NaN for anything undefined or non-real. */
function ev(tex: string, vars: Env): number {
  try {
    const v = evaluate(tex, { vars });
    if (Math.abs(v.im) > 1e-9 * Math.max(1, Math.abs(v.re))) return NaN;
    return v.re;
  } catch {
    return NaN;
  }
}

const val = (tex: string, vars: Env = {}) => evalReal(prep(stripUnits(tex)), { vars });
const fn = (tex: string): Fn => {
  const t = prep(tex);
  return (env) => ev(t, env);
};

function near(a: number, b: number, tol = 1e-6): boolean {
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
}
function expectNear(got: number, want: number, what: string, tol = 1e-6): void {
  expect(near(got, want, tol), `${what}: got ${got}, want ${want}`).toBe(true);
}

const segs = (rich: string) => mathSegments(rich).map((s) => s.replace(/\\displaystyle\s*/g, '').trim());

/** `\left\langle … \right\rangle` groups (in order) as TeX item lists. */
function langles(tex: string): string[][] {
  const out: string[][] = [];
  const re = /\\left\\langle([\s\S]*?)\\right\\rangle/g;
  let mm: RegExpExecArray | null;
  while ((mm = re.exec(tex))) out.push(splitTop(mm[1]!, [',']).parts.map((s) => s.trim()));
  return out;
}

/** Named vectors `\mathbf{u} = ⟨…⟩` in the question. */
function vectorsIn(q: string): Map<string, V> {
  const out = new Map<string, V>();
  for (const s of segs(q)) {
    const mm = /^\\mathbf\{(\w+)\}\s*=\s*(\\left\\langle[\s\S]*\\right\\rangle)$/.exec(s);
    if (mm) out.set(mm[1]!, langles(mm[2]!)[0]!.map((t) => val(t)));
  }
  return out;
}

/** Named points `P(1, 2, 3)` in the question. */
function pointsIn(q: string): Map<string, V> {
  const out = new Map<string, V>();
  for (const s of segs(q)) {
    const mm = /^([A-Z])(?:_\{?(\d)\}?)?\s*(?:\\left)?\(([\s\S]*?)(?:\\right)?\)$/.exec(s);
    if (mm) out.set(mm[1]! + (mm[2] ?? ''), listItems(`(${mm[3]})`).map((t) => val(t)));
  }
  return out;
}

const getV = (m: Map<string, V>, k: string) => {
  const v = m.get(k);
  if (!v) throw new Error(`missing ${k} in question`);
  return v;
};

/** Value after the last `=` / `\approx` of the last math segment. */
function answerNum(a: string, seg = -1): number {
  const s = segs(a).at(seg)!;
  return val(splitTop(s, ['=', '\\approx']).parts.at(-1)!);
}

function lastVector(a: string): V {
  const all = segs(a).flatMap((s) => langles(s));
  expect(all.length, `vector in ${a}`).toBeGreaterThan(0);
  return all.at(-1)!.map((t) => val(t));
}

function expectVec(got: V, want: V, what: string, tol = 1e-6): void {
  expect(got.length, `${what}: dimension`).toBe(want.length);
  got.forEach((g, i) => expectNear(g, want[i]!, `${what} [${i}]`, tol));
}

// ---------------------------------------------------------------- vector algebra

const dot = (a: V, b: V) => a.reduce((s, x, i) => s + x * b[i]!, 0);
const cross = (a: V, b: V): V => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];
const len = (a: V) => Math.sqrt(dot(a, a));
const vsub = (a: V, b: V) => a.map((x, i) => x - b[i]!);

// ---------------------------------------------------------------- verifiers

export const VERIFIERS: Record<string, Verifier> = {
  /** Vector algebra: recompute from the vectors / points in the question. */
  'multivariable.vec'(p: ProblemContent) {
    const task = p.check!.task as string;
    const vs = vectorsIn(p.question);
    const ps = pointsIn(p.question);
    const what = `${p.question} → ${p.answer}`;
    switch (task) {
      case 'magnitude':
        return expectNear(answerNum(p.answer), len(getV(vs, 'v')), what);
      case 'unit': {
        const v = getV(vs, 'v');
        return expectVec(lastVector(p.answer), v.map((x) => x / len(v)), what);
      }
      case 'combo': {
        const u = getV(vs, 'u');
        const v = getV(vs, 'v');
        const expr = segs(p.question)[0]!;
        const want = u.map((_, i) => val(expr.replace(/\\mathbf\{u\}/g, `(${u[i]})`).replace(/\\mathbf\{v\}/g, `(${v[i]})`)));
        return expectVec(lastVector(p.answer), want, what);
      }
      case 'pq':
        return expectVec(lastVector(p.answer), vsub(getV(ps, 'Q'), getV(ps, 'P')), what);
      case 'distance':
        return expectNear(answerNum(p.answer), len(vsub(getV(ps, 'Q'), getV(ps, 'P'))), what);
      case 'dot':
        return expectNear(answerNum(p.answer), dot(getV(vs, 'u'), getV(vs, 'v')), what);
      case 'angle': {
        const u = getV(vs, 'u');
        const v = getV(vs, 'v');
        return expectNear(answerNum(p.answer), Math.acos(dot(u, v) / (len(u) * len(v))), what, 1e-3);
      }
      case 'classify': {
        const u = getV(vs, 'u');
        const v = getV(vs, 'v');
        const want = Math.abs(dot(u, v)) < 1e-9 ? 'Orthogonal' : len(cross(u, v)) < 1e-9 ? 'Parallel' : 'Neither';
        return expect(p.answer, what).toBe(want);
      }
      case 'cross':
        return expectVec(lastVector(p.answer), cross(getV(vs, 'u'), getV(vs, 'v')), what);
      case 'parallelogram':
        return expectNear(answerNum(p.answer), len(cross(getV(vs, 'u'), getV(vs, 'v'))), what);
      case 'triangle': {
        const P = getV(ps, 'P');
        return expectNear(answerNum(p.answer), len(cross(vsub(getV(ps, 'Q'), P), vsub(getV(ps, 'R'), P))) / 2, what);
      }
      case 'triple':
      case 'volume': {
        const t = dot(getV(vs, 'u'), cross(getV(vs, 'v'), getV(vs, 'w')));
        return expectNear(answerNum(p.answer), task === 'volume' ? Math.abs(t) : t, what);
      }
      default:
        throw new Error(`vec task ${task}`);
    }
  },
};

export { ev, expectNear, fn, near, val };
