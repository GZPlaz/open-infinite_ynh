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
    .replace(/\\theta/g, ' Q ')
    .replace(/\\rho/g, ' R ')
    .replace(/\\phi/g, ' P ')
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

// ---------------------------------------------------------------- equations in x, y, z

/** L − R of an equation as a function. */
function eqDiff(eq: string): Fn {
  const parts = splitTop(prep(eq), ['=']).parts;
  expect(parts.length, `one '=' in ${eq}`).toBe(2);
  return (env) => ev(parts[0]!, env) - ev(parts[1]!, env);
}
function eqSides(eq: string): (env: Env) => [number, number] {
  const parts = splitTop(prep(eq), ['=']).parts;
  expect(parts.length, `one '=' in ${eq}`).toBe(2);
  return (env) => [ev(parts[0]!, env), ev(parts[1]!, env)];
}
const xyz = (p: V): Env => ({ x: p[0]!, y: p[1]!, z: p[2]! });

/** Plane n·X = c from a linear equation. */
function planeOf(eq: string): { n: V; c: number } {
  const g = eqDiff(eq);
  const g0 = g(xyz([0, 0, 0]));
  const n = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((e) => g(xyz(e)) - g0);
  // linear: check at a random point
  const r = [0.37, -1.21, 2.03];
  expectNear(g(xyz(r)), dot(n, r) + g0, `${eq} is linear`);
  expect(len(n), `${eq} is a plane`).toBeGreaterThan(1e-9);
  return { n, c: -g0 };
}

/** Parametric line `x = …, y = …, z = …` in t. */
function lineOf(seg: string): (t: number) => V {
  const parts = splitTop(prep(seg).replace(/\\ /g, ' '), [',']).parts;
  const byVar: Record<string, string> = {};
  for (const part of parts) {
    const [l, r] = splitTop(part, ['=']).parts;
    byVar[l!.trim()] = r!;
  }
  expect(Object.keys(byVar).sort().join(''), `x, y, z in ${seg}`).toBe('xyz');
  return (t) => ['x', 'y', 'z'].map((v) => val(byVar[v]!, { t }));
}

const parallel = (a: V, b: V) => len(cross(a, b)) <= 1e-9 * Math.max(1, len(a) * len(b));

function planeSegments(q: string): string[] {
  return segs(q).filter((s) => splitTop(s, ['=']).parts.length === 2 && !/[t,]/.test(s.replace(/\\[a-z]+/g, '')) && /[xyz]/.test(s));
}

// ---------------------------------------------------------------- coordinate systems

type Sys = 'rect' | 'cyl' | 'sph';
const SYS_VARS: Record<Sys, [string, string, string]> = { rect: ['x', 'y', 'z'], cyl: ['r', 'Q', 'z'], sph: ['R', 'Q', 'P'] };
const TAU = 2 * Math.PI;

function toRect(sys: Sys, p: V): V {
  if (sys === 'rect') return p;
  if (sys === 'cyl') return [p[0]! * Math.cos(p[1]!), p[0]! * Math.sin(p[1]!), p[2]!];
  return [p[0]! * Math.sin(p[2]!) * Math.cos(p[1]!), p[0]! * Math.sin(p[2]!) * Math.sin(p[1]!), p[0]! * Math.cos(p[2]!)];
}
function fromRect(sys: Sys, p: V): V {
  if (sys === 'rect') return p;
  const th = (Math.atan2(p[1]!, p[0]!) + TAU) % TAU;
  if (sys === 'cyl') return [Math.hypot(p[0]!, p[1]!), th, p[2]!];
  const rho = len(p);
  return [rho, th, Math.acos(Math.max(-1, Math.min(1, p[2]! / rho)))];
}
function inDomain(sys: Sys, p: V): boolean {
  if (sys === 'rect') return p.every((x) => Math.abs(x) <= 7);
  if (sys === 'cyl') return p[0]! > 1e-6 && p[0]! < 9 && Math.abs(p[2]!) < 7;
  return p[0]! > 1e-6 && p[0]! < 9 && p[2]! > 1e-6 && p[2]! < Math.PI - 1e-6;
}

/** Deterministic pseudo-random numbers for sampling. */
function lcg(seed = 12345): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Points on the surface L = R (coordinates of `sys`) found by scanning random lines. */
function surfacePoints(eq: string, sys: Sys, want = 12): V[] {
  const sides = eqSides(eq);
  const [a, b, c] = SYS_VARS[sys];
  const at = (p: V) => sides({ [a]: p[0]!, [b]: p[1]!, [c]: p[2]! });
  const g = (p: V) => {
    const [l, r] = at(p);
    return l - r;
  };
  const rnd = lcg(987);
  const out: V[] = [];
  for (let line = 0; line < 80 && out.length < want; line++) {
    const base = sys === 'rect' ? [rnd() * 8 - 4, rnd() * 8 - 4, rnd() * 8 - 4] : sys === 'cyl' ? [rnd() * 6 + 0.2, rnd() * TAU, rnd() * 8 - 4] : [rnd() * 6 + 0.2, rnd() * TAU, rnd() * 3 + 0.07];
    const dir = [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5];
    const P = (s: number) => base.map((x, i) => x + s * dir[i]!);
    let prevS = NaN;
    let prev = NaN;
    for (let k = 0; k <= 800; k++) {
      const s = -8 + k * 0.02;
      const pt = P(s);
      const v = inDomain(sys, pt) ? g(pt) : NaN;
      if (Number.isFinite(v) && Number.isFinite(prev) && Math.sign(v) !== Math.sign(prev)) {
        let lo = prevS;
        let hi = s;
        let flo = prev;
        for (let it = 0; it < 60; it++) {
          const mid = (lo + hi) / 2;
          const fm = g(P(mid));
          if (!Number.isFinite(fm)) break;
          if (Math.sign(fm) === Math.sign(flo)) {
            lo = mid;
            flo = fm;
          } else hi = mid;
        }
        const root = P((lo + hi) / 2);
        const [l, r] = at(root);
        if (near(l, r, 1e-7)) out.push(root);
      }
      prevS = s;
      prev = v;
    }
  }
  return out;
}

