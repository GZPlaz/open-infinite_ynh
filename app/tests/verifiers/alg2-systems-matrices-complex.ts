/** Verifiers for the alg2-systems-matrices-complex pack (3-variable systems, matrices, complex numbers). */
import { expect } from 'vitest';
import type { Diagram } from '../../src/engine/diagram';
import type { ProblemContent } from '../../src/engine/types';
import { close, closeC, evalReal, evaluate, listItems, mathSegments, onlyMath, splitTop, type C } from '../evaluator';
import type { Verifier } from '../verify';

const P = 'alg2-systems-matrices-complex';

// ---------------------------------------------------------------- matrices

type M = number[][];

const MATRIX_RE = /\\begin\{([bvp]matrix)\}(.*?)\\end\{\1\}/g;

function parseCells(body: string): M {
  return body.split('\\\\').map((row) => row.split('&').map((cell) => evalReal(cell.trim())));
}

/** All matrices (any bracket style) in a TeX string, in order. */
function matricesIn(tex: string): Array<{ env: string; m: M }> {
  return [...tex.matchAll(MATRIX_RE)].map((mm) => ({ env: mm[1]!, m: parseCells(mm[2]!) }));
}

const mmul = (a: M, b: M): M => a.map((r) => b[0]!.map((_, j) => r.reduce((s, x, k) => s + x * b[k]![j]!, 0)));
const madd = (a: M, b: M, s = 1): M => a.map((r, i) => r.map((x, j) => x + s * b[i]![j]!));
const mscale = (a: M, k: number): M => a.map((r) => r.map((x) => k * x));
const sameDims = (a: M, b: M) => a.length === b.length && a[0]!.length === b[0]!.length;

function mdet(a: M): number {
  if (a.length === 1) return a[0]![0]!;
  return a[0]!.reduce((s, x, j) => s + (j % 2 ? -1 : 1) * x * mdet(a.slice(1).map((r) => r.filter((_, c) => c !== j))), 0);
}

/** Inverse by Gauss–Jordan (numeric). */
function minv(a: M): M {
  const n = a.length;
  const w = a.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(w[r]![c]!) > Math.abs(w[p]![c]!)) p = r;
    [w[c], w[p]] = [w[p]!, w[c]!];
    const piv = w[c]![c]!;
    if (Math.abs(piv) < 1e-12) throw new Error('singular');
    w[c] = w[c]!.map((x) => x / piv);
    for (let r = 0; r < n; r++) if (r !== c) w[r] = w[r]!.map((x, j) => x - w[r]![c]! * w[c]![j]!);
  }
  return w.map((r) => r.slice(n));
}

function expectMatrix(actual: M, expected: M, what: string): void {
  expect(actual.length, `${what}: rows`).toBe(expected.length);
  actual.forEach((r, i) => {
    expect(r.length, `${what}: columns`).toBe(expected[i]!.length);
    r.forEach((x, j) => expect(close(x, expected[i]![j]!), `${what}: entry (${i + 1}, ${j + 1}) = ${x}, want ${expected[i]![j]}`).toBe(true));
  });
}

class Undefined extends Error {}

/**
 * Evaluate a matrix expression such as `3A - 2B`, `AB + C`, `\frac{1}{2}A`,
 * `A^{-1}` where the matrices are written out. `X` may be bound to a matrix.
 * Throws Undefined on a dimension mismatch.
 */
