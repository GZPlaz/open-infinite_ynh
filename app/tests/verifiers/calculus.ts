/**
 * Calculus pack verifiers. Everything is checked numerically from the
 * RENDERED question and answer: numeric limits, derivatives (any order),
 * implicit derivatives along the curve, integrals (Simpson), extrema by
 * sampling, Riemann sums from the formula or table, solids of revolution.
 */
import { expect } from 'vitest';
import type { ProblemContent } from '../../src/engine/types';
import { close, evalReal, evaluate, listItems, mathSegments, onlyMath, splitTop, stripUnits } from '../evaluator';
import { answerValues, curvePoints, rhs, sides, type Verifier } from '../verify';

type Fn = (x: number) => number;
const POS = [0.7, 1.3, 1.9, 2.6, 3.4];

/** Lenient evaluation: NaN for anything undefined or non-real. */
function ev(tex: string, vars: Record<string, number>): number {
  try {
    const v = evaluate(tex, { vars });
    if (!Number.isFinite(v.re) && Number.isNaN(v.im)) return v.re;
    if (Math.abs(v.im) > 1e-9 * Math.max(1, Math.abs(v.re))) return NaN;
    return v.re;
  } catch {
    return NaN;
  }
}
const fnOf = (tex: string, v: string, extra: Record<string, number> = {}): Fn => (x) => ev(tex, { ...extra, [v]: x });
const strip = (t: string) => t.replace(/\\displaystyle\s*/g, '').trim();

/** Strict scalar from a TeX string (units stripped). */
const val = (t: string) => evalReal(stripUnits(strip(t)));

function near(a: number, b: number, tol = 1e-4): boolean {
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
}

// ---------------------------------------------------------------- function definitions

interface Def {
  name: string;
  v: string;
  body: string;
}

/** First `y = …` / `f(x) = …` segment of the question (piecewise allowed). */
function definition(q: string, v = 'x'): Def {
  for (const seg of mathSegments(q)) {
    const s = strip(seg);
    const mm = /^([a-zA-Z])(?:\(([a-z])\))?\s*=\s*([\s\S]+)$/.exec(s);
    if (mm && (mm[2] || mm[1] === 'y')) return { name: mm[1]!, v: mm[2] ?? v, body: mm[3]!.trim() };
  }
  throw new Error(`no function definition in ${q}`);
}

const PIECE_RELS = ['\\le', '\\ge', '\\leq', '\\geq', '\\neq', '\\ne', '<', '>', '='];

function condHolds(cond: string, v: string, x: number, extra: Record<string, number>): boolean {
  const { parts, rels } = splitTop(cond.replace(/\\text\{[^}]*\}/g, '').trim(), PIECE_RELS);
  const vals = parts.map((p) => evalReal(p, { vars: { ...extra, [v]: x } }));
  return rels.every((r, i) => {
    const a = vals[i]!;
    const b = vals[i + 1]!;
    const eps = 1e-12;
    switch (r) {
      case '<':
        return a < b - eps;
      case '>':
        return a > b + eps;
      case '\\le':
      case '\\leq':
        return a <= b + eps;
      case '\\ge':
      case '\\geq':
        return a >= b - eps;
      case '=':
        return Math.abs(a - b) <= eps;
      default:
        return Math.abs(a - b) > eps;
    }
  });
}

interface Piece {
  expr: string;
  cond: string;
}

function pieces(body: string): Piece[] | null {
  const mm = /\\begin\{cases\}([\s\S]*)\\end\{cases\}/.exec(body);
  if (!mm) return null;
  return mm[1]!
    .split('\\\\')
    .map((r) => r.trim())
    .filter(Boolean)
    .map((row) => {
      const [e, c] = row.split('&');
      return { expr: e!.trim().replace(/,$/, '').trim(), cond: (c ?? '').trim() };
    });
}

/** Numeric function from a definition body (piecewise via cases). */
function bodyFn(body: string, v: string, extra: Record<string, number> = {}): Fn {
  const ps = pieces(body);
  if (!ps) return fnOf(body, v, extra);
  return (x) => {
    const p = ps.find((pp) => condHolds(pp.cond, v, x, extra));
    return p ? ev(p.expr, { ...extra, [v]: x }) : NaN;
  };
}

/** Boundary numbers mentioned in piecewise conditions. */
function boundaries(body: string): number[] {
  const out = new Set<number>();
  for (const p of pieces(body) ?? []) {
    for (const part of splitTop(p.cond, PIECE_RELS).parts) {
      const t = part.trim();
      if (!/[a-z]/.test(t.replace(/\\(frac|sqrt|pi)/g, ''))) out.add(evalReal(t));
    }
  }
  return [...out];
}

// ---------------------------------------------------------------- numeric calculus

/** Richardson central difference; `scale` shrinks the step near poles, where the derivative is huge and curvature dominates. */
function d1(f: Fn, x: number, scale = 1): number {
  const D = (h: number) => (f(x + h * scale) - f(x - h * scale)) / (2 * h * scale);
  return (4 * D(5e-4) - D(1e-3)) / 3;
}
function d2(f: Fn, x: number): number {
  const D = (h: number) => (f(x + h) - 2 * f(x) + f(x - h)) / (h * h);
  return (4 * D(1e-3) - D(2e-3)) / 3;
}
function d3(f: Fn, x: number): number {
  const D = (h: number) => (f(x + 2 * h) - 2 * f(x + h) + 2 * f(x - h) - f(x - 2 * h)) / (2 * h * h * h);
  return (4 * D(5e-3) - D(1e-2)) / 3;
}
const DERIV = [(f: Fn, x: number) => f(x), d1, d2, d3];

/** Simpson after x = a + (b − a)(3u² − 2u³): smooth integrands stay smooth, √-type endpoint singularities disappear. */
function simpsonSafe(f: Fn, a: number, b: number, n = 800): number {
  return simpson((u) => {
    const w = 6 * u * (1 - u);
    return w === 0 ? 0 : f(a + (b - a) * (3 * u * u - 2 * u * u * u)) * (b - a) * w;
  }, 0, 1, n);
}

/** d1, falling back to one-sided differences at the edge of the domain (e.g. x^{3/2} at 0). */
function d1edge(f: Fn, x: number): number {
  const c = d1(f, x);
  if (Number.isFinite(c)) return c;
  const h = 1e-6;
  const fwd = (-3 * f(x) + 4 * f(x + h) - f(x + 2 * h)) / (2 * h);
  return Number.isFinite(fwd) ? fwd : (3 * f(x) - 4 * f(x - h) + f(x - 2 * h)) / (2 * h);
}

function simpson(f: Fn, a: number, b: number, n = 600): number {
  if (a === b) return 0;
  const h = (b - a) / n;
  let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2);
  return (s * h) / 3;
}

type LimitVal = number | 'inf' | '-inf' | 'dne';

/** One-sided limit of f at a from side s. */
function sideLimit(f: Fn, a: number, s: 1 | -1): LimitVal {
  const g = (h: number) => f(a + s * h);
  const far = g(1e-3);
  const tiny = g(1e-7);
  if (Math.abs(tiny) > 1e5 && Math.abs(tiny) > 50 * Math.abs(far)) return tiny > 0 ? 'inf' : '-inf';
  const est = 2 * g(5e-4) - g(1e-3);
  return Number.isFinite(est) ? est : NaN;
}

function twoSided(f: Fn, a: number): LimitVal {
  const l = sideLimit(f, a, -1);
  const r = sideLimit(f, a, 1);
  if (typeof l === 'number' && typeof r === 'number') {
    if (!near(l, r, 1e-3)) return 'dne';
    return (l + r) / 2;
  }
  return l === r ? l : 'dne';
}

/** f(s·X) for growing X; overflowing exponentials give NaN at huge X, so use the largest X with a value. */
function atInfinity(f: Fn, s: 1 | -1): LimitVal {
  const vals = [1e2, 1e3, 1e4, 1e6, 1e8].map((X) => f(s * X)).filter((v) => !Number.isNaN(v));
  const last = vals[vals.length - 1]!;
  const prev = vals[vals.length - 2] ?? last;
  if (last >= 1e3 && last >= prev) return 'inf';
  if (last <= -1e3 && last <= prev) return '-inf';
  return last;
}

function sameLimit(got: LimitVal, want: LimitVal, what: string): void {
  if (typeof want === 'number' && typeof got === 'number') expect(near(got, want, 1e-4), `${what}: numeric ${got} vs answer ${want}`).toBe(true);
  else expect(got, what).toBe(want);
}

function answerLimit(answer: string): LimitVal {
  if (/does not exist/i.test(answer)) return 'dne';
  const t = strip(onlyMath(answer));
  const r = rhs(t);
  if (r === '\\infty') return 'inf';
  if (r === '-\\infty') return '-inf';
  return evalReal(r);
}

/** Read a brace group starting at s[i] === '{'. */
function braced(s: string, i: number): { text: string; end: number } {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === '{') depth++;
    else if (s[j] === '}' && --depth === 0) return { text: s.slice(i + 1, j), end: j + 1 };
  }
  throw new Error(`unbalanced braces in ${s}`);
}

interface IntegralTex {
  lo?: string;
  hi?: string;
  body: string;
  v: string;
  prefix: string;
}

