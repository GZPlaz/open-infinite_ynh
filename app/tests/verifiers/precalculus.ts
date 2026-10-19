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

export const VERIFIERS: Record<string, Verifier> = {
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