Object.assign(VERIFIERS, {
  /** Lines in space: the answer line passes through the given points / is parallel to the given vector. */
  'multivariable.line'(p: ProblemContent) {
    const task = p.check!.task as string;
    const ps = pointsIn(p.question);
    const P = getV(ps, 'P');
    const what = `${p.question} → ${p.answer}`;
    if (task === 'symmetric') {
      const parts = splitTop(prep(segs(p.answer)[0]!), ['=']).parts;
      expect(parts.length, what).toBe(3);
      const vals = (X: V) => parts.map((e) => val(e, xyz(X)));
      for (const X of [P, getV(ps, 'Q')]) {
        const v = vals(X);
        expectNear(v[0]!, v[1]!, `${what} at ${X}`);
        expectNear(v[1]!, v[2]!, `${what} at ${X}`);
      }
      const off = vals(P.map((x, i) => x + (i === 0 ? 1 : 0)));
      expect(near(off[0]!, off[1]!) && near(off[1]!, off[2]!), `${what} non-degenerate`).toBe(false);
      return;
    }
    const X = lineOf(segs(p.answer)[0]!);
    const X0 = X(0);
    const D = vsub(X(1), X0);
    expect(len(D), what).toBeGreaterThan(1e-9);
    expect(parallel(vsub(P, X0), D), `${what}: P on line`).toBe(true);
    if (task === 'points') expect(parallel(vsub(getV(ps, 'Q'), X0), D), `${what}: Q on line`).toBe(true);
    else expect(parallel(getV(vectorsIn(p.question), 'v'), D), `${what}: direction`).toBe(true);
  },

  /** Planes: through points, with a normal, intersections, angles, distances. */
  'multivariable.plane'(p: ProblemContent) {
    const task = p.check!.task as string;
    const ps = pointsIn(p.question);
    const what = `${p.question} → ${p.answer}`;
    switch (task) {
      case 'points':
      case 'normal': {
        const { n, c } = planeOf(segs(p.answer)[0]!);
        const pts = task === 'points' ? ['P', 'Q', 'R'].map((k) => getV(ps, k)) : [getV(ps, 'P')];
        pts.forEach((X) => expectNear(dot(n, X), c, `${what}: point ${X}`));
        if (task === 'normal') expect(parallel(n, getV(vectorsIn(p.question), 'n')), `${what}: normal`).toBe(true);
        return;
      }
      case 'intersect': {
        const line = segs(p.question).find((s) => /,/.test(s) && /t/.test(s))!;
        const L = lineOf(line);
        const { n, c } = planeOf(planeSegments(p.question)[0]!);
        const X = listItems(segs(p.answer).at(-1)!).map((t) => val(t));
        expectNear(dot(n, X), c, `${what}: on plane`);
        expect(parallel(vsub(X, L(0)), vsub(L(1), L(0))), `${what}: on line`).toBe(true);
        return;
      }
      case 'angle': {
        const [a, b] = planeSegments(p.question).map(planeOf);
        const th = Math.acos(Math.abs(dot(a!.n, b!.n)) / (len(a!.n) * len(b!.n)));
        return expectNear(answerNum(p.answer), th, what, 1e-3);
      }
      case 'distance': {
        const { n, c } = planeOf(planeSegments(p.question)[0]!);
        const P = getV(ps, 'P');
        return expectNear(answerNum(p.answer), Math.abs(dot(n, P) - c) / len(n), what);
      }
      default:
        throw new Error(`plane task ${task}`);
    }
  },

  /** Quadric surfaces: classify numerically from the coefficients of the rendered equation. */
  'multivariable.quadric'(p: ProblemContent) {
    const g = eqDiff(segs(p.question)[0]!);
    const F = (a: number, b: number, c: number) => g(xyz([a, b, c]));
    const K = F(0, 0, 0);
    const e = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    const A = e.map((u) => (F(u[0]!, u[1]!, u[2]!) + F(-u[0]!, -u[1]!, -u[2]!) - 2 * K) / 2);
    const B = e.map((u) => (F(u[0]!, u[1]!, u[2]!) - F(-u[0]!, -u[1]!, -u[2]!)) / 2);
    // no cross terms, nothing beyond degree 2
    const r = [0.7, -1.3, 2.1];
    expectNear(F(r[0]!, r[1]!, r[2]!), A.reduce((s, a, i) => s + a * r[i]! ** 2 + B[i]! * r[i]!, K), `${p.question}: axis-aligned quadric`);
    let k = K;
    const sq: number[] = [];
    let lin = 0;
    A.forEach((a, i) => {
      if (Math.abs(a) > 1e-9) {
        k -= B[i]! ** 2 / (4 * a);
        sq.push(a);
      } else if (Math.abs(B[i]!) > 1e-9) lin++;
    });
    const R = -k;
    let kind = '?';
    const same = sq.every((a) => Math.sign(a) === Math.sign(sq[0]!));
    if (sq.length === 3 && lin === 0) {
      if (Math.abs(R) < 1e-9) kind = same ? 'point' : 'Elliptic cone';
      else {
        const pos = sq.filter((a) => a / R > 0).length;
        kind = pos === 3 ? 'Ellipsoid' : pos === 2 ? 'Hyperboloid of one sheet' : pos === 1 ? 'Hyperboloid of two sheets' : 'empty';
      }
    } else if (sq.length === 2 && lin === 1) kind = same ? 'Elliptic paraboloid' : 'Hyperbolic paraboloid';
    else if (sq.length === 2 && lin === 0) kind = Math.abs(R) < 1e-9 ? 'degenerate' : same ? (sq[0]! / R > 0 ? 'Elliptic cylinder' : 'empty') : 'Hyperbolic cylinder';
    else if (sq.length === 1 && lin === 1) kind = 'Parabolic cylinder';
    expect(p.answer, p.question).toBe(kind);
  },

  /** Point conversions: convert the answer back to rectangular coordinates. */
  'multivariable.coordPt'(p: ProblemContent) {
    const from = p.check!.from as Sys;
    const to = p.check!.to as Sys;
    const tuple = (s: string) => listItems(s).map((t) => val(t));
    const qs = segs(p.question).filter((s) => !/\\(rho|theta|phi)/.test(s));
    const q = tuple(qs[0]!);
    const a = tuple(segs(p.answer).at(-1)!);
    expectVec(toRect(to, a), toRect(from, q), `${p.question} → ${p.answer}`);
    if (to !== 'rect') {
      expect(a[0]!, 'r, ρ ≥ 0').toBeGreaterThanOrEqual(0);
      expect(a[1]! >= -1e-12 && a[1]! < TAU - 1e-12, `0 ≤ θ < 2π in ${p.answer}`).toBe(true);
      if (to === 'sph') expect(a[2]! >= -1e-12 && a[2]! <= Math.PI + 1e-12, `0 ≤ φ ≤ π in ${p.answer}`).toBe(true);
    }
  },

  /** Equation conversions: points of each surface satisfy the other equation. */
  'multivariable.coordEq'(p: ProblemContent) {
    const from = p.check!.from as Sys;
    const to = p.check!.to as Sys;
    const qeq = segs(p.question)[0]!;
    const aeq = segs(p.answer)[0]!;
    const check = (eqA: string, sysA: Sys, eqB: string, sysB: Sys) => {
      const pts = surfacePoints(eqA, sysA);
      expect(pts.length, `points on ${eqA}`).toBeGreaterThanOrEqual(6);
      const sidesB = eqSides(eqB);
      const [a, b, c] = SYS_VARS[sysB];
      for (const pt of pts) {
        const q = fromRect(sysB, toRect(sysA, pt));
        const [l, r] = sidesB({ [a]: q[0]!, [b]: q[1]!, [c]: q[2]! });
        expect(near(l, r, 1e-6), `${eqA} → ${eqB} at ${pt}: ${l} vs ${r}`).toBe(true);
      }
    };
    check(qeq, from, aeq, to);
    check(aeq, to, qeq, from);
  },
} satisfies Record<string, Verifier>);

// ---------------------------------------------------------------- numeric calculus

type F1 = (t: number) => number;
function d1(f: F1, t: number): number {
  const D = (h: number) => (f(t + h) - f(t - h)) / (2 * h);
  return (4 * D(5e-4) - D(1e-3)) / 3;
}
function d2(f: F1, t: number): number {
  const D = (h: number) => (f(t + h) - 2 * f(t) + f(t - h)) / (h * h);
  return (4 * D(1e-3) - D(2e-3)) / 3;
}

/** Gauss–Legendre nodes/weights on [-1, 1]. */
function gaussLegendre(n: number): { x: number[]; w: number[] } {
  const x: number[] = [];
  const w: number[] = [];
  for (let i = 1; i <= n; i++) {
    let z = Math.cos((Math.PI * (i - 0.25)) / (n + 0.5));
    let dp = 0;
    for (let it = 0; it < 100; it++) {
      let p0 = 1;
      let p1 = z;
      for (let k = 2; k <= n; k++) {
        const p2 = ((2 * k - 1) * z * p1 - (k - 1) * p0) / k;
        p0 = p1;
        p1 = p2;
      }
      dp = (n * (z * p1 - p0)) / (z * z - 1);
      const dz = p1 / dp;
      z -= dz;
      if (Math.abs(dz) < 1e-15) break;
    }
    x.push(z);
    w.push(2 / ((1 - z * z) * dp * dp));
  }
  return { x, w };
}
const GL = new Map<number, { x: number[]; w: number[] }>();
function gl(n: number) {
  let g = GL.get(n);
  if (!g) GL.set(n, (g = gaussLegendre(n)));
  return g;
}

/**
 * ∫_a^b f by composite Gauss–Legendre. `smooth` substitutes x = a + (b − a)(3u² − 2u³),
 * which removes √-type endpoint singularities (e.g. bounds like √(4 − x²)).
 */
function quad(f: F1, a: number, b: number, n = 12, panels = 4, smooth = false): number {
  if (a === b) return 0;
  const g = gl(n);
  const F = smooth ? (u: number) => f(a + (b - a) * (3 * u * u - 2 * u * u * u)) * (b - a) * 6 * u * (1 - u) : f;
  const [lo, hi] = smooth ? [0, 1] : [a, b];
  const h = (hi - lo) / panels;
  let s = 0;
  for (let k = 0; k < panels; k++) {
    const c = lo + (k + 0.5) * h;
    for (let i = 0; i < n; i++) s += g.w[i]! * F(c + (g.x[i]! * h) / 2);
  }
  return (s * h) / 2;
}

// ---------------------------------------------------------------- vector functions