function evalMatrixExpr(tex: string, X?: M): M {
  const mats: M[] = [];
  let s = tex.replace(MATRIX_RE, (_, _env, body: string) => {
    mats.push(parseCells(body));
    return ` §${mats.length - 1}§ `;
  });
  if (X) s = s.replace(/X/g, () => {
    mats.push(X);
    return ` §${mats.length - 1}§ `;
  });
  s = s.replace(/§(\d+)§\s*\^\{-1\}/g, (_, i: string) => {
    mats.push(minv(mats[Number(i)]!));
    return ` §${mats.length - 1}§ `;
  });
  // split into top-level signed terms
  const terms: Array<{ sign: number; body: string }> = [];
  let depth = 0;
  let cur = '';
  let sign = 1;
  for (const ch of s) {
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    if (depth === 0 && (ch === '+' || ch === '-')) {
      if (cur.trim()) {
        terms.push({ sign, body: cur.trim() });
        sign = ch === '-' ? -1 : 1;
      } else sign *= ch === '-' ? -1 : 1;
      cur = '';
      continue;
    }
    cur += ch;
  }
  terms.push({ sign, body: cur.trim() });
  let total: M | null = null;
  for (const t of terms) {
    const mm = /^(.*?)((?:\s*§\d+§\s*)+)$/.exec(t.body);
    expect(mm, `matrix term in ${tex}: ${t.body}`).toBeTruthy();
    const k = (mm![1]!.trim() ? evalReal(mm![1]!.trim()) : 1) * t.sign;
    const factors = [...mm![2]!.matchAll(/§(\d+)§/g)].map((x) => mats[Number(x[1])]!);
    let prod = factors[0]!;
    for (const f of factors.slice(1)) {
      if (prod[0]!.length !== f.length) throw new Undefined('inner dimensions');
      prod = mmul(prod, f);
    }
    prod = mscale(prod, k);
    if (total && !sameDims(total, prod)) throw new Undefined('dimensions');
    total = total ? madd(total, prod) : prod;
  }
  return total!;
}

function isUndefined(f: () => unknown): boolean {
  try {
    f();
    return false;
  } catch (e) {
    if (e instanceof Undefined) return true;
    throw e;
  }
}

function answerMatrix(p: ProblemContent): M {
  const ms = matricesIn(onlyMath(p.answer));
  expect(ms.length, `one matrix in ${p.answer}`).toBe(1);
  return ms[0]!.m;
}

const identity = (n: number): M => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));

// ---------------------------------------------------------------- transformations

type T = { k: string; h?: number; v?: number; axis?: string; deg?: number; s?: number; den?: number };

function applyT(t: T, V: M): M {
  if (t.k === 'translate') return [V[0]!.map((x) => x + t.h!), V[1]!.map((y) => y + t.v!)];
  if (t.k === 'dilate') return mscale(V, t.s! / t.den!);
  const pt = (f: (x: number, y: number) => [number, number]) => {
    const out: M = [[], []];
    V[0]!.forEach((x, j) => {
      const [a, b] = f(x, V[1]![j]!);
      out[0]!.push(a);
      out[1]!.push(b);
    });
    return out;
  };
  if (t.k === 'rotate') {
    const r = (t.deg! * Math.PI) / 180;
    return pt((x, y) => [Math.round(x * Math.cos(r) - y * Math.sin(r)), Math.round(x * Math.sin(r) + y * Math.cos(r))]);
  }
  const phi = t.axis === 'x' ? 0 : t.axis === 'y' ? Math.PI / 2 : t.axis === 'y=x' ? Math.PI / 4 : -Math.PI / 4;
  return pt((x, y) => [Math.round(x * Math.cos(2 * phi) + y * Math.sin(2 * phi)), Math.round(x * Math.sin(2 * phi) - y * Math.cos(2 * phi))]);
}

function describedIn(q: string, t: T): boolean {
  if (t.k === 'translate') {
    const okH = t.h === 0 || q.includes(`${Math.abs(t.h!)} unit${Math.abs(t.h!) === 1 ? '' : 's'} ${t.h! > 0 ? 'right' : 'left'}`);
    const okV = t.v === 0 || q.includes(`${Math.abs(t.v!)} unit${Math.abs(t.v!) === 1 ? '' : 's'} ${t.v! > 0 ? 'up' : 'down'}`);
    return /translation/.test(q) && okH && okV;
  }
  if (t.k === 'reflect') return q.includes(t.axis === 'x' ? '$x$-axis' : t.axis === 'y' ? '$y$-axis' : t.axis === 'y=x' ? '$y = x$' : '$y = -x$');
  if (t.k === 'rotate') return q.includes(`$${t.deg}^\\circ$ counterclockwise`);
  const f = t.den === 1 ? String(t.s) : `\\frac{${t.s}}{${t.den}}`;
  return q.includes(`scale factor of $${f}$`);
}

// ---------------------------------------------------------------- systems