function parseIntegral(seg: string): IntegralTex {
  const s = strip(seg);
  const k = s.indexOf('\\int');
  if (k < 0) throw new Error(`no integral in ${seg}`);
  let i = k + 4;
  let lo: string | undefined;
  let hi: string | undefined;
  if (s[i] === '_') {
    const b1 = braced(s, i + 1);
    lo = b1.text;
    i = b1.end;
    if (s[i] !== '^') throw new Error(`bad bounds in ${seg}`);
    const b2 = braced(s, i + 1);
    hi = b2.text;
    i = b2.end;
  }
  const rest = s.slice(i);
  const mm = /^([\s\S]*?)\\,d([a-z])\s*$/.exec(rest);
  if (!mm) throw new Error(`no differential in ${seg}`);
  return { lo, hi, body: mm[1]!.trim(), v: mm[2]!, prefix: s.slice(0, k) };
}

/** A closed interval `[a, b]` in the question. */
function intervalIn(q: string): [number, number] {
  for (const seg of mathSegments(q)) {
    const mm = /^(?:\\left)?\[(.*),(.*?)(?:\\right)?\]$/.exec(strip(seg));
    if (mm) return [evalReal(mm[1]!), evalReal(mm[2]!)];
  }
  throw new Error(`no interval in ${q}`);
}

/** Roots of g by sign changes on a grid. */
function signChanges(g: Fn, a: number, b: number, n: number): number[] {
  const out: number[] = [];
  let px = a;
  let pv = g(a);
  for (let i = 1; i <= n; i++) {
    const x = a + ((b - a) * i) / n;
    const v = g(x);
    if (Number.isFinite(pv) && Number.isFinite(v) && pv * v < 0) {
      let lo = px;
      let hi = x;
      let glo = pv;
      for (let k = 0; k < 45; k++) {
        const mid = (lo + hi) / 2;
        const gm = g(mid);
        if (glo * gm <= 0) hi = mid;
        else {
          lo = mid;
          glo = gm;
        }
      }
      out.push((lo + hi) / 2);
    }
    px = x;
    pv = v;
  }
  return out;
}

/** `Label: $…$; Other: $…$` → [{label, segs}] */
function labeled(answer: string): Array<{ label: string; segs: string[] }> {
  return answer.split(';').map((part) => ({ label: part.replace(/\$[^$]*\$/g, '').toLowerCase(), segs: mathSegments(part) }));
}

const tupleOf = (seg: string) => listItems(strip(seg)).map((t) => evalReal(t));

function endVal(t: string): number {
  const s = t.trim();
  if (s === '\\infty') return Infinity;
  if (s === '-\\infty') return -Infinity;
  return evalReal(s);
}

/** `(a, b) \cup (c, \infty)` → [[a, b], [c, ∞]] */
function intervals(seg: string): Array<[number, number]> {
  return strip(seg)
    .split('\\cup')
    .map((t) => {
      const mm = /^\s*(?:\\left)?[([](.*),(.*?)(?:\\right)?[)\]]\s*$/.exec(t);
      if (!mm) throw new Error(`bad interval ${t}`);
      return [endVal(mm[1]!), endVal(mm[2]!)] as [number, number];
    });
}

function wordProblemValue(p: ProblemContent): number {
  const segs = mathSegments(p.answer);
  return val(splitTop(strip(segs[segs.length - 1]!), ['=', '\\approx']).parts.at(-1)!);
}


/**
 * Double-exponential (tanh-sinh / exp-sinh / sinh-sinh) quadrature on [a, b], either end may be
 * infinite, truncated at |t| ≤ T. Endpoint nodes that round onto a singular endpoint are skipped.
 */
function deQuad(f: Fn, a: number, b: number, T: number, h = 1 / 32): number {
  let s = 0;
  for (let k = Math.ceil(-T / h); k * h <= T; k++) {
    const t = k * h;
    const u = (Math.PI / 2) * Math.sinh(t);
    const du = (Math.PI / 2) * Math.cosh(t);
    let x: number;
    let w: number;
    if (Number.isFinite(a) && Number.isFinite(b)) {
      const d = (b - a) / (1 + Math.exp(2 * Math.abs(u)));
      x = u >= 0 ? b - d : a + d;
      const e = Math.exp(-Math.abs(u));
      w = ((b - a) / 2) * ((4 * e * e) / (1 + e * e) ** 2) * du;
    } else if (Number.isFinite(a)) {
      x = a + Math.exp(u);
      w = Math.exp(u) * du;
    } else if (Number.isFinite(b)) {
      x = b - Math.exp(u);
      w = Math.exp(u) * du;
    } else {
      x = Math.sinh(u);
      w = Math.cosh(u) * du;
    }
    if (w === 0) continue;
    const v = f(x);
    if (!Number.isFinite(v)) {
      if (x === a || x === b) continue;
      return NaN;
    }
    s += v * w;
  }
  return s * h;
}

const boundVal = (t: string) => (t.trim() === '\\infty' ? Infinity : t.trim() === '-\\infty' ? -Infinity : evalReal(t));


// ---------------------------------------------------------------- differential equations

interface DE {
  dep: string;
  ind: string;
  rhs: string;
  F: (x: number, y: number) => number;
}

/** `\frac{dy}{dx} = …` segment of a rich string. */
function parseDE(rich: string): DE {
  for (const seg of mathSegments(rich)) {
    const mm = /^\\frac\{d([a-zA-Z])\}\{d([a-zA-Z])\} = ([\s\S]+)$/.exec(strip(seg));
    if (mm) {
      const [, dep, ind, rhs0] = mm as unknown as [string, string, string, string];
      return { dep, ind, rhs: rhs0, F: (x, y) => ev(rhs0, { [ind]: x, [dep]: y }) };
    }
  }
  throw new Error(`no differential equation in ${rich}`);
}

/** Initial condition `y(a) = b` for the dependent variable. */
function initialOf(rich: string, dep: string): [number, number] | null {
  for (const seg of mathSegments(rich)) {
    const mm = /^([a-zA-Z])\(([^()]+)\) = (.+)$/.exec(strip(seg));
    if (mm && mm[1] === dep) return [evalReal(mm[2]!), evalReal(mm[3]!)];
  }
  return null;
}

type Path = { t: 'path'; pts: ReadonlyArray<readonly [number, number]>; ink?: string; role?: string };
/** Slope marks of a slope-field figure: two-point paths in 'ink'. */
function slopeMarks(p: ProblemContent): Array<{ x: number; y: number; s: number }> {
  return ((p.diagram?.items ?? []) as unknown as Path[])
    .filter((it) => it.t === 'path' && it.pts.length === 2 && it.ink === 'ink' && !it.role)
    .map(({ pts: [[x1, y1], [x2, y2]] }) => ({ x: (x1 + x2) / 2, y: (y1 + y2) / 2, s: (y2 - y1) / (x2 - x1) }));
}


// ---------------------------------------------------------------- parametric, polar, vector

/** `x = …` and `y = …` (in t) of a parametric question. */
function paramXY(q: string): [Fn, Fn] {
  const segs = mathSegments(q).map(strip);
  const xs = segs.find((x) => /^x = /.test(x))!;
  const ys = segs.find((x) => /^y = /.test(x))!;
  return [fnOf(rhs(xs), 't'), fnOf(rhs(ys), 't')];
}

/** `a \le v \le b` → [v, a, b] */
function chainInterval(q: string): [string, number, number] {
  for (const seg of mathSegments(q).map(strip)) {
    const { parts, rels } = splitTop(seg, ['\\le']);
    if (rels.length === 2 && /^[a-z]$/.test(parts[1]!.trim())) return [parts[1]!.trim(), evalReal(parts[0]!), evalReal(parts[2]!)];
  }
  throw new Error(`no interval in ${q}`);
}

const untheta = (t: string) => t.replace(/\\theta/g, ' t ').replace(/\s+/g, ' ').trim();

/** Vector `\left\langle a, b \right\rangle` → [a, b] as TeX. */
const vecItems = (t: string) => listItems(strip(t));

/** Check a `y = mx + b` answer against a line through (x0, y0) with slope m. */
function expectLine(answer: string, x0: number, y0: number, slope: number, what: string): void {
  const ans = strip(onlyMath(answer));
  expect(ans, answer).toMatch(/^y = /);
  for (const x of [x0 - 1.5, x0 + 0.5, x0 + 2]) expect(near(evalReal(rhs(ans), { vars: { x } }), y0 + slope * (x - x0), 1e-6), `${what} → ${answer} at x=${x}`).toBe(true);
}


// ---------------------------------------------------------------- series

/** `\sum_{n=k}^{\infty} body` in a segment. */
function parseSum(seg: string): { from: number; body: string } {
  const mm = /\\sum_\{n=(-?\d+)\}\^\{\\infty\}\s*([\s\S]+)$/.exec(strip(seg));
  if (!mm) throw new Error(`no series in ${seg}`);
  return { from: Number(mm[1]), body: mm[2]!.trim() };
}