/** Named vector function `\mathbf{r}(t) = ⟨…⟩` (any letter, primes allowed) → component TeX. */
function vecFnIn(rich: string, name: string): string[] {
  for (const s of segs(rich)) {
    const mm = /^\\mathbf\{(\w)\}('*)\((\w|-?\d+)\)\s*=\s*(\\left\\langle[\s\S]*\\right\\rangle)$/.exec(s);
    if (mm && `${mm[1]}${mm[2]}(${mm[3]})` === name) return langles(mm[4]!)[0]!;
  }
  throw new Error(`no ${name} in ${rich}`);
}
const compFns = (comps: string[], v = 't'): F1[] => comps.map((c) => {
  const f = fn(c);
  return (t: number) => f({ [v]: t });
});
const evalV = (fs: F1[], t: number) => fs.map((f) => f(t));
const dV = (fs: F1[], t: number) => fs.map((f) => d1(f, t));
const ddV = (fs: F1[], t: number) => fs.map((f) => d2(f, t));
const T_SAMPLES = [0.4, 0.9, 1.3, 1.7];

/** `t = k` in the question (the point of evaluation). */
function tPoint(q: string): number {
  for (const s of segs(q)) {
    const mm = /^t\s*=\s*(-?[\d.]+)$/.exec(s);
    if (mm) return Number(mm[1]);
  }
  throw new Error(`no t = … in ${q}`);
}

/** `a \le t \le b`. */
function tBounds(q: string, v = 't'): [number, number] {
  for (const s of segs(q)) {
    const { parts, rels } = splitTop(prep(s), ['\\le', '\\leq', '<']);
    if (rels.length === 2 && parts[1]!.trim() === v) return [val(parts[0]!), val(parts[2]!)];
  }
  throw new Error(`no bounds for ${v} in ${q}`);
}

function answerVecFn(a: string): F1[] {
  const all = segs(a).flatMap((s) => langles(s));
  return compFns(all.at(-1)!);
}

Object.assign(VERIFIERS, {
  /** Derivatives, tangent vectors and tangent lines of r(t), by numeric differentiation of the question's components. */
  'multivariable.curve'(p: ProblemContent) {
    const task = p.check!.task as string;
    const r = compFns(vecFnIn(p.question, 'r(t)'));
    const what = `${p.question} → ${p.answer}`;
    switch (task) {
      case 'derivative':
      case 'second': {
        const A = answerVecFn(p.answer);
        for (const t of T_SAMPLES) expectVec(evalV(A, t), task === 'second' ? ddV(r, t) : dV(r, t), `${what} at t=${t}`, 1e-5);
        return;
      }
      case 'atPoint': {
        const t0 = Number(/\\mathbf\{r\}'\((-?\d+)\)/.exec(p.question)![1]);
        return expectVec(lastVector(p.answer), dV(r, t0), what, 1e-6);
      }
      case 'unitTangent': {
        const v = dV(r, tPoint(p.question));
        return expectVec(lastVector(p.answer), v.map((x) => x / len(v)), what, 1e-6);
      }
      case 'speed': {
        const t0 = Number(/at \$t = (-?\d+)\$/.exec(p.question)![1]);
        return expectNear(answerNum(p.answer), len(dV(r, t0)), what, 1e-6);
      }
      case 'tangentLine': {
        const t0 = tPoint(p.question);
        const X = lineOf(segs(p.answer)[0]!);
        expectVec(X(0), evalV(r, t0), `${what}: point`, 1e-7);
        expect(parallel(vsub(X(1), X(0)), dV(r, t0)) || len(cross(vsub(X(1), X(0)), dV(r, t0))) < 1e-6, `${what}: direction`).toBe(true);
        return;
      }
      default:
        throw new Error(`curve task ${task}`);
    }
  },

  /** Arc length by numeric integration of ‖r′(t)‖. */
  'multivariable.arc'(p: ProblemContent) {
    const r = compFns(vecFnIn(p.question, 'r(t)'));
    const [a, b] = tBounds(p.question);
    const L = quad((t) => len(dV(r, t)), a, b, 16, 8);
    expectNear(answerNum(p.answer), L, `${p.question} → ${p.answer}`, 1e-6);
  },

  /** Curvature κ = ‖r′ × r″‖ / ‖r′‖³. */
  'multivariable.curvature'(p: ProblemContent) {
    const r = compFns(vecFnIn(p.question, 'r(t)'));
    let t0 = 0.7;
    try {
      t0 = tPoint(p.question);
    } catch {
      // constant curvature (helix)
    }
    const v = dV(r, t0);
    const k = len(cross(v, ddV(r, t0))) / len(v) ** 3;
    expectNear(answerNum(p.answer), k, `${p.question} → ${p.answer}`, 1e-5);
  },

  /** Position from acceleration: r″ = a, r′(0) = v(0), r(0) = r₀. */
  'multivariable.position'(p: ProblemContent) {
    const a = compFns(vecFnIn(p.question, 'a(t)'));
    const v0 = vecFnIn(p.question, 'v(0)').map((t) => val(t));
    const r0 = vecFnIn(p.question, 'r(0)').map((t) => val(t));
    const r = answerVecFn(p.answer);
    const what = `${p.question} → ${p.answer}`;
    for (const t of T_SAMPLES) expectVec(ddV(r, t), evalV(a, t), `${what}: r'' at ${t}`, 1e-5);
    expectVec(evalV(r, 0), r0, `${what}: r(0)`);
    expectVec(dV(r, 0), v0, `${what}: r'(0)`, 1e-6);
  },

  /** a_T = v·a/‖v‖, a_N = ‖v × a‖/‖v‖. */
  'multivariable.accelComponents'(p: ProblemContent) {
    const r = compFns(vecFnIn(p.question, 'r(t)'));
    const t0 = tPoint(p.question);
    const v = dV(r, t0);
    const a = ddV(r, t0);
    expectNear(answerNum(p.answer, 0), dot(v, a) / len(v), `${p.question} → ${p.answer}: a_T`, 1e-5);
    expectNear(answerNum(p.answer, 1), len(cross(v, a)) / len(v), `${p.question} → ${p.answer}: a_N`, 1e-5);
  },
} satisfies Record<string, Verifier>);


// ---------------------------------------------------------------- functions of several variables

interface Def {
  name: string;
  vars: string[];
  body: string;
}

/** `f(x, y) = …` definitions in the question. */
function defIn(rich: string, name?: string): Def {
  for (const s of segs(rich)) {
    const mm = /^([a-zA-Z])\(([a-z](?:,\s*[a-z])*)\)\s*=\s*([\s\S]+)$/.exec(s);
    if (mm && (!name || mm[1] === name) && mm[3]!.trim() !== 'k') return { name: mm[1]!, vars: mm[2]!.split(',').map((v) => v.trim()), body: mm[3]! };
  }
  throw new Error(`no function definition in ${rich}`);
}
const defFn = (d: Def): Fn => fn(d.body);

/** `x = …` style single-letter definitions. */
function letterDefs(rich: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of segs(rich)) {
    const mm = /^([a-z])\s*=\s*([\s\S]+)$/.exec(s);
    if (mm && splitTop(mm[2]!, ['=']).parts.length === 1) out[mm[1]!] = mm[2]!;
  }
  return out;
}

/** Numeric partial derivative ∂^n f / ∂v1 … ∂vn (Richardson-extrapolated central differences). */
function partial(f: Fn, env: Env, vs: string[], h = 1e-3): number {
  if (!vs.length) return f(env);
  const v = vs.at(-1)!;
  const rest = vs.slice(0, -1);
  const g = (x: number) => partial(f, { ...env, [v]: x }, rest, h);
  const x0 = env[v]!;
  const D = (k: number) => (g(x0 + k) - g(x0 - k)) / (2 * k);
  return (4 * D(h / 2) - D(h)) / 3;
}

const SAMPLE_ENVS: Env[] = [
  { x: 0.7, y: 1.3, z: 0.9, s: 0.6, t: 1.1 },
  { x: 1.2, y: 0.8, z: 1.4, s: 1.3, t: 0.7 },
  { x: 1.6, y: 1.9, z: 0.6, s: 0.9, t: 1.5 },
];

/** Truth of a relation chain with ≤, ≥, <, >, =, ≠. */
function relChain(tex: string, env: Env): boolean {
  const { parts, rels } = splitTop(prep(tex), ['\\le', '\\ge', '\\leq', '\\geq', '\\neq', '\\ne', '<', '>', '=']);
  const vals = parts.map((t) => val(t, env));
  return rels.every((r, i) => {
    const a = vals[i]!;
    const b = vals[i + 1]!;
    switch (r) {
      case '<':
        return a < b;
      case '>':
        return a > b;
      case '\\le':
      case '\\leq':
        return a <= b + 1e-12;
      case '\\ge':
      case '\\geq':
        return a >= b - 1e-12;
      case '=':
        return Math.abs(a - b) < 1e-12;
      default:
        return Math.abs(a - b) > 1e-12;
    }
  });
}

/** Conditions of a set-builder answer `\{(x, y) \mid c1, c2\}`. */
function setConds(tex: string): string[] {
  const t = prep(tex);
  const k = t.indexOf('|');
  expect(k, `set-builder: ${tex}`).toBeGreaterThan(0);
  const body = t.slice(k + 1).replace(/\\right\\\}\s*$|\\\}\s*$/, '');
  return splitTop(body.replace(/\\ /g, ' '), [',']).parts.filter(Boolean);
}

