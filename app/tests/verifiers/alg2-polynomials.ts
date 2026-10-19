/** Answer verifiers for the Algebra 2 polynomial-functions pack. All checks read the rendered strings. */
import { expect } from 'vitest';
import { Frac } from '../../src/engine/fraction';
import { Poly } from '../../src/engine/polynomial';
import { close, closeC, evalReal, evaluate, mathSegments, onlyMath, splitTop, type C } from '../evaluator';
import { allMath, answerValues, curvePoints, expectEquivalent, rhs, type Verifier } from '../verify';

// ---------------------------------------------------------------- helpers

const cmul = (a: C, b: C): C => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
const csub = (a: C, b: C): C => ({ re: a.re - b.re, im: a.im - b.im });
const cdiv = (a: C, b: C): C => {
  const d = b.re * b.re + b.im * b.im;
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
};

/** Nearest fraction with a small denominator. */
function toFrac(y: number, what: string): Frac {
  for (let d = 1; d <= 2000; d++) {
    const n = Math.round(y * d);
    if (Math.abs(n - y * d) <= 1e-7 * Math.max(1, Math.abs(y * d))) return new Frac(n, d);
  }
  throw new Error(`${what}: value ${y} is not a simple rational`);
}

/** Exact coefficients of a one-variable polynomial expression (degree ≤ 10), from its values at 0…12. */
export function polyOf(tex: string, v: string): Poly {
  const N = 12;
  let row = Array.from({ length: N + 1 }, (_, x) => toFrac(evalReal(tex, { vars: { [v]: x } }), tex));
  const diffs: Frac[] = [];
  for (let k = 0; k <= N; k++) {
    diffs.push(row[0]!);
    row = row.slice(1).map((y, i) => y.sub(row[i]!));
  }
  expect(diffs.slice(11).every((d) => d.isZero()), `${tex} is a polynomial of degree ≤ 10`).toBe(true);
  // Newton forward form: Σ Δ^k f(0) · C(x, k)
  let p = Poly.of(0);
  let basis = Poly.of(1);
  let fact = 1;
  diffs.forEach((d, k) => {
    if (k > 0) {
      basis = basis.mul(Poly.of(-(k - 1), 1));
      fact *= k;
    }
    if (!d.isZero()) p = p.add(basis.scale(d.div(fact)));
  });
  return p;
}

const fRhs = (q: string): string => {
  const seg = mathSegments(q).find((s) => /^[a-z]\(x\)\s*=/.test(s));
  return seg ? rhs(seg) : onlyMath(q);
};

function divisors(n: number): number[] {
  const out: number[] = [];
  for (let i = 1; i <= Math.abs(n); i++) if (n % i === 0) out.push(i);
  return out;
}

/** Candidate rational zeros ±p/q of an integer polynomial with non-zero constant term. */
function rationalCandidates(p: Poly): Frac[] {
  const a0 = p.coef(0).n;
  const an = p.lead().n;
  const out: Frac[] = [];
  for (const a of divisors(a0)) for (const b of divisors(an)) for (const s of [1, -1]) {
    const f = new Frac(s * a, b);
    if (!out.some((x) => x.eq(f))) out.push(f);
  }
  return out;
}

function hasRationalRoot(p: Poly): boolean {
  if (p.coef(0).isZero()) return true;
  return rationalCandidates(p).some((c) => p.eval(c).isZero());
}

function isIntegral(p: Poly): boolean {
  return p.c.every((c) => c.isInt());
}

function content(p: Poly): number {
  return p.c.reduce((g, c) => {
    let a = Math.abs(g);
    let b = Math.abs(c.n);
    while (b) [a, b] = [b, a % b];
    return a;
  }, 0);
}