/** Rows of an aligned system as [coefficients…, constant] for the given variables. */
function systemRows(question: string, vars: string[]): number[][] {
  const rows = onlyMath(question)
    .replace(/\\begin\{aligned\}|\\end\{aligned\}/g, '')
    .split('\\\\')
    .map((r) => r.replace(/&/g, '').trim())
    .filter(Boolean);
  return rows.map((r) => {
    const { parts, rels } = splitTop(r, ['=']);
    expect(rels.length).toBe(1);
    const f = (env: Record<string, number>) => evalReal(parts[0]!, { vars: env }) - evalReal(parts[1]!, { vars: env });
    const zero = Object.fromEntries(vars.map((v) => [v, 0]));
    const f0 = f(zero);
    const coefs = vars.map((v) => f({ ...zero, [v]: 1 }) - f0);
    // linearity spot check
    const probe = Object.fromEntries(vars.map((v, i) => [v, 1.3 + i * 0.7]));
    expect(close(f(probe), coefs.reduce((s, c, i) => s + c * probe[vars[i]!]!, f0)), `linear row ${r}`).toBe(true);
    return [...coefs, -f0];
  });
}

function rank(rows: number[][]): number {
  const a = rows.map((r) => [...r]);
  let rk = 0;
  const cols = a[0]!.length;
  for (let c = 0; c < cols && rk < a.length; c++) {
    let p = rk;
    for (let r = rk + 1; r < a.length; r++) if (Math.abs(a[r]![c]!) > Math.abs(a[p]![c]!)) p = r;
    if (Math.abs(a[p]![c]!) < 1e-9) continue;
    [a[rk], a[p]] = [a[p]!, a[rk]!];
    for (let r = 0; r < a.length; r++) {
      if (r === rk) continue;
      const f = a[r]![c]! / a[rk]![c]!;
      a[r] = a[r]!.map((x, j) => x - f * a[rk]![j]!);
    }
    rk++;
  }
  return rk;
}

/** Numbers of the tuples `(a, b, c)` appearing in a TeX string. */
function tuplesIn(tex: string): number[][] {
  return [...tex.matchAll(/\\left\(((?:(?!\\right\)).)*)\\right\)/g)].map((mm) => listItems(`(${mm[1]})`).map((t) => evalReal(t)));
}

// ---------------------------------------------------------------- figures

function accentDots(d: Diagram | undefined): Array<readonly [number, number]> {
  return (d?.items ?? []).filter((it) => it.t === 'dot' && it.ink === 'accent').map((it) => (it as { p: readonly [number, number] }).p);
}

/** Oblique projection used by the 3D figures (must mirror src/engine/topics/algebra2/sys3/space.ts). */
export function project3(x: number, y: number, z: number): [number, number] {
  const k = 0.5 * Math.SQRT1_2;
  return [y - k * x, z - k * x];
}

// ---------------------------------------------------------------- complex

/** Value after the last top-level '=' / '\approx' of the single answer math segment. */
function lastValue(rich: string): { tex: string; approx: boolean } {
  const { parts, rels } = splitTop(onlyMath(rich), ['=', '\\approx']);
  return { tex: parts[parts.length - 1]!, approx: rels[rels.length - 1] === '\\approx' };
}

/** Denominators of every \frac in a TeX string. */
function denominators(tex: string): string[] {
  const out: string[] = [];
  let i = tex.indexOf('\\frac');
  while (i >= 0) {
    let j = i + 5;
    const group = () => {
      while (tex[j] === ' ') j++;
      expect(tex[j], `braced \\frac argument in ${tex}`).toBe('{');
      let depth = 0;
      const start = j;
      do {
        if (tex[j] === '{') depth++;
        else if (tex[j] === '}') depth--;
        j++;
      } while (depth > 0);
      return tex.slice(start + 1, j - 1);
    };
    group();
    out.push(group());
    i = tex.indexOf('\\frac', i + 5);
  }
  return out;
}

function squareFree(tex: string): boolean {
  return [...tex.matchAll(/\\sqrt\{(\d+)\}/g)].every((mm) => {
    const n = Number(mm[1]);
    for (let f = 2; f * f <= n; f++) if (n % (f * f) === 0) return false;
    return n > 1;
  });
}

const OCTANTS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

function octantOf([x, y, z]: number[]): string {
  const zeros = [x, y, z].filter((v) => v === 0).length;
  if (zeros === 3) return 'origin';
  if (zeros === 2) return x !== 0 ? 'x-axis' : y !== 0 ? 'y-axis' : 'z-axis';
  if (zeros === 1) return x === 0 ? 'yz-plane' : y === 0 ? 'xz-plane' : 'xy-plane';
  const top = ['+++', '-++', '--+', '+-+'];
  const key = `${x! > 0 ? '+' : '-'}${y! > 0 ? '+' : '-'}`;
  const idx = top.findIndex((s) => s.startsWith(key));
  return `Octant ${OCTANTS[idx + (z! > 0 ? 0 : 4)]}`;
}

