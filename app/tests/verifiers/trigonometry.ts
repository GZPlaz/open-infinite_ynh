/** Verifiers for the trigonometry pack. */
import { expect } from 'vitest';
import type { Diagram } from '../../src/engine/diagram';
import { close, evalReal, listItems, splitTop } from '../evaluator';
import { answerValues, curvePoints, mathSegments, onlyMath, rhs, sides, stripUnits, type Verifier } from '../verify';

const TAU = 2 * Math.PI;
const FNS: Record<string, (x: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  csc: (x) => 1 / Math.sin(x),
  sec: (x) => 1 / Math.cos(x),
  cot: (x) => Math.cos(x) / Math.sin(x),
};

/** Greek letters → evaluator variables; `\sin 2x` → `\sin(2x)` (TeX convention the evaluator does not read). */
function prep(tex: string): string {
  return tex
    .replace(/\\alpha/g, 'a')
    .replace(/\\beta/g, 'b')
    .replace(/\\theta/g, 't')
    .replace(/\\(sin|cos|tan|sec|csc|cot)(\^\{\d+\}|\^\d)?\s*(\d+)\s*([a-z]|\\pi)/g, '\\$1$2($3$4)');
}

const mod = (x: number, n: number) => ((x % n) + n) % n;
const refAngle = (t: number) => {
  const a = mod(t, TAU);
  if (a <= Math.PI / 2) return a;
  if (a <= Math.PI) return Math.PI - a;
  if (a <= 1.5 * Math.PI) return a - Math.PI;
  return TAU - a;
};

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

