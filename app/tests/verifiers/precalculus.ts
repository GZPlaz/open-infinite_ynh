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
  for (const piece of splitTop(tex.replace(/\\left|\\right/g, ''), ['\\cup', ',', '<', '>', '\\le', '\\ge', '=', '\\text{ or }', '\\text{ and }']).parts) {
    const s = piece.replace(/^[([]|[)\]]$/g, '').replace(/^\\\{|\\\}$/g, '').trim();
    if (!s || /infty|[a-z]$/.test(s)) continue;
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
  return [...points.flatMap((b) => [b - 2.3, b - 0.4, b - 1e-4, b, b + 1e-4, b + 0.4, b + 2.3]), ...GRID];
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

export const VERIFIERS: Record<string, Verifier> = {
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