/** Points with g = 0 found by scanning random lines in the plane. */
function zeroSet2(g: (x: number, y: number) => number, want: number, ok: (x: number, y: number) => boolean, seed = 4242): Array<[number, number]> {
  const rnd = lcg(seed);
  const out: Array<[number, number]> = [];
  for (let line = 0; line < 60 && out.length < want; line++) {
    const bx = rnd() * 8 - 4;
    const by = rnd() * 8 - 4;
    const th = rnd() * Math.PI;
    const dx = Math.cos(th);
    const dy = Math.sin(th);
    let ps = NaN;
    let pv = NaN;
    for (let k = 0; k <= 600; k++) {
      const s = -6 + k * 0.02;
      const v = g(bx + s * dx, by + s * dy);
      if (Number.isFinite(v) && Number.isFinite(pv) && Math.sign(v) !== Math.sign(pv)) {
        let lo = ps;
        let hi = s;
        let flo = pv;
        for (let it = 0; it < 60; it++) {
          const mid = (lo + hi) / 2;
          const fm = g(bx + mid * dx, by + mid * dy);
          if (!Number.isFinite(fm)) break;
          if (Math.sign(fm) === Math.sign(flo)) {
            lo = mid;
            flo = fm;
          } else hi = mid;
        }
        const x = bx + ((lo + hi) / 2) * dx;
        const y = by + ((lo + hi) / 2) * dy;
        if (ok(x, y)) out.push([x, y]);
      }
      ps = s;
      pv = v;
    }
  }
  return out;
}

/** Solve A x = b (Gaussian elimination with partial pivoting). */
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]!]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[piv]![c]!)) piv = r;
    [M[c], M[piv]] = [M[piv]!, M[c]!];
    const d = M[c]![c]! || 1e-300;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const k = M[r]![c]! / d;
      for (let j = c; j <= n; j++) M[r]![j]! -= k * M[c]![j]!;
    }
  }
  return M.map((r, i) => r[n]! / (r[i]! || 1e-300));
}

/** Best-fit conic A x² + B xy + C y² + D x + E y + F = 0 (smallest eigenvector of the normal matrix). */
function fitConic(pts: Array<[number, number]>): { z: number[]; residual: number } {
  const rows = pts.map(([x, y]) => [x * x, x * y, y * y, x, y, 1]);
  const M = Array.from({ length: 6 }, (_, i) => Array.from({ length: 6 }, (_, j) => rows.reduce((s, r) => s + r[i]! * r[j]!, 0)));
  const tr = M.reduce((s, r, i) => s + r[i]!, 0);
  const Ms = M.map((r, i) => r.map((x, j) => x + (i === j ? 1e-13 * tr : 0)));
  let z = [1, 0.3, 0.7, -0.2, 0.5, 0.1];
  for (let it = 0; it < 40; it++) {
    z = solve(Ms, z);
    const n = Math.hypot(...z);
    z = z.map((x) => x / n);
  }
  const residual = Math.max(...rows.map((r) => Math.abs(dot(r, z)) / Math.max(1, ...r.map(Math.abs))));
  return { z, residual };
}

function levelKind(pts: Array<[number, number]>): string {
  // collinear?
  const [p, q] = [pts[0]!, pts[pts.length - 1]!];
  const dir = [q[0] - p[0], q[1] - p[1]];
  const dl = Math.hypot(dir[0]!, dir[1]!);
  const colinear = pts.every(([x, y]) => Math.abs((x - p[0]) * dir[1]! - (y - p[1]) * dir[0]!) / dl < 1e-7);
  if (colinear) {
    const throughOrigin = Math.abs(-p[0] * dir[1]! + p[1] * dir[0]!) / dl < 1e-7;
    return throughOrigin ? 'Lines through the origin' : `Parallel lines`;
  }
  const { z, residual } = fitConic(pts);
  expect(residual, 'level curve is a conic').toBeLessThan(1e-6);
  const [A, B, C, D, E] = z as [number, number, number, number, number];
  const q2 = Math.max(Math.abs(A), Math.abs(B), Math.abs(C));
  const disc = (B * B - 4 * A * C) / (q2 * q2);
  if (disc < -1e-6) {
    const centred = Math.abs(D) < 1e-6 * q2 && Math.abs(E) < 1e-6 * q2;
    const circle = Math.abs(A - C) < 1e-6 * q2 && Math.abs(B) < 1e-6 * q2;
    return `${circle ? 'Circles' : 'Ellipses'} ${centred ? 'centered at the origin' : 'off-center'}`;
  }
  return disc > 1e-6 ? 'Hyperbolas' : 'Parabolas';
}

function lineDir(pts: Array<[number, number]>): number {
  const [p, q] = [pts[0]!, pts[pts.length - 1]!];
  return Math.atan2(q[1] - p[1], q[0] - p[0]) % Math.PI;
}

Object.assign(VERIFIERS, {
  /** f evaluated at the point in the question. */
  'multivariable.evaluate'(p: ProblemContent) {
    const d = defIn(p.question);
    const at = segs(p.question).find((s) => new RegExp(`^${d.name}\\((?!${d.vars[0]})`).test(s))!;
    const pt = listItems(at.slice(1)).map((t) => val(t));
    const env = Object.fromEntries(d.vars.map((v, i) => [v, pt[i]!]));
    expectNear(answerNum(p.answer), defFn(d)(env), `${p.question} → ${p.answer}`, 1e-9);
  },

  /** Domain: f is defined exactly where the set-builder conditions hold (random sampling). */
  'multivariable.domain'(p: ProblemContent) {
    const f = defFn(defIn(p.question));
    const conds = setConds(segs(p.answer)[0]!);
    const rnd = lcg(77);
    for (let i = 0; i < 400; i++) {
      const env = { x: rnd() * 14 - 7, y: rnd() * 14 - 7 };
      const defined = Number.isFinite(f(env));
      expect(conds.every((c) => relChain(c, env)), `${p.question} → ${p.answer} at (${env.x}, ${env.y})`).toBe(defined);
    }
  },

  /** Level curves: points of f = k for three values of k are fitted by a conic and classified. */
  'multivariable.level'(p: ProblemContent) {
    const f = defFn(defIn(p.question, 'f'));
    const kinds = new Set<string>();
    const dirs: number[] = [];
    for (const [x0, y0] of [
      [1.3, 0.7],
      [-0.9, 1.6],
      [2.1, -1.1],
    ] as const) {
      const k = f({ x: x0, y: y0 });
      const pts = zeroSet2((x, y) => f({ x, y }) - k, 14, (x, y) => Math.abs(f({ x, y }) - k) < 1e-8 * Math.max(1, Math.abs(k)));
      expect(pts.length, `${p.question}: level ${k}`).toBeGreaterThanOrEqual(8);
      const kind = levelKind(pts);
      kinds.add(kind);
      if (kind.includes('lines')) dirs.push(lineDir(pts));
    }
    expect([...kinds], p.question).toEqual([p.answer]);
    if (p.answer === 'Parallel lines') dirs.forEach((d) => expect(Math.abs(Math.sin(d - dirs[0]!)), 'parallel').toBeLessThan(1e-6));
  },

  /** Two-variable limits: approach along lines and parabolas. */
  'multivariable.limit'(p: ProblemContent) {
    const s0 = segs(p.question)[0]!;
    const mm = /\\lim_\{\(x, y\) \\to \(([^)]*)\)\}\s*([\s\S]+)$/.exec(s0)!;
    const [a, b] = listItems(`(${mm[1]})`).map((t) => val(t)) as [number, number];
    const f = fn(mm[2]!);
    const paths: Array<[(s: number) => [number, number], number]> = [];
    for (let i = 0; i < 7; i++) {
      const th = 0.3 + (i * 2 * Math.PI) / 7;
      paths.push([(s) => [a + s * Math.cos(th), b + s * Math.sin(th)], 1e-6]);
    }
    for (const k of [1, -2]) {
      for (const P of [(s: number): [number, number] => [a + s, b + k * s * s], (s: number): [number, number] => [a - s, b + k * s * s], (s: number): [number, number] => [a + k * s * s, b + s], (s: number): [number, number] => [a + k * s * s, b - s]]) paths.push([P, 1e-4]);
    }
    const lims = paths
      .map(([P, h]) => {
        const [x, y] = P(h);
        const [x2, y2] = P(2 * h);
        const v1 = f({ x, y });
        const v2 = f({ x: x2, y: y2 });
        return 2 * v1 - v2;
      })
      .filter(Number.isFinite);
    expect(lims.length, p.question).toBeGreaterThanOrEqual(8);
    const spread = Math.max(...lims) - Math.min(...lims);
    const what = `${p.question} → ${p.answer}: path limits ${lims.map((x) => x.toFixed(5)).join(', ')}`;
    if (/does not exist/i.test(p.answer)) expect(spread, what).toBeGreaterThan(0.05);
    else {
      const L = answerNum(p.answer);
      lims.forEach((l) => expect(Math.abs(l - L), what).toBeLessThan(1e-4 * Math.max(1, Math.abs(L))));
    }
  },

  /** Partial derivatives `f_{xy} = …` and `f_{x}(a, b) = …` by numeric differentiation. */
  'multivariable.partials'(p: ProblemContent) {
    const d = defIn(p.question);
    const f = defFn(d);
    const items = segs(p.answer);
    expect(items.length, p.answer).toBeGreaterThan(0);
    for (const it of items) {
      const mm = /^f_\{([xyz]+)\}(?:\(([^)]*)\))?\s*=\s*([\s\S]+)$/.exec(it)!;
      expect(mm, `answer item ${it}`).toBeTruthy();
      const order = [...mm[1]!];
      if (mm[2]) {
        const pt = listItems(`(${mm[2]})`).map((t) => val(t));
        const env = Object.fromEntries(d.vars.map((v, i) => [v, pt[i]!]));
        expectNear(val(mm[3]!), partial(f, env, order), `${p.question} → ${it}`, 1e-6);
        continue;
      }
      const g = fn(mm[3]!);
      for (const env of SAMPLE_ENVS) expectNear(g(env), partial(f, env, order), `${p.question} → ${it} at ${JSON.stringify(env)}`, 2e-5);
    }
  },

  /** Chain rule: compose the question's functions numerically. */
  'multivariable.chain'(p: ProblemContent) {
    const defs = letterDefs(p.question);
    const z = fn(defs.z!);
    const X = fn(defs.x!);
    const Y = fn(defs.y!);
    const wrt = p.check!.wrt as string;
    const env: Env = {};
    for (const v of ['s', 't']) if (defs[v] !== undefined) env[v] = val(defs[v]!);
    const Z = (e: Env) => z({ x: X(e), y: Y(e) });
    expectNear(answerNum(p.answer), partial(Z, env, [wrt]), `${p.question} → ${p.answer}`, 1e-6);
  },

  /** Implicit differentiation: the answer equals −F_ind / F_dep. */
  'multivariable.implicit'(p: ProblemContent) {
    const ind = p.check!.ind as string;
    const dep = p.check!.dep as string;
    const F = eqDiff(segs(p.question).find((s) => /=/.test(s) && !/frac/.test(s.slice(0, 6)))!);
    const ans = fn(splitTop(segs(p.answer)[0]!, ['=']).parts.at(-1)!);
    let used = 0;
    for (const env of SAMPLE_ENVS) {
      const Fd = partial(F, env, [dep]);
      if (Math.abs(Fd) < 1e-3) continue;
      used++;
      expectNear(ans(env), -partial(F, env, [ind]) / Fd, `${p.question} → ${p.answer} at ${JSON.stringify(env)}`, 1e-5);
    }
    expect(used, p.question).toBeGreaterThan(0);
  },
} satisfies Record<string, Verifier>);