/** Simplified radical form: rationalized denominators, square-free radicands, reduced fractions. */
function expectSimplified(tex: string): void {
  expect(/\\frac\{[^{}]*\}\{[^{}]*\\sqrt/.test(tex), `denominator not rationalized: ${tex}`).toBe(false);
  for (const mm of tex.matchAll(/\\sqrt\{(\d+)\}/g)) {
    const n = Number(mm[1]);
    for (let f = 2; f * f <= n; f++) expect(n % (f * f), `radicand ${n} not simplified: ${tex}`).not.toBe(0);
  }
  for (const mm of tex.matchAll(/\\frac\{([^{}]*(?:\{\d+\}[^{}]*)*)\}\{(\d+)\}/g)) {
    const terms = splitTop(mm[1]!.replace(/^-/, ''), ['+', '-']).parts;
    const coefs: number[] = [];
    for (const t of terms) {
      const tm = /^(\d*)(\\sqrt\{\d+\})?$/.exec(t.trim());
      if (!tm) return;
      coefs.push(tm[1] ? Number(tm[1]) : 1);
    }
    expect(coefs.reduce((g, c) => gcd(g, c), Number(mm[2])), `fraction not reduced: ${tex}`).toBe(1);
  }
}

/** Terminal direction and swept rotation (radians) of a standard-position figure. */
function angleFromFigure(d: Diagram | undefined): { term: number; swept: number } {
  const arrows = (d?.items ?? []).filter((it) => it.t === 'arrow' && it.ink === 'accent' && Math.hypot(it.from[0], it.from[1]) < 1e-9);
  expect(arrows.length, 'one terminal side').toBe(1);
  const a = arrows[0]! as { to: readonly [number, number] };
  const spiral = (d?.items ?? []).find((it) => it.t === 'path' && it.ink === 'accent' && it.role !== 'curve') as { pts: Array<readonly [number, number]> } | undefined;
  expect(spiral, 'rotation arrow').toBeTruthy();
  let swept = 0;
  const pts = spiral!.pts;
  for (let i = 1; i < pts.length; i++) {
    let da = Math.atan2(pts[i]![1], pts[i]![0]) - Math.atan2(pts[i - 1]![1], pts[i - 1]![0]);
    if (da > Math.PI) da -= TAU;
    if (da < -Math.PI) da += TAU;
    swept += da;
  }
  return { term: Math.atan2(a.to[1], a.to[0]), swept };
}

const sameDir = (x: number, y: number) => Math.abs(Math.sin(x - y)) < 1e-6 && Math.cos(x - y) > 0;

/** `name rel value` items of every math segment. */
function named(rich: string): Array<{ name: string; value: string; approx: boolean }> {
  const out: Array<{ name: string; value: string; approx: boolean }> = [];
  for (const seg of mathSegments(rich)) {
    const { parts, rels } = splitTop(seg, ['=', '\\approx']);
    if (parts.length < 2 || rels.length !== 1) continue;
    out.push({ name: parts[0]!.trim(), value: parts[1]!.trim(), approx: rels[0] === '\\approx' });
  }
  return out;
}

const num = (tex: string) => evalReal(stripUnits(tex));
const degValue = (tex: string) => evalReal(stripUnits(tex).replace(/\^\\circ/g, ''));

// ---------------------------------------------------------------- independent triangle solver

type T = Record<'A' | 'B' | 'C' | 'a' | 'b' | 'c', number>;
const R = (d: number) => (d * Math.PI) / 180;
const D = (r: number) => (r * 180) / Math.PI;

function sss(a: number, b: number, c: number): T | null {
  if (a + b <= c || a + c <= b || b + c <= a) return null;
  const A = D(Math.acos((b * b + c * c - a * a) / (2 * b * c)));
  const B = D(Math.acos((a * a + c * c - b * b) / (2 * a * c)));
  const C = D(Math.acos((a * a + b * b - c * c) / (2 * a * b)));
  return { A, B, C, a, b, c };
}

function triangles(g: Partial<T>): T[] {
  const angs = (['A', 'B', 'C'] as const).filter((k) => g[k] !== undefined);
  const sds = (['a', 'b', 'c'] as const).filter((k) => g[k] !== undefined);
  const low = (k: string) => k.toLowerCase() as 'a' | 'b' | 'c';
  if (sds.length === 3) return [sss(g.a!, g.b!, g.c!)].filter((x): x is T => x !== null);
  if (angs.length >= 2) {
    const total = angs.reduce((s, k) => s + g[k]!, 0);
    const all = { A: g.A ?? 180 - total, B: g.B ?? 180 - total, C: g.C ?? 180 - total };
    if (Math.abs(all.A + all.B + all.C - 180) > 1e-9) return [];
    const s = sds[0]!;
    const k = g[s]! / Math.sin(R(all[s.toUpperCase() as 'A']));
    return [{ ...all, a: k * Math.sin(R(all.A)), b: k * Math.sin(R(all.B)), c: k * Math.sin(R(all.C)) }];
  }
  expect(angs.length === 1 && sds.length === 2, 'three givens').toBe(true);
  const P = angs[0]!;
  const p = low(P);
  const sideMap: Partial<Record<'a' | 'b' | 'c', number>> = {};
  if (g[p] === undefined) {
    // SAS
    const [q, r] = sds as ['a' | 'b' | 'c', 'a' | 'b' | 'c'];
    sideMap[q] = g[q]!;
    sideMap[r] = g[r]!;
    sideMap[p] = Math.sqrt(g[q]! ** 2 + g[r]! ** 2 - 2 * g[q]! * g[r]! * Math.cos(R(g[P]!)));
    return [sss(sideMap.a!, sideMap.b!, sideMap.c!)].filter((x): x is T => x !== null);
  }
  // SSA via the quadratic for the third side: r² − 2qr·cos P + (q² − p²) = 0
  const q = sds.find((s) => s !== p)!;
  const r = (['a', 'b', 'c'] as const).find((s) => s !== p && s !== q)!;
  const B = -2 * g[q]! * Math.cos(R(g[P]!));
  const Cc = g[q]! ** 2 - g[p]! ** 2;
  const disc = B * B - 4 * Cc;
  if (disc < 0) return [];
  const roots = [(-B + Math.sqrt(disc)) / 2, (-B - Math.sqrt(disc)) / 2].filter((x) => x > 1e-9);
  const uniq = roots.filter((x, i) => roots.findIndex((y) => Math.abs(x - y) < 1e-9) === i);
  return uniq
    .map((x) => {
      const m: Record<string, number> = { [p]: g[p]!, [q]: g[q]!, [r]: x };
      return sss(m.a!, m.b!, m.c!);
    })
    .filter((x): x is T => x !== null);
}

function partName(lhs: string): { part: string; sub: string } {
  const t = lhs.replace(/\s+/g, ' ').trim();
  let mm = /^m\\angle ([ABC])(?:_\{(\d)\})?$/.exec(t);
  if (mm) return { part: mm[1]!, sub: mm[2] ?? '' };
  mm = /^([abc])(?:_\{(\d)\})?$/.exec(t);
  if (mm) return { part: mm[1]!, sub: mm[2] ?? '' };
  if (t === '\\text{Area}') return { part: 'Area', sub: '' };
  throw new Error(`unknown triangle part ${lhs}`);
}

// ---------------------------------------------------------------- equations

function scanRoots(f: (x: number) => number): number[] {
  const N = 2000;
  const h = TAU / N;
  const xs = Array.from({ length: N }, (_, i) => i * h);
  const ys = xs.map(f);
  const roots: number[] = [];
  const ok = (x: number) => Math.abs(f(x)) < 1e-7;
  if (ok(0)) roots.push(0);
  for (let i = 0; i + 1 < N; i++) {
    const y0 = ys[i]!;
    const y1 = ys[i + 1]!;
    if (Number.isFinite(y0) && Number.isFinite(y1) && y0 * y1 < 0) {
      let lo = xs[i]!;
      let hi = xs[i + 1]!;
      for (let k = 0; k < 80; k++) {
        const mid = (lo + hi) / 2;
        if (f(lo) * f(mid) <= 0) hi = mid;
        else lo = mid;
      }
      const x = (lo + hi) / 2;
      if (ok(x)) roots.push(x);
    }
  }
  for (let i = 1; i + 1 < N; i++) {
    const a = Math.abs(ys[i]!);
    if (a < 1e-3 && a <= Math.abs(ys[i - 1]!) && a <= Math.abs(ys[i + 1]!)) {
      // golden-section search for the minimum of |f|
      let lo = xs[i - 1]!;
      let hi = xs[i + 1]!;
      const g = (Math.sqrt(5) - 1) / 2;
      for (let k = 0; k < 70; k++) {
        const x1 = hi - g * (hi - lo);
        const x2 = lo + g * (hi - lo);
        if (Math.abs(f(x1)) < Math.abs(f(x2))) hi = x2;
        else lo = x1;
      }
      const x = (lo + hi) / 2;
      if (ok(x)) roots.push(x);
    }
  }
  roots.sort((x, y) => x - y);
  return roots.filter((x, i) => i === 0 || x - roots[i - 1]! > 1e-5);
}

// ---------------------------------------------------------------- verifiers

export const VERIFIERS: Record<string, Verifier> = {
  'trigonometry.stdpos'(p) {
    const task = p.check!.task as string;
    if (task === 'identify') {
      const { term, swept } = angleFromFigure(p.diagram);
      const ans = evalReal(rhs(onlyMath(p.answer)));
      expect(Math.abs(ans - swept), `${p.answer} vs drawn rotation ${swept}`).toBeLessThan(1e-6);
      expect(sameDir(ans, term), 'terminal side').toBe(true);
      const ref = (p.diagram!.items.find((it) => it.t === 'label' && it.small) as { tex: string } | undefined)?.tex;
      expect(ref, 'reference angle label').toBeTruthy();
      expect(close(evalReal(ref!), refAngle(ans), 1e-9), `reference label ${ref}`).toBe(true);
      return;
    }
    const theta = evalReal(onlyMath(p.question));
    const qm = /Quadrant (IV|III|II|I)\b/.exec(p.answer);
    expect(qm, p.answer).toBeTruthy();
    expect(['I', 'II', 'III', 'IV'].indexOf(qm![1]!), `${p.question} → ${p.answer}`).toBe(Math.floor(mod(theta, TAU) / (Math.PI / 2)));
    expect(close(evalReal(mathSegments(p.answer)[0]!), refAngle(theta), 1e-9), `reference angle ${p.answer}`).toBe(true);
    if (task === 'draw') {
      const { term, swept } = angleFromFigure(p.answerDiagram);
      expect(Math.abs(swept - theta), 'drawn rotation').toBeLessThan(1e-6);
      expect(sameDir(term, theta), 'drawn terminal side').toBe(true);
    }
  },

  'trigonometry.convert'(p) {
    const qTex = onlyMath(p.question);
    const q = num(qTex);
    const a = onlyMath(p.answer);
    const approx = a.includes('\\approx');
    const v = num(splitTop(a, ['\\approx', '=']).parts.at(-1)!);
    const toDeg = p.check!.to === 'deg';
    expect(/\\circ/.test(a), `answer units: ${a}`).toBe(toDeg);
    expect(/\\circ/.test(qTex), `question units: ${qTex}`).toBe(!toDeg);
    if (approx) expect(Math.abs(v - q), `${qTex} → ${a}`).toBeLessThanOrEqual((toDeg ? (0.05 * Math.PI) / 180 : 0.005) + 1e-12);
    else expect(close(v, q, 1e-9), `${qTex} → ${a}`).toBe(true);
  },

  'trigonometry.dms'(p) {
    const parse = (tex: string): { v: number; dms: boolean; approx: boolean } => {
      const approx = tex.includes('\\approx');
      const t = tex.replace('\\approx', '').trim();
      const dm = /^(-?)(\d+)\^\\circ\s*(\d+)'\s*(\d+)''$/.exec(t);
      if (dm) {
        const M = Number(dm[3]);
        const S = Number(dm[4]);
        expect(M < 60 && S < 60, `minutes/seconds below 60: ${t}`).toBe(true);
        return { v: (dm[1] ? -1 : 1) * (Number(dm[2]) + M / 60 + S / 3600), dms: true, approx };
      }
      const dd = /^(-?\d+(?:\.\d+)?)\^\\circ$/.exec(t);
      expect(dd, `angle format: ${t}`).toBeTruthy();
      return { v: Number(dd![1]), dms: false, approx };
    };
    const q = parse(onlyMath(p.question));
    const a = parse(onlyMath(p.answer));
    const toDms = p.check!.to === 'dms';
    expect(q.dms).toBe(!toDms);
    expect(a.dms).toBe(toDms);
    const tol = a.approx ? (toDms ? 0.5 / 3600 : 0.0005) + 1e-9 : 1e-9;
    expect(Math.abs(a.v - q.v), `${p.question} → ${p.answer}`).toBeLessThanOrEqual(tol);
  },

  'trigonometry.coterminal'(p) {
    const theta = evalReal(onlyMath(p.question));
    const vals = answerValues(p.answer).map((t) => evalReal(t));
    for (const v of vals) {
      const k = (v - theta) / TAU;
      expect(Math.abs(k - Math.round(k)), `${v} coterminal with ${theta}`).toBeLessThan(1e-9);
    }
    if (p.check!.task === 'posneg') {
      expect(vals.length).toBe(2);
      expect(vals[0]!, 'positive angle').toBeGreaterThan(0);
      expect(vals[1]!, 'negative angle').toBeLessThan(0);
      vals.forEach((v) => expect(Math.abs(v - theta), 'a different angle').toBeGreaterThan(1e-9));
    } else {
      expect(vals.length).toBe(1);
      expect(vals[0]! >= 0 && vals[0]! < TAU - 1e-12, p.answer).toBe(true);
    }
  },

  'trigonometry.sector'(p) {
    const known: Record<string, number> = {};
    for (const it of named(p.question)) known[it.name === '\\theta' ? 't' : it.name] = num(it.value);
    const ans = named(p.answer);
    expect(ans.length, p.answer).toBe(1);
    const { name, value, approx } = ans[0]!;
    const u = name === '\\theta' ? 't' : name;
    const { r, t, s, A } = known as Record<string, number | undefined>;
    const want =
      u === 's' ? r! * t! : u === 'A' ? (r! * r! * t!) / 2 : u === 'r' ? (s !== undefined ? s / t! : Math.sqrt((2 * A!) / t!)) : s! / r!;
    expect(Number.isFinite(want), `${p.question}: cannot compute ${u}`).toBe(true);
    const v = num(value);
    if (approx) expect(Math.abs(v - want), `${p.question} → ${p.answer}`).toBeLessThanOrEqual(0.0500001);
    else expect(close(v, want, 1e-9), `${p.question} → ${p.answer}`).toBe(true);
  },

  'trigonometry.triangle'(p) {
    const g: Partial<T> = {};
    for (const it of named(p.question)) {
      const { part } = partName(it.name);
      expect(it.approx).toBe(false);
      g[part as keyof T] = /^[ABC]$/.test(part) ? degValue(it.value) : num(it.value);
    }
    const sols = triangles(g);
    if (/No triangle/.test(p.answer)) {
      expect(sols.length, `${p.question}: expected a triangle`).toBe(0);
      return;
    }
    const groups = new Map<string, Array<{ part: string; v: number; approx: boolean }>>();
    for (const it of named(p.answer)) {
      const { part, sub } = partName(it.name);
      const v = /^[ABC]$/.test(part) ? degValue(it.value) : num(it.value);
      if (!groups.has(sub)) groups.set(sub, []);
      groups.get(sub)!.push({ part, v, approx: it.approx });
    }
    expect(groups.size, `${p.question}: triangles listed`).toBe(sols.length);
    if (sols.length === 2) expect(/Two triangles/.test(p.answer)).toBe(true);
    if (p.check!.ambiguous && sols.length === 1) expect(/One triangle/.test(p.answer)).toBe(true);
    const find = /Find \$([^$]+)\$/.exec(p.question);
    const left = [...sols];
    for (const items of groups.values()) {
      if (find) expect(items.map((x) => x.part), 'answers what was asked').toEqual([partName(find[1]!).part]);
      else if (/Find the area/.test(p.question)) expect(items.map((x) => x.part)).toEqual(['Area']);
      else expect(new Set([...items.map((x) => x.part), ...Object.keys(g)]).size, 'all parts solved').toBe(6);
      const k = left.findIndex((t) =>
        items.every(({ part, v, approx }) => {
          const want = part === 'Area' ? 0.5 * t.a * t.b * Math.sin(R(t.C)) : t[part as keyof T];
          return approx ? Math.abs(v - want) <= 0.0500001 : Math.abs(v - want) < 1e-6 * Math.max(1, want);
        }),
      );
      expect(k, `${p.question} → ${p.answer}: values match no triangle ${JSON.stringify(sols)}`).toBeGreaterThanOrEqual(0);
      left.splice(k, 1);
    }
  },

  'trigonometry.exact'(p) {
    const q = evalReal(prep(onlyMath(p.question)));
    if (/Undefined/.test(p.answer)) {
      expect(!Number.isFinite(q) || Math.abs(q) > 1e8, `${p.question} is defined (${q})`).toBe(true);
      return;
    }
    const a = onlyMath(p.answer);
    expect(Math.abs(q), `${p.question} should be defined`).toBeLessThan(1e8);
    expect(close(evalReal(a), q, 1e-9), `${p.question} → ${a} (want ${q})`).toBe(true);
    expectSimplified(a);
  },

  'trigonometry.point'(p) {
    const pm = /\\left\((-?\d+), (-?\d+)\\right\)/.exec(p.question);
    expect(pm, p.question).toBeTruthy();
    const th = Math.atan2(Number(pm![2]), Number(pm![1]));
    const items = named(p.answer);
    const find = /Find \$\\([a-z]+) \\theta\$/.exec(p.question);
    if (find) expect(items.length).toBe(1);
    else expect(new Set(items.map((i) => i.name)).size, 'six functions').toBe(6);
    for (const it of items) {
      const fm = /^\\([a-z]+) \\theta$/.exec(it.name);
      expect(fm && fm[1]! in FNS, it.name).toBeTruthy();
      if (find) expect(fm![1]).toBe(find[1]);
      expect(close(evalReal(it.value), FNS[fm![1]!]!(th), 1e-9), `${p.question} → ${it.name} = ${it.value}`).toBe(true);
      expectSimplified(it.value);
    }
  },

  'trigonometry.graph'(p) {
    const q = prep(onlyMath(p.question));
    const f = (x: number) => evalReal(rhs(q), { vars: { x } });
    const isTan = /\\tan/.test(q);
    const ans = p.answer;
    const ampM = /Amplitude: (none|\$([^$]+)\$)/.exec(ans);
    const perM = /Period: \$([^$]+)\$/.exec(ans);
    const phM = /Phase shift: (none|\$([^$]+)\$ (left|right))/.exec(ans);
    const vsM = /Vertical shift: (none|\$([^$]+)\$ (up|down))/.exec(ans);
    expect(ampM && perM && phM && vsM, ans).toBeTruthy();
    const P = evalReal(perM![1]!);
    const c = phM![2] ? evalReal(phM![2]) * (phM![3] === 'right' ? 1 : -1) : 0;
    const d = vsM![2] ? evalReal(vsM![2]) * (vsM![3] === 'up' ? 1 : -1) : 0;
    const samples = Array.from({ length: 17 }, (_, i) => -2.9 + 0.37 * i);
    const finite = (x: number) => Math.abs(f(x)) < 1e5;
    for (const x of samples) if (finite(x) && finite(x + P)) expect(close(f(x + P), f(x), 1e-7), `period ${P} of ${q} at ${x}`).toBe(true);
    for (const k of [2, 3, 4]) expect(samples.some((x) => finite(x) && finite(x + P / k) && Math.abs(f(x + P / k) - f(x)) > 1e-4), `period ${P} is not minimal`).toBe(true);
    if (isTan) {
      expect(ampM![1], 'tangent has no amplitude').toBe('none');
      expect(close(f(c), d, 1e-9), 'center point').toBe(true);
      const k = f(c + P / 4) - d;
      for (const t of samples) {
        const tv = Math.tan((Math.PI * t) / P);
        if (Math.abs(tv) > 50) continue;
        expect(Math.abs(f(c + t) - d - k * tv), `${q}: shape at ${t}`).toBeLessThan(1e-6 * Math.max(1, Math.abs(k * tv)));
      }
    } else {
      const A = evalReal(ampM![2]!);
      expect(A).toBeGreaterThan(0);
      const g = /\\sin/.test(q) ? Math.sin : Math.cos;
      const ok = [1, -1].some((s) => samples.every((t) => Math.abs(f(c + t) - d - s * A * g((TAU * t) / P)) < 1e-7));
      expect(ok, `${q} vs ${ans}`).toBe(true);
    }
    if (p.answerDiagram) {
      const pts = curvePoints(p.answerDiagram);
      expect(pts.length).toBeGreaterThan(50);
      for (const [x, y] of pts) expect(Math.abs(y - f(x)), `curve point (${x}, ${y})`).toBeLessThan(1e-6 * Math.max(1, Math.abs(y)));
      expect(p.answerDiagram.items.some((it) => it.t === 'label' && it.tex === '\\pi/2'), 'π/2 tick label').toBe(true);
    }
  },

  'trigonometry.given'(p) {
    const segs = mathSegments(p.question).map(prep);
    const vals: Record<string, { fn: string; v: number }> = {};
    const ranges: Record<string, [number, number]> = {};
    for (const s of segs) {
      const eqm = /^\\(sin|cos|tan) ([abt]) = (.+)$/.exec(s);
      if (eqm) vals[eqm[2]!] = { fn: eqm[1]!, v: evalReal(eqm[3]!) };
      const rm = /^(.+) < ([abt]) < (.+)$/.exec(s);
      if (rm) ranges[rm[2]!] = [evalReal(rm[1]!), evalReal(rm[3]!)];
    }
    const env: Record<string, number> = {};
    for (const [k, { fn, v }] of Object.entries(vals)) {
      const [lo, hi] = ranges[k]!;
      const base = fn === 'sin' ? [Math.asin(v), Math.PI - Math.asin(v)] : fn === 'cos' ? [Math.acos(v), -Math.acos(v)] : [Math.atan(v), Math.atan(v) + Math.PI];
      const cands = base.flatMap((b) => [-2, -1, 0, 1, 2].map((j) => b + j * TAU)).filter((x) => x > lo + 1e-12 && x < hi - 1e-12);
      const uniq = cands.filter((x, i) => cands.findIndex((y) => Math.abs(x - y) < 1e-9) === i);
      expect(uniq.length, `${p.question}: angle ${k}`).toBe(1);
      env[k] = uniq[0]!;
    }
    const target = /Find \$([^$]+)\$/.exec(p.question);
    expect(target, p.question).toBeTruthy();
    const want = evalReal(prep(target![1]!), { vars: env });
    const a = onlyMath(p.answer);
    expect(close(evalReal(a), want, 1e-9), `${p.question} → ${a} (want ${want})`).toBe(true);
    expectSimplified(a);
  },

  'trigonometry.equation'(p) {
    const [l, r] = sides(prep(onlyMath(p.question)));
    const f = (x: number) => evalReal(l!, { vars: { x } }) - evalReal(r!, { vars: { x } });
    const none = /No solution/.test(p.answer);
    const vals = none ? [] : answerValues(p.answer, 'x').map((t) => evalReal(t));
    const deg = p.check!.units === 'deg';
    if (!none) expect(/\\circ/.test(p.answer), `units of ${p.answer}`).toBe(deg);
    for (const v of vals) {
      expect(v >= -1e-12 && v < TAU - 1e-9, `${v} in [0, 2π)`).toBe(true);
      expect(Math.abs(f(v)), `${p.question} at ${v}`).toBeLessThan(1e-7);
    }
    const roots = scanRoots(f);
    expect(vals.length, `${p.question} → ${p.answer}: found roots ${roots.join(', ')}`).toBe(roots.length);
    for (const root of roots) expect(vals.some((v) => Math.abs(v - root) < 1e-5), `${p.question}: missing root ${root}`).toBe(true);
    // listed ascending, no repeats
    vals.forEach((v, i) => i > 0 && expect(v).toBeGreaterThan(vals[i - 1]!));
  },
};

// ---------------------------------------------------------------- v0.3 additions

/** Value after the last `=` / `\approx` of a math segment, and whether it was rounded. */
function valueOf(seg: string): { v: number; approx: boolean; tex: string } {
  const { parts, rels } = splitTop(seg, ['=', '\\approx']);
  const tex = parts.at(-1)!.trim();
  return { v: tex === '' ? NaN : evalReal(stripUnits(tex)), approx: rels.at(-1) === '\\approx', tex };
}

/** Rounded answers: within half a unit of the last shown decimal place. */
function expectRounded(got: { v: number; approx: boolean; tex: string }, want: number, what: string, degrees = false): void {
  if (!got.approx) {
    expect(close(got.v, want, 1e-9), `${what}: ${got.tex} vs ${want}`).toBe(true);
    return;
  }
  const digits = /\.(\d+)/.exec(got.tex.replace(/\\text\{[^}]*\}/g, ''))?.[1]?.length ?? 0;
  const half = 0.5 * 10 ** -digits;
  const tol = (degrees ? (half * Math.PI) / 180 : half) + 1e-9 * Math.max(1, Math.abs(want));
  expect(Math.abs(got.v - want), `${what}: ${got.tex} vs ${want}`).toBeLessThanOrEqual(tol);
}

