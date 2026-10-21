/** Answer verifiers for the Precalculus pack. */
import { expect } from 'vitest';
import type { Diagram, DiagramItem } from '../../src/engine/diagram';
import type { ProblemContent } from '../../src/engine/types';
import { close, closeC, evaluate, evalReal, listItems, mathSegments, onlyMath, splitTop, type C } from '../evaluator';
import { chainHolds, curvePoints, expectEquivalent, setHolds, sides, type Verifier } from '../verify';

// ---------------------------------------------------------------- helpers

/** f(x) as a real number, or null where the expression is undefined / non-real. */
function realAt(tex: string, vars: Record<string, number>): number | null {
  try {
    const v = evaluate(tex, { vars });
    if (!Number.isFinite(v.re) || !Number.isFinite(v.im)) return null;
    if (Math.abs(v.im) > 1e-9 * Math.max(1, Math.abs(v.re))) return null;
    return v.re;
  } catch {
    return null;
  }
}

/** Right-hand side of `f(x) = …`. */
function rhsOf(seg: string): string {
  const { parts } = splitTop(seg, ['=']);
  return parts[parts.length - 1]!;
}

/** Membership test for interval notation: `(-\infty, 2) \cup [3, 5]`, `\{4\}`, `\varnothing`. */
export function intervalSet(tex: string): (x: number) => boolean {
  const t = tex.replace(/\\left|\\right/g, '').trim();
  if (t === '\\varnothing' || t === '\\emptyset') return () => false;
  const pieces = splitTop(t, ['\\cup']).parts;
  const tests = pieces.map((piece) => {
    const p = piece.trim();
    const single = /^\\\{(.*)\\\}$/.exec(p);
    if (single) {
      const vals = splitTop(single[1]!, [',']).parts.map((s) => evalReal(s));
      return (x: number) => vals.some((v) => Math.abs(v - x) < 1e-9);
    }
    const open = p[0];
    const shut = p[p.length - 1];
    expect('([', `interval ${p}`).toContain(open);
    expect(')]', `interval ${p}`).toContain(shut);
    const [a, b] = splitTop(p.slice(1, -1), [',']).parts.map((s) => endpoint(s));
    expect(a! <= b!, `interval ${p} is ordered`).toBe(true);
    if (!Number.isFinite(a!)) expect(open, `${p}: infinite endpoints are open`).toBe('(');
    if (!Number.isFinite(b!)) expect(shut, `${p}: infinite endpoints are open`).toBe(')');
    return (x: number) => (open === '[' ? x >= a! - 1e-9 : x > a! + 1e-9) && (shut === ']' ? x <= b! + 1e-9 : x < b! - 1e-9);
  });
  return (x) => tests.some((f) => f(x));
}

function endpoint(s: string): number {
  const t = s.trim();
  if (t === '\\infty' || t === '+\\infty') return Infinity;
  if (t === '-\\infty') return -Infinity;
  return evalReal(t);
}

/** Finite numbers appearing in an interval / inequality answer (probe anchors). */
function anchors(tex: string): number[] {
  const out: number[] = [];
  const flat = tex.replace(/\\left|\\right/g, '').replace(/\\\{|\\\}/g, ' ').replace(/[()[\]]/g, ' ');
  for (const piece of splitTop(flat, ['\\cup', ',', '<', '>', '\\le', '\\ge', '=', '\\text{ or }', '\\text{ and }']).parts) {
    const s = piece.trim();
    if (!s || /infty|^[a-z]$/.test(s)) continue;
    const v = realAt(s, {});
    if (v !== null) out.push(v);
  }
  return out;
}

const GRID = (() => {
  const xs: number[] = [];
  for (let x = -30; x <= 30; x += 0.73) xs.push(x);
  return xs;
})();

function probesAround(points: number[]): number[] {
  return [...points.flatMap((b) => [b - 2.3, b - 0.4, b - 1e-4, b, b + 1e-4, b + 0.4, b + 2.3]), ...GRID.filter((x) => points.every((b) => Math.abs(x - b) > 1e-6))];
}

/** Labelled parts of an answer such as `Domain: $…$; Range: $…$`. */
function labelled(answer: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const part of answer.split('; ')) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    out[part.slice(0, i).trim().toLowerCase()] = mathSegments(part.slice(i + 1));
  }
  return out;
}

/** Sorted sample abscissas for range checks, refined around `hints`. */
function rangeSamples(hints: number[]): number[] {
  const xs = new Set<number>();
  for (let i = -200; i <= 200; i++) xs.add(i / 10);
  for (let x = 21; x <= 1e6; x = Math.ceil(x * 1.08)) {
    xs.add(x);
    xs.add(-x);
  }
  for (const h of hints) {
    xs.add(h);
    for (let j = 1; j <= 16; j++) {
      xs.add(h + 3 ** -j);
      xs.add(h - 3 ** -j);
    }
  }
  return [...xs].sort((a, b) => a - b);
}