// ---------------------------------------------------------------- gradients, tangent planes, extrema

const gradAt = (f: Fn, env: Env, vars: string[]) => vars.map((v) => partial(f, env, [v]));
const envOf = (vars: string[], p: V): Env => Object.fromEntries(vars.map((v, i) => [v, p[i]!]));
const tupleSegs = (rich: string) => segs(rich).filter((s) => /^\(([^()]*)\)$/.test(s)).map((s) => listItems(s).map((t) => val(t)));

/** Fit a polynomial of total degree ≤ deg in x, y (exactly, from samples) and check the fit. */
function polyFit2(f: Fn, deg = 4): { c: number[]; mons: Array<[number, number]> } {
  const mons: Array<[number, number]> = [];
  for (let i = 0; i <= deg; i++) for (let j = 0; i + j <= deg; j++) mons.push([i, j]);
  const rnd = lcg(31);
  const pts = Array.from({ length: mons.length + 10 }, () => [rnd() * 4 - 2, rnd() * 4 - 2] as const);
  const A = pts.map(([x, y]) => mons.map(([i, j]) => x ** i * y ** j));
  const b = pts.map(([x, y]) => f({ x, y }));
  const AtA = mons.map((_, i) => mons.map((__, j) => A.reduce((s, r) => s + r[i]! * r[j]!, 0)));
  const Atb = mons.map((_, i) => A.reduce((s, r, k) => s + r[i]! * b[k]!, 0));
  const c = solve(AtA, Atb).map((x) => (Math.abs(x - Math.round(x)) < 1e-6 ? Math.round(x) : x));
  for (const [x, y] of [[2.7, -1.9], [-3.1, 0.4], [0.3, 3.3]] as const) {
    expectNear(mons.reduce((s, [i, j], k) => s + c[k]! * x ** i * y ** j, 0), f({ x, y }), 'polynomial fit', 1e-7);
  }
  return { c, mons };
}