const SAMPLES = Array.from({ length: 23 }, (_, i) => -5.3 + 0.47 * i);

/** f has (minimal) period P on the sample points (skipping points near poles). */
function expectPeriod(f: (x: number) => number, P: number, what: string): void {
  const fin = (x: number) => Number.isFinite(f(x)) && Math.abs(f(x)) < 1e5;
  for (const x of SAMPLES) if (fin(x) && fin(x + P)) expect(close(f(x + P), f(x), 1e-7), `${what}: period ${P} at ${x}`).toBe(true);
  for (const k of [2, 3, 4]) expect(SAMPLES.some((x) => fin(x) && fin(x + P / k) && Math.abs(f(x + P / k) - f(x)) > 1e-4), `${what}: period ${P} is not minimal`).toBe(true);
}

/** Do two expressions agree at sample points where both are defined (at least `need` of them)? */
function agree(a: string, b: string, v: string, pts: number[], need = 4): boolean {
  let used = 0;
  for (const x of pts) {
    let ya: number;
    let yb: number;
    try {
      ya = evalReal(a, { vars: { [v]: x } });
      yb = evalReal(b, { vars: { [v]: x } });
    } catch {
      continue;
    }
    if (!Number.isFinite(ya) || !Number.isFinite(yb) || Math.abs(ya) > 1e6 || Math.abs(yb) > 1e6) continue;
    used++;
    if (!close(ya, yb, 1e-7)) return false;
  }
  return used >= need;
}