/** Does the continuous function f attain y somewhere among the samples (with continuity guard)? */
function attains(fx: Array<[number, number | null]>, mids: Array<number | null>, y: number): boolean {
  for (let i = 0; i < fx.length; i++) {
    const v = fx[i]![1];
    if (v !== null && Math.abs(fx[i]![0]) <= 20 && Math.abs(v - y) < 1e-12) return true;
    if (i + 1 < fx.length) {
      const w = fx[i + 1]![1];
      const mv = mids[i];
      if (v === null || w === null || mv === null || mv === undefined) continue;
      if ((v - y) * (w - y) < 0 && mv >= Math.min(v, w) - 1e-9 && mv <= Math.max(v, w) + 1e-9) return true;
    }
  }
  return false;
}

function expectRange(f: (x: number) => number | null, rangeTex: string, hints: number[], what: string): void {
  const xs = rangeSamples(hints);
  const fx = xs.map((x) => [x, f(x)] as [number, number | null]);
  const mids = xs.slice(0, -1).map((x, i) => f((x + xs[i + 1]!) / 2));
  const inR = intervalSet(rangeTex);
  const ends = anchors(rangeTex);
  const finite = fx.filter(([x, v]) => v !== null && Math.abs(x) <= 20).map(([, v]) => v!).sort((a, b) => a - b);
  const c = finite.length ? Math.round(finite[Math.floor(finite.length / 2)]!) : 0;
  const ys = ends.length ? ends.flatMap((e) => [e - 2.13, e - 0.47, e, e + 0.47, e + 2.13]) : [c - 2.13, c - 0.47, c + 0.31, c + 0.47, c + 2.13];
  for (const y of ys) expect(attains(fx, mids, y), `${what}: range ${rangeTex} at y=${y}`).toBe(inR(y));
}

function expectDomain(f: (x: number) => number | null, domainTex: string, what: string): void {
  const inD = intervalSet(domainTex);
  for (const x of probesAround(anchors(domainTex))) expect(f(x) !== null, `${what}: domain ${domainTex} at x=${x}`).toBe(inD(x));
}

// ---------------------------------------------------------------- verifiers

/** Segment of the form `name = …` (e.g. `f(x) = …`) among a rich string's math, or undefined. */
function defOf(rich: string, name: string): string | undefined {
  const seg = mathSegments(rich).find((s) => s.trim().startsWith(`${name} =`));
  return seg === undefined ? undefined : rhsOf(seg);
}

/** Every role:'curve' point of the figure lies on y = f(x). */
function curveOnGraph(fig: Diagram | undefined, f: (x: number) => number | null, what: string, stride = 1): void {
  const pts = curvePoints(fig);
  expect(pts.length, `${what}: curve drawn`).toBeGreaterThan(5);
  for (let i = 0; i < pts.length; i += stride) {
    const [x, y] = pts[i]!;
    const v = f(x);
    expect(v !== null && Math.abs(v - y) <= 1e-6 * Math.max(1, Math.abs(y)), `${what}: point (${x}, ${y}) vs ${v}`).toBe(true);
  }
}

interface Row {
  expr: string;
  cond: string;
}

/** Rows of a `\\begin{cases} expr, & condition \\\\ … \\end{cases}` definition. */
function casesRows(rich: string): Row[] {
  const seg = mathSegments(rich).find((s) => s.includes('\\begin{cases}'))!;
  const body = /\\begin\{cases\}(.*)\\end\{cases\}/.exec(seg)![1]!;
  return body.split('\\\\').map((r) => {
    const [e, c] = r.split('&');
    return { expr: e!.trim().replace(/,$/, ''), cond: c!.trim() };
  });
}

function rowsHolding(rows: Row[], x: number): Row[] {
  return rows.filter((r) => chainHolds(r.cond, { x }));
}

/** Value of the piecewise function (exactly one row must apply). */
function piecewiseAt(rows: Row[], x: number): number {
  const hit = rowsHolding(rows, x);
  expect(hit.length, `exactly one piece applies at x=${x}`).toBe(1);
  return evalReal(hit[0]!.expr, { vars: { x } });
}

function dotsOf(fig: Diagram | undefined): Array<{ x: number; y: number; open: boolean }> {
  return (fig?.items ?? []).filter((it): it is Extract<DiagramItem, { t: 'dot' }> => it.t === 'dot' && it.ink === 'accent').map((d) => ({ x: d.p[0], y: d.p[1], open: !!d.open }));
}

function pointsIn(rich: string): number[][] {
  return mathSegments(rich).map((s) => listItems(s).map((t) => evalReal(t)));
}

/** Top-level `\\frac{a}{b}` → [a, b] (brace matched), or null. */
function fracParts(t: string): [string, string] | null {
  const s = t.trim();
  if (!s.startsWith('\\frac{')) return null;
  const groups: string[] = [];
  let i = 5;
  while (groups.length < 2 && s[i] === '{') {
    let depth = 0;
    const start = i + 1;
    do {
      if (s[i] === '{') depth++;
      else if (s[i] === '}') depth--;
      i++;
    } while (depth > 0 && i < s.length);
    groups.push(s.slice(start, i - 1));
  }
  return groups.length === 2 && i === s.length ? [groups[0]!, groups[1]!] : null;
}

