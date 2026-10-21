/** Verifiers for the alg2-radicals-rational pack (radicals, rational exponents, rational expressions). */
import { expect } from 'vitest';
import type { ProblemContent } from '../../src/engine/types';
import { close, closeC, evaluate, evalReal, listItems, mathSegments, onlyMath, RELATIONS, splitTop, type C } from '../evaluator';
import { answerValues, curvePoints, expectEquivalent, rhs, satisfies, setHolds, sides, VERIFIERS as GENERIC, type Verifier } from '../verify';

const P = 'alg2-radicals-rational';
const NO_SOLUTION = /no solution|no real solution/i;

/**
 * Two rational expressions agree at sample points. Points where either side blows up
 * (a pole, or a sample that lands on one in floating point) are skipped.
 */
function expectEquivalentAwayFromPoles(a: string, b: string, v: string): void {
  let compared = 0;
  for (const x of [-4.3, -2.7, -1.3, 0.6, 1.7, 3.1, 5.2, 7.9]) {
    const ya = evaluate(a, { vars: { [v]: x } });
    const yb = evaluate(b, { vars: { [v]: x } });
    const big = (c: C) => !Number.isFinite(c.re) || !Number.isFinite(c.im) || Math.hypot(c.re, c.im) > 1e6;
    if (big(ya) || big(yb)) continue;
    compared++;
    expect(closeC(ya, yb, 1e-7), `${a}  vs  ${b}  at ${v} = ${x}`).toBe(true);
  }
  expect(compared, `${a} vs ${b}: too few comparable sample points`).toBeGreaterThanOrEqual(4);
}

/** Brace-matched argument starting at s[i] === '{'; returns [content, index after]. */
function braced(s: string, i: number): [string, number] {
  expect(s[i], `brace at ${i} in ${s}`).toBe('{');
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === '{') depth++;
    else if (s[j] === '}') {
      depth--;
      if (depth === 0) return [s.slice(i + 1, j), j + 1];
    }
  }
  throw new Error(`unbalanced braces in ${s}`);
}