const IDENTITY_PTS = [0.31, 0.77, 1.13, 2.05, 2.71, 3.62, 4.4, 5.17, -0.58, -1.94];
/** The evaluator variable of an identity expression (from the raw TeX). */
const varOf = (raw: string) => (/\\alpha/.test(raw) ? 'a' : /\\theta/.test(raw) ? 't' : 'x');

/** Some sample point where both are defined shows a difference. */
function disagree(a: string, b: string, v: string): boolean {
  return IDENTITY_PTS.some((x) => {
    try {
      const ya = evalReal(a, { vars: { [v]: x } });
      const yb = evalReal(b, { vars: { [v]: x } });
      return Number.isFinite(ya) && Number.isFinite(yb) && Math.abs(ya) < 1e6 && Math.abs(yb) < 1e6 && !close(ya, yb, 1e-6);
    } catch {
      return false;
    }
  });
}

/** Distance from the start after legs given as `flies 120 miles on a bearing of N 40° E`. */
function bearingLegs(text: string): Array<[number, number]> {
  return [...text.matchAll(/(\d+) miles on a bearing of (N|S) (\d+)° (E|W)/g)].map((mm) => {
    const ang = Number(mm[3]);
    const az = mm[2] === 'N' ? (mm[4] === 'E' ? ang : 360 - ang) : mm[4] === 'E' ? 180 - ang : 180 + ang;
    return [Number(mm[1]), az];
  });
}

