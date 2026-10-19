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
    .replace(/\\(sin|cos|tan|sec|csc|cot)(\^\{\d+\}|\^\d)?\s*(\d+)\s*([a-z])/g, '\\$1$2($3$4)');
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
  const N = 7200;
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
      for (let k = 0; k < 100; k++) {
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
    void listItems;
  },
};