/** Split `k x^{2}(x + 1)^{2}(x - 3)` into its prefix and parenthesised factors. */
function splitProduct(tex: string): { prefix: string; factors: Array<{ inner: string; e: number }> } {
  let prefix = '';
  const factors: Array<{ inner: string; e: number }> = [];
  let i = 0;
  while (i < tex.length) {
    const ch = tex[i]!;
    if (ch === '(') {
      let depth = 0;
      let j = i;
      for (; j < tex.length; j++) {
        if (tex[j] === '(') depth++;
        else if (tex[j] === ')' && --depth === 0) break;
      }
      const inner = tex.slice(i + 1, j);
      i = j + 1;
      let e = 1;
      const mm = /^\^(?:\{(\d+)\}|(\d))/.exec(tex.slice(i));
      if (mm) {
        e = Number(mm[1] ?? mm[2]);
        i += mm[0].length;
      }
      factors.push({ inner, e });
    } else {
      if (ch !== ' ') {
        expect(factors.length, `monomial factor must come first in ${tex}`).toBe(0);
        prefix += ch;
      }
      i++;
    }
  }
  return { prefix, factors };
}

/** Zeros listed as `$a$, $b$ (multiplicity 2)` in a text fragment. */
function listedZeros(text: string): Array<{ tex: string; e: number }> {
  return [...text.matchAll(/\$([^$]+)\$(?: \(multiplicity (\d+)\))?/g)].map((mm) => ({ tex: mm[1]!, e: mm[2] ? Number(mm[2]) : 1 }));
}

/** Conjugate of an irrational zero `a ± b\sqrt{c}` (null if there is no radical). */
function radicalConjugate(tex: string): string | null {
  if (!tex.includes('\\sqrt') || tex.includes('i')) return null;
  const mm = /^(.*) ([+-]) (\d*\\sqrt\{\d+\})$/.exec(tex);
  if (mm) return `${mm[1]} ${mm[2] === '+' ? '-' : '+'} ${mm[3]}`;
  return tex.startsWith('-') ? tex.slice(1) : `-${tex}`;
}

/** f(x) / ∏(x − z)^e must be the same constant at several points; returns it. */
function quotientConstant(f: (x: C) => C, zeros: Array<{ z: C; e: number }>, what: string): number {
  const pts = [-2.7, -1.3, 0.6, 1.7, 3.1, 4.3].map((re) => ({ re, im: 0.37 }));
  const ratios = pts.map((x) => {
    let q: C = { re: 1, im: 0 };
    for (const { z, e } of zeros) for (let k = 0; k < e; k++) q = cmul(q, csub(x, z));
    return cdiv(f(x), q);
  });
  ratios.forEach((r) => expect(closeC(r, ratios[0]!, 1e-6), `${what}: not a constant multiple of the zero product`).toBe(true));
  expect(Math.abs(ratios[0]!.im), what).toBeLessThan(1e-6 * Math.max(1, Math.abs(ratios[0]!.re)));
  return ratios[0]!.re;
}

function nums(s: string): number[] {
  return [...s.matchAll(/\d+/g)].map((mm) => Number(mm[0])).sort((a, b) => a - b);
}

const stepDown = (k: number) => Array.from({ length: Math.floor(k / 2) + 1 }, (_, i) => k - 2 * i).sort((a, b) => a - b);

function signChanges(p: Poly): number {
  const s = [...p.c].reverse().filter((c) => !c.isZero()).map((c) => c.sign);
  let n = 0;
  for (let i = 1; i < s.length; i++) if (s[i] !== s[i - 1]) n++;
  return n;
}

// ---------------------------------------------------------------- verifiers

const DEGREE = ['Constant', 'Linear', 'Quadratic', 'Cubic', 'Quartic', 'Quintic', 'Sixth-degree', 'Seventh-degree'];
const TERMS = ['', 'monomial', 'binomial', 'trinomial', 'polynomial with four terms', 'polynomial with five terms', 'polynomial with six terms', 'polynomial with seven terms', 'polynomial with eight terms'];