const LoC = (a: number, b: number, C: number) => Math.sqrt(a * a + b * b - 2 * a * b * Math.cos(R(C)));
const LAW_APPS: Record<string, (q: Record<string, number>, text: string) => number> = {
  ships: (q) => LoC(q.v1! * q.t!, q.v2! * q.t!, q.gamma!),
  shipsBearing: (q) => LoC(q.v1! * q.t!, q.v2! * q.t!, 180 - q.alpha! - q.beta!),
  river: (q) => (q.d! * Math.sin(R(q.beta!))) / Math.sin(R(q.alpha! + q.beta!)),
  riverWidth: (q) => ((q.d! * Math.sin(R(q.beta!))) / Math.sin(R(q.alpha! + q.beta!))) * Math.sin(R(q.alpha!)),
  tower: (q) => (q.d! * Math.sin(R(q.beta!))) / Math.sin(R(90 - q.alpha! - q.beta!)),
  lake: (q) => LoC(q.p!, q.q!, q.gamma!),
  lighthouse: (q) => (q.d! * Math.sin(R(q.alpha!))) / Math.sin(R(q.beta! - q.alpha!)),
  plot: (q) => D(Math.acos((q.a! ** 2 + q.b! ** 2 - q.c! ** 2) / (2 * q.a! * q.b!))),
  plane: (_q, text) => {
    const legs = bearingLegs(text);
    expect(legs.length, 'two legs').toBe(2);
    const x = legs.reduce((s, [d, az]) => s + d * Math.sin(R(az)), 0);
    const y = legs.reduce((s, [d, az]) => s + d * Math.cos(R(az)), 0);
    return Math.hypot(x, y);
  },
};