export const VERIFIERS: Record<string, Verifier> = {
  [`${P}.det`](p) {
    const ms = matricesIn(onlyMath(p.question));
    expect(ms.length).toBe(1);
    expect(ms[0]!.env).toBe('vmatrix');
    expect(close(evalReal(onlyMath(p.answer)), mdet(ms[0]!.m)), `${p.question} → ${p.answer}`).toBe(true);
  },

  [`${P}.inverse`](p) {
    const q = onlyMath(p.question);
    expect(q).toMatch(/\^\{-1\}$/);
    const A = matricesIn(q)[0]!.m;
    if (p.answer === 'No inverse') {
      expect(Math.abs(mdet(A)), `${p.question} should be singular`).toBeLessThan(1e-9);
      return;
    }
    expectMatrix(mmul(A, answerMatrix(p)), identity(A.length), `${p.question} · ${p.answer}`);
  },

  [`${P}.matrixExpr`](p) {
    const q = onlyMath(p.question);
    if (p.answer === 'Undefined') {
      expect(isUndefined(() => evalMatrixExpr(q)), `${q} should be undefined`).toBe(true);
      return;
    }
    expectMatrix(answerMatrix(p), evalMatrixExpr(q), q);
  },

  [`${P}.matrixEq`](p) {
    const q = onlyMath(p.question);
    const a = onlyMath(p.answer);
    expect(a.startsWith('X = '), a).toBe(true);
    const X = answerMatrix(p);
    const sides = q.split(' = ');
    expect(sides.length, q).toBe(2);
    const [l, r] = sides;
    expectMatrix(evalMatrixExpr(l!, X), evalMatrixExpr(r!, X), `${q} with ${a}`);
  },

  [`${P}.transform`](p) {
    const ts = p.check!.transforms as T[];
    const V = matricesIn(mathSegments(p.question).join(' '))[0]!.m;
    expect(V.length).toBe(2);
    ts.forEach((t) => expect(describedIn(p.question, t), `${p.question} describes ${JSON.stringify(t)}`).toBe(true));
    const want = ts.reduce((cur, t) => applyT(t, cur), V);
    expectMatrix(answerMatrix(p), want, p.question);
    if (p.answerDiagram) {
      const paths = p.answerDiagram.items.filter((it) => it.t === 'path' && it.closed && it.ink === 'accent');
      expect(paths.length).toBe(1);
      const pts = (paths[0] as unknown as { pts: number[][] }).pts;
      pts.forEach((pt, j) => expect(close(pt[0]!, want[0]![j]!) && close(pt[1]!, want[1]![j]!)).toBe(true));
    }
  },

  /**
   * Linear system in x, y, z read from the question. Unique answers satisfy
   * every row and the coefficient matrix is invertible; "No solution" /
   * "Infinitely many solutions" are checked against the ranks.
   */
  [`${P}.system3`](p) {
    const vars = (p.check!.vars as string[] | undefined) ?? ['x', 'y', 'z'];
    const rows = systemRows(p.question, vars);
    const coef = rows.map((r) => r.slice(0, vars.length));
    const rA = rank(coef);
    const rAug = rank(rows);
    if (/no solution/i.test(p.answer)) {
      expect(rA, `${p.question}: inconsistent`).toBeLessThan(rAug);
    } else if (/infinitely many/i.test(p.answer)) {
      expect(rA === rAug && rA < vars.length, `${p.question}: dependent`).toBe(true);
    } else {
      expect(rA, `${p.question}: unique`).toBe(vars.length);
      const t = tuplesIn(onlyMath(p.answer));
      expect(t.length).toBe(1);
      expect(t[0]!.length).toBe(vars.length);
      rows.forEach((r) => expect(close(r.slice(0, -1).reduce((s, c, i) => s + c * t[0]![i]!, 0), r[r.length - 1]!), `${p.question} at ${p.answer}`).toBe(true));
    }
  },

  /** Points in space: distance, midpoint, endpoint, octant (with optional plotted figure). */
  [`${P}.space`](p) {
    const task = p.check!.task as string;
    const pts = tuplesIn(mathSegments(p.question).join(' '));
    if (task === 'octant') {
      expect(pts.length).toBe(1);
      const where = octantOf(pts[0]!);
      const ans = p.answer.replace(/\$/g, '').replace(/^On the /, '');
      expect(ans, `${p.question} → ${p.answer}`).toBe(where);
      if (p.answerDiagram) {
        const dots = accentDots(p.answerDiagram);
        expect(dots.length).toBe(1);
        const [x, y, z] = pts[0]!;
        const [px, py] = project3(x!, y!, z!);
        expect(close(dots[0]![0], px) && close(dots[0]![1], py), 'plotted point').toBe(true);
      }
      return;
    }
    expect(pts.length).toBe(2);
    const [A, B] = pts as [number[], number[]];
    if (task === 'distance') {
      const want = Math.hypot(B[0]! - A[0]!, B[1]! - A[1]!, B[2]! - A[2]!);
      const { tex, approx } = lastValue(p.answer);
      const got = evalReal(tex);
      if (approx) expect(Math.abs(got - want), `${p.answer} vs ${want}`).toBeLessThanOrEqual(0.0500001);
      else {
        expect(close(got, want, 1e-9), `${p.answer} vs ${want}`).toBe(true);
        expect(squareFree(tex), `simplest radical form: ${tex}`).toBe(true);
      }
      return;
    }
    const got = tuplesIn(onlyMath(p.answer));
    expect(got.length).toBe(1);
    // midpoint: answer = (A + B)/2; endpoint: the question gives an endpoint A and midpoint B
    const want = task === 'midpoint' ? A.map((a, i) => (a + B[i]!) / 2) : A.map((a, i) => 2 * B[i]! - a);
    got[0]!.forEach((g, i) => expect(close(g, want[i]!), `${p.question} → ${p.answer}`).toBe(true));
  },

  /** Planes ax + by + cz = d: intercepts, which points lie on it, equation from intercepts. */
  [`${P}.plane`](p) {
    const task = p.check!.task as string;
    const plane = (eq: string) => {
      const rows = systemRows(`$${eq}$`, ['x', 'y', 'z']);
      return rows[0]!;
    };
    const on = (pl: number[], pt: number[]) => close(pl[0]! * pt[0]! + pl[1]! * pt[1]! + pl[2]! * pt[2]!, pl[3]!);
    const sketchOk = (pl: number[]) => {
      if (!p.answerDiagram) return;
      const polys = p.answerDiagram.items.filter((it) => it.t === 'path' && it.closed && it.fill === 'accent');
      expect(polys.length, 'one sketched plane').toBe(1);
      const k = 0.5 * Math.SQRT1_2;
      for (const [X, Y] of (polys[0] as unknown as { pts: number[][] }).pts as [number, number][]) {
        // invert the oblique projection for points on an axis
        const pt = close(Y, 0) ? [0, X, 0] : close(X, 0) ? [0, 0, Y] : [-X / k, 0, 0];
        if (!close(Y, 0) && !close(X, 0)) expect(close(X, Y), 'vertex on the x-axis').toBe(true);
        expect(on(pl, pt), `sketch vertex ${pt.join(', ')} on the plane`).toBe(true);
      }
    };
    if (task === 'intercepts') {
      const eq = mathSegments(p.question).find((s) => s.includes('='))!;
      const pl = plane(eq);
      const segs = p.answer.split(/,\s*(?=\$[xyz]\$-intercept)/);
      expect(segs.length).toBe(3);
      ['x', 'y', 'z'].forEach((v, i) => {
        const seg = segs[i]!;
        expect(seg.startsWith(`$${v}$-intercept`), seg).toBe(true);
        const t = tuplesIn(mathSegments(seg).join(' '));
        if (/none/i.test(seg)) {
          expect(t.length).toBe(0);
          expect(close(pl[i]!, 0), `${eq}: no ${v}-intercept`).toBe(true);
        } else {
          expect(t.length).toBe(1);
          expect(on(pl, t[0]!), `${seg} on ${eq}`).toBe(true);
          t[0]!.forEach((c, j) => j !== i && expect(c).toBe(0));
        }
      });
      sketchOk(pl);
    } else if (task === 'contains') {
      const eq = mathSegments(p.question).find((s) => s.includes('='))!;
      const pl = plane(eq);
      const named = [...p.question.matchAll(/\$([A-Z])\\left\(([^$]*)\\right\)\$/g)].map((mm) => ({ name: mm[1]!, pt: listItems(`(${mm[2]})`).map((t) => evalReal(t)) }));
      expect(named.length).toBe(3);
      const want = named.filter((n) => on(pl, n.pt)).map((n) => n.name);
      const got = /none/i.test(p.answer) ? [] : /all three/i.test(p.answer) ? named.map((n) => n.name) : [...p.answer.matchAll(/\$([A-Z])\$/g)].map((mm) => mm[1]!);
      expect(got.sort(), `${p.question} → ${p.answer}`).toEqual(want.sort());
    } else {
      // equation through the given intercepts
      const ints = [...p.question.matchAll(/\$([xyz])\$-intercept \$(-?[^$]+)\$/g)].map((mm) => ({ v: mm[1]!, val: evalReal(mm[2]!) }));
      expect(ints.length).toBe(3);
      const pl = plane(onlyMath(p.answer));
      expect(pl.slice(0, 3).some((c) => !close(c, 0))).toBe(true);
      ints.forEach(({ v, val }) => {
        const pt = ['x', 'y', 'z'].map((w) => (w === v ? val : 0));
        expect(on(pl, pt), `${p.answer} through ${v}-intercept ${val}`).toBe(true);
      });
      sketchOk(pl);
      const coefs = pl.slice(0, 4);
      coefs.forEach((c) => expect(Number.isInteger(Math.round(c * 1e9) / 1e9), `integer coefficients in ${p.answer}`).toBe(true));
    }
  },

  /** Complex plane: plotted dots match the question's number(s), or the answer names the plotted point. */
  [`${P}.cplane`](p) {
    const task = p.check!.task as string;
    if (task === 'plot') {
      const z = evaluate(onlyMath(p.question));
      const dots = accentDots(p.answerDiagram);
      expect(dots.length).toBe(1);
      expect(close(dots[0]![0], z.re) && close(dots[0]![1], z.im), `dot for ${p.question}`).toBe(true);
      const t = tuplesIn(allOf(p.answer));
      expect(t.length).toBe(1);
      expect(close(t[0]![0]!, z.re) && close(t[0]![1]!, z.im), p.answer).toBe(true);
    } else {
      const dots = (p.diagram?.items ?? []).filter((it) => it.t === 'dot');
      expect(dots.length).toBe(1);
      const [x, y] = (dots[0] as unknown as { p: [number, number] }).p;
      const z = evaluate(onlyMath(p.answer));
      expect(closeC(z, { re: x, im: y }), `${p.answer} vs dot (${x}, ${y})`).toBe(true);
    }
  },

  /** |z|: exact (simplest radical form) or rounded to the tenth. */
  [`${P}.cabs`](p) {
    const q = onlyMath(p.question);
    const want = evalReal(q);
    const { tex, approx } = lastValue(p.answer);
    const got = evalReal(tex);
    if (approx) expect(Math.abs(got - want), `${q} → ${p.answer}`).toBeLessThanOrEqual(0.0500001);
    else {
      expect(close(got, want, 1e-9), `${q} → ${p.answer}`).toBe(true);
      expect(squareFree(tex), `simplest radical form: ${tex}`).toBe(true);
      expect(tex).not.toMatch(/i/);
    }
  },

  /** Rationalized quotient: same value as the question and no radical or i in any denominator. */
  [`${P}.rationalize`](p) {
    const q = onlyMath(p.question);
    const a = lastValue(p.answer).tex;
    expect(closeC(evaluate(q), evaluate(a), 1e-9), `${q} → ${a}`).toBe(true);
    denominators(a).forEach((d) => expect(/\\sqrt|i/.test(d), `rational denominator in ${a}`).toBe(false));
    expect(squareFree(a), `simplified radicals in ${a}`).toBe(true);
    // a lone radical or i must not divide anything either
    expect(/\/|\\div/.test(a)).toBe(false);
  },

  /** Complex arithmetic: value check plus standard form a + bi (no i powers, no parentheses). */
  [`${P}.complex`](p) {
    const q = evaluate(onlyMath(p.question));
    const a = onlyMath(p.answer);
    const z: C = evaluate(a);
    expect(closeC(q, z, 1e-9), `${p.question} → ${p.answer}`).toBe(true);
    expect(/\^|\(|\\sqrt/.test(a), `standard form: ${a}`).toBe(false);
  },
};

function allOf(rich: string): string {
  return mathSegments(rich).join(' ');
}