/** Vectors `\\mathbf{u} = \\left\\langle … \\right\\rangle` named in a rich string. */
function vectorsIn(rich: string, vars: Record<string, number> = {}): Record<string, number[] | string[]> {
  const out: Record<string, number[] | string[]> = {};
  for (const s of mathSegments(rich)) {
    const mm = /\\mathbf\{(\w)\} = \\left\\langle (.*) \\right\\rangle$/.exec(s.trim());
    if (mm) out[mm[1]!] = splitTop(mm[2]!, [',']).parts;
  }
  void vars;
  return out;
}
const vdot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i]!, 0);

/** Polar LaTeX → evaluator input in the variable t (θ). */
function polarTex(tex: string): string {
  return tex
    .replace(/\\theta/g, ' t')
    .replace(/\\(sin|cos|tan|sec|csc|cot) (\d+) t/g, '\\$1($2t)');
}

const THETAS = [0.37, 1.13, 2.03, 2.71, 3.67, 4.4, 5.3, 5.9];

/** Points (x, y) on a polar curve `r = f(θ)`, `r^{2} = f(θ)` or `θ = c`. */
function polarSamples(eq: string): Array<[number, number]> {
  const [l, r] = sides(polarTex(eq));
  const out: Array<[number, number]> = [];
  if (l.trim() === 't') {
    const c = evalReal(r);
    for (const rr of [-2.5, 1, 3.2]) out.push([rr * Math.cos(c), rr * Math.sin(c)]);
    return out;
  }
  expect(['r', 'r^{2}']).toContain(l.trim());
  for (const t of THETAS) {
    let v = realAt(r, { t });
    if (v === null) continue;
    if (l.trim() === 'r^{2}') {
      if (v < 0) continue;
      v = Math.sqrt(v);
    }
    out.push([v * Math.cos(t), v * Math.sin(t)]);
  }
  return out;
}

/** Name of the polar graph read off the equation's shape. */
function polarName(eq: string): string {
  const t = eq.replace(/\s+/g, ' ').trim();
  if (/^r\^\{2\} =/.test(t)) return 'Lemniscate';
  if (/^r = -?\d+$/.test(t)) return 'Circle';
  if (/^r = -?\d*\\(sin|cos)\\theta$/.test(t)) return 'Circle';
  const rose = /^r = -?\d*\\(sin|cos) (\d+)\\theta$/.exec(t);
  if (rose) {
    const n = Number(rose[2]);
    return `Rose curve with ${n % 2 ? n : 2 * n} petals`;
  }
  const lim = /^r = (\d+) [+-] (\d*)\\(sin|cos)\\theta$/.exec(t);
  expect(lim, `recognised polar equation ${t}`).toBeTruthy();
  const a = Number(lim![1]);
  const b = Number(lim![2] || '1');
  return a === b ? 'Cardioid' : a < b ? 'Limaçon with an inner loop' : a < 2 * b ? 'Dimpled limaçon' : 'Convex limaçon';
}

/** Check `r\\left(\\cos θ + i\\sin θ\\right)` shape: same angle twice, r > 0, θ in one turn. */
function expectTrigForm(tex: string, degrees: boolean): void {
  const t = tex.trim();
  const mm = /^(.*?)\\left\(\\cos ?(.+?) \+ i\\sin ?(.+?)\\right\)$/.exec(t) ?? /^()\\cos ?(.+?) \+ i\\sin ?(.+)$/.exec(t);
  expect(mm, `trigonometric form: ${t}`).toBeTruthy();
  expect(mm![2], `same angle in ${t}`).toBe(mm![3]);
  if (mm![1]) expect(evalReal(mm![1]!), `modulus of ${t}`).toBeGreaterThan(0);
  const a = evalReal(mm![2]!);
  expect(a >= -1e-12 && a < 2 * Math.PI - 1e-12, `angle of ${t} in one turn`).toBe(true);
  expect(mm![2]!.includes('^\\circ'), `${t}: angle unit`).toBe(degrees || a === 0 ? mm![2]!.includes('^\\circ') : false);
}

/** x(t), y(t) defined in the question. */
function paramDefs(q: string): { X: string; Y: string } {
  const X = defOf(q, 'x')!;
  const Y = defOf(q, 'y')!;
  expect(X && Y, q).toBeTruthy();
  return { X, Y };
}

function expectOnRect(eq: string, pts: Array<[number, number]>, what: string): void {
  const [l, r] = sides(eq);
  const resid = (x: number, y: number) => evalReal(l, { vars: { x, y } }) - evalReal(r, { vars: { x, y } });
  for (const [x, y] of pts) expect(Math.abs(resid(x, y)) < 1e-7 * Math.max(1, x * x + y * y), `${what}: (${x}, ${y}) on ${eq}`).toBe(true);
  expect([[0.37, 1.91], [-2.3, 0.77], [1.4, -3.2]].some(([x, y]) => Math.abs(resid(x!, y!)) > 1e-6), `${eq} is not an identity`).toBe(true);
}