function inLangle(tex: string): number[] {
  const mm = /\\left\\langle (.*) \\right\\rangle/.exec(tex);
  expect(mm, tex).toBeTruthy();
  return splitTop(mm![1]!, [',']).parts.map((t) => evalReal(t));
}

/** First point of a `P\left(x, y\right)` segment. */
function pointIn(rich: string): [number, number] | null {
  for (const seg of mathSegments(rich)) {
    const mm = /^P\\left\((.*)\\right\)$/.exec(seg.trim());
    if (mm) {
      const [x, y] = splitTop(mm[1]!, [',']).parts.map((t) => evalReal(t));
      return [x!, y!];
    }
  }
  return null;
}

/** Number appears in the text (not as part of a longer number). */
const mentions = (text: string, v: number) => new RegExp(`(?<![\\d.])${String(v).replace('.', '\\.')}(?![\\d])`).test(text);

/** Function of t from the `h(t) = …` segment of a rich string. */
function modelIn(rich: string): (t: number) => number {
  const seg = mathSegments(rich).find((s) => /^[A-Za-z]\(t\) =/.test(s.trim()));
  expect(seg, `model in ${rich}`).toBeTruthy();
  const rhsTex = splitTop(seg!, ['=']).parts[1]!;
  return (t: number) => evalReal(rhsTex, { vars: { t } });
}

function firstCrossing(f: (x: number) => number, target: number, P: number): number {
  const N = 3000;
  for (let i = 0; i < N; i++) {
    const x0 = (P * i) / N;
    const x1 = (P * (i + 1)) / N;
    if ((f(x0) - target) * (f(x1) - target) <= 0 && x1 > 1e-9) {
      let a = x0;
      let b = x1;
      for (let j = 0; j < 80; j++) {
        const mid = (a + b) / 2;
        if ((f(a) - target) * (f(mid) - target) <= 0) b = mid;
        else a = mid;
      }
      if ((a + b) / 2 > 1e-9) return (a + b) / 2;
    }
  }
  return NaN;
}

const SPEED: Record<string, (q: Record<string, number>) => number> = {
  ferrisAngular: (q) => TAU / q.T!,
  ferrisLinear: (q) => (TAU * q.r!) / q.T!,
  wheelMph: (q) => (q.n! * Math.PI * q.d! * 60) / 63360,
  rpmRad: (q) => (TAU * q.n!) / 60,
  bikeRpm: (q) => (q.mph! * 63360) / 60 / (Math.PI * q.d!),
  pulley: (q) => (q.n1! * q.r1!) / q.r2!,
  gear: (q) => (TAU * q.n1! * q.t1!) / q.t2!,
  satellite: (q) => (TAU * (q.R! + q.h!)) / q.T!,
  earth: (q) => (TAU * q.R! * Math.cos(R(q.L!))) / 24,
};