Object.assign(VERIFIERS, {
  /** Gradient, gradient at a point, directional derivative, maximum rate of change. */
  'multivariable.gradient'(p: ProblemContent) {
    const task = p.check!.task as string;
    const d = defIn(p.question);
    const f = defFn(d);
    const what = `${p.question} → ${p.answer}`;
    if (task === 'gradient') {
      const comps = segs(p.answer).flatMap((s) => langles(s)).at(-1)!.map(fn);
      for (const env of SAMPLE_ENVS) expectVec(comps.map((c) => c(env)), gradAt(f, env, d.vars), `${what} at ${JSON.stringify(env)}`, 1e-5);
      return;
    }
    const P = getV(pointsIn(p.question), 'P');
    const g = gradAt(f, envOf(d.vars, P), d.vars);
    switch (task) {
      case 'gradPoint':
        return expectVec(lastVector(p.answer), g, what, 1e-6);
      case 'directional': {
        const v = getV(vectorsIn(p.question), 'v');
        return expectNear(answerNum(p.answer), dot(g, v) / len(v), what, 1e-6);
      }
      default: {
        expectNear(answerNum(p.answer, 0), len(g), what, 1e-6);
        const dir = lastVector(p.answer);
        expect(parallel(dir, g) || len(cross([...dir, 0].slice(0, 3), [...g, 0].slice(0, 3))) < 1e-6 * len(g) * len(dir), `${what}: direction`).toBe(true);
        expect(dot(dir, g), `${what}: direction sign`).toBeGreaterThan(0);
      }
    }
  },

  /** Tangent planes, linearizations, linear approximations. */
  'multivariable.tangentPlane'(p: ProblemContent) {
    const task = p.check!.task as string;
    const what = `${p.question} → ${p.answer}`;
    if (task === 'surface') {
      const F = eqDiff(segs(p.question)[0]!);
      const P = getV(pointsIn(p.question), 'P');
      expectNear(F(xyz(P)), 0, `${what}: point on surface`, 1e-9);
      const { n, c } = planeOf(segs(p.answer)[0]!);
      expectNear(dot(n, P), c, `${what}: point on plane`);
      const g = gradAt(F, xyz(P), ['x', 'y', 'z']);
      expect(parallel(n, g) || len(cross(n, g)) < 1e-6 * len(n) * len(g), `${what}: normal`).toBe(true);
      return;
    }
    if (task === 'graph') {
      const z = fn(letterDefs(p.question).z!);
      const P = tupleSegs(p.question).at(-1)!;
      expectNear(z({ x: P[0]!, y: P[1]! }), P[2]!, `${what}: point on surface`, 1e-9);
      const { n, c } = planeOf(segs(p.answer)[0]!);
      expectNear(dot(n, P), c, `${what}: point on plane`);
      const g = [...gradAt(z, { x: P[0]!, y: P[1]! }, ['x', 'y']), -1];
      expect(len(cross(n, g)) < 1e-6 * len(n) * len(g), `${what}: normal`).toBe(true);
      return;
    }
    const f = defFn(defIn(p.question));
    const [a, b] = p.check!.at as [number, number];
    expect(segs(p.question).some((s) => s === `(${a}, ${b})`), `${what}: base point shown`).toBe(true);
    const base = { x: a, y: b };
    const f0 = f(base);
    const [fx, fy] = gradAt(f, base, ['x', 'y']);
    const L = (x: number, y: number) => f0 + fx! * (x - a) + fy! * (y - b);
    if (task === 'linearization') {
      const ans = fn(splitTop(segs(p.answer)[0]!, ['=']).parts.at(-1)!);
      for (const env of SAMPLE_ENVS) expectNear(ans(env), L(env.x!, env.y!), `${what} at ${JSON.stringify(env)}`, 1e-6);
      return;
    }
    const target = segs(p.question).find((s) => /^f\(\d|^f\(-/.test(s))!;
    const [tx, ty] = listItems(target.slice(1)).map((t) => val(t));
    expectNear(answerNum(p.answer), L(tx!, ty!), what, 1e-4);
  },

  /** Critical points: each listed point is critical with the stated type, and none are missing. */
  'multivariable.extrema'(p: ProblemContent) {
    const f = defFn(defIn(p.question));
    const { c, mons } = polyFit2(f);
    const P = (x: number, y: number, dx: number, dy: number) =>
      mons.reduce((s, [i, j], k) => {
        if (i < dx || j < dy) return s;
        const fi = dx ? (dx === 1 ? i : i * (i - 1)) : 1;
        const fj = dy ? (dy === 1 ? j : j * (j - 1)) : 1;
        return s + c[k]! * fi * fj * x ** (i - dx) * y ** (j - dy);
      }, 0);
    const kindAt = (x: number, y: number) => {
      const D = P(x, y, 2, 0) * P(x, y, 0, 2) - P(x, y, 1, 1) ** 2;
      expect(Math.abs(D), `non-degenerate at (${x}, ${y})`).toBeGreaterThan(1e-9);
      return D < 0 ? 'saddle' : P(x, y, 2, 0) > 0 ? 'min' : 'max';
    };
    const listed: Array<[number, number]> = [];
    for (const clause of p.answer.split(';')) {
      const kind = /maxim/i.test(clause) ? 'max' : /minim/i.test(clause) ? 'min' : /saddle/i.test(clause) ? 'saddle' : '?';
      for (const s of mathSegments(clause)) {
        const [x, y] = listItems(s).map((t) => val(t)) as [number, number];
        expect(Math.hypot(P(x, y, 1, 0), P(x, y, 0, 1)), `${p.question}: (${x}, ${y}) is critical`).toBeLessThan(1e-7);
        expect(kindAt(x, y), `${p.question} → ${p.answer}: type at (${x}, ${y})`).toBe(kind);
        listed.push([x, y]);
      }
    }
    // Newton from a grid of starting points: every critical point must be listed
    for (let i = -5; i <= 5; i++)
      for (let j = -5; j <= 5; j++) {
        let x = i + 0.37;
        let y = j - 0.21;
        for (let it = 0; it < 60; it++) {
          const gx = P(x, y, 1, 0);
          const gy = P(x, y, 0, 1);
          const a = P(x, y, 2, 0);
          const b = P(x, y, 1, 1);
          const d = P(x, y, 0, 2);
          const det = a * d - b * b;
          if (!det) break;
          const sx = (d * gx - b * gy) / det;
          const sy = (a * gy - b * gx) / det;
          x -= sx;
          y -= sy;
          if (Math.hypot(sx, sy) < 1e-12 || !Number.isFinite(x)) break;
        }
        if (Number.isFinite(x) && Math.hypot(P(x, y, 1, 0), P(x, y, 0, 1)) < 1e-8 && Math.abs(x) < 50 && Math.abs(y) < 50) {
          expect(listed.some(([u, v]) => Math.hypot(u - x, v - y) < 1e-5), `${p.question} → ${p.answer}: missing critical point (${x}, ${y})`).toBe(true);
        }
      }
  },

  /** Lagrange multipliers: compare with a numeric search over the (homogeneous quadratic) constraint. */
  'multivariable.lagrange'(p: ProblemContent) {
    const d = defIn(p.question);
    const f = defFn(d);
    const [lhs, rhsTex] = splitTop(segs(p.question)[1]!, ['=']).parts;
    const g = fn(lhs!);
    const c = val(rhsTex!);
    const n = d.vars.length;
    const pointOf = (u: V): Env => {
      const e1 = envOf(d.vars, u);
      const gu = g(e1);
      const rho = Math.sqrt(c / gu);
      return envOf(d.vars, u.map((x) => x * rho));
    };
    // homogeneous of degree 2
    const u0 = [0.6, -0.48, 0.64].slice(0, n);
    expectNear(g(envOf(d.vars, u0.map((x) => 2 * x))), 4 * g(envOf(d.vars, u0)), 'homogeneous constraint');
    const dirOf = (a: number, b: number): V => (n === 2 ? [Math.cos(a), Math.sin(a)] : [Math.sin(b) * Math.cos(a), Math.sin(b) * Math.sin(a), Math.cos(b)]);
    const F = (a: number, b: number) => f(pointOf(dirOf(a, b)));
    const search = (sign: 1 | -1) => {
      let best = -Infinity;
      let ba = 0;
      let bb = 0;
      const NA = n === 2 ? 720 : 96;
      const NB = n === 2 ? 1 : 48;
      for (let i = 0; i < NA; i++)
        for (let j = 0; j < NB; j++) {
          const a = (2 * Math.PI * i) / NA;
          const b = (Math.PI * (j + 0.5)) / NB;
          const v = sign * F(a, b);
          if (v > best) [best, ba, bb] = [v, a, b];
        }
      let h = 0.05;
      for (let it = 0; it < 200 && h > 1e-12; it++) {
        let moved = false;
        for (const [da, db] of n === 2 ? [[h, 0], [-h, 0]] : [[h, 0], [-h, 0], [0, h], [0, -h]]) {
          const v = sign * F(ba + da!, bb + db!);
          if (v > best) {
            [best, ba, bb] = [v, ba + da!, bb + db!];
            moved = true;
          }
        }
        if (!moved) h /= 2;
      }
      return sign * best;
    };
    const what = `${p.question} → ${p.answer}`;
    expectNear(answerNum(p.answer, 0), search(1), `${what}: maximum`, 1e-6);
    expectNear(answerNum(p.answer, 1), search(-1), `${what}: minimum`, 1e-6);
  },
} satisfies Record<string, Verifier>);

// ---------------------------------------------------------------- multiple integrals

/** Read a brace group starting at s[i] === '{'. */
function braced(s: string, i: number): { text: string; end: number } {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === '{') depth++;
    else if (s[j] === '}' && --depth === 0) return { text: s.slice(i + 1, j), end: j + 1 };
  }
  throw new Error(`unbalanced braces in ${s}`);
}

interface Bound {
  v: string;
  lo: string;
  hi: string;
}
interface Integral {
  bounds: Bound[];
  body: string;
  region?: string;
  dims: number;
}

/** `\int_{a}^{b}\int_{c}^{d} body \,dy\,dx` or `\iint_{D} body \,dA` (prepped TeX). */
function parseIntegral(seg: string): Integral {
  let s = prep(seg);
  const k = s.search(/\\i+nt/);
  expect(k, `integral in ${seg}`).toBeGreaterThanOrEqual(0);
  s = s.slice(k);
  s = splitTop(s, ['=']).parts[0]!;
  const ints: Array<{ lo: string; hi: string }> = [];
  let region: string | undefined;
  let dims = 0;
  let i = 0;
  for (;;) {
    const mm = /^\s*\\(i*)int/.exec(s.slice(i));
    if (!mm) break;
    i += mm[0].length;
    if (mm[1]) {
      dims = mm[1].length + 1;
      expect(s[i], `region subscript in ${seg}`).toBe('_');
      const b = braced(s, i + 1);
      region = b.text.trim();
      i = b.end;
      continue;
    }
    expect(s[i], `lower limit in ${seg}`).toBe('_');
    const lo = braced(s, i + 1);
    expect(s[lo.end], `upper limit in ${seg}`).toBe('^');
    const hi = braced(s, lo.end + 1);
    ints.push({ lo: lo.text, hi: hi.text });
    i = hi.end;
  }
  const rest = s.slice(i).trim();
  const dm = /((?:(?:\\,)?\s*d\s*[a-zA-Z]\s*)+)$/.exec(rest)!;
  expect(dm, `differentials in ${seg}`).toBeTruthy();
  const ds = [...dm[1]!.matchAll(/d\s*([a-zA-Z])/g)].map((x) => x[1]!);
  let body = rest.slice(0, dm.index).trim().replace(/\\,$/, '').trim();
  if (!body) body = '1';
  if (region) return { bounds: [], body, region, dims };
  expect(ds.length, `limits vs differentials in ${seg}`).toBe(ints.length);
  const bounds = ints.map((b, j) => ({ v: ds[ds.length - 1 - j]!, ...b }));
  return { bounds, body, dims: ints.length };
}