export const VERIFIERS: Record<string, Verifier> = {
  /** Points of the parametric curve satisfy the rectangular equation (and its restriction). */
  'precalculus.eliminate'(p) {
    const { X, Y } = paramDefs(p.question);
    const pts: Array<[number, number]> = [];
    for (const t of [-2.3, -1.1, -0.4, 0.35, 0.9, 1.45, 2.2, 3.1]) {
      const x = realAt(X, { t });
      const y = realAt(Y, { t });
      if (x !== null && y !== null) pts.push([x, y]);
    }
    expect(pts.length).toBeGreaterThanOrEqual(4);
    const [eq, ...restr] = mathSegments(p.answer);
    expectOnRect(eq!, pts, p.question);
    for (const r of restr) for (const [x] of pts) expect(chainHolds(r, { x }), `${r} at x=${x}`).toBe(true);
  },

  /** Graph of a parametric curve: drawn points, endpoints, orientation and arrows. */
  'precalculus.paramGraph'(p) {
    const { X, Y } = paramDefs(p.question);
    const range = mathSegments(p.question).find((s) => s.includes('t \\le'))!;
    const [a, , b] = splitTop(range, ['\\le']).parts;
    const t0 = evalReal(a!);
    const t1 = evalReal(b!);
    const N = 800;
    const samp: Array<[number, number, number]> = [];
    for (let i = 0; i <= N; i++) {
      const t = t0 + ((t1 - t0) * i) / N;
      samp.push([t, evalReal(X, { vars: { t } }), evalReal(Y, { vars: { t } })]);
    }
    const nearest = (x: number, y: number) => samp.reduce((best, s) => (Math.hypot(s[1] - x, s[2] - y) < Math.hypot(best[1] - x, best[2] - y) ? s : best));
    const pts = curvePoints(p.answerDiagram);
    expect(pts.length).toBeGreaterThan(20);
    for (let i = 0; i < pts.length; i += 3) {
      const [x, y] = pts[i]!;
      const s = nearest(x, y);
      expect(Math.hypot(s[1] - x, s[2] - y) < 0.05, `(${x}, ${y}) on the parametric curve`).toBe(true);
    }
    const [eqPart, rest] = p.answer.split('; ');
    expectOnRect(mathSegments(eqPart!)[0]!, samp.filter((_, i) => i % 80 === 0).map((s) => [s[1], s[2]]), p.question);
    const marks = pointsIn(rest!);
    const start = samp[0]!;
    const fin = samp[N]!;
    expect(Math.abs(marks[0]![0]! - start[1]) < 0.006 && Math.abs(marks[0]![1]! - start[2]) < 0.006, `start point ${rest}`).toBe(true);
    if (/clockwise/.test(rest!)) {
      let area = 0;
      for (let i = 0; i < N; i++) area += samp[i]![1] * samp[i + 1]![2] - samp[i + 1]![1] * samp[i]![2];
      expect(/counterclockwise/.test(rest!), `orientation (signed area ${area})`).toBe(area > 0);
      expect(Math.hypot(fin[1] - start[1], fin[2] - start[2]) < 1e-6, 'closed curve').toBe(true);
    } else expect(Math.abs(marks[1]![0]! - fin[1]) < 0.006 && Math.abs(marks[1]![1]! - fin[2]) < 0.006, `end point ${rest}`).toBe(true);
    for (const it of p.answerDiagram!.items) {
      if (it.t !== 'arrow' || it.ink !== 'accent') continue;
      const s = nearest(it.from[0], it.from[1]);
      const h = 1e-4;
      const dx = evalReal(X, { vars: { t: s[0] + h } }) - evalReal(X, { vars: { t: s[0] - h } });
      const dy = evalReal(Y, { vars: { t: s[0] + h } }) - evalReal(Y, { vars: { t: s[0] - h } });
      expect(dx * (it.to[0] - it.from[0]) + dy * (it.to[1] - it.from[1]) > 0, 'arrow points with increasing t').toBe(true);
    }
  },

  /** Complex numbers in trigonometric form: value and requested form. */
  'precalculus.complex'(p) {
    const env: Record<string, C> = {};
    for (const s of mathSegments(p.question)) {
      const mm = /^([zw](?:_\d)?) = (.*)$/.exec(s.trim());
      if (mm) env[mm[1]!] = evaluate(mm[2]!);
    }
    const degrees = mathSegments(p.question).some((s) => s.includes('^\\circ')) || p.answer.includes('^\\circ');
    const trig = /trigonometric form/.test(p.question);
    const segs = mathSegments(p.answer);
    const task = p.check!.task as string;
    if (task === 'roots') {
      const n = { square: 2, cube: 3, fourth: 4, sixth: 6 }[/the (\w+) roots/.exec(p.question)![1]!]!;
      expect(segs.length, p.answer).toBe(n);
      const vals = segs.map((s) => {
        const [lhs, rhs] = splitTop(s, ['=']).parts;
        expect(lhs).toMatch(/^z_\d$/);
        expectTrigForm(rhs!, degrees);
        return evaluate(rhs!);
      });
      for (const v of vals) {
        let pw: C = { re: 1, im: 0 };
        for (let i = 0; i < n; i++) pw = { re: pw.re * v.re - pw.im * v.im, im: pw.re * v.im + pw.im * v.re };
        expect(closeC(pw, env.w!, 1e-9), `${p.answer}: root^${n} = w`).toBe(true);
      }
      vals.forEach((v, i) => vals.slice(i + 1).forEach((u) => expect(closeC(u, v, 1e-9), 'distinct roots').toBe(false)));
      return;
    }
    expect(segs.length).toBe(1);
    const ans = segs[0]!;
    let want: C;
    if (task === 'multiply' || task === 'divide') {
      const expr = mathSegments(p.question).find((s) => !s.includes('='))!;
      want = evaluate(expr, { vars: env });
    } else if (task === 'power') {
      const expr = mathSegments(p.question).find((s) => /^z\^\{\d+\}$/.test(s.trim()))!;
      want = evaluate(expr, { vars: env });
    } else want = env.z!;
    expect(closeC(evaluate(ans), want, 1e-9), `${p.question} → ${p.answer}`).toBe(true);
    if (trig) expectTrigForm(ans, degrees);
    else expect(ans).not.toMatch(/\\cos|\\sin/);
  },

  /** Graphed points satisfy the polar equation, the whole curve is drawn, and the name fits. */
  'precalculus.polarCurve'(p) {
    const eq = onlyMath(p.question);
    expect(p.answer).toBe(polarName(eq));
    const [l, r] = sides(polarTex(eq));
    const sq = l.trim() === 'r^{2}';
    const f = (t: number) => realAt(r, { t });
    const pts = curvePoints(p.answerDiagram);
    expect(pts.length).toBeGreaterThan(30);
    for (let i = 0; i < pts.length; i += 2) {
      const [x, y] = pts[i]!;
      const rho = Math.hypot(x, y);
      if (rho < 1e-6) continue;
      const phi = Math.atan2(y, x);
      const ok = sq ? close(f(phi) ?? NaN, rho * rho, 1e-6) : close(f(phi) ?? NaN, rho, 1e-6) || close(f(phi + Math.PI) ?? NaN, -rho, 1e-6);
      expect(ok, `point (${x}, ${y}) on ${eq}`).toBe(true);
    }
    for (const [x, y] of polarSamples(eq)) {
      expect(pts.some(([u, v]) => Math.hypot(u - x, v - y) < 0.25), `${eq}: curve passes near (${x}, ${y})`).toBe(true);
    }
  },

  /** A polar and a rectangular equation describe the same curve (sampled from the polar side). */
  'precalculus.polarEq'(p) {
    const eqs = [...mathSegments(p.question), ...mathSegments(p.answer)];
    const polar = eqs.find((e) => /\\theta|^r/.test(e.trim()))!;
    const rect = eqs.find((e) => e !== polar)!;
    expect(polar && rect, `${p.question} → ${p.answer}`).toBeTruthy();
    expect(rect).not.toMatch(/\\theta|\br\b/);
    const [l, r] = sides(rect);
    const resid = (x: number, y: number) => evalReal(l, { vars: { x, y } }) - evalReal(r, { vars: { x, y } });
    const pts = polarSamples(polar);
    expect(pts.length).toBeGreaterThanOrEqual(3);
    for (const [x, y] of pts) expect(Math.abs(resid(x, y)) < 1e-7 * Math.max(1, x * x + y * y), `(${x}, ${y}) from ${polar} on ${rect}`).toBe(true);
    // the rectangular equation is not an identity
    expect([[0.37, 1.91], [-2.3, 0.77], [1.4, -3.2]].some(([x, y]) => Math.abs(resid(x!, y!)) > 1e-6), rect).toBe(true);
  },

  /** (r, θ) ↔ (x, y): both points name the same location. */
  'precalculus.polarPoint'(p) {
    const q = pointsIn(p.question)[0]!;
    const a = pointsIn(p.answer)[0]!;
    const toPolar = p.check!.dir === 'toPolar';
    const [polar, rect] = toPolar ? [a, q] : [q, a];
    const tol = (p.check!.tol as number | undefined) ?? 1e-9;
    const x = polar[0]! * Math.cos(polar[1]!);
    const y = polar[0]! * Math.sin(polar[1]!);
    expect(Math.abs(x - rect[0]!) <= tol && Math.abs(y - rect[1]!) <= tol, `${p.question} → ${p.answer}`).toBe(true);
    if (toPolar) {
      expect(a[0]!, 'r > 0').toBeGreaterThan(0);
      expect(a[1]! >= -1e-12 && a[1]! < 2 * Math.PI - 1e-12, 'θ in [0, 2π)').toBe(true);
    }
  },

  'precalculus.vectors'(p) {
    const task = p.check!.task as string;
    const raw = vectorsIn(p.question) as Record<string, string[]>;
    const num = (name: string, env: Record<string, number> = {}) => raw[name]!.map((t) => evalReal(t, { vars: env }));
    const ans = mathSegments(p.answer);
    if (task === 'dot') {
      expect(close(evalReal(rhsOf(ans[0]!)), vdot(num('u'), num('v'))), p.answer).toBe(true);
    } else if (task === 'angle') {
      const u = num('u');
      const v = num('v');
      const want = (Math.acos(vdot(u, v) / Math.sqrt(vdot(u, u) * vdot(v, v))) * 180) / Math.PI;
      const { parts, rels } = splitTop(ans[0]!, ['=', '\\approx']);
      const got = evalReal(parts[1]!.replace(/\^\\circ/, ''));
      expect(Math.abs(got - want), p.answer).toBeLessThanOrEqual(rels[0] === '=' ? 1e-9 : 0.0500001);
    } else if (task === 'classify') {
      const u = num('u');
      const v = num('v');
      const n = (w: number[]) => Math.sqrt(vdot(w, w));
      const orth = Math.abs(vdot(u, v)) < 1e-9;
      const par = Math.abs(Math.abs(vdot(u, v)) - n(u) * n(v)) < 1e-9;
      expect(p.answer, p.question).toBe(orth && par ? 'Both parallel and orthogonal' : orth ? 'Orthogonal' : par ? 'Parallel' : 'Neither');
    } else if (task === 'findK') {
      const k = evalReal(rhsOf(ans[0]!));
      expect(Math.abs(vdot(num('u', { k }), num('v', { k }))) < 1e-9, `${p.question} at k=${k}`).toBe(true);
    } else {
      const u = num('u');
      const v = num('v');
      const s = vdot(u, v) / vdot(v, v);
      const got = listItems(rhsOf(ans[0]!).replace(/\\left\\langle|\\right\\rangle/g, '')).map((t) => evalReal(t));
      expect(got.length === v.length && got.every((g, i) => close(g, s * v[i]!)), p.answer).toBe(true);
    }
  },

  /** One-variable inequality; answer in interval notation or as inequalities. */
  'precalculus.solset'(p) {
    const q = onlyMath(p.question);
    const segs = mathSegments(p.answer);
    const interval = segs.length === 1 && /^\s*(\(|\[|\\\{|\\varnothing)/.test(segs[0]!);
    const inSet = interval ? intervalSet(segs[0]!) : (x: number) => setHolds(p.answer, 'x', x);
    const extra = (p.check!.probes as number[] | undefined) ?? [];
    for (const x of probesAround([...anchors(segs.join(', ')), ...extra])) {
      let qv: boolean;
      try {
        qv = chainHolds(q, { x });
      } catch {
        qv = false;
      }
      expect(qv, `${q} vs ${p.answer} at x=${x}`).toBe(inSet(x));
    }
  },

  /** Equivalent to the question and really decomposed into proper partial fractions. */
  'precalculus.partialFractions'(p) {
    const q = onlyMath(p.question);
    const a = onlyMath(p.answer);
    expectEquivalent(q, a, ['x']);
    const terms = splitTop(a, ['+', '-']).parts.filter((t) => t.trim());
    expect(terms.length, a).toBeGreaterThanOrEqual(2);
    const dens = new Set<string>();
    for (const t of terms) {
      const fr = fracParts(t);
      expect(fr, `term ${t} is a fraction`).toBeTruthy();
      const [n, d] = fr!;
      expect(d).toMatch(/x/);
      dens.add(d);
      const quadratic = /^x\^\{2\} \+ \d+$/.test(d);
      if (!quadratic) expect(n, `${t}: constant numerator over a linear factor`).not.toMatch(/x/);
    }
    expect(dens.size, 'distinct denominators').toBe(terms.length);
  },

  /** Asymptotes, holes, intercepts and graph of a rational function. */
  'precalculus.rationalGraph'(p) {
    const fTex = rhsOf(onlyMath(p.question));
    const f = (x: number) => realAt(fTex, { x });
    const parts = labelled(p.answer);
    const vas = parts['vertical asymptotes']!.map((s) => evalReal(rhsOf(s)));
    for (const a of vas) {
      expect(f(a), `undefined at x=${a}`).toBeNull();
      expect(Math.abs(f(a - 1e-7)!) > 1e4 && Math.abs(f(a + 1e-7)!) > 1e4, `${p.question}: blows up at x=${a}`).toBe(true);
    }
    const holes = pointsIn((p.answer.split('; ').find((s) => s.startsWith('Holes')) ?? '').replace(/^Holes:/, ''));
    for (const [x, y] of holes) {
      expect(f(x!), `hole at x=${x}`).toBeNull();
      expect(Math.abs(f(x! - 1e-7)! - y!) < 1e-4 && Math.abs(f(x! + 1e-7)! - y!) < 1e-4, `${p.question}: hole (${x}, ${y})`).toBe(true);
    }
    // nothing else is excluded
    const scan = new Map<number, number | null>();
    for (let n = -72; n <= 72; n++) scan.set(n, f(n / 6));
    for (let n = -72; n <= 72; n++) {
      const x = n / 6;
      if (scan.get(n) === null) expect([...vas, ...holes.map((h) => h[0]!)].some((v) => close(v, x)), `${p.question}: unlisted gap at x=${x}`).toBe(true);
    }
    const ha = parts['horizontal asymptote'] ?? parts['slant asymptote'];
    expect(ha, p.answer).toBeTruthy();
    const line = rhsOf(ha![0]!);
    if (parts['horizontal asymptote']) expect(line).not.toMatch(/x/);
    else expect(line).toMatch(/x/);
    for (const X of [1e7, -1e7]) expect(Math.abs(f(X)! - evalReal(line, { vars: { x: X } })), `${p.question}: asymptote ${line}`).toBeLessThan(1e-4);
    const xi = pointsIn((p.answer.split('; ').find((s) => s.startsWith('x-intercepts')) ?? '').replace(/^x-intercepts:/, ''));
    for (const [x, y] of xi) expect(y === 0 && f(x!) !== null && Math.abs(f(x!)!) < 1e-9, `${p.question}: x-intercept ${x}`).toBe(true);
    for (let n = -72; n <= 72; n++) {
      const v = scan.get(n)!;
      if (v !== null && Math.abs(v) < 1e-12) expect(xi.some(([x]) => close(x!, n / 6)), `${p.question}: unlisted zero at ${n / 6}`).toBe(true);
    }
    const yi = pointsIn((p.answer.split('; ').find((s) => s.startsWith('y-intercept')) ?? '').replace(/^y-intercept:/, ''));
    if (f(0) === null) expect(yi.length).toBe(0);
    else expect(yi.length === 1 && yi[0]![0] === 0 && close(yi[0]![1]!, f(0)!), `${p.question}: y-intercept`).toBe(true);
    curveOnGraph(p.answerDiagram, f, p.question, 3);
    for (const d of dotsOf(p.answerDiagram)) expect(d.open && holes.some(([x, y]) => close(x!, d.x) && close(y!, d.y)), 'dots mark holes').toBe(true);
  },

  /** (f∘g)(x) and its domain, against f and g as printed. */
  'precalculus.composition'(p) {
    const fns: Record<string, string> = { f: defOf(p.question, 'f(x)')!, g: defOf(p.question, 'g(x)')! };
    const op = /\((\w) \\circ (\w)\)\(x\)/.exec(p.answer)!;
    const outer = fns[op[1]!]!;
    const inner = fns[op[2]!]!;
    expect(p.question).toContain(op[0]);
    const comp = (x: number) => {
      const u = realAt(inner, { x });
      return u === null ? null : realAt(outer, { x: u });
    };
    const [expr, dom] = mathSegments(p.answer);
    const ans = rhsOf(expr!);
    expectDomain(comp, dom!, p.question);
    let checked = 0;
    for (const x of probesAround(anchors(dom!))) {
      const want = comp(x);
      if (want === null) continue;
      const got = realAt(ans, { x });
      expect(got !== null && close(got, want, 1e-7), `${ans} vs composite at x=${x}`).toBe(true);
      checked++;
    }
    expect(checked).toBeGreaterThan(3);
  },

  'precalculus.piecewiseEval'(p) {
    const rows = casesRows(p.question);
    const segs = mathSegments(p.answer);
    const asked = mathSegments(p.question).filter((s) => /^f\(|^f\\left\(/.test(s) && !s.includes('='));
    expect(segs.length, p.answer).toBe(asked.length);
    for (const s of segs) {
      const mm = /^f(?:\\left)?\((.*?)(?:\\right)?\) = (.*)$/.exec(s)!;
      expect(mm, s).toBeTruthy();
      const x = evalReal(mm[1]!);
      expect(close(evalReal(mm[2]!), piecewiseAt(rows, x)), `${p.question}: ${s}`).toBe(true);
    }
  },

  'precalculus.piecewiseGraph'(p) {
    const rows = casesRows(p.question);
    const pts = curvePoints(p.answerDiagram);
    expect(pts.length).toBeGreaterThan(10);
    for (const [x, y] of pts) {
      const on = (list: Row[]) => list.some((r) => close(evalReal(r.expr, { vars: { x } }), y, 1e-9));
      expect(on(rowsHolding(rows, x)) || on([...rowsHolding(rows, x - 1e-7), ...rowsHolding(rows, x + 1e-7)]), `point (${x}, ${y}) on a piece`).toBe(true);
    }
    const dots = dotsOf(p.answerDiagram);
    for (const d of dots) {
      const fx = piecewiseAt(rows, d.x);
      if (d.open) {
        expect(close(fx, d.y), `open dot (${d.x}, ${d.y}) is not a value`).toBe(false);
        expect(rows.some((r) => close(evalReal(r.expr, { vars: { x: d.x } }), d.y)), `open dot (${d.x}, ${d.y}) ends a piece`).toBe(true);
      } else expect(close(fx, d.y), `closed dot (${d.x}, ${d.y})`).toBe(true);
    }
    // every breakpoint of the definition has its value marked
    for (const r of rows) {
      for (const t of splitTop(r.cond, ['<', '\\le', '>', '\\ge']).parts) {
        if (t.trim() === 'x') continue;
        const b = evalReal(t);
        expect(dots.some((d) => !d.open && close(d.x, b) && close(d.y, piecewiseAt(rows, b))), `closed dot at x=${b}`).toBe(true);
      }
    }
    const [closedPart, openPart] = p.answer.split('; ');
    const want = (open: boolean) => dots.filter((d) => d.open === open).map((d) => [d.x, d.y]);
    expect(pointsIn(closedPart!), p.answer).toEqual(want(false));
    expect(pointsIn(openPart!), p.answer).toEqual(want(true));
  },

  /** g(x) = a·f(b(x − h)) + k against a verbal description of the transformations. */
  'precalculus.transform'(p) {
    const fTex = defOf(p.question, 'f(x)')!;
    const write = /g\(x\) =/.test(p.answer);
    const gTex = defOf(write ? p.answer : p.question, 'g(x)')!;
    const text = write ? p.question : p.answer;
    expect(fTex && gTex, `${p.question} → ${p.answer}`).toBeTruthy();
    let a = 1;
    let b = 1;
    let h = 0;
    let k = 0;
    if (/reflection across the \$x\$-axis/i.test(text)) a = -a;
    if (/reflection across the \$y\$-axis/i.test(text)) b = -b;
    for (const mm of text.matchAll(/(vertical|horizontal) (stretch|compression) by a factor of \$([^$]+)\$/gi)) {
      const v = evalReal(mm[3]!);
      expect(mm[2]!.toLowerCase() === 'stretch' ? v > 1 : v < 1, `${mm[0]}: wording matches the factor`).toBe(true);
      if (mm[1]!.toLowerCase() === 'vertical') a *= v;
      else b /= v;
    }
    for (const mm of text.matchAll(/shift \$(\d+)\$ units? (left|right|up|down)/gi)) {
      const v = Number(mm[1]);
      if (mm[2] === 'left') h -= v;
      else if (mm[2] === 'right') h += v;
      else if (mm[2] === 'down') k -= v;
      else k += v;
    }
    let matched = 0;
    for (const x of [-11.3, -9.6, -8.1, -6.4, -4.3, -2.7, -1.3, 0.6, 1.7, 3.1, 4.4, 5.9, 7.2, 8.8, 10.3, 11.7]) {
      const inner = realAt(fTex, { x: b * (x - h) });
      const want = inner === null ? null : a * inner + k;
      const got = realAt(gTex, { x });
      expect(got === null, `${gTex} defined at ${x}`).toBe(want === null);
      if (got !== null) {
        expect(close(got, want!, 1e-9), `${text} vs g = ${gTex} at x=${x}`).toBe(true);
        matched++;
      }
    }
    expect(matched).toBeGreaterThanOrEqual(3);
    if (p.answerDiagram) curveOnGraph(p.answerDiagram, (x) => realAt(gTex, { x }), p.question);
  },

  /** Even / odd / neither, by comparing f(−x) and f(x) numerically. */
  'precalculus.parity'(p) {
    const fTex = rhsOf(onlyMath(p.question));
    let even = true;
    let odd = true;
    for (const x of [0.7, 1.3, 2.1, 2.9, 3.6]) {
      const a = realAt(fTex, { x });
      const b = realAt(fTex, { x: -x });
      if (a === null || b === null) {
        even = odd = false;
        break;
      }
      if (!close(a, b, 1e-9)) even = false;
      if (!close(a, -b, 1e-9)) odd = false;
    }
    const want = even && odd ? 'Both even and odd' : even ? 'Even' : odd ? 'Odd' : 'Neither';
    expect(p.answer, p.question).toBe(want);
  },

  /** Domain / range in interval notation of `f(x) = …`. */
  'precalculus.domainRange'(p) {
    const fTex = rhsOf(onlyMath(p.question));
    const f = (x: number) => realAt(fTex, { x });
    const parts = labelled(p.answer);
    expect(parts.domain || parts.range, p.answer).toBeTruthy();
    if (parts.domain) expectDomain(f, parts.domain[0]!, p.question);
    if (parts.range) expectRange(f, parts.range[0]!, (p.check!.hints as number[]) ?? [], p.question);
  },
};

export { chainHolds, close, closeC, curvePoints, evalReal, expectEquivalent, listItems, setHolds, sides };
export type { C, Diagram, DiagramItem, ProblemContent };