/** Exact signs: (−1)^n → u, (−1)^{n+1} → w, (−k)^n → u·k^n (cpow of negatives at large n is inexact). */
function signed(body: string): string {
  return body.replace(/\(-1\)\^\{n\+1\}/g, ' w ').replace(/\(-1\)\^\{n\}/g, ' u ').replace(/\(-(\d+)\)\^\{n\}/g, ' u $1^{n} ');
}
function termFn(body: string, extra: Record<string, number> = {}, vSign = 1): (n: number) => number {
  const b = signed(body);
  return (n) => ev(b, { ...extra, n, u: n % 2 === 0 ? 1 : -1, w: n % 2 === 0 ? -1 : 1, v: n % 2 === 0 ? 1 : vSign });
}

/** Value after the last ≤ of the answer's math. */
const leValue = (p: ProblemContent) => val(splitTop(strip(mathSegments(p.answer).at(-1)!), ['\\le']).parts.at(-1)!);

interface SeriesInfo {
  verdict: 'conv' | 'div';
  sum?: number;
  /** ratio-test limit estimate, when the ratio settles */
  L?: number;
}

/** Numerical convergence: ratio of terms (fast path), nth-term test, then the doubling-block tail test. */
function analyse(a: (n: number) => number, n0: number): SeriesInfo {
  // (indices stay small: the evaluator's complex division overflows for huge numerators/denominators)
  const r = (n: number) => Math.abs(a(n + 1) / a(n));
  const r1 = r(n0 + 20);
  const r2 = r(n0 + 40);
  const steady = Math.abs(r(n0 + 21) - r1) < 0.05 * Math.max(1, r1) && Math.abs(r(n0 + 41) - r2) < 0.05 * Math.max(1, r2);
  const L = Number.isFinite(r1) && Number.isFinite(r2) && steady ? 2 * r2 - r1 : undefined;
  if (L !== undefined && L < 0.9 && r2 < 0.97) {
    let s = 0;
    for (let n = n0; n < n0 + 500; n++) {
      const t = a(n);
      if (!Number.isFinite(t)) break;
      s += t;
      if (n > n0 + 20 && Math.abs(t) < 1e-18 * Math.max(1, Math.abs(s))) break;
    }
    return { verdict: 'conv', sum: s, L };
  }
  if (L !== undefined && L > 1.1) return { verdict: 'div', L };
  if (L === undefined && steady && Number.isFinite(r1) && r1 > 1.1) return { verdict: 'div', L: r1 };
  const marks: Record<number, number> = {};
  let s = 0;
  // N = 128 keeps b^n (b ≤ 5) and its square inside double range
  for (let n = n0; n <= 128; n++) {
    s += a(n);
    if (n === 32 || n === 64 || n === 128) marks[n] = s;
  }
  if (!Number.isFinite(s)) return { verdict: 'div' };
  const aN = Math.abs(a(128));
  if (aN > 1e-3 && aN >= 0.9 * Math.abs(a(64))) return { verdict: 'div' };
  const D1 = marks[64]! - marks[32]!;
  const D2 = marks[128]! - marks[64]!;
  if (D1 === 0 && D2 === 0) return { verdict: 'conv', sum: s };
  const q = Math.abs(D2) / Math.abs(D1);
  if (q < 0.85) return { verdict: 'conv', sum: 2 * marks[128]! - marks[64]! };
  if (q > 0.93) return { verdict: 'div' };
  throw new Error(`series convergence is numerically ambiguous (block ratio ${q})`);
}