interface Region {
  vars: string[];
  bounds: Bound[];
}

/** Region named `name` in the question: set-builder or a rectangle `[a, b] \times [c, d]`. */
function regionIn(rich: string, name: string): Region {
  for (const raw of segs(rich)) {
    const s = prep(raw);
    const mm = new RegExp(`^${name}\\s*=\\s*([\\s\\S]+)$`).exec(s);
    if (!mm) continue;
    const body = mm[1]!.trim();
    if (body.startsWith('[')) {
      const ivs = body.split('\\times').map((t) => listItems(t.trim().replace(/^\[/, '(').replace(/\]$/, ')')));
      const vars = ['x', 'y', 'z'].slice(0, ivs.length);
      return { vars, bounds: ivs.map((iv, j) => ({ v: vars[j]!, lo: iv[0]!, hi: iv[1]! })) };
    }
    const vm = /^\\left\\\{\s*\(([^)]*)\)\s*\|/.exec(body)!;
    expect(vm, `set-builder ${raw}`).toBeTruthy();
    const vars = vm[1]!.split(',').map((v) => v.trim());
    const conds = setConds(body);
    const raw3 = conds.map((c) => {
      const { parts, rels } = splitTop(c, ['\\le', '\\leq', '<']);
      expect(rels.length, `bounds ${c}`).toBe(2);
      return { v: parts[1]!.trim(), lo: parts[0]!, hi: parts[2]! };
    });
    // dependency order: a bound that mentions another variable goes inside it
    const placed: Bound[] = [];
    const left = [...raw3];
    const uses = (b: Bound, v: string) => new RegExp(`(^|[^a-zA-Z\\\\])${v}([^a-zA-Z]|$)`).test(`${b.lo} ${b.hi}`);
    while (left.length) {
      const j = left.findIndex((b) => left.every((o) => o === b || !uses(b, o.v)));
      expect(j, `region order in ${raw}`).toBeGreaterThanOrEqual(0);
      placed.push(left.splice(j, 1)[0]!);
    }
    return { vars, bounds: placed };
  }
  throw new Error(`no region ${name} in ${rich}`);
}

/** Map integration variables to x, y, z with the Jacobian of the coordinate system. */
function coordEnv(vars: string[], env: Env): { env: Env; jac: number } {
  const key = vars.join(',');
  if (key === 'r,Q') return { env: { ...env, x: env.r! * Math.cos(env.Q!), y: env.r! * Math.sin(env.Q!) }, jac: env.r! };
  if (key === 'r,Q,z') return { env: { ...env, x: env.r! * Math.cos(env.Q!), y: env.r! * Math.sin(env.Q!) }, jac: env.r! };
  if (key === 'R,Q,P') {
    const { R, Q, P } = env as { R: number; Q: number; P: number };
    return { env: { ...env, x: R * Math.sin(P) * Math.cos(Q), y: R * Math.sin(P) * Math.sin(Q), z: R * Math.cos(P) }, jac: R * R * Math.sin(P) };
  }
  return { env, jac: 1 };
}

/** Numeric iterated integral (bounds outer → inner). */
function integrate(body: Fn, bounds: Bound[], vars: string[] | null = null, n?: number): number {
  const pts = n ?? (bounds.length >= 3 ? 12 : 20);
  const lo = bounds.map((b) => fn(b.lo));
  const hi = bounds.map((b) => fn(b.hi));
  // substitute away √-type endpoint behaviour only where a deeper limit has a radical
  const smooth = bounds.map((_, k) => bounds.slice(k + 1).some((b) => /sqrt/.test(b.lo + b.hi)));
  const rec = (k: number, env: Env): number => {
    if (k === bounds.length) {
      if (!vars) return body(env);
      const c = coordEnv(vars, env);
      return body(c.env) * c.jac;
    }
    const a = lo[k]!(env);
    const b = hi[k]!(env);
    return quad((t) => rec(k + 1, { ...env, [bounds[k]!.v]: t }), a, b, pts, bounds.length >= 3 ? 1 : 2, smooth[k]);
  };
  return rec(0, {});
}

/** Value of the integral in a rendered segment (regions looked up in `context`). */
function integralValue(seg: string, context: string): number {
  const I = parseIntegral(seg);
  const body = fn(I.body);
  if (I.region) {
    const R = regionIn(context, I.region);
    return integrate(body, R.bounds, R.vars);
  }
  return integrate(body, I.bounds);
}

Object.assign(VERIFIERS, {
  /** Iterated / multiple integrals evaluated numerically from the question (and from the answer when it rewrites the integral). */
  'multivariable.integral'(p: ProblemContent) {
    const what = `${p.question} → ${p.answer}`;
    const over = p.check!.over as string | undefined;
    if (over) {
      // area (∬ 1 dA) or volume under z = f over a region given in the question
      const R = regionIn(p.question, over);
      const b = p.check!.body as string;
      const body = b === '1' ? () => 1 : fn(letterDefs(p.question)[b]!);
      return expectNear(answerNum(p.answer), integrate(body, R.bounds, R.vars), what, 1e-6);
    }
    const qseg = segs(p.question).find((s) => /\\i+nt/.test(s))!;
    const want = integralValue(qseg, p.question);
    expectNear(answerNum(p.answer), want, `${what}: value`, 1e-6);
    if (p.check!.reversed) {
      const aseg = segs(p.answer).find((s) => /\\i+nt/.test(s))!;
      const I = parseIntegral(aseg);
      const Q = parseIntegral(qseg);
      expect(I.bounds.map((b) => b.v).join(''), `${what}: order reversed`).toBe([...Q.bounds].reverse().map((b) => b.v).join(''));
      expectNear(integralValue(aseg, p.answer), want, `${what}: rewritten integral`, 1e-6);
    }
  },
} satisfies Record<string, Verifier>);

Object.assign(VERIFIERS, {
  /** Tetrahedron cut from the first octant by a plane: volume from the intercepts, and by integration. */
  'multivariable.tetra'(p: ProblemContent) {
    const { n, c } = planeOf(planeSegments(p.question)[0]!);
    const [a, b, cc] = n.map((k) => c / k) as [number, number, number];
    [a, b, cc].forEach((x) => expect(x, 'positive intercepts').toBeGreaterThan(0));
    const V = integrate(() => 1, [
      { v: 'x', lo: '0', hi: String(a) },
      { v: 'y', lo: '0', hi: `${b}(1 - x/${a})` },
      { v: 'z', lo: '0', hi: `${cc}(1 - x/${a} - y/${b})` },
    ]);
    expectNear(V, (a * b * cc) / 6, 'tetrahedron volume', 1e-8);
    expectNear(answerNum(p.answer), V, `${p.question} → ${p.answer}`, 1e-6);
  },

  /** Mass / center of mass of a lamina over the region D with density δ (1 when absent). */
  'multivariable.lamina'(p: ProblemContent) {
    const R = regionIn(p.question, 'D');
    const dseg = segs(p.question).find((s) => s.startsWith('\\delta(x, y) ='));
    const dens = dseg ? fn(dseg.replace(/^\\delta\(x, y\)\s*=/, '')) : () => 1;
    const M = integrate(dens, R.bounds);
    const what = `${p.question} → ${p.answer}`;
    if (p.check!.what === 'mass') return expectNear(answerNum(p.answer), M, what, 1e-6);
    const My = integrate((e) => e.x! * dens(e), R.bounds);
    const Mx = integrate((e) => e.y! * dens(e), R.bounds);
    const pt = listItems(splitTop(segs(p.answer)[0]!, ['=']).parts.at(-1)!).map((t) => val(t));
    expectVec(pt, [My / M, Mx / M], what, 1e-6);
  },
} satisfies Record<string, Verifier>);

// ---------------------------------------------------------------- vector fields and line integrals

/** `\mathbf{F}(x, y, z) = ⟨P, Q, R⟩` in the question. */
function fieldIn(rich: string): { vars: string[]; comps: Fn[] } {
  for (const s of segs(rich)) {
    const mm = /^\\mathbf\{F\}\(([a-z](?:,\s*[a-z])*)\)\s*=\s*(\\left\\langle[\s\S]*\\right\\rangle)$/.exec(s);
    if (mm) return { vars: mm[1]!.split(',').map((v) => v.trim()), comps: langles(mm[2]!)[0]!.map(fn) };
  }
  throw new Error(`no vector field in ${rich}`);
}
const Fat = (F: Fn[], env: Env) => F.map((c) => c(env));

