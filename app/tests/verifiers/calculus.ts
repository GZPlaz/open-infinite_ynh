/**
 * Calculus pack verifiers. Everything is checked numerically from the
 * RENDERED question and answer: numeric limits, derivatives (any order),
 * implicit derivatives along the curve, integrals (Simpson), extrema by
 * sampling, Riemann sums from the formula or table, solids of revolution.
 */
import { expect } from 'vitest';
import type { ProblemContent } from '../../src/engine/types';
import { close, evalReal, evaluate, listItems, mathSegments, onlyMath, splitTop, stripUnits } from '../evaluator';
import { answerValues, rhs, sides, type Verifier } from '../verify';

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

function d1(f: Fn, x: number): number {
  const D = (h: number) => (f(x + h) - f(x - h)) / (2 * h);
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
    const avg = (h: number) => (f(a + h) + f(a - h)) / 2;
    return (4 * avg(5e-3) - avg(1e-2)) / 3;
  }
  return l === r ? l : 'dne';
}

function atInfinity(f: Fn, s: 1 | -1): LimitVal {
  const v6 = f(s * 1e6);
  const v8 = f(s * 1e8);
  if (v8 >= 1e3 && v8 >= v6) return 'inf';
  if (v8 <= -1e3 && v8 <= v6) return '-inf';
  return v8;
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
      for (let k = 0; k < 50; k++) {
        const mid = (lo + hi) / 2;
        if (g(lo) * g(mid) <= 0) hi = mid;
        else lo = mid;
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

// ---------------------------------------------------------------- verifiers

export const VERIFIERS: Record<string, Verifier> = {
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
      const want = DERIV[order]!(f, x);
      const got = evalReal(dr, { vars: { [d.v]: x } });
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
      for (const r of signChanges(fp, -10.013, 10.017, 400)) expect(xs.some((x) => Math.abs(x - r) < 1e-4), `missing critical point ${r} in ${p.answer}`).toBe(true);
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
      const roots = signChanges(fp, -10.013, 10.017, 400);
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
    const roots = signChanges(fpp, -10.013, 10.017, 400);
    expect(roots.length, `inflections of ${d.body}: ${roots.join(', ')} vs ${p.answer}`).toBe(listed.length);
    for (const r of roots) expect(listed.some(([x]) => Math.abs(x! - r) < 1e-3), `missing inflection ${r}`).toBe(true);
    const up = parts.find((pp) => pp.label.includes('up'));
    const down = parts.find((pp) => pp.label.includes('down'));
    if (!up && !down) return;
    const ups = (up?.segs ?? []).flatMap(intervals);
    const downs = (down?.segs ?? []).flatMap(intervals);
    for (let x = -12.31; x <= 12.4; x += 0.173) {
      if (roots.some((r) => Math.abs(r - x) < 0.02)) continue;
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
      const roots = signChanges((t) => d1(s, t), 1e-4, 30.01, 3000);
      expect(roots.length, `${p.question}: ${roots.join(', ')}`).toBe(ts.length);
    } else {
      const [t0, t1] = p.check!.span as number[];
      const qs = mathSegments(p.question).map(strip);
      expect(qs.includes(`t = ${t0}`) && qs.includes(`t = ${t1}`), 'span in question').toBe(true);
      const N = 20000;
      let total = 0;
      let prev = s(t0!);
      for (let i = 1; i <= N; i++) {
        const cur = s(t0! + ((t1! - t0!) * i) / N);
        total += Math.abs(cur - prev);
        prev = cur;
      }
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
      const want = simpson(g, evalReal(I.lo), evalReal(I.hi!), 2000);
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
    const dl = 1e-4;
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
    const avg = simpson(f, a, b, 2000) / (b - a);
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
    const cut = q.search(/revolved|rotated|about the/);
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
    if (p.check!.measure === 'area') want = Math.abs(simpson((x) => f(x) - g(x), lo!, hi!, 2000));
    else {
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
      want = Math.PI * Math.abs(simpson((x) => (f(x) - k) ** 2 - (g(x) - k) ** 2, lo!, hi!, 2000));
    }
    expect(near(wordProblemValue(p), want, 1e-6), `${q} → ${p.answer} (${want})`).toBe(true);
  },
};