Object.assign(VERIFIERS, {
  'trigonometry.lawapp'(p) {
    const params = p.check!.params as Record<string, number>;
    const scenario = p.check!.scenario as string;
    if (scenario !== 'plane') for (const [k, v] of Object.entries(params)) expect(mentions(p.question, v), `${k} = ${v} stated in ${p.question}`).toBe(true);
    const want = LAW_APPS[scenario]!(params, p.question);
    expectRounded(valueOf(onlyMath(p.answer)), scenario === 'plot' ? R(want) : want, p.question, scenario === 'plot');
  },

  'trigonometry.identity'(p) {
    const raw = onlyMath(p.question);
    const v = varOf(raw);
    const q = prep(raw);
    const a = prep(onlyMath(p.answer));
    expect(agree(q, a, v, IDENTITY_PTS, 6), `${raw} is not identically ${a}`).toBe(true);
    p.distractors!.slice(0, 3).forEach((d) => expect(disagree(q, prep(onlyMath(d)), v), `distractor ${d} is equivalent`).toBe(true));
    const body = a.replace(/^-/, '');
    if (p.check!.form === 'sum') expect(/\+| - /.test(body), `not a sum: ${a}`).toBe(true);
    if (p.check!.form === 'product') expect(/\+| - /.test(body), `not a product: ${a}`).toBe(false);
  },

  'trigonometry.identityChoice'(p) {
    const qRaw = onlyMath(p.question);
    const v = varOf(qRaw);
    const ans = prep(onlyMath(p.answer));
    if (p.check!.task === 'equal') {
      const q = prep(qRaw);
      expect(agree(q, ans, v, IDENTITY_PTS, 6), `${qRaw} vs ${ans}`).toBe(true);
      p.distractors!.slice(0, 3).forEach((d) => expect(disagree(q, prep(onlyMath(d)), v), `distractor ${d} is equivalent`).toBe(true));
      return;
    }
    expect(qRaw.includes('\\boxed{?}'), qRaw).toBe(true);
    const parts = splitTop(prep(qRaw.replace('\\boxed{?}', `{${onlyMath(p.answer)}}`)), ['=']).parts;
    expect(parts.length).toBeGreaterThanOrEqual(3);
    parts.slice(1).forEach((x) => expect(agree(parts[0]!, x, v, IDENTITY_PTS, 6), `proof step ${x} is not equal to ${parts[0]}`).toBe(true));
    p.distractors!.slice(0, 3).forEach((d) => expect(disagree(parts[0]!, prep(onlyMath(d)), v), `distractor ${d} would be a valid step`).toBe(true));
  },

  'trigonometry.vecMagDir'(p) {
    if (p.check!.task === 'magdir') {
      const [x, y] = inLangle(onlyMath(p.question));
      const segs = mathSegments(p.answer);
      expect(segs.length).toBe(2);
      expectRounded(valueOf(segs[0]!), Math.hypot(x!, y!), 'magnitude');
      expectSimplified(valueOf(segs[0]!).tex);
      const dir = mod(Math.atan2(y!, x!), TAU);
      const got = valueOf(segs[1]!);
      expectRounded(got, dir, 'direction angle', true);
      expect(got.v >= 0 && got.v < TAU, 'angle in [0°, 360°)').toBe(true);
    } else {
      const g = named(p.question);
      const mag = num(g.find((i) => i.name.includes('mathbf'))!.value);
      const th = num(g.find((i) => i.name === '\\theta')!.value);
      const a = onlyMath(p.answer);
      const approx = a.includes('\\approx');
      const comps = inLangle(a);
      const want = [mag * Math.cos(th), mag * Math.sin(th)];
      comps.forEach((c, i) => (approx ? expect(Math.abs(c - want[i]!), a).toBeLessThanOrEqual(0.0500001) : expect(close(c, want[i]!, 1e-9), a).toBe(true)));
      if (!approx) expectSimplified(a);
    }
  },

  'trigonometry.refangle'(p) {
    const th = valueOf(onlyMath(p.question)).v;
    const got = valueOf(onlyMath(p.answer));
    expect(got.approx).toBe(false);
    expect(close(got.v, refAngle(th), 1e-9), `${p.question} → ${p.answer}`).toBe(true);
  },

  'trigonometry.speed'(p) {
    const params = p.check!.params as Record<string, number>;
    for (const [k, v] of Object.entries(params)) if (k !== 'R') expect(mentions(p.question, v), `${k} = ${v} stated in ${p.question}`).toBe(true);
    if ('R' in params) expect(mentions(p.question, params.R!), 'Earth radius stated').toBe(true);
    const want = SPEED[p.check!.scenario as string]!(params);
    expectRounded(valueOf(onlyMath(p.answer)), want, p.question);
  },

  'trigonometry.unitcircle'(p) {
    const task = p.check!.task as string;
    if (task === 'coords') {
      const th = valueOf(onlyMath(p.question)).v;
      const a = onlyMath(p.answer);
      const [x, y] = listItems(a).map((t) => evalReal(t));
      expect(close(x!, Math.cos(th), 1e-9) && close(y!, Math.sin(th), 1e-9), `${p.question} → ${a}`).toBe(true);
      expectSimplified(a);
      return;
    }
    if (task === 'read') {
      const [x, y] = pointIn(p.question)!;
      expect(close(x * x + y * y, 1, 1e-9), 'point on the unit circle').toBe(true);
      const want: Record<string, number> = { sin: y, cos: x, tan: y / x, csc: 1 / y, sec: 1 / x, cot: x / y };
      const items = named(p.answer);
      const asked = mathSegments(p.question.slice(p.question.indexOf('Find'))).map((t) => t.trim());
      expect(items.map((i) => i.name), 'answers what was asked').toEqual(asked);
      for (const it of items) {
        expect(close(evalReal(it.value), want[/\\([a-z]+)/.exec(it.name)![1]!]!, 1e-9), `${it.name} = ${it.value}`).toBe(true);
        expectSimplified(it.value);
      }
      return;
    }
    const vals = answerValues(p.answer, '\\theta').map((t) => evalReal(t));
    let want: number[];
    const pt = pointIn(p.question);
    if (pt) {
      expect(close(pt[0] * pt[0] + pt[1] * pt[1], 1, 1e-9), 'point on the unit circle').toBe(true);
      want = [mod(Math.atan2(pt[1], pt[0]), TAU)];
    } else {
      const it = named(p.question)[0]!;
      const c = evalReal(it.value);
      const base = it.name === 'x' ? [Math.acos(c), -Math.acos(c)] : [Math.asin(c), Math.PI - Math.asin(c)];
      want = base.map((b) => mod(b, TAU)).filter((v, i, arr) => arr.findIndex((w) => Math.abs(Math.sin((w - v) / 2)) < 1e-9) === i);
    }
    expect(vals.length, `${p.question} → ${p.answer}`).toBe(want.length);
    for (const v of vals) {
      expect(v >= -1e-12 && v < TAU - 1e-9, 'angle in one revolution').toBe(true);
      expect(want.some((w) => Math.abs(Math.sin((w - v) / 2)) < 1e-9), `${p.question}: unexpected angle ${v}`).toBe(true);
    }
  },

  'trigonometry.recipGraph'(p) {
    const q = prep(onlyMath(p.question));
    const f = (x: number) => evalReal(rhs(q), { vars: { x } });
    const g = /\\(tan|cot|sec|csc)/.exec(q)![1]!;
    const ans = p.answer;
    const perM = /Period: \$([^$]+)\$/.exec(ans);
    const phM = /Phase shift: (none|\$([^$]+)\$ (left|right))/.exec(ans);
    const vsM = /Vertical shift: (none|\$([^$]+)\$ (up|down))/.exec(ans);
    const asM = /Asymptotes: \$x = ([^$]+)\$/.exec(ans);
    expect(perM && phM && vsM && asM, ans).toBeTruthy();
    const P = evalReal(perM![1]!);
    const c = phM![2] ? evalReal(phM![2]) * (phM![3] === 'right' ? 1 : -1) : 0;
    const d = vsM![2] ? evalReal(vsM![2]) * (vsM![3] === 'up' ? 1 : -1) : 0;
    expectPeriod(f, P, q);
    const asy = (n: number) => evalReal(asM![1]!, { vars: { n } });
    const S = asy(1) - asy(0);
    expect(S, 'asymptote spacing').toBeGreaterThan(0);
    for (let n = -3; n <= 3; n++) {
      const x = asy(n);
      const near = Math.abs(f(x + 1e-7));
      expect(!Number.isFinite(near) || near > 1e4, `${q}: no asymptote at ${x}`).toBe(true);
      // nothing else blows up between consecutive asymptotes
      for (let i = 1; i < 24; i++) {
        const t = x + (S * i) / 24;
        expect(Math.abs(f(t)) < 1e5, `${q}: extra asymptote near ${t}`).toBe(true);
      }
    }
    // shape: f(c + t) − d = K·g(b t)
    const b = (g === 'tan' || g === 'cot' ? Math.PI : TAU) / P;
    const base = FNS[g]!;
    const t0 = 0.123 * P;
    const K = (f(c + t0) - d) / base(b * t0);
    expect(Math.abs(K), 'vertical stretch').toBeGreaterThan(1e-6);
    for (const t of SAMPLES.map((s) => s * 0.37 * P)) {
      const gv = base(b * t);
      if (!Number.isFinite(gv) || Math.abs(gv) > 50) continue;
      expect(Math.abs(f(c + t) - d - K * gv), `${q} vs ${ans} at t=${t}`).toBeLessThan(1e-6 * Math.max(1, Math.abs(K * gv)));
    }
    if (p.answerDiagram) {
      const pts = curvePoints(p.answerDiagram);
      expect(pts.length).toBeGreaterThan(50);
      for (const [x, y] of pts) expect(Math.abs(y - f(x)), `curve point (${x}, ${y})`).toBeLessThan(1e-6 * Math.max(1, Math.abs(y)));
      const dashedX = p.answerDiagram.items.filter((it) => it.t === 'path' && it.dash && it.pts.length === 2 && Math.abs(it.pts[0]![0] - it.pts[1]![0]) < 1e-12).map((it) => (it as { pts: Array<readonly [number, number]> }).pts[0]![0]);
      const isAsy = (x: number) => Math.abs(Math.sin((Math.PI * (x - asy(0))) / S)) < 1e-9;
      dashedX.forEach((x) => expect(isAsy(x), `dashed line x = ${x} is not an asymptote`).toBe(true));
      const lo = Math.ceil((-2 * Math.PI - asy(0)) / S + 1e-9);
      const hi = Math.floor((2 * Math.PI - asy(0)) / S - 1e-9);
      expect(dashedX.length, 'every asymptote in the window is drawn').toBe(Math.max(0, hi - lo + 1));
    }
  },

  'trigonometry.sinusoidFit'(p) {
    const pts = curvePoints(p.diagram);
    expect(pts.length).toBeGreaterThan(50);
    const fits = (rich: string) => {
      const r = rhs(prep(onlyMath(rich)));
      return pts.every(([x, y]) => Math.abs(evalReal(r, { vars: { x } }) - y) < 1e-6 * Math.max(1, Math.abs(y)));
    };
    expect(fits(p.answer), `${p.answer} does not match the graph`).toBe(true);
    p.distractors!.slice(0, 3).forEach((d) => expect(fits(d), `distractor ${d} matches the graph`).toBe(false));
  },

  'trigonometry.model'(p) {
    const task = p.check!.task as string;
    const facts = p.check!.facts as { period: number; max: [number, number]; min: [number, number]; stated: number[] };
    for (const v of facts.stated) expect(mentions(p.question, v), `${v} stated in ${p.question}`).toBe(true);
    if (task === 'model') {
      const f = modelIn(p.answer);
      for (const [t, v] of [facts.max, facts.min]) expect(close(f(t), v, 1e-9), `${p.answer} at t=${t}`).toBe(true);
      let hi = -Infinity;
      let lo = Infinity;
      for (let i = 0; i <= 600; i++) {
        const y = f((facts.period * i) / 600);
        hi = Math.max(hi, y);
        lo = Math.min(lo, y);
        expect(close(f((facts.period * i) / 600 + facts.period), y, 1e-7), 'period').toBe(true);
      }
      expect(hi <= facts.max[1] + 1e-9 && lo >= facts.min[1] - 1e-9, 'range of the model').toBe(true);
      return;
    }
    const f = modelIn(p.question);
    const got = valueOf(onlyMath(p.answer));
    if (task === 'value') {
      const tm = /Find \$[A-Za-z]\(([\d.]+)\)\$/.exec(p.question);
      expect(tm, p.question).toBeTruthy();
      expectRounded(got, f(Number(tm![1])), p.question);
    } else {
      const target = p.check!.target as number;
      expect(mentions(p.question, target), 'target stated').toBe(true);
      expectRounded(got, firstCrossing(f, target, facts.period), p.question);
    }
  },

  'trigonometry.inverse'(p) {
    const q = evalReal(prep(onlyMath(p.question)));
    if (/Undefined/.test(p.answer)) {
      expect(Number.isNaN(q), `${p.question} has a value ${q}`).toBe(true);
      return;
    }
    expect(Number.isFinite(q), `${p.question} is undefined`).toBe(true);
    const got = valueOf(onlyMath(p.answer));
    expectRounded(got, q, p.question, /\\circ/.test(got.tex));
    if (!got.approx) expectSimplified(got.tex);
  },

  'trigonometry.composition'(p) {
    const q = prep(onlyMath(p.question));
    const a = onlyMath(p.answer);
    if (p.check!.algebraic) {
      expect(agree(q, a, 'x', [-0.29, -0.17, 0.11, 0.23, 0.37, 0.41, 0.53], 6), `${q} vs ${a}`).toBe(true);
      expect(/\\frac\{[^{}]*\}\{[^{}]*\\sqrt/.test(a), `rationalize ${a}`).toBe(false);
      return;
    }
    expect(close(evalReal(a), evalReal(q), 1e-9), `${p.question} → ${a}`).toBe(true);
    expectSimplified(a);
  },
} satisfies Record<string, Verifier>);