/** Is P the degree-n Taylor polynomial of f about a? Degree ≤ n and f − P = O((x − a)^{n+1}). */
function expectTaylor(f: Fn, P: Fn, a: number, n: number, what: string): void {
  // (n+1)-th finite difference of a degree-≤n polynomial vanishes
  const h0 = 0.37;
  let diff = 0;
  let scale = 0;
  for (let k = 0; k <= n + 1; k++) {
    const c = binom(n + 1, k) * (k % 2 ? -1 : 1);
    const v = P(a - 0.5 + k * h0);
    diff += c * v;
    scale += Math.abs(c * v);
  }
  expect(Math.abs(diff), `${what}: degree at most ${n}`).toBeLessThan(1e-9 * Math.max(1, scale));
  const e = (h: number) => Math.max(Math.abs(f(a + h) - P(a + h)), Math.abs(f(a - h) - P(a - h)));
  const e1 = e(0.1);
  const e2 = e(0.05);
  if (e2 < 1e-13) return;
  expect(Math.log2(e1 / e2), `${what}: error order ${Math.log2(e1 / e2)} < ${n + 1}`).toBeGreaterThan(n + 0.6);
}
function binom(n: number, k: number): number {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

// ---------------------------------------------------------------- verifiers

export const VERIFIERS: Record<string, Verifier> = {

  /** Limits of sequences a_n: "Converges to $L$" or "Diverges". */
  'calculus.sequence'(p) {
    const seg = mathSegments(p.question).map(strip).find((x) => /^a_\{n\} = /.test(x))!;
    const a = termFn(rhs(seg));
    // the largest scale at which every value is a number (exponentials overflow early)
    let vals: number[] = [];
    for (const N of [1e6, 1e4, 1e3, 300, 100]) {
      vals = [2 * N, 2 * N + 1, 4 * N, 4 * N + 1].map(a);
      if (vals.every((x) => !Number.isNaN(x))) break;
    }
    const v = vals[2]!;
    const conv = vals.every(Number.isFinite) && Math.max(...vals) - Math.min(...vals) <= 1e-4 * Math.max(1, Math.abs(v));
    if (/diverg/i.test(p.answer)) expect(conv, `${seg} should diverge: ${vals}`).toBe(false);
    else {
      expect(conv, `${seg} should converge: ${vals}`).toBe(true);
      expect(near(val(onlyMath(p.answer)), v, 1e-4), `${p.answer} vs ${v}`).toBe(true);
    }
  },

  /** Series convergence (and sum / ratio-test limit when stated); check.absolute splits absolute vs conditional. */
  'calculus.series'(p) {
    const seg = mathSegments(p.question).find((x) => x.includes('\\sum'))!;
    const { from, body } = parseSum(seg);
    const a = termFn(body);
    const info = analyse(a, from);
    const ans = p.answer;
    if (p.check!.absolute) {
      const absInfo = analyse((n) => Math.abs(a(n)), from);
      const kind = info.verdict === 'div' ? 'div' : absInfo.verdict === 'conv' ? 'abs' : 'cond';
      const said = /diverg/i.test(ans) ? 'div' : /conditional/i.test(ans) ? 'cond' : /absolute/i.test(ans) ? 'abs' : '?';
      expect(said, `${seg}: ${kind}`).toBe(kind);
      return;
    }
    expect(/diverg/i.test(ans) ? 'div' : 'conv', `${seg} (${JSON.stringify(info)}) → ${ans}`).toBe(info.verdict);
    const to = /Converges to \$([^$]+)\$/.exec(ans);
    if (to) expect(near(evalReal(to[1]!), info.sum!, 1e-6), `${ans} vs ${info.sum}`).toBe(true);
    const Lm = /\$L = ([^$]+)\$/.exec(ans);
    if (Lm) {
      const root = p.check!.test === 'root';
      const est = (n: number) => (root ? Math.abs(a(n)) ** (1 / n) : Math.abs(a(n + 1) / a(n)));
      const e1 = est(from + 20);
      const e2 = est(from + 40);
      if (Lm[1] === '\\infty') expect(e2 > 3 && e2 > 1.3 * e1, `L = ∞ for ${seg}: ${e1}, ${e2}`).toBe(true);
      else expect(Math.abs(2 * e2 - e1 - evalReal(Lm[1]!)), `L for ${seg}: ${e1}, ${e2}`).toBeLessThan(0.02);
    }
  },

  /** Alternating series error bound: the stated bound is |a_{N+1}| and covers the true error. */
  'calculus.alterror'(p) {
    const { from, body } = parseSum(mathSegments(p.question).find((x) => x.includes('\\sum'))!);
    const a = termFn(body);
    const N = p.check!.N as number;
    let SN = 0;
    for (let n = from; n < from + N; n++) SN += a(n);
    let S = 0;
    let prev = 0;
    for (let n = from; n <= 20000; n++) {
      const t = a(n);
      if (!Number.isFinite(t)) break;
      prev = S;
      S += t;
    }
    const Sinf = (S + prev) / 2;
    const bound = leValue(p);
    expect(near(bound, Math.abs(a(from + N)), 1e-9), `bound is the first omitted term`).toBe(true);
    expect(bound >= Math.abs(Sinf - SN) * (1 - 1e-6), `bound ${bound} ≥ error ${Math.abs(Sinf - SN)}`).toBe(true);
  },

  /** Radius and interval of convergence, by probing inside, outside and at the endpoints. */
  'calculus.powerseries'(p) {
    const { from, body } = parseSum(mathSegments(p.question).find((x) => x.includes('\\sum'))!);
    // (x − a)^n with x − a < 0 is evaluated as v·|x − a|^n with an exact sign v = (±1)^n
    const base = /\((x [+-] \d+)\)\^\{n\}|x\^\{n\}/.exec(body);
    const conv = (x: number) => {
      if (!base) return analyse(termFn(body, { x }), from).verdict === 'conv';
      const t = evalReal(base[1] ?? 'x', { vars: { x } });
      const b2 = body.replace(base[0], ` v ${Math.abs(t)}^{n} `);
      return analyse(termFn(b2, { x }, t < 0 ? -1 : 1), from).verdict === 'conv';
    };
    const segs = mathSegments(p.answer).map(strip);
    const Rtex = rhs(segs[0]!);
    if (/only at/.test(p.answer)) {
      expect(Rtex).toBe('0');
      const a = evalReal(rhs(segs[1]!));
      for (const d of [0.05, 0.3, -0.05, -0.3]) expect(conv(a + d), `diverges at ${a + d}`).toBe(false);
      return;
    }
    const mm = /^([[(])(.*),(.*?)([\])])$/.exec(segs[1]!)!;
    expect(mm, segs[1]).toBeTruthy();
    if (Rtex === '\\infty') {
      expect(segs[1]!.replace(/\s/g, '')).toBe('(-\\infty,\\infty)');
      for (const x of [-5.3, -1.1, 0.7, 2.9, 6.1]) expect(conv(x), `converges at ${x}`).toBe(true);
      return;
    }
    const lo = evalReal(mm[2]!);
    const hi = evalReal(mm[3]!);
    const R = evalReal(Rtex);
    expect(near((hi - lo) / 2, R, 1e-12), 'interval width matches R').toBe(true);
    const a = (lo + hi) / 2;
    for (const x of [a - R / 2, a + R / 2]) expect(conv(x), `converges inside at ${x}`).toBe(true);
    for (const x of [a - 1.5 * R, a + 1.5 * R]) expect(conv(x), `diverges outside at ${x}`).toBe(false);
    expect(conv(lo), `left endpoint ${lo}`).toBe(mm[1] === '[');
    expect(conv(hi), `right endpoint ${hi}`).toBe(mm[4] === ']');
  },

  /** Taylor polynomials: degree and order of contact; or the approximation P_n(b) via numeric derivatives (n ≤ 3). */
  'calculus.taylor'(p) {
    const d = definition(p.question);
    const f = fnOf(d.body, 'x');
    const n = p.check!.n as number;
    const a = p.check!.a as number;
    if (p.check!.approx) {
      const b = evalReal(/^f\((.+)\)$/.exec(mathSegments(p.question).map(strip).find((x) => /^f\([^x)]+\)$/.test(x))!)![1]!);
      let want = 0;
      let fact = 1;
      for (let k = 0; k <= n; k++) {
        if (k) fact *= k;
        want += (DERIV[k]!(f, a) / fact) * (b - a) ** k;
      }
      expect(Math.abs(wordProblemValue(p) - want), `${p.answer} vs ${want}`).toBeLessThanOrEqual(6e-5);
      return;
    }
    const ans = strip(onlyMath(p.answer));
    expect(ans.startsWith(`P_{${n}}(x) =`), 'P_n notation').toBe(true);
    const P = fnOf(rhs(ans), 'x');
    expectTaylor(f, P, a, n, `${p.question} → ${p.answer}`);
  },

  /** Maclaurin series in sigma notation: partial sums match f near 0. */
  'calculus.maclaurin'(p) {
    const f = fnOf(rhs(strip(onlyMath(p.question))), 'x');
    const { from, body } = parseSum(onlyMath(p.answer));
    for (const x of [0.03, -0.05, 0.07]) {
      const t = termFn(body, { x });
      let s = 0;
      for (let n = from; n < from + 160; n++) {
        const v = t(n);
        if (!Number.isFinite(v)) break;
        s += v;
        if (n > from + 10 && Math.abs(v) < 1e-18) break;
      }
      expect(near(s, f(x), 1e-9), `${p.answer} at x=${x}: ${s} vs ${f(x)}`).toBe(true);
    }
  },

  /** Lagrange error bound: P is the Taylor polynomial, the bound covers the true error and has the stated value. */
  'calculus.lagrange'(p) {
    const segs = mathSegments(p.question).map(strip);
    const Pseg = segs.find((x) => /^P_\{\d+\}\(x\) = /.test(x))!;
    const P = fnOf(rhs(Pseg), 'x');
    const f = fnOf(rhs(segs.find((x) => /^f\(x\) = /.test(x))!), 'x');
    const n = p.check!.n as number;
    expectTaylor(f, P, 0, n, Pseg);
    const mm = /R_\{(\d+)\}\((.+?)\)/.exec(onlyMath(p.answer))!;
    const b = evalReal(mm[2]!);
    const bound = leValue(p);
    expect(bound >= Math.abs(f(b) - P(b)) * (1 - 1e-9), `bound ${bound} ≥ ${Math.abs(f(b) - P(b))}`).toBe(true);
    expect(near(bound, p.check!.value as number, 1e-9), 'bound value').toBe(true);
  },

  /** Parametric curves: dy/dx, d²y/dx² (in t), tangent line at t = t0, horizontal/vertical tangents. */
  'calculus.parametric'(p) {
    const [X, Y] = paramXY(p.question);
    const task = p.check!.task as string;
    if (task === 'hv') {
      const parts = labeled(p.answer);
      for (const [label, g, other] of [['horizontal', Y, X], ['vertical', X, Y]] as const) {
        const part = parts.find((pp) => pp.label.includes(label))!;
        expect(part, `${label} in ${p.answer}`).toBeTruthy();
        const listed = part.segs.map(tupleOf);
        const roots = signChanges((t) => d1(g, t), -10.013, 10.017, 400).filter((t) => Math.abs(d1(other, t)) > 1e-6);
        expect(listed.length, `${label}: roots ${roots.join(', ')} vs ${p.answer}`).toBe(roots.length);
        for (const t of roots) expect(listed.some(([x, y]) => near(x!, X(t), 1e-6) && near(y!, Y(t), 1e-6)), `${label} point at t=${t}`).toBe(true);
      }
      return;
    }
    if (task === 'tangent') {
      const t0 = evalReal(rhs(mathSegments(p.question).map(strip).find((x) => /^t = /.test(x))!));
      expectLine(p.answer, X(t0), Y(t0), d1(Y, t0) / d1(X, t0), p.question);
      return;
    }
    const ans = rhs(strip(onlyMath(p.answer)));
    let checked = 0;
    for (const t of [0.7, 1.3, -0.6, 2.1, -1.7, 0.35]) {
      const xp = d1(X, t);
      if (Math.abs(xp) < 0.05) continue;
      const want = task === 'dydx' ? d1(Y, t) / xp : (d2(Y, t) * xp - d1(Y, t) * d2(X, t)) / xp ** 3;
      expect(near(evalReal(ans, { vars: { t } }), want, 1e-5), `${p.question} → ${p.answer} at t=${t}`).toBe(true);
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(3);
  },

  /** Arc length of y = f(x) or of x(t), y(t) over the interval `a \le v \le b`. */
  'calculus.arclength'(p) {
    const [v, a, b] = chainInterval(p.question);
    let speed: Fn;
    if (v === 't') {
      const [X, Y] = paramXY(p.question);
      speed = (t) => Math.hypot(d1edge(X, t), d1edge(Y, t));
    } else {
      const d = definition(p.question, v);
      const f = fnOf(d.body, v);
      speed = (x) => Math.hypot(1, d1edge(f, x));
    }
    const L = simpsonSafe(speed, a, b, 400);
    const got = wordProblemValue(p);
    if (p.check!.approx) expect(Math.abs(got - L), `${p.answer} vs ${L}`).toBeLessThanOrEqual(5.1e-4);
    else expect(near(got, L, 1e-7), `${p.answer} vs ${L}`).toBe(true);
  },

  /** Polar slope dy/dx or tangent line at θ = θ0. */
  'calculus.polar'(p) {
    const segs = mathSegments(p.question).map((x) => untheta(strip(x)));
    const r = fnOf(rhs(segs.find((x) => /^r = /.test(x))!), 't');
    const t0 = evalReal(rhs(segs.find((x) => /^t = /.test(x))!));
    const R = r(t0);
    const dR = d1(r, t0);
    const slope = (dR * Math.sin(t0) + R * Math.cos(t0)) / (dR * Math.cos(t0) - R * Math.sin(t0));
    if (p.check!.task === 'slope') expect(near(val(rhs(strip(onlyMath(p.answer)))), slope, 1e-6), `${p.question} → ${p.answer} (${slope})`).toBe(true);
    else expectLine(p.answer, R * Math.cos(t0), R * Math.sin(t0), slope, p.question);
  },

  /** Polar area: ½∫r² over one region (bounds are zeros of r or a full turn), or between two curves. */
  'calculus.polararea'(p) {
    const curves = mathSegments(p.question)
      .map((x) => untheta(strip(x)))
      .filter((x) => /^r = /.test(x))
      .map((x) => fnOf(rhs(x), 't'));
    const [lo, hi] = p.check!.bounds as [number, number];
    const probes = Array.from({ length: 39 }, (_, i) => lo + ((hi - lo) * (i + 0.5)) / 39);
    let want: number;
    if (!p.check!.between) {
      expect(curves.length).toBe(1);
      const r = curves[0]!;
      const full = close(hi - lo, 2 * Math.PI);
      for (const b of [lo, hi]) expect(full || Math.abs(r(b)) < 1e-9, `bound ${b} is a zero of r`).toBe(true);
      const sgn = Math.sign(r(probes[0]!));
      probes.forEach((t) => expect(r(t) * sgn >= -1e-12, `one region (r keeps its sign) at ${t}`).toBe(true));
      want = 0.5 * simpsonSafe((t) => r(t) ** 2, lo, hi);
    } else {
      expect(curves.length).toBe(2);
      const [outer, inner] = curves as [Fn, Fn];
      for (const b of [lo, hi]) expect(near(outer(b), inner(b), 1e-9), `curves meet at ${b}`).toBe(true);
      probes.forEach((t) => expect(outer(t) >= inner(t) - 1e-12 && inner(t) >= -1e-12, `inside ${t}`).toBe(true));
      want = 0.5 * simpsonSafe((t) => outer(t) ** 2 - inner(t) ** 2, lo, hi);
    }
    expect(near(wordProblemValue(p), want, 1e-7), `${p.question} → ${p.answer} (${want})`).toBe(true);
  },

  /** Plane motion r(t) = ⟨x, y⟩: velocity/acceleration, speed, displacement, distance. */
  'calculus.vector2d'(p) {
    const seg = mathSegments(p.question).map(strip).find((x) => /^r\(t\) = /.test(x))!;
    const [xs, ys] = vecItems(rhs(seg)) as [string, string];
    const X = fnOf(xs, 't');
    const Y = fnOf(ys, 't');
    const task = p.check!.task as string;
    const qs = mathSegments(p.question).map(strip);
    if (task === 'va') {
      for (const s0 of mathSegments(p.answer).map(strip)) {
        const [l, r0] = sides(s0);
        const mm = /^([va])\((.+)\)$/.exec(l.trim())!;
        const t = evalReal(mm[2]!);
        const got = vecItems(r0).map((x) => evalReal(x));
        const want = mm[1] === 'v' ? [d1(X, t), d1(Y, t)] : [d2(X, t), d2(Y, t)];
        expect(near(got[0]!, want[0]!, 1e-5) && near(got[1]!, want[1]!, 1e-5), `${s0} vs ${want}`).toBe(true);
      }
    } else if (task === 'speed') {
      const ans = strip(onlyMath(p.answer));
      const t = evalReal(/^\|v\((.+)\)\|/.exec(ans)![1]!);
      expect(near(evalReal(rhs(ans)), Math.hypot(d1(X, t), d1(Y, t)), 1e-6), `${p.answer}`).toBe(true);
    } else if (task === 'displacement') {
      const ts = qs.filter((x) => /^t = /.test(x)).map((x) => evalReal(rhs(x)));
      const got = vecItems(onlyMath(p.answer)).map((x) => evalReal(x));
      expect(near(got[0]!, X(ts[1]!) - X(ts[0]!), 1e-9) && near(got[1]!, Y(ts[1]!) - Y(ts[0]!), 1e-9), p.answer).toBe(true);
    } else {
      const [, a, b] = chainInterval(p.question);
      const want = simpsonSafe((t) => Math.hypot(d1(X, t), d1(Y, t)), a, b, 400);
      expect(near(wordProblemValue(p), want, 1e-7), `${p.answer} vs ${want}`).toBe(true);
    }
  },

  /** Solutions of differential equations, checked by substitution (C sampled when present) and the initial condition. */
  'calculus.ode'(p) {
    const de = parseDE(p.question);
    const ans = strip(onlyMath(p.answer));
    expect(splitTop(ans, ['=']).parts[0]!.trim(), 'solved for the dependent variable').toBe(de.dep);
    const G = rhs(ans);
    const init = initialOf(p.question, de.dep);
    const hasC = /(?<!\\[a-zA-Z]*)C/.test(G);
    if (init) {
      expect(hasC, 'particular solution has no C').toBe(false);
      expect(near(ev(G, { [de.ind]: init[0] }), init[1], 1e-9), `${p.answer} at ${init[0]}`).toBe(true);
    } else expect(hasC, 'general solution keeps C').toBe(true);
    let checked = 0;
    for (const C of hasC ? [0.7, 1.9, 3.1] : [0]) {
      const g = (t: number) => ev(G, { [de.ind]: t, C });
      for (const x of (p.check!.pts as number[] | undefined) ?? [0.15, 0.3, 0.45, -0.2, -0.35]) {
        const y = g(x);
        if (!Number.isFinite(y)) continue;
        expect(near(d1(g, x), de.F(x, y), 1e-5), `${p.question} → ${p.answer} at ${de.ind}=${x}, C=${C}`).toBe(true);
        checked++;
      }
    }
    expect(checked, 'substitution points').toBeGreaterThanOrEqual(3);
  },

  /** Euler's method recomputed from the rendered equation, start, step and target. */
  'calculus.euler'(p) {
    const de = parseDE(p.question);
    const [x0, y0] = initialOf(p.question, de.dep)!;
    const segs = mathSegments(p.question).map(strip);
    const h = evalReal(rhs(segs.find((x) => /^h = /.test(x))!));
    const T = evalReal(/^y\((.+)\)$/.exec(segs.find((x) => /^y\([^)]*\)$/.test(x))!)![1]!);
    const n = Math.round((T - x0) / h);
    expect(close(x0 + n * h, T), 'whole number of steps').toBe(true);
    let x = x0;
    let y = y0;
    for (let k = 0; k < n; k++) {
      y += h * de.F(x, y);
      x += h;
    }
    expect(near(wordProblemValue(p), y, 1e-9), `${p.question} → ${p.answer} (${y})`).toBe(true);
  },

  /** Slope fields: the answer matches every drawn mark and each distractor misses one; or a sketched solution. */
  'calculus.slopefield'(p) {
    const marks = slopeMarks(p);
    expect(marks.length, 'slope marks drawn').toBeGreaterThan(20);
    const fits = (F: (x: number, y: number) => number) => marks.every((mk) => near(F(mk.x, mk.y), mk.s, 1e-6));
    if (p.check!.task === 'match') {
      expect(fits(parseDE(p.answer).F), `${p.answer} fits the field`).toBe(true);
      for (const d of p.distractors!.slice(0, 3)) expect(fits(parseDE(d).F), `${d} should not fit`).toBe(false);
      return;
    }
    const de = parseDE(p.question);
    expect(fits(de.F), 'field drawn for the question equation').toBe(true);
    const pt = mathSegments(p.question).map(strip).find((x) => /^\\left\(/.test(x))!;
    const [x0, y0] = listItems(pt).map((t) => evalReal(t)) as [number, number];
    const xs = [-0.5, -0.2, 0.3, 0.6];
    const solves = (rich: string) => {
      const G = rhs(strip(onlyMath(rich)));
      const g = (t: number) => ev(G, { x: t });
      return near(g(x0), y0, 1e-9) && xs.every((x) => Number.isFinite(g(x)) && near(d1(g, x), de.F(x, g(x)), 1e-5));
    };
    expect(solves(p.answer), `${p.answer} solves ${de.rhs} through (${x0}, ${y0})`).toBe(true);
    for (const d of p.distractors!.slice(0, 3)) expect(solves(d), `${d} should not solve the IVP`).toBe(false);
    const G = rhs(strip(onlyMath(p.answer)));
    const pts = curvePoints(p.answerDiagram);
    expect(pts.length).toBeGreaterThan(5);
    for (const [x, y] of pts) expect(near(ev(G, { x }), y, 1e-9), `curve point (${x}, ${y})`).toBe(true);
  },

  /** Logistic models: carrying capacity, fastest growth, long-run limit (RK4). */
  'calculus.logistic'(p) {
    const de = parseDE(p.question);
    const R = (P: number) => de.F(0, P);
    const got = wordProblemValue(p);
    const task = p.check!.task as string;
    if (task === 'capacity') {
      expect(Math.abs(R(got)), `R(${got}) = 0`).toBeLessThan(1e-9 * Math.max(1, got));
      expect(got > 0 && R(got / 2) > 0, 'positive growth below K').toBe(true);
    } else if (task === 'fastest') {
      expect(R(got) > 0 && R(got) > R(got * 0.99) && R(got) > R(got * 1.01), `maximum growth at ${got}`).toBe(true);
    } else {
      let [t, P] = initialOf(p.question, de.dep)!;
      const dt = 0.25;
      for (; t < 400 && Math.abs(R(P)) > 1e-9 * Math.max(1, Math.abs(P)); t += dt) {
        const k1 = R(P);
        const k2 = R(P + (dt / 2) * k1);
        const k3 = R(P + (dt / 2) * k2);
        const k4 = R(P + dt * k3);
        P += (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
      }
      expect(near(got, P, 1e-4), `limit ${got} vs ${P}`).toBe(true);
    }
  },

  /** Improper integrals: "Diverges" or "Converges to $v$", by DE quadrature and its truncation tail. */
  'calculus.improper'(p) {
    const seg = mathSegments(p.question).find((x) => x.includes('\\int'))!;
    const I = parseIntegral(seg);
    const g = fnOf(I.body, I.v);
    const cuts = [boundVal(I.lo!), ...((p.check!.split as number[] | undefined) ?? []), boundVal(I.hi!)];
    let short = 0;
    let long = 0;
    for (let i = 0; i + 1 < cuts.length; i++) {
      short += deQuad(g, cuts[i]!, cuts[i + 1]!, 4);
      long += deQuad(g, cuts[i]!, cuts[i + 1]!, 4.6);
    }
    // nodes that round onto a singular endpoint are dropped, so a huge total also means divergence
    const diverges = !Number.isFinite(long) || Math.abs(long) > 1e9 || Math.abs(long - short) > 1e-6 * Math.max(1, Math.abs(long));
    if (/diverg/i.test(p.answer)) {
      expect(diverges, `${seg} should diverge: ${short} → ${long}`).toBe(true);
      return;
    }
    expect(diverges, `${seg} should converge: ${short} → ${long}`).toBe(false);
    expect(near(val(onlyMath(p.answer)), long, 1e-6), `${seg} → ${p.answer} (${long})`).toBe(true);
  },
  /** Limits: \lim_{x \to a}, a^{+}, a^{-}, ±\infty; f(x) may be defined (piecewise) in the question. */
  'calculus.limit'(p) {
    const seg = mathSegments(p.question).map(strip).find((s) => s.startsWith('\\lim'));
    expect(seg, 'limit in question').toBeTruthy();
    const mm = /^\\lim_\{([a-z]) \\to ((?:[^{}]|\{[^{}]*\})*)\}\s*([\s\S]*)$/.exec(seg!)!;
    expect(mm, seg).toBeTruthy();
    const v = mm[1]!;
    const pt = mm[2]!.trim();
    let body = mm[3]!.trim();
    let f: Fn;
    if (/^[a-z]\([a-z]\)$/.test(body)) {
      const d = definition(p.question, v);
      body = d.body;
      f = bodyFn(body, d.v);
    } else f = fnOf(body, v);
    const want = answerLimit(p.answer);
    let got: LimitVal;
    if (pt === '\\infty') got = atInfinity(f, 1);
    else if (pt === '-\\infty') got = atInfinity(f, -1);
    else {
      const side = /\^\{?([+-])\}?$/.exec(pt);
      const a = evalReal(pt.replace(/\^\{?[+-]\}?$/, ''));
      got = side ? sideLimit(f, a, side[1] === '+' ? 1 : -1) : twoSided(f, a);
    }
    sameLimit(got, want, `${p.question} → ${p.answer}`);
  },

  /** Discontinuities of a rational function, classified as removable / infinite. */
  'calculus.discontinuities'(p) {
    const d = definition(p.question);
    const f = fnOf(d.body, d.v);
    const listed: number[] = [];
    for (const { label, segs } of labeled(p.answer)) {
      if (!segs.length) continue;
      const xs = answerValues(`$${segs.join('$, $')}$`, 'x').map((t) => evalReal(t));
      for (const x0 of xs) {
        listed.push(x0);
        expect(Number.isFinite(f(x0)), `${d.body} should be undefined at ${x0}`).toBe(false);
        const l = sideLimit(f, x0, -1);
        const r = sideLimit(f, x0, 1);
        if (label.includes('removable')) {
          expect(typeof l === 'number' && typeof r === 'number' && near(l, r, 1e-4), `removable at ${x0}: ${l} ${r}`).toBe(true);
        } else if (label.includes('infinite')) {
          expect(typeof l === 'string' && typeof r === 'string', `infinite at ${x0}: ${l} ${r}`).toBe(true);
        } else throw new Error(`unknown label ${label}`);
      }
    }
    for (let k = -60; k <= 60; k++) {
      const x = k / 4;
      if (!listed.some((y) => Math.abs(y - x) < 1e-9)) expect(Number.isFinite(f(x)), `${d.body} undefined at unlisted ${x}`).toBe(true);
    }
  },

  /** Piecewise continuity at a point: Continuous / Jump / Removable / Infinite. */
  'calculus.classify'(p) {
    const d = definition(p.question);
    const f = bodyFn(d.body, d.v);
    const at = mathSegments(p.question).map(strip).filter((s) => /^x = /.test(s)).at(-1)!;
    const a = evalReal(rhs(at));
    const l = sideLimit(f, a, -1);
    const r = sideLimit(f, a, 1);
    const fa = f(a);
    let kind: string;
    if (typeof l === 'string' || typeof r === 'string') kind = 'infinite';
    else if (!near(l, r, 1e-4)) kind = 'jump';
    else if (!Number.isFinite(fa) || !near(fa, l, 1e-4)) kind = 'removable';
    else kind = 'continuous';
    expect(p.answer.toLowerCase(), `${p.question}: ${l} ${r} ${fa}`).toContain(kind);
  },

  /** Constants (`k = 3`, `a = 2, b = -1`) that make a piecewise function continuous everywhere. */
  'calculus.makeContinuous'(p) {
    const d = definition(p.question);
    const consts: Record<string, number> = {};
    for (const seg of mathSegments(p.answer)) {
      const [l, r] = sides(strip(seg));
      consts[l.trim()] = evalReal(r);
    }
    expect(Object.keys(consts).length, p.answer).toBeGreaterThan(0);
    const f = bodyFn(d.body, d.v, consts);
    const bs = boundaries(d.body);
    expect(bs.length).toBeGreaterThan(0);
    for (const a of bs) {
      const l = sideLimit(f, a, -1);
      const r = sideLimit(f, a, 1);
      expect(typeof l === 'number' && typeof r === 'number' && near(l, r, 1e-5) && near(f(a), l as number, 1e-5), `${p.question} with ${p.answer}: at ${a}: ${l}, ${r}, ${f(a)}`).toBe(true);
    }
  },

  /**
   * Derivative of order check.order (default 1) of the question's function,
   * compared at check.pts (default POS); `f'(a)` in the question asks for a number.
   */
  'calculus.deriv'(p) {
    const order = (p.check!.order as number | undefined) ?? 1;
    const d = definition(p.question, (p.check!.v as string | undefined) ?? 'x');
    const f = bodyFn(d.body, d.v);
    const ans = strip(onlyMath(p.answer));
    const lhs = splitTop(ans, ['=']).parts[0]!;
    if (order === 2) expect(lhs, 'second-derivative notation').toMatch(/d\^\{2\}|''/);
    if (order === 3) expect(lhs, 'third-derivative notation').toMatch(/d\^\{3\}|'''/);
    const dr = rhs(ans);
    const at = mathSegments(p.question).map(strip).find((s) => /^[a-zA-Z]'+\((.+)\)$/.test(s));
    if (at) {
      const x0 = evalReal(/\((.+)\)$/.exec(at)![1]!);
      expect(near(DERIV[order]!(f, x0), evalReal(dr), 1e-5), `${p.question} → ${p.answer}`).toBe(true);
      return;
    }
    for (const x of (p.check!.pts as number[] | undefined) ?? POS) {
      const got = evalReal(dr, { vars: { [d.v]: x } });
      let want = DERIV[order]!(f, x);
      // near a pole (e.g. tan³ at 4x ≈ π/2) the default step is too coarse: refine, the true value is the limit
      if (order === 1 && !near(want, got, 1e-5)) {
        for (const scale of [0.2, 0.04, 0.008, 0.0016]) {
          const w = d1(f, x, scale);
          if (near(w, got, 1e-5)) { want = w; break; }
        }
      }
      expect(near(want, got, 1e-5), `${p.question} → ${p.answer} at ${d.v}=${x}: numeric ${want}, answer ${got}`).toBe(true);
    }
  },

  /** dy/dx by implicit differentiation, checked along the curve through check.point. */
  'calculus.implicit'(p) {
    const eq = strip(onlyMath(p.question));
    const [l, r] = sides(eq);
    const F = (x: number, y: number) => ev(l, { x, y }) - ev(r, { x, y });
    const [x0, y0] = p.check!.point as number[];
    expect(Math.abs(F(x0!, y0!)), `(${x0}, ${y0}) on ${eq}`).toBeLessThan(1e-9 * Math.max(1, Math.abs(ev(l, { x: x0!, y: y0! }))));
    const Fx = (x: number, y: number) => d1((t) => F(t, y), x);
    const Fy = (x: number, y: number) => d1((t) => F(x, t), y);
    const dy = rhs(strip(onlyMath(p.answer)));
    const pts: Array<[number, number]> = [[x0!, y0!]];
    for (const dx of [0.04, 0.08, -0.04, -0.08]) {
      const x = x0! + dx;
      let y = y0! + (-Fx(x0!, y0!) / Fy(x0!, y0!)) * dx;
      for (let k = 0; k < 30; k++) y -= F(x, y) / Fy(x, y);
      if (Math.abs(F(x, y)) < 1e-9 && Number.isFinite(y)) pts.push([x, y]);
    }
    expect(pts.length).toBeGreaterThanOrEqual(3);
    for (const [x, y] of pts) {
      const want = -Fx(x, y) / Fy(x, y);
      const got = evalReal(dy, { vars: { x, y } });
      expect(near(want, got, 1e-5), `${eq} → ${dy} at (${x}, ${y}): ${want} vs ${got}`).toBe(true);
    }
  },

  /** Tangent / normal line at x = a (the word "normal" in the question selects the normal). */
  'calculus.tangent'(p) {
    const d = definition(p.question);
    const f = fnOf(d.body, d.v);
    const at = mathSegments(p.question).map(strip).filter((s) => /^x = /.test(s)).at(-1)!;
    const a = evalReal(rhs(at));
    const m = d1(f, a);
    const y0 = f(a);
    const ans = strip(onlyMath(p.answer));
    const normal = /normal/i.test(p.question);
    if (normal && Math.abs(m) < 1e-7) {
      expect(ans.replace(/\s/g, '')).toMatch(/^x=/);
      expect(near(evalReal(rhs(ans)), a, 1e-9)).toBe(true);
      return;
    }
    expect(ans, p.answer).toMatch(/^y = /);
    const slope = normal ? -1 / m : m;
    for (const x of [a - 1.5, a + 0.5, a + 2]) {
      expect(near(evalReal(rhs(ans), { vars: { x } }), y0 + slope * (x - a), 1e-6), `${p.question} → ${p.answer} at x=${x}`).toBe(true);
    }
  },

  /** Critical points / relative extrema / absolute extrema on [a, b] (check.task). */
  'calculus.extrema'(p) {
    const d = definition(p.question);
    const f = fnOf(d.body, d.v);
    const fp = (x: number) => d1(f, x);
    const task = p.check!.task as string;
    if (task === 'critical') {
      const xs = /none/i.test(p.answer) ? [] : answerValues(p.answer, 'x').map((t) => evalReal(t));
      xs.forEach((x) => expect(Math.abs(fp(x)), `f'(${x}) = 0 for ${d.body}`).toBeLessThan(1e-5 * Math.max(1, Math.abs(f(x)))));
      for (const r of signChanges(fp, -10.013, 10.017, 200)) expect(xs.some((x) => Math.abs(x - r) < 1e-4), `missing critical point ${r} in ${p.answer}`).toBe(true);
      return;
    }
    if (task === 'relative') {
      const found: number[] = [];
      for (const { label, segs } of labeled(p.answer)) {
        for (const s of segs) {
          const [x, y] = tupleOf(s);
          found.push(x!);
          expect(near(f(x!), y!, 1e-7), `${s} on ${d.body}`).toBe(true);
          const h = 1e-2;
          if (label.includes('min')) expect(f(x! - h) > y! && f(x! + h) > y!, `min at ${s}`).toBe(true);
          else if (label.includes('max')) expect(f(x! - h) < y! && f(x! + h) < y!, `max at ${s}`).toBe(true);
          else throw new Error(`label ${label}`);
        }
      }
      const roots = signChanges(fp, -10.013, 10.017, 200);
      expect(roots.length, `${p.question} → ${p.answer}: extrema at ${roots.join(', ')}`).toBe(found.length);
      for (const r of roots) expect(found.some((x) => Math.abs(x - r) < 1e-4), `missing extremum ${r}`).toBe(true);
      return;
    }
    const [a, b] = intervalIn(p.question);
    const N = 2000;
    const xs = Array.from({ length: N + 1 }, (_, i) => a + ((b - a) * i) / N);
    const ys = xs.map(f);
    const hi = Math.max(...ys);
    const lo = Math.min(...ys);
    const parts = labeled(p.answer);
    for (const [kind, ext] of [['max', hi], ['min', lo]] as const) {
      const part = parts.find((pp) => pp.label.includes(kind));
      expect(part, `${kind} in ${p.answer}`).toBeTruthy();
      const pts = part!.segs.map(tupleOf);
      expect(pts.length).toBeGreaterThan(0);
      for (const [x, y] of pts) {
        expect(x! >= a - 1e-9 && x! <= b + 1e-9 && near(f(x!), y!, 1e-7), `${x}, ${y}`).toBe(true);
        expect(kind === 'max' ? y! >= hi - 1e-9 * Math.max(1, Math.abs(hi)) : y! <= lo + 1e-9 * Math.max(1, Math.abs(lo)), `${kind} value ${y} vs sampled ${ext}`).toBe(true);
      }
      xs.forEach((x, i) => {
        if (Math.abs(ys[i]! - ext) < 1e-6 * Math.max(1, Math.abs(ext))) expect(pts.some(([px]) => Math.abs(px! - x) < 0.02), `${kind} also at x=${x}`).toBe(true);
      });
    }
  },

  /** Concavity intervals and inflection points. */
  'calculus.concavity'(p) {
    const d = definition(p.question);
    const f = fnOf(d.body, d.v);
    const fpp = (x: number) => d2(f, x);
    const parts = labeled(p.answer);
    const infl = parts.find((pp) => pp.label.includes('inflection'));
    const listed = (infl?.segs ?? []).flatMap((s) => strip(s).split(/\\text\{ and \}|,\s*(?=\()/)).filter((s) => s.trim()).map((s) => tupleOf(s.trim()));
    for (const [x, y] of listed) expect(near(f(x!), y!, 1e-7), `inflection (${x}, ${y}) on graph`).toBe(true);
    const roots = signChanges(fpp, -10.013, 10.017, 200);
    expect(roots.length, `inflections of ${d.body}: ${roots.join(', ')} vs ${p.answer}`).toBe(listed.length);
    for (const r of roots) expect(listed.some(([x]) => Math.abs(x! - r) < 1e-3), `missing inflection ${r}`).toBe(true);
    const up = parts.find((pp) => pp.label.includes('up'));
    const down = parts.find((pp) => pp.label.includes('down'));
    if (!up && !down) return;
    const ups = (up?.segs ?? []).flatMap(intervals);
    const downs = (down?.segs ?? []).flatMap(intervals);
    for (let x = -8.317; x <= 8.4; x += 0.293) {
      if (roots.some((r) => Math.abs(r - x) < 0.02)) continue;
      // a zero of f'' without a sign change (double root) has no concavity to test
      if (Math.abs(fpp(x)) < 1e-5 * Math.max(1, Math.abs(f(x)))) continue;
      const inUp = ups.some(([a, b]) => a < x && x < b);
      const inDown = downs.some(([a, b]) => a < x && x < b);
      const s = fpp(x);
      expect(inUp, `concave up at ${x}? f''=${s} (${p.answer})`).toBe(s > 0);
      expect(inDown, `concave down at ${x}? f''=${s} (${p.answer})`).toBe(s < 0);
    }
  },

  /** Mean value theorem / Rolle's theorem: every c with f'(c) = average slope on (a, b). */
  'calculus.mvt'(p) {
    const d = definition(p.question);
    const f = fnOf(d.body, d.v);
    const [a, b] = intervalIn(p.question);
    const slope = (f(b) - f(a)) / (b - a);
    if (/rolle/i.test(p.question)) expect(near(f(a), f(b), 1e-9), 'Rolle hypotheses').toBe(true);
    const cs = answerValues(p.answer, 'c').map((t) => evalReal(t));
    expect(cs.length).toBeGreaterThan(0);
    for (const c of cs) {
      expect(c > a && c < b, `${c} in (${a}, ${b})`).toBe(true);
      expect(near(d1(f, c), slope, 1e-6), `f'(${c}) = ${slope}`).toBe(true);
    }
    const roots = signChanges((x) => d1(f, x) - slope, a + 1e-6, b - 1e-6, 997);
    expect(roots.length, `${p.question}: ${roots.join(', ')}`).toBe(cs.length);
  },

  /** Particle motion; check.task = values | rest | distance. */
  'calculus.motion'(p) {
    const d = definition(p.question, 't');
    const s = fnOf(d.body, d.v);
    const task = p.check!.task as string;
    if (task === 'values') {
      const segs = mathSegments(p.answer).map(strip);
      expect(segs.length).toBeGreaterThan(0);
      for (const seg of segs) {
        const [l, r] = sides(seg);
        const mm = /^([sva])\((.+)\)$/.exec(l.trim())!;
        expect(mm, l).toBeTruthy();
        const t = evalReal(mm[2]!);
        const want = mm[1] === 's' ? s(t) : mm[1] === 'v' ? d1(s, t) : d2(s, t);
        expect(near(val(r), want, 1e-5), `${seg}: ${want}`).toBe(true);
      }
    } else if (task === 'rest') {
      const ts = answerValues(p.answer, 't').map((t) => evalReal(t));
      ts.forEach((t) => {
        expect(t).toBeGreaterThanOrEqual(0);
        expect(Math.abs(d1(s, t)), `v(${t}) = 0`).toBeLessThan(1e-5);
      });
      const roots = signChanges((t) => d1(s, t), 1e-4, 30.01, 600);
      expect(roots.length, `${p.question}: ${roots.join(', ')}`).toBe(ts.length);
    } else {
      const [t0, t1] = p.check!.span as number[];
      const qs = mathSegments(p.question).map(strip);
      expect(qs.includes(`t = ${t0}`) && qs.includes(`t = ${t1}`), 'span in question').toBe(true);
      // split at every turning point (sign change of v), then sum |Δs| exactly
      const marks = [t0!, ...signChanges((t) => d1(s, t), t0! + 1.3e-5, t1! - 1.7e-5, 401), t1!];
      let total = 0;
      for (let i = 0; i + 1 < marks.length; i++) total += Math.abs(s(marks[i + 1]!) - s(marks[i]!));
      expect(near(wordProblemValue(p), total, 1e-5), `${p.answer} vs ${total}`).toBe(true);
    }
  },

  /** Riemann / trapezoidal sums from a formula or a table of values. */
  'calculus.riemann'(p) {
    const q = p.question;
    const method = /midpoint/i.test(q) ? 'mid' : /trapezoid/i.test(q) ? 'trap' : /right/i.test(q) ? 'right' : /left/i.test(q) ? 'left' : '';
    expect(method, 'method named').not.toBe('');
    const n = Number(rhs(mathSegments(q).map(strip).find((s) => /^n = \d+$/.test(s))!));
    const segs = mathSegments(q).map(strip);
    const integ = parseIntegral(segs.find((s) => s.includes('\\int'))!);
    const a = evalReal(integ.lo!);
    const b = evalReal(integ.hi!);
    const table = segs.find((s) => s.includes('\\begin{array}'));
    let total = 0;
    if (table) {
      const rows = table
        .replace(/\\begin\{array\}\{[^}]*\}|\\end\{array\}|\\hline/g, '')
        .split('\\\\')
        .map((r) => r.split('&').map((c) => c.trim()));
      const xs = rows[0]!.slice(1).map((t) => evalReal(t));
      const ys = rows[1]!.slice(1).map((t) => evalReal(t));
      expect(close(xs[0]!, a) && close(xs.at(-1)!, b), 'table spans the integral').toBe(true);
      if (method === 'mid') {
        expect(xs.length - 1).toBe(2 * n);
        for (let i = 0; i < n; i++) total += (xs[2 * i + 2]! - xs[2 * i]!) * ys[2 * i + 1]!;
      } else {
        expect(xs.length - 1).toBe(n);
        for (let i = 0; i < n; i++) {
          const w = xs[i + 1]! - xs[i]!;
          total += method === 'left' ? w * ys[i]! : method === 'right' ? w * ys[i + 1]! : (w * (ys[i]! + ys[i + 1]!)) / 2;
        }
      }
    } else {
      const f = fnOf(integ.body, integ.v);
      const w = (b - a) / n;
      for (let i = 0; i < n; i++) {
        const x = a + i * w;
        total += method === 'left' ? w * f(x) : method === 'right' ? w * f(x + w) : method === 'mid' ? w * f(x + w / 2) : (w * (f(x) + f(x + w))) / 2;
      }
    }
    expect(near(wordProblemValue(p), total, 1e-9), `${q} → ${p.answer} (${total})`).toBe(true);
  },

  /** Indefinite (answer + C, differentiate back at check.pts) or definite (Simpson) integrals. */
  'calculus.integral'(p) {
    const seg = mathSegments(p.question).find((s) => s.includes('\\int'))!;
    const I = parseIntegral(seg);
    const g = fnOf(I.body, I.v);
    const ans = strip(onlyMath(p.answer));
    if (I.lo !== undefined) {
      const want = simpson(g, evalReal(I.lo), evalReal(I.hi!), 800);
      expect(near(evalReal(rhs(ans)), want, 1e-6), `${seg} → ${ans} (${want})`).toBe(true);
      return;
    }
    expect(ans.endsWith('+ C'), 'indefinite answers end with + C').toBe(true);
    const F = fnOf(rhs(ans).replace(/\s*\+\s*C$/, ''), I.v);
    for (const x of (p.check!.pts as number[] | undefined) ?? POS) {
      const want = g(x);
      expect(Number.isFinite(want), `integrand defined at ${x}`).toBe(true);
      expect(near(d1(F, x), want, 1e-5), `${seg} → ${ans} at ${x}: ${d1(F, x)} vs ${want}`).toBe(true);
    }
  },

  /** d/dx ∫_{A(x)}^{B(x)} f(t) dt. */
  'calculus.ftc'(p) {
    const seg = mathSegments(p.question).find((s) => s.includes('\\int'))!;
    const I = parseIntegral(seg);
    const g = fnOf(I.body, I.v);
    const A = fnOf(I.lo!, 'x');
    const B = fnOf(I.hi!, 'x');
    const ans = rhs(strip(onlyMath(p.answer)));
    const dl = 1e-5;
    for (const x of (p.check!.pts as number[] | undefined) ?? POS) {
      const want = (simpson(g, B(x - dl), B(x + dl), 16) - simpson(g, A(x - dl), A(x + dl), 16)) / (2 * dl);
      const got = evalReal(ans, { vars: { x } });
      expect(near(want, got, 1e-5), `${seg} → ${ans} at ${x}: ${want} vs ${got}`).toBe(true);
    }
  },

  /** Average value on [a, b]; check.task = 'c' asks for the c with f(c) = average. */
  'calculus.average'(p) {
    const d = definition(p.question);
    const f = fnOf(d.body, d.v);
    const [a, b] = intervalIn(p.question);
    const avg = simpsonSafe(f, a, b) / (b - a);
    if (p.check!.task === 'c') {
      const cs = answerValues(p.answer, 'c').map((t) => evalReal(t));
      cs.forEach((c) => expect(c >= a && c <= b && near(f(c), avg, 1e-6), `f(${c}) = ${avg}`).toBe(true));
      const roots = signChanges((x) => f(x) - avg, a, b, 997);
      expect(roots.length, `${p.question}: ${roots.join(', ')}`).toBe(cs.length);
    } else expect(near(wordProblemValue(p), avg, 1e-6), `${p.answer} vs ${avg}`).toBe(true);
  },

  /**
   * Area between curves / volume of revolution (washers). Curves are the
   * `y = …` (or `x = …` in y) segments before "about"; check.bounds must each
   * be a stated bound or an intersection of the two curves.
   */
  'calculus.region'(p) {
    const q = p.question;
    const cut = q.search(/revolved|rotated|about the|Cross sections/);
    const head = cut >= 0 ? q.slice(0, cut) : q;
    const segs = mathSegments(head).map(strip);
    const first = segs.find((s) => /^[xy] = /.test(s))!;
    const dep = first[0]!;
    const ind = dep === 'y' ? 'x' : 'y';
    const curves = segs.filter((s) => s.startsWith(`${dep} = `)).map((s) => fnOf(rhs(s), ind));
    const stated = segs.filter((s) => s.startsWith(`${ind} = `)).map((s) => evalReal(rhs(s)));
    expect(curves.length, `two curves in ${q}`).toBe(2);
    const [f, g] = curves as [Fn, Fn];
    const [lo, hi] = p.check!.bounds as number[];
    for (const b of [lo!, hi!]) expect(stated.some((s) => close(s, b)) || near(f(b), g(b), 1e-9), `bound ${b}`).toBe(true);
    const probes = Array.from({ length: 41 }, (_, i) => lo! + ((hi! - lo!) * (i + 0.5)) / 41);
    const sgn = Math.sign(f(probes[0]!) - g(probes[0]!));
    probes.forEach((x) => expect(Math.sign(f(x) - g(x)), `curves do not cross at ${x}`).toBe(sgn));
    let want: number;
    if (p.check!.measure === 'area') want = Math.abs(simpsonSafe((x) => f(x) - g(x), lo!, hi!));
    else if (p.check!.measure === 'cross') {
      const tail = q.slice(cut);
      const factor = /equilateral/.test(tail) ? Math.sqrt(3) / 4 : /semicircle/.test(tail) ? Math.PI / 8 : /isosceles right/.test(tail) ? 1 / 2 : /squares/.test(tail) ? 1 : NaN;
      expect(Number.isNaN(factor), `shape in ${tail}`).toBe(false);
      expect(tail, 'sections perpendicular to the axis of the variable').toContain(`perpendicular to the $${ind}$-axis`);
      want = factor * simpsonSafe((x) => (f(x) - g(x)) ** 2, lo!, hi!);
    } else if (p.check!.measure === 'shell') {
      // axis perpendicular to the variable: "the $dep$-axis" (ind = 0) or "the line $ind = k$"
      const tail = q.slice(cut);
      let k = 0;
      const line = /the line \$([xy]) = ([^$]+)\$/.exec(tail);
      if (line) {
        expect(line[1], 'shell axis').toBe(ind);
        k = evalReal(line[2]!);
      } else expect(/the \$([xy])\$-axis/.exec(tail)![1], 'shell axis').toBe(dep);
      probes.forEach((x) => expect(Math.sign(x - k) === Math.sign(probes[0]! - k), 'axis outside region').toBe(true));
      want = 2 * Math.PI * Math.abs(simpsonSafe((x) => (x - k) * (f(x) - g(x)), lo!, hi!));
    } else {
      const tail = q.slice(cut);
      let k = 0;
      const line = /the line \$([xy]) = ([^$]+)\$/.exec(tail);
      if (line) {
        expect(line[1], 'axis parallel to the axis of the variable').toBe(dep);
        k = evalReal(line[2]!);
      } else {
        const ax = /the \$([xy])\$-axis/.exec(tail)!;
        expect(ax[1], 'axis').toBe(ind);
      }
      probes.forEach((x) => expect((f(x) - k) * (g(x) - k) >= -1e-12, 'axis outside region').toBe(true));
      want = Math.PI * Math.abs(simpsonSafe((x) => (f(x) - k) ** 2 - (g(x) - k) ** 2, lo!, hi!));
    }
    expect(near(wordProblemValue(p), want, 1e-6), `${q} → ${p.answer} (${want})`).toBe(true);
  },
};