/** All (numerator, denominator) pairs of \frac / \dfrac in a TeX string. */
function fractions(s: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const re = /\\d?frac(?=\{)/g;
  let mm: RegExpExecArray | null;
  while ((mm = re.exec(s))) {
    const [a, i] = braced(s, mm.index + mm[0].length);
    const [b] = braced(s, i);
    out.push([a, b]);
  }
  return out;
}

/** Radicands of every \sqrt / \sqrt[n] in a TeX string. */
function radicals(s: string): Array<{ index: number; body: string }> {
  const out: Array<{ index: number; body: string }> = [];
  const re = /\\sqrt(?:\[(\d+)\])?(?=\{)/g;
  let mm: RegExpExecArray | null;
  while ((mm = re.exec(s))) {
    const [body] = braced(s, mm.index + mm[0].length);
    out.push({ index: Number(mm[1] ?? 2), body });
  }
  return out;
}

/** A radicand like `12x^{2}y` is free of n-th powers (number and variables). */
function expectRadicandSimplified(body: string, index: number, where: string): void {
  const mm = /^(-?\d*)((?:[a-z](?:\^\{\d+\})?)*)$/.exec(body);
  expect(mm, `radicand form ${body} in ${where}`).not.toBeNull();
  const c = Math.abs(Number(mm![1] === '' || mm![1] === '-' ? 1 : mm![1]));
  for (let f = 2; f ** index <= c; f++) expect(c % f ** index, `radicand ${body} has a perfect ${index}th power factor (${where})`).not.toBe(0);
  for (const v of mm![2]!.matchAll(/([a-z])(?:\^\{(\d+)\})?/g)) {
    expect(Number(v[2] ?? 1), `variable power ${v[0]} under index ${index} (${where})`).toBeLessThan(index);
  }
}

function roughlyReal(z: C): boolean {
  return Number.isFinite(z.re) && Number.isFinite(z.im) && Math.abs(z.im) <= 1e-9 * Math.max(1, Math.abs(z.re));
}

/** Rewrite b^{p/q} (q odd) as real roots so that (−8)^{2/3} = 4, as taught in Algebra 2. */
function realPowers(tex: string): string {
  return tex.replace(/(\([^()]*\)|[a-z])\^\{(-?)\\frac\{(\d+)\}\{(\d+)\}\}/g, (_all, base: string, neg: string, p: string, q: string) => {
    const inner = base.startsWith('(') ? base.slice(1, -1) : base;
    const r = `\\left(\\sqrt[${q}]{${inner}}\\right)^{${p}}`;
    return neg ? `\\frac{1}{${r}}` : r;
  });
}

/** Real roots of l − r found by sign changes on a grid, refined by bisection (poles rejected). */
function scanRoots(eq: string, v: string, lo: number, hi: number, n = 360): number[] {
  const [l, r] = sides(eq);
  const f = (x: number): number => {
    try {
      const a = evaluate(l, { vars: { [v]: x } });
      const b = evaluate(r, { vars: { [v]: x } });
      if (!roughlyReal(a) || !roughlyReal(b)) return NaN;
      return a.re - b.re;
    } catch {
      return NaN;
    }
  };
  /** A crossing at a removable singularity (e.g. a cancelled denominator factor) is not a root. */
  const undefinedNear = (x: number): boolean => {
    for (let d = 1; d <= 12; d++) {
      const s = Math.round(x * d) / d;
      if (Math.abs(s - x) < 1e-6) return !Number.isFinite(f(s));
    }
    return false;
  };
  const roots: number[] = [];
  let x0 = lo;
  let f0 = f(x0);
  for (let i = 1; i <= n; i++) {
    const x1 = lo + ((hi - lo) * i) / n;
    const f1 = f(x1);
    if (f0 === 0) roots.push(x0);
    else if (Number.isFinite(f0) && Number.isFinite(f1) && f1 !== 0 && Math.sign(f0) !== Math.sign(f1)) {
      let a = x0;
      let b = x1;
      let fa = f0;
      let ok = true;
      for (let k = 0; k < 60; k++) {
        const mid = (a + b) / 2;
        const fm = f(mid);
        if (!Number.isFinite(fm)) {
          ok = false;
          break;
        }
        if (fm === 0) {
          a = b = mid;
          break;
        }
        if (Math.sign(fm) === Math.sign(fa)) {
          a = mid;
          fa = fm;
        } else b = mid;
      }
      const x = (a + b) / 2;
      if (ok && Math.abs(f(x)) < 1e-6 && !undefinedNear(x)) roots.push(x);
    }
    x0 = x1;
    f0 = f1;
  }
  return roots;
}

function interval(tex: string): { lo: number; hi: number; loIn: boolean; hiIn: boolean } | null {
  const s = tex.replace(/\\left|\\right/g, '').trim();
  if (!/^[[(]/.test(s) || !/[\])]$/.test(s)) return null;
  const parts = splitTop(s.slice(1, -1), [',']).parts;
  if (parts.length !== 2) return null;
  const val = (t: string) => (t.includes('\\infty') ? (t.trim().startsWith('-') ? -Infinity : Infinity) : evalReal(t));
  return { lo: val(parts[0]!), hi: val(parts[1]!), loIn: s[0] === '[', hiIn: s.endsWith(']') };
}

/** Membership in "Domain: …" / "Range: …" written as an inequality, an interval or "all real numbers". */
function inSet(part: string, v: string, x: number): boolean {
  if (/all real numbers/i.test(part)) return true;
  const segs = mathSegments(part);
  expect(segs.length, `one math segment in ${part}`).toBe(1);
  const iv = interval(segs[0]!);
  if (iv) {
    if (iv.lo === -Infinity && iv.hi === Infinity) return true;
    const eps = 1e-9;
    return (iv.loIn ? x >= iv.lo - eps : x > iv.lo + eps) && (iv.hiIn ? x <= iv.hi + eps : x < iv.hi - eps);
  }
  return setHolds(part, v, x);
}

/** Finite endpoints named in a domain/range part. */
function endpoints(part: string, v: string): number[] {
  if (/all real numbers/i.test(part)) return [];
  const seg = mathSegments(part)[0]!;
  const iv = interval(seg);
  if (iv) return [iv.lo, iv.hi].filter(Number.isFinite);
  return splitTop(seg, RELATIONS)
    .parts.filter((t) => t.trim() !== v)
    .map((t) => evalReal(t));
}

/** Coefficients (ascending) of a polynomial expression in v, interpolated at 0…8. */
function interpolate(tex: string, v: string): number[] {
  const xs = Array.from({ length: 9 }, (_, i) => i);
  const ys = xs.map((x) => evalReal(tex, { vars: { [v]: x } }));
  // Newton divided differences → standard form
  const coef = [...ys];
  for (let j = 1; j < xs.length; j++) for (let i = xs.length - 1; i >= j; i--) coef[i] = (coef[i]! - coef[i - 1]!) / (xs[i]! - xs[i - j]!);
  let poly = [0];
  for (let i = xs.length - 1; i >= 0; i--) {
    // poly = poly·(x − xs[i]) + coef[i]
    const next = new Array(poly.length + 1).fill(0);
    poly.forEach((c, k) => {
      next[k + 1] += c;
      next[k] -= c * xs[i]!;
    });
    next[0] += coef[i]!;
    poly = next;
  }
  const scale = Math.max(...poly.map(Math.abs));
  while (poly.length > 1 && Math.abs(poly[poly.length - 1]!) < 1e-7 * scale) poly.pop();
  return poly;
}

function deflate(poly: number[], r: number): { q: number[]; rem: number } {
  const n = poly.length - 1;
  const q = new Array(n).fill(0);
  let acc = 0;
  for (let k = n; k >= 0; k--) {
    acc = acc * r + poly[k]!;
    if (k > 0) q[k - 1] = acc;
  }
  return { q, rem: acc };
}

function labelled(answer: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of answer.split(';')) {
    const mm = /^\s*([^:]*?):(.*)$/.exec(part);
    expect(mm, `labelled part in ${answer}`).not.toBeNull();
    out[mm![1]!.replace(/\$/g, '').trim().toLowerCase()] = mm![2]!.trim();
  }
  return out;
}

function points(rich: string): number[][] {
  return mathSegments(rich).map((s) => listItems(s).map((t) => evalReal(t)));
}

export const VERIFIERS: Record<string, Verifier> = {
  /**
   * Radical simplification: answer equals the question (positive variables),
   * every radicand is free of n-th powers, and with `rationalized` no
   * denominator contains a radical.
   */
  [`${P}.radical`](p: ProblemContent) {
    const vars = p.check!.vars as string[];
    const q = onlyMath(p.question);
    const a = onlyMath(p.answer);
    expectEquivalent(q, a, vars, true);
    for (const r of radicals(a)) expectRadicandSimplified(r.body, r.index, p.answer);
    if (p.check!.rationalized) {
      for (const [, den] of fractions(a)) expect(den, `radical in a denominator: ${p.answer}`).not.toMatch(/\\sqrt/);
      expect(a, 'no negative exponents').not.toMatch(/\^\{-/);
    }
  },

  /** Exponential ⇄ radical form: equivalent, and written in the requested form. */
  [`${P}.convert`](p) {
    const vars = p.check!.vars as string[];
    const q = onlyMath(p.question);
    const a = onlyMath(p.answer);
    expectEquivalent(q, a, vars, true);
    if (p.check!.to === 'exponent') expect(a, 'exponential form has no radicals or fractions').not.toMatch(/\\sqrt|\\frac\{[^}]*\}\{[^}]*\}(?!\})/);
    else {
      expect(a, 'radical form has no rational exponents').not.toMatch(/\^\{-?\\frac/);
      expect(a, 'radical form has no negative exponents').not.toMatch(/\^\{-/);
      expect(a).toMatch(/\\sqrt/);
    }
  },

  /**
   * Equation solutions: every answer value satisfies the question equation,
   * the set matches check.solutions ([] ⇔ "No solution"), and a sign-change
   * scan of the rendered equation finds no real root missing from the answer
   * (so extraneous roots are excluded and real ones are all listed).
   * check.realPow: read b^{p/q} with odd q as a real root.
   */
  [`${P}.roots`](p) {
    const v = p.check!.variable as string;
    let eq = onlyMath(p.question);
    if (p.check!.realPow) eq = realPowers(eq);
    const none = NO_SOLUTION.test(p.answer);
    const vals = none ? [] : answerValues(p.answer, v).map((t) => evalReal(t));
    vals.forEach((x) => satisfies(eq, { [v]: x }, p.answer));
    const want = p.check!.solutions as number[];
    expect(vals.length, `${p.question} → ${p.answer}: count`).toBe(want.length);
    for (const w of want) expect(vals.some((x) => close(x, w, 1e-9)), `${p.answer} lacks ${w}`).toBe(true);
    const R = Math.max(15, ...vals.map((x) => 2 * Math.abs(x) + 5), ...((p.check!.extraneous as number[] | undefined) ?? []).map((x) => 2 * Math.abs(x) + 5));
    const extraneous = (p.check!.extraneous as number[] | undefined) ?? [];
    for (const r of scanRoots(eq, v, -R - 0.37, R + 0.29)) {
      // at an excluded value the cleared equation holds but the original is undefined (checked below);
      // the scan sees the sign change of the removable singularity there
      if (extraneous.some((x) => Math.abs(x - r) <= 1e-5 * Math.max(1, Math.abs(r)))) continue;
      expect(
        vals.some((x) => Math.abs(x - r) <= 1e-5 * Math.max(1, Math.abs(r))),
        `${p.question}: real root ${r} missing from ${p.answer}`,
      ).toBe(true);
    }
    const [l, r] = sides(eq);
    for (const x of (p.check!.extraneous as number[] | undefined) ?? []) {
      let holds = false;
      try {
        const a = evaluate(l, { vars: { [v]: x } });
        const b = evaluate(r, { vars: { [v]: x } });
        holds = roughlyReal(a) && roughlyReal(b) && close(a.re, b.re, 1e-9);
      } catch {
        holds = false;
      }
      expect(holds, `${x} should be extraneous for ${p.question}`).toBe(false);
    }
  },

  /** Graph of a radical function: plotted curve and every named point lie on y = f(x). */
  [`${P}.radgraph`](p) {
    const eq = onlyMath(p.question);
    GENERIC.curve!({ ...p, check: { kind: 'curve', eq } });
    const f = rhs(eq);
    const pts = points(p.answer);
    expect(pts.length).toBeGreaterThanOrEqual(2);
    for (const [x, y] of pts) expect(close(evalReal(f, { vars: { x: x! } }), y!), `(${x}, ${y}) on ${eq}`).toBe(true);
    const dots = (p.answerDiagram?.items ?? []).filter((it) => it.t === 'dot');
    for (const d of dots) if (d.t === 'dot') expect(close(evalReal(f, { vars: { x: d.p[0] } }), d.p[1]), `dot on ${eq}`).toBe(true);
  },

  /** Domain and range of y = f(x), checked by probing where f is real and which values it takes. */
  [`${P}.domrange`](p) {
    const f = rhs(onlyMath(p.question));
    const parts = labelled(p.answer);
    const dom = parts.domain!;
    const ran = parts.range!;
    expect(dom && ran, p.answer).toBeTruthy();
    const ends = endpoints(dom, 'x');
    const probes: number[] = [];
    for (let i = 0; i <= 162; i++) {
      const x = -30 + 0.37 * i;
      if (!ends.some((e) => Math.abs(x - e) < 1e-6)) probes.push(x);
    }
    for (const e of ends) probes.push(e - 0.4, e - 1e-4, e, e + 1e-4, e + 0.4);
    const ys: number[] = [];
    for (const x of probes) {
      const z = evaluate(f, { vars: { x } });
      const real = roughlyReal(z);
      expect(real, `${f} real at x=${x} vs ${dom}`).toBe(inSet(dom, 'x', x));
      if (real) ys.push(z.re);
    }
    for (let x = -80; x <= 80; x += 0.5) {
      const z = evaluate(f, { vars: { x } });
      if (roughlyReal(z)) ys.push(z.re);
    }
    for (const y of ys) expect(inSet(ran, 'y', y), `y=${y} outside ${ran}`).toBe(true);
    const rEnds = endpoints(ran, 'y');
    for (const e of rEnds) expect(ys.some((y) => Math.abs(y - e) < 1e-9), `range endpoint ${e} attained`).toBe(true);
    const sorted = [...ys].sort((a, b) => a - b);
    const med = sorted[sorted.length >> 1]!;
    if (rEnds.length === 0) expect(sorted.at(-1)! - med > 2 && med - sorted[0]! > 2, `range unbounded both ways: ${ran}`).toBe(true);
    else expect(sorted.at(-1)! - sorted[0]!).toBeGreaterThan(2);
  },

  /**
   * Rational expressions: answer equals the question at sample points; an
   * optional "x \neq …" segment lists exactly the zeros of the question's
   * denominator.
   */
  [`${P}.ratexpr`](p) {
    const v = p.check!.variable as string;
    const q = onlyMath(p.question);
    const segs = mathSegments(p.answer);
    expectEquivalentAwayFromPoles(q, segs[0]!, v);
    if (segs.length === 1) return;
    expect(segs.length).toBe(2);
    const { parts, rels } = splitTop(segs[1]!, ['\\neq']);
    expect(rels.length).toBe(1);
    expect(parts[0]).toBe(v);
    const ex = splitTop(parts[1]!, [',']).parts.map((t) => evalReal(t));
    expect(q.startsWith('\\frac{'), `question is one fraction: ${q}`).toBe(true);
    const [, i1] = braced(q, 5);
    const [den, i2] = braced(q, i1);
    expect(i2, `question is one fraction: ${q}`).toBe(q.length);
    let poly = interpolate(den, v);
    for (const e of ex) {
      expect(Math.abs(evalReal(den, { vars: { [v]: e } })), `denominator zero at ${e}`).toBeLessThan(1e-7);
      for (;;) {
        const { q: qq, rem } = deflate(poly, e);
        const scale = Math.max(1, ...poly.map(Math.abs));
        if (poly.length > 1 && Math.abs(rem) < 1e-6 * scale) poly = qq;
        else break;
      }
    }
    const deg = poly.length - 1;
    expect(deg === 0 || (deg === 2 && poly[1]! ** 2 - 4 * poly[0]! * poly[2]! < 0), `excluded values incomplete: ${p.answer} for ${q}`).toBe(true);
  },

  /**
   * Graph of a rational function. The plotted curve lies on y = f(x); listed
   * vertical asymptotes are poles, the horizontal asymptote is the limit at
   * ±∞, holes are removable gaps, intercepts lie on the graph; the dashed
   * lines of the figure are exactly the asymptotes and every grid point
   * where f is undefined is a listed asymptote or hole.
   */
  [`${P}.ratgraph`](p) {
    const q = onlyMath(p.question);
    const f = rhs(q);
    const F = (x: number) => {
      const z = evaluate(f, { vars: { x } });
      return roughlyReal(z) ? z.re : NaN;
    };
    const pts = curvePoints(p.answerDiagram);
    expect(pts.length, 'curve drawn').toBeGreaterThan(5);
    for (const [x, y] of pts) expect(close(F(x), y, 1e-7), `(${x}, ${y}) on ${q}`).toBe(true);
    const parts = labelled(p.answer);
    const get = (re: RegExp) => Object.entries(parts).find(([k]) => re.test(k))?.[1];
    const va = (get(/^vertical/) ?? '').length ? mathSegments(get(/^vertical/)!).map((s) => evalReal(rhs(s))) : [];
    const haPart = get(/^horizontal/);
    expect(haPart, 'horizontal asymptote stated').toBeTruthy();
    const ha = mathSegments(haPart!).map((s) => evalReal(rhs(s)));
    const holes = get(/^hole/) ? points(get(/^hole/)!) : [];
    for (const c of va) expect(Math.min(Math.abs(F(c - 1e-7)), Math.abs(F(c + 1e-7))), `pole at x=${c}`).toBeGreaterThan(1e4);
    for (const c of ha) {
      expect(Math.abs(F(1e6) - c), `limit at +inf = ${c}`).toBeLessThan(1e-3);
      expect(Math.abs(F(-1e6) - c), `limit at -inf = ${c}`).toBeLessThan(1e-3);
    }
    for (const [hx, hy] of holes) {
      expect(Number.isFinite(F(hx!)), `hole at ${hx} undefined`).toBe(false);
      expect(Math.abs(F(hx! + 1e-6) - hy!)).toBeLessThan(1e-4);
      expect(Math.abs(F(hx! - 1e-6) - hy!)).toBeLessThan(1e-4);
    }
    const xi = get(/x\$?-intercept/) ?? get(/^x-intercept/);
    const yi = get(/y\$?-intercept/) ?? get(/^y-intercept/);
    for (const [x, y] of xi ? points(xi) : []) expect(Math.abs(y!) < 1e-12 && Math.abs(F(x!)) < 1e-9, `x-intercept (${x}, ${y})`).toBe(true);
    for (const [x, y] of yi ? points(yi) : []) expect(x === 0 && close(F(0), y!), `y-intercept (${x}, ${y})`).toBe(true);
    // undefined grid points are named
    for (let k = -240; k <= 240; k++) {
      const x = k / 24;
      if (!Number.isFinite(F(x)) || Math.abs(F(x)) > 1e9) {
        expect([...va, ...holes.map((h) => h[0]!)].some((c) => Math.abs(c - x) < 1e-9), `${q} undefined at ${x} but not listed`).toBe(true);
      }
    }
    // dashed lines = asymptotes
    const vLines: number[] = [];
    const hLines: number[] = [];
    for (const it of p.answerDiagram?.items ?? []) {
      if (it.t !== 'path' || !it.dash) continue;
      const [a, b] = [it.pts[0]!, it.pts[it.pts.length - 1]!];
      if (a[0] === b[0]) vLines.push(a[0]);
      else if (a[1] === b[1]) hLines.push(a[1]);
    }
    expect(vLines.sort((a, b) => a - b)).toEqual([...va].sort((a, b) => a - b));
    expect(hLines).toEqual(ha);
    const openDots = (p.answerDiagram?.items ?? []).filter((it) => it.t === 'dot' && it.open);
    expect(openDots.length).toBe(holes.length);
  },
};