export const VERIFIERS: Record<string, Verifier> = {
  'alg2-polynomials.naming'(p) {
    const v = p.check!.variable as string;
    const poly = polyOf(onlyMath(p.question), v);
    const n = poly.c.filter((c) => !c.isZero()).length;
    const task = p.check!.task as string;
    if (task !== 'degree') expect(p.answer.startsWith(`${DEGREE[poly.degree]} ${TERMS[n]}`), `${p.question} → ${p.answer}`).toBe(true);
    else {
      const mm = /^Degree \$(\d+)\$/.exec(p.answer);
      expect(Number(mm?.[1]), p.answer).toBe(poly.degree);
    }
    if (task !== 'name') {
      const mm = /leading coefficient \$([^$]+)\$/.exec(p.answer)!;
      expect(close(evalReal(mm[1]!), poly.lead().value), p.answer).toBe(true);
    }
  },

  'alg2-polynomials.factored'(p) {
    const vars = p.check!.vars as string[];
    const src = fRhs(p.question);
    const ans = onlyMath(p.answer);
    expectEquivalent(src, ans, vars);
    const { prefix, factors } = splitProduct(ans);
    expect(/^-?\d*(?:[a-z](?:\^\{?\d+\}?)?)*$/.test(prefix), `prefix ${prefix} is a monomial`).toBe(true);
    expect(factors.length + (prefix.replace(/^-?\d*/, '') ? 1 : 0), `${ans} is a product`).toBeGreaterThan(0);
    if (vars.length > 1) return;
    const v = vars[0]!;
    for (const f of factors) {
      const fp = polyOf(f.inner, v);
      expect(fp.degree, `factor ${f.inner}`).toBeGreaterThan(0);
      expect(isIntegral(fp) && content(fp) === 1, `factor ${f.inner} has integer coefficients and no common factor`).toBe(true);
      if (fp.degree >= 2) expect(hasRationalRoot(fp), `factor ${f.inner} factors further`).toBe(false);
    }
  },

  'alg2-polynomials.binomial'(p) {
    const vars = p.check!.vars as string[];
    const segs = mathSegments(p.question);
    const mm = /^\((.*)\)\^\{(\d+)\}$/.exec(segs[segs.length - 1]!)!;
    const n = Number(mm[2]);
    const { parts, rels } = splitTop(mm[1]!, [' + ', ' - ']);
    expect(parts.length, mm[1]).toBe(2);
    const first = parts[0]!;
    const second = rels[0] === ' - ' ? `-(${parts[1]})` : `(${parts[1]})`;
    const binom = (k: number) => {
      let r = 1;
      for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
      return r;
    };
    const envs = [
      { x: 1.3, y: 0.7 },
      { x: -0.8, y: 1.9 },
      { x: 2.1, y: -1.2 },
    ].map((e) => Object.fromEntries(vars.map((v, i) => [v, i === 0 ? e.x : e.y])));
    const term = (k: number, env: Record<string, number>) => binom(k) * evalReal(first, { vars: env }) ** (n - k) * evalReal(second, { vars: env }) ** k;
    if (p.check!.task === 'term') {
      const idx = Number(/the (\d+)(?:st|nd|rd|th) term/.exec(p.question)![1]);
      for (const env of envs) expect(close(evalReal(onlyMath(p.answer), { vars: env }), term(idx - 1, env), 1e-7), `${p.question} → ${p.answer}`).toBe(true);
    } else {
      const monomial = segs[0]!;
      const k = Array.from({ length: n + 1 }, (_, j) => j).find((j) => {
        const r = envs.map((env) => term(j, env) / evalReal(monomial, { vars: env }));
        return r.every((x) => close(x, r[0]!, 1e-7));
      });
      expect(k, `a term containing ${monomial}`).toBeDefined();
      const coef = term(k!, envs[0]!) / evalReal(monomial, { vars: envs[0]! });
      expect(close(evalReal(onlyMath(p.answer)), coef, 1e-7), `${p.question} → ${p.answer}`).toBe(true);
    }
  },

  'alg2-polynomials.remainder'(p) {
    const segs = mathSegments(p.question);
    const task = p.check!.task as string;
    const at = (tex: string, x: number) => evalReal(tex, { vars: { x } });
    const rootOf = (lin: string) => -at(lin, 0) / (at(lin, 1) - at(lin, 0));
    if (task === 'evaluate') {
      const a = evalReal(/^f\((.+)\)$/.exec(segs[0]!)![1]!);
      const f = rhs(segs[1]!);
      const ans = onlyMath(p.answer);
      expect(close(evalReal(/^f\((.+)\)/.exec(ans)![1]!), a)).toBe(true);
      expect(close(evalReal(rhs(ans)), at(f, a)), `${p.question} → ${p.answer}`).toBe(true);
    } else if (task === 'remainder') {
      const r = rootOf(segs[1]!);
      expect(close(evalReal(onlyMath(p.answer)), at(segs[0]!, r)), `${p.question} → ${p.answer}`).toBe(true);
    } else {
      const r = rootOf(segs[0]!);
      const val = at(rhs(segs[1]!), r);
      const isFactor = Math.abs(val) < 1e-9;
      expect(p.answer.startsWith(isFactor ? 'Yes' : 'No'), `${p.question} → ${p.answer}`).toBe(true);
      const ans = onlyMath(p.answer);
      expect(close(evalReal(/^f\((.+)\)/.exec(ans)![1]!), r)).toBe(true);
      expect(close(evalReal(rhs(ans)), val), `${p.question} → ${p.answer}`).toBe(true);
    }
  },

  'alg2-polynomials.zeros'(p) {
    const [zeroPart, ...conds] = p.question.split(';');
    const given = listedZeros(zeroPart!);
    const zeros: Array<{ z: C; e: number }> = [];
    const addZero = (z: C, e: number) => {
      if (!zeros.some((o) => closeC(o.z, z, 1e-9))) zeros.push({ z, e });
    };
    for (const g of given) {
      const z = evaluate(g.tex);
      addZero(z, g.e);
      if (Math.abs(z.im) > 1e-12) addZero({ re: z.re, im: -z.im }, g.e);
      const conj = radicalConjugate(g.tex);
      if (conj) addZero(evaluate(conj), g.e);
    }
    const ans = rhs(onlyMath(p.answer));
    const poly = polyOf(ans, 'x');
    expect(isIntegral(poly), `${ans} has integer coefficients`).toBe(true);
    expect(poly.degree, `least degree for ${p.question}`).toBe(zeros.reduce((s, z) => s + z.e, 0));
    const c = quotientConstant((x) => evaluate(ans, { vars: { x } }), zeros, `${p.question} → ${p.answer}`);
    const lead = conds.map((s) => /leading coefficient \$([^$]+)\$/.exec(s)).find(Boolean);
    const point = conds.map((s) => /passes through \$\\left\((.+), (.+)\\right\)\$/.exec(s)).find(Boolean);
    if (lead) expect(close(c, evalReal(lead[1]!)), `leading coefficient in ${p.answer}`).toBe(true);
    else if (point) expect(close(evalReal(ans, { vars: { x: evalReal(point[1]!) } }), evalReal(point[2]!)), `point on ${p.answer}`).toBe(true);
    else expect(content(poly) === 1 && poly.lead().sign > 0, `${p.answer} is primitive with positive leading coefficient`).toBe(true);
  },

  'alg2-polynomials.descartes'(p) {
    const f = polyOf(fRhs(p.question), 'x');
    expect(f.coef(0).isZero()).toBe(false);
    const P = signChanges(f);
    const N = signChanges(new Poly(f.c.map((c, i) => (i % 2 ? c.neg() : c))));
    const mm = /^Positive: (.+); negative: (.+); imaginary: (.+)$/.exec(p.answer)!;
    const imag = [...new Set(stepDown(P).flatMap((a) => stepDown(N).map((b) => f.degree - a - b)))].sort((a, b) => a - b);
    expect(nums(mm[1]!), p.answer).toEqual(stepDown(P));
    expect(nums(mm[2]!), p.answer).toEqual(stepDown(N));
    expect(nums(mm[3]!), p.answer).toEqual(imag);
  },

  'alg2-polynomials.rationalZeros'(p) {
    const f = polyOf(fRhs(p.question), 'x');
    expect(isIntegral(f)).toBe(true);
    const cands = rationalCandidates(f);
    if (p.check!.task === 'list') {
      const items = splitTop(allMath(p.answer), [',']).parts;
      items.forEach((it) => expect(it.startsWith('\\pm'), it).toBe(true));
      const got = items.map((it) => toFrac(evalReal(it.replace(/^\\pm/, '')), it));
      expect(got.length * 2, `${p.question} → ${p.answer}`).toBe(cands.length);
      got.forEach((g) => expect(cands.some((c) => c.eq(g)), `${g} is a candidate`).toBe(true));
      return;
    }
    const got = answerValues(p.answer, 'x').map((t) => toFrac(evalReal(t), t));
    const want = cands.filter((c) => f.eval(c).isZero());
    expect(got.length, `${p.question} → ${p.answer}`).toBe(want.length);
    got.forEach((g) => expect(f.eval(g).isZero(), `${g} is a zero`).toBe(true));
  },

  'alg2-polynomials.fta'(p) {
    const n = polyOf(fRhs(p.question), 'x').degree;
    const mm = /^Complex zeros: (\d+); possible real zeros: (.+); possible imaginary zeros: (.+)$/.exec(p.answer)!;
    expect(Number(mm[1]), p.answer).toBe(n);
    expect(nums(mm[2]!), p.answer).toEqual(stepDown(n));
    expect(nums(mm[3]!), p.answer).toEqual(stepDown(n).map((r) => n - r).sort((a, b) => a - b));
  },

  'alg2-polynomials.endBehavior'(p) {
    let left: number;
    let right: number;
    if (p.check!.source === 'graph') {
      const pts = curvePoints(p.diagram);
      expect(pts.length).toBeGreaterThan(5);
      const l = pts.reduce((a, b) => (b[0] < a[0] ? b : a));
      const r = pts.reduce((a, b) => (b[0] > a[0] ? b : a));
      expect(Math.abs(l[1]) > 5 && Math.abs(r[1]) > 5, 'graph leaves the window at both ends').toBe(true);
      left = Math.sign(l[1]);
      right = Math.sign(r[1]);
      expect(p.answer.startsWith(left === right ? 'Even degree' : 'Odd degree'), p.answer).toBe(true);
      expect(p.answer.includes(right > 0 ? 'positive leading' : 'negative leading'), p.answer).toBe(true);
    } else {
      const f = fRhs(p.question);
      left = Math.sign(evalReal(f, { vars: { x: -1e3 } }));
      right = Math.sign(evalReal(f, { vars: { x: 1e3 } }));
    }
    const ends = [...p.answer.matchAll(/\$f\(x\) \\to ([+-])\\infty\$ as \$x \\to ([+-])\\infty\$/g)];
    expect(ends.length, p.answer).toBe(2);
    for (const e of ends) expect(e[1] === '+' ? 1 : -1, p.answer).toBe(e[2] === '-' ? left : right);
    expect(new Set(ends.map((e) => e[2])).size).toBe(2);
  },

  'alg2-polynomials.graph'(p) {
    const f = fRhs(p.question);
    const pts = curvePoints(p.answerDiagram);
    expect(pts.length, 'curve drawn').toBeGreaterThan(5);
    for (const [x, y] of pts) expect(Math.abs(evalReal(f, { vars: { x } }) - y), `(${x}, ${y}) on ${f}`).toBeLessThan(1e-6 * Math.max(1, Math.abs(y)));
    const [zeroPart, yPart] = p.answer.split(';');
    const zeros = listedZeros(zeroPart!).map((z) => ({ z: evaluate(z.tex), e: z.e }));
    expect(zeros.reduce((s, z) => s + z.e, 0), p.answer).toBe(polyOf(f, 'x').degree);
    quotientConstant((x) => evaluate(f, { vars: { x } }), zeros, `${p.question} → ${p.answer}`);
    const y0 = /y-intercept: \$([^$]+)\$/.exec(yPart!)!;
    expect(close(evalReal(y0[1]!), evalReal(f, { vars: { x: 0 } })), p.answer).toBe(true);
  },
};