function curlPairs(F: Fn[], vars: string[], env: Env): Array<[number, number]> {
  const d = (i: number, v: string) => partial(F[i]!, env, [v]);
  if (vars.length === 2) return [[d(1, 'x'), d(0, 'y')]];
  return [
    [d(2, 'y'), d(1, 'z')],
    [d(0, 'z'), d(2, 'x')],
    [d(1, 'x'), d(0, 'y')],
  ];
}
const curlAt = (F: Fn[], vars: string[], env: Env) => curlPairs(F, vars, env).map(([a, b]) => a - b);
/** Curl vanishes (relative to the size of the partial derivatives) at the sample points. */
const curlFree = (F: Fn[], vars: string[]) => SAMPLE_ENVS.every((env) => curlPairs(F, vars, env).every(([a, b]) => near(a, b, 1e-6)));

/** `C: \mathbf{r}(t) = ⟨…⟩,\ a \le t \le b` (or `\mathbf{r}(t) = …` with the bounds in another segment). */
function curveIn(rich: string): { r: F1[]; a: number; b: number } {
  for (const s of segs(rich)) {
    const mm = /\\mathbf\{r\}\(t\)\s*=\s*(\\left\\langle[\s\S]*?\\right\\rangle),\\ ([\s\S]*)\\le t \\le ([\s\S]*)$/.exec(s);
    if (mm) return { r: compFns(langles(mm[1]!)[0]!), a: val(mm[2]!), b: val(mm[3]!) };
  }
  throw new Error(`no curve in ${rich}`);
}

const lineInt = (g: F1, a: number, b: number) => quad(g, a, b, 16, 8);

Object.assign(VERIFIERS, {
  /** Vector fields: values, magnitudes, gradient fields, qualitative description. */
  'multivariable.field'(p: ProblemContent) {
    const task = p.check!.task as string;
    const what = `${p.question} → ${p.answer}`;
    if (task === 'gradientField') {
      const d = defIn(p.question);
      const comps = segs(p.answer).flatMap((s) => langles(s)).at(-1)!.map(fn);
      for (const env of SAMPLE_ENVS) expectVec(comps.map((c) => c(env)), gradAt(defFn(d), env, d.vars), `${what} at ${JSON.stringify(env)}`, 1e-5);
      return;
    }
    const { vars, comps } = fieldIn(p.question);
    if (task === 'describe') {
      const pts = [[1.3, 0.4], [-0.7, 1.9], [-2.2, -1.1], [0.5, -2.6]];
      const vals = pts.map(([x, y]) => Fat(comps, { x: x!, y: y! }));
      const same = vals.every((v) => near(v[0]!, vals[0]![0]!) && near(v[1]!, vals[0]![1]!));
      const kinds = new Set(
        pts.map(([x, y], i) => {
          const [u, w] = vals[i]!;
          const dotp = x! * u! + y! * w!;
          const crs = x! * w! - y! * u!;
          if (same) return 'Constant: every vector is the same';
          if (Math.abs(crs) < 1e-9) return dotp > 0 ? 'Points directly away from the origin' : 'Points directly toward the origin';
          if (Math.abs(dotp) < 1e-9) return crs > 0 ? 'Circulates counterclockwise about the origin' : 'Circulates clockwise about the origin';
          return 'other';
        }),
      );
      return expect([...kinds], what).toEqual([p.answer]);
    }
    if (task === 'evaluate') {
      const at = segs(p.question).find((s) => /^\\mathbf\{F\}\((-?\d|\()/.test(s) || /^\\mathbf\{F\}\(-?\d/.test(s))!;
      const P = listItems(at.replace(/^\\mathbf\{F\}/, '')).map((t) => val(t));
      return expectVec(lastVector(p.answer), Fat(comps, envOf(vars, P)), what);
    }
    const P = tupleSegs(p.question).at(-1)!;
    return expectNear(answerNum(p.answer), len(Fat(comps, envOf(vars, P))), what);
  },

  /** Divergence and curl by numeric partial derivatives. */
  'multivariable.divcurl'(p: ProblemContent) {
    const task = p.check!.task as string;
    const { vars, comps } = fieldIn(p.question);
    const what = `${p.question} → ${p.answer}`;
    const div = (env: Env) => vars.reduce((s, v, i) => s + partial(comps[i]!, env, [v]), 0);
    if (task === 'divPoint' || task === 'curlPoint') {
      const P = envOf(vars, tupleSegs(p.question).at(-1)!);
      if (task === 'divPoint') return expectNear(answerNum(p.answer), div(P), what, 1e-6);
      return expectVec(lastVector(p.answer), curlAt(comps, vars, P), what, 1e-6);
    }
    if (task === 'div') {
      const ans = fn(splitTop(segs(p.answer)[0]!, ['=']).parts.at(-1)!);
      for (const env of SAMPLE_ENVS) expectNear(ans(env), div(env), `${what} at ${JSON.stringify(env)}`, 1e-5);
      return;
    }
    const ans = segs(p.answer).flatMap((s) => langles(s)).at(-1)!.map(fn);
    for (const env of SAMPLE_ENVS) expectVec(Fat(ans, env), curlAt(comps, vars, env), `${what} at ${JSON.stringify(env)}`, 1e-5);
  },

  /** Conservative fields: ∇f = F for the stated potential, or a non-zero curl for "Not conservative". */
  'multivariable.conservative'(p: ProblemContent) {
    const { vars, comps } = fieldIn(p.question);
    const what = `${p.question} → ${p.answer}`;
    if (/not conservative/i.test(p.answer)) {
      return expect(curlFree(comps, vars), `${what}: curl should be non-zero`).toBe(false);
    }
    const rhsT = splitTop(segs(p.answer)[0]!, ['=']).parts.at(-1)!;
    expect(/\+ C$/.test(rhsT), `${what}: + C`).toBe(true);
    const f = fn(rhsT.replace(/\+ C$/, ''));
    for (const env of SAMPLE_ENVS) expectVec(gradAt(f, env, vars), Fat(comps, env), `${what} at ${JSON.stringify(env)}`, 1e-5);
  },

  /** Scalar and vector line integrals by numeric integration along the parametrized curve. */
  'multivariable.lineIntegral'(p: ProblemContent) {
    const task = p.check!.task as string;
    const what = `${p.question} → ${p.answer}`;
    const got = answerNum(p.answer);
    const ints = segs(p.question).filter((s) => /\\int_\{C\}/.test(s));
    if (task === 'scalarSegment' || task === 'scalarCurve') {
      const body = fn(/\\int_\{C\}\s*([\s\S]*?)\\,ds$/.exec(ints[0]!)![1]!);
      if (task === 'scalarSegment') {
        const ps = pointsIn(p.question);
        const P = getV(ps, 'P');
        const Q = getV(ps, 'Q');
        const d = vsub(Q, P);
        const vars = ['x', 'y', 'z'].slice(0, P.length);
        return expectNear(got, lineInt((t) => body(envOf(vars, P.map((x, i) => x + t * d[i]!))) * len(d), 0, 1), what, 1e-6);
      }
      const { r, a, b } = curveIn(p.question);
      const vars = ['x', 'y', 'z'].slice(0, r.length);
      return expectNear(got, lineInt((t) => body(envOf(vars, evalV(r, t))) * len(dV(r, t)), a, b), what, 1e-6);
    }
    if (task === 'differential') {
      const { r, a, b } = curveIn(p.question);
      const form = /\\int_\{C\}\s*([\s\S]*)$/.exec(ints[0]!)![1]!;
      const pieces = [...form.matchAll(/([\s\S]*?)\\,d([xyz])/g)].map((x) => ({ coef: fn(x[1]!.trim().replace(/^\+/, '')), v: x[2]! }));
      const vars = ['x', 'y', 'z'].slice(0, r.length);
      const g = (t: number) => {
        const env = envOf(vars, evalV(r, t));
        const dr = dV(r, t);
        return pieces.reduce((s, pc) => s + pc.coef(env) * dr[vars.indexOf(pc.v)]!, 0);
      };
      return expectNear(got, lineInt(g, a, b), what, 1e-6);
    }
    const { vars, comps } = fieldIn(p.question);
    if (task === 'points') {
      const ps = pointsIn(p.question);
      const P = getV(ps, 'P');
      const Q = getV(ps, 'Q');
      expect(curlFree(comps, vars), `${what}: conservative`).toBe(true);
      const d = vsub(Q, P);
      return expectNear(got, lineInt((t) => dot(Fat(comps, envOf(vars, P.map((x, i) => x + t * d[i]!))), d), 0, 1), what, 1e-6);
    }
    const { r, a, b } = curveIn(p.question);
    return expectNear(got, lineInt((t) => dot(Fat(comps, envOf(vars, evalV(r, t))), dV(r, t)), a, b), what, 1e-6);
  },
} satisfies Record<string, Verifier>);
