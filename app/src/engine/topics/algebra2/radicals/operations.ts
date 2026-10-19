/** Multiplying and dividing radical expressions (binomials, conjugates, rationalizing denominators). */
import { Frac } from '../../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, offset } from '../../../generator';
import { rootTex } from '../../../radical';
import type { Rng } from '../../../rng';
import { m } from '../../../tex';
import type { Difficulty, ProblemContent } from '../../../types';
import { joinTerms, RadSum, radFracTex, radicandTex, radTex, reduceRadFrac, rootTermTex, simplifyRootMono, varsTex, type Exps, type RootTerm } from './common';

const CATEGORY = 'Radical Functions and Rational Exponents';
const SMALL_FREE = [2, 3, 5, 6, 7, 10];

/** Terms (coef, radicand) displayed in the given order: `2 - 3\sqrt{5}`. */
function termsTex(ts: ReadonlyArray<readonly [number, number]>): string {
  return joinTerms(ts.map(([c, n]) => (n === 1 ? String(c) : `${c === 1 ? '' : c === -1 ? '-' : c}\\sqrt{${n}}`)));
}

/** RadSum from display-order (coef, radicand) pairs. */
function rs(ts: ReadonlyArray<readonly [number, number]>): RadSum {
  return new RadSum(ts.map(([c, n]) => [n, c] as const));
}

function randVars(rng: Rng, d: Difficulty): string[] {
  return d === 'hard' ? rng.pick([['x'], ['x', 'y'], ['a', 'b'], ['m', 'n']]) : [rng.pick(['x', 'a', 'n', 'k'])];
}

type MulKind = 'mono' | 'distribute' | 'binomial' | 'conjugate' | 'square';

export const multiplyRadicals = defineTopic({
  id: 'alg2.radical.multiply',
  subject: 'algebra2',
  title: 'Multiplying Radical Expressions',
  description: 'Multiply radicals: monomials, distributing, binomials, conjugates and squares.',
  category: CATEGORY,
  instruction: (o) => (o.variables ? 'Simplify. Assume all variables are positive.' : 'Simplify.'),
  multipleChoice: true,
  defaultCount: 12,
  options: [
    { type: 'boolean', id: 'variables', label: 'Include variables (medium/hard)', default: true },
    { type: 'boolean', id: 'cube', label: 'Include cube roots (medium/hard)', default: true },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const kinds: MulKind[] =
      difficulty === 'easy' ? ['mono', 'distribute'] : difficulty === 'medium' ? ['mono', 'distribute', 'binomial', 'conjugate'] : ['mono', 'binomial', 'conjugate', 'square'];
    const kind = rng.pick(kinds);
    const steps: string[] = [];
    let question: string;
    let answerTex: string;
    let wrongs: Array<string | null> = [];
    let vars: string[] = [];
    let fallback: (k: number) => string | null;

    if (kind === 'mono') {
      const n = boolOpt(ctx, 'cube') && difficulty !== 'easy' && rng.bool(0.4) ? 3 : 2;
      const useVars = boolOpt(ctx, 'variables') && difficulty !== 'easy';
      vars = useVars ? randVars(rng, difficulty) : [];
      const built = attempt('radical-mul-mono', () => {
        const a = rng.int(2, n === 2 ? 15 : 12);
        const b = rng.int(2, n === 2 ? 15 : 12);
        const ea: Exps = {};
        const eb: Exps = {};
        for (const v of vars) {
          ea[v] = rng.int(0, 5);
          eb[v] = rng.int(v === vars[0] && ea[v] === 0 ? 1 : 0, 5);
        }
        const tot: Exps = Object.fromEntries(vars.map((v) => [v, ea[v]! + eb[v]!]));
        const r = simplifyRootMono(a * b, tot, n);
        if (r.coef === 1 && !Object.values(r.out).some((e) => e > 0)) return null;
        if (a === b && vars.length === 0) return null;
        const ca = difficulty === 'easy' ? 1 : rng.int(1, 4) * (difficulty === 'hard' && rng.bool(0.25) ? -1 : 1);
        const cb = difficulty === 'easy' ? rng.pick([1, 1, 2, 3]) : rng.int(1, 5);
        return { a, b, ea, eb, tot, ca, cb };
      });
      const { a, b, ea, eb, tot, ca, cb } = built;
      const pre = (c: number) => (c === 1 ? '' : c === -1 ? '-' : String(c));
      const left = `${pre(ca)}${radTex(n, radicandTex(a, ea))}`;
      const right = `${cb === 1 ? '' : cb}${radTex(n, radicandTex(b, eb))}`;
      question = `${left} \\cdot ${right}`;
      const ans = simplifyRootMono(a * b, tot, n, ca * cb);
      answerTex = rootTermTex(ans);
      steps.push(m(`= ${pre(ca * cb)}${radTex(n, radicandTex(a * b, tot))}`));
      steps.push(m(`= ${answerTex}`));
      const v = (t: Partial<RootTerm>) => {
        const r = { ...ans, ...t };
        return r.coef === 0 ? null : rootTermTex(r);
      };
      const o = Math.abs(ans.coef / (ca * cb));
      wrongs = [
        rootTermTex(simplifyRootMono(a * b, tot, n, ca + cb)),
        v({ coef: ans.coef * o }),
        vars.length ? v({ out: Object.fromEntries(vars.map((x) => [x, tot[x]!])), inV: {} }) : v({ inC: ans.inC + 1 }),
        v({ coef: -ans.coef }),
      ];
      fallback = (k) => v({ coef: ans.coef + offset(k) });
    } else if (kind === 'distribute') {
      const built = attempt('radical-distribute', () => {
        const a = rng.pick(SMALL_FREE);
        const ca = difficulty === 'easy' ? 1 : rng.int(1, 3) * (rng.bool(0.25) ? -1 : 1);
        const b = rng.pick([...SMALL_FREE, 8, 12, 15]);
        const cb = rng.int(1, 4);
        const c2 = rng.signedInt(1, 6, true);
        const second: [number, number] = rng.bool(0.5) ? [c2, 1] : [c2, rng.pick(SMALL_FREE)];
        const inner: Array<[number, number]> = rng.bool(0.5) ? [[cb, b], second] : [second, [cb, b]];
        if (inner[0]![1] === inner[1]![1]) return null;
        const res = RadSum.of([a, ca]).mul(rs(inner));
        if (res.size < 2) return null;
        return { a, ca, inner, res };
      });
      const { a, ca, inner, res } = built;
      const outer = rootTex(ca, a);
      question = `${outer}(${termsTex(inner)})`;
      answerTex = res.tex();
      const raw = inner.map(([c, n]) => [ca * c, a * n] as const);
      steps.push(m(`= ${termsTex(raw)}`));
      steps.push(m(`= ${answerTex}`));
      const noSimplify = rs(inner);
      wrongs = [
        RadSum.of([a, ca]).mul(rs([inner[0]!])).add(rs([inner[1]!])).tex(),
        noSimplify.add(RadSum.of([a, ca])).tex(),
        res.scale(-1).tex(),
        RadSum.of([a, ca]).mul(rs([inner[0]!])).add(RadSum.of([inner[1]![1], -inner[1]![0] * ca])).tex(),
      ];
      fallback = (k) => res.add(RadSum.of([1, offset(k)])).tex();
    } else {
      // binomial products (a + b√r)(c + d√s)
      const built = attempt('radical-binomial', () => {
        const r = rng.pick(SMALL_FREE);
        const twoRad = difficulty === 'hard' && kind !== 'square' && rng.bool(0.35);
        const s = twoRad ? rng.pick(SMALL_FREE.filter((x) => x !== r)) : r;
        const p: Array<[number, number]> = twoRad ? [[rng.int(1, 3), r], [rng.signedInt(1, 3, true), s]] : [[rng.signedInt(1, 6, true), 1], [rng.signedInt(1, 3, true), r]];
        let q: Array<[number, number]>;
        if (kind === 'conjugate') q = [p[0]!, [-p[1]![0], p[1]![1]]];
        else if (kind === 'square') q = p;
        else q = twoRad ? [[rng.signedInt(1, 3, true), r], [rng.signedInt(1, 3, true), s]] : [[rng.signedInt(1, 6, true), 1], [rng.signedInt(1, 3, true), r]];
        const res = rs(p).mul(rs(q));
        if (res.isZero()) return null;
        if (kind === 'binomial' && res.size < 2) return null;
        if (rng.bool(0.4) && !twoRad) {
          // radical term first: (3√2 - 1)
          p.reverse();
          if (kind !== 'square') q.reverse();
        }
        return { p, q, res };
      });
      const { p, q, res } = built;
      question = kind === 'square' ? `(${termsTex(p)})^{2}` : `(${termsTex(p)})(${termsTex(q)})`;
      answerTex = res.tex();
      const foil: Array<readonly [number, number]> = [];
      for (const a of p) for (const b of q) foil.push([a[0] * b[0], a[1] * b[1]]);
      steps.push(m(`= ${joinTerms(foil.map(([c, n]) => (n === 1 ? String(c) : `${c === 1 ? '' : c === -1 ? '-' : c}\\sqrt{${n}}`)))}`));
      steps.push(m(`= ${answerTex}`));
      const firstLast = new RadSum([[p[0]![1] * q[0]![1], p[0]![0] * q[0]![0]], [p[1]![1] * q[1]![1], p[1]![0] * q[1]![0]]]);
      const signSlip = new RadSum(foil.map(([c, n], i) => [n, i === foil.length - 1 ? -c : c] as const));
      const noSquare = new RadSum(foil.map(([c, n]) => (n > 1 && Math.round(Math.sqrt(n)) ** 2 === n ? ([1, c * n] as const) : ([n, c] as const))));
      wrongs = [firstLast.isZero() ? null : firstLast.tex(), signSlip.isZero() ? null : signSlip.tex(), noSquare.isZero() ? null : noSquare.tex(), res.scale(-1).tex()];
      fallback = (k) => res.add(RadSum.of([1, offset(k)])).tex();
    }
    const answer = m(answerTex);
    const distractors = distinctDistractors(
      answer,
      wrongs.map((w) => (w ? m(w) : null)),
      (k) => {
        const f = fallback(k);
        return f ? m(f) : null;
      },
    );
    return {
      question: m(question),
      answer,
      steps,
      distractors,
      check: { kind: 'alg2-radicals-rational.radical', vars, positive: true },
    };
  },
});

// ---------------------------------------------------------------- division

/** Fraction with a monomial-root numerator/denominator: coef·x^{e}·ⁿ√(inC·inV), negative exponents go below. */
function monoFracTex(coef: Frac, exps: Exps, index: number, inC: number, inV: Exps): string {
  const top: Exps = {};
  const bottom: Exps = {};
  for (const [v, e] of Object.entries(exps)) {
    if (e > 0) top[v] = e;
    else if (e < 0) bottom[v] = -e;
  }
  const rad = inC !== 1 || varsTex(inV) ? radTex(index, radicandTex(inC, inV)) : '';
  const n = Math.abs(coef.n);
  const numer = `${n === 1 && (varsTex(top) || rad) ? '' : n}${varsTex(top)}${rad}`;
  const denom = `${coef.d === 1 && varsTex(bottom) ? '' : coef.d}${varsTex(bottom)}`;
  const sign = coef.sign < 0 ? '-' : '';
  return denom === '1' ? `${sign}${numer}` : `${sign}\\frac{${numer}}{${denom}}`;
}

/** k·ⁿ√N / (c·ⁿ√D) rationalized: k·ⁿ√(N·D^{n−1}) / (c·D). */
function rationalizeMono(k: number, N: { c: number; e: Exps }, c: number, D: { c: number; e: Exps }, n: number, vars: string[], mult = n - 1) {
  const prodE: Exps = Object.fromEntries(vars.map((v) => [v, (N.e[v] ?? 0) + mult * (D.e[v] ?? 0)]));
  const r = simplifyRootMono(N.c * D.c ** mult, prodE, n);
  const coef = new Frac(k * r.coef, c * D.c);
  const exps: Exps = Object.fromEntries(vars.map((v) => [v, (r.out[v] ?? 0) - (D.e[v] ?? 0)]));
  return { coef, exps, inC: r.inC, inV: r.inV, radicand: radicandTex(N.c * D.c ** mult, prodE) };
}

type DivKind = 'mono' | 'conj' | 'conj2';

export const divideRadicals = defineTopic({
  id: 'alg2.radical.divide',
  subject: 'algebra2',
  title: 'Dividing Radical Expressions',
  description: 'Simplify quotients of radicals and rationalize denominators, using conjugates where needed.',
  category: CATEGORY,
  instruction: (o) => (o.variables ? 'Simplify. Rationalize each denominator. Assume all variables are positive.' : 'Simplify. Rationalize each denominator.'),
  multipleChoice: true,
  defaultCount: 12,
  options: [
    { type: 'boolean', id: 'variables', label: 'Include variables (medium/hard)', default: true },
    { type: 'boolean', id: 'cube', label: 'Include cube-root denominators (medium/hard)', default: true },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const kinds: DivKind[] = difficulty === 'easy' ? ['mono'] : difficulty === 'medium' ? ['mono', 'conj'] : ['mono', 'conj', 'conj2'];
    const kind = rng.pick(kinds);
    const steps: string[] = [];
    let question: string;
    let answerTex: string;
    let wrongs: Array<string | null> = [];
    let fallback: (k: number) => string | null;
    let vars: string[] = [];

    if (kind === 'mono') {
      const n = boolOpt(ctx, 'cube') && difficulty !== 'easy' && rng.bool(0.4) ? 3 : 2;
      vars = boolOpt(ctx, 'variables') && difficulty !== 'easy' && rng.bool(0.6) ? [rng.pick(['x', 'a', 'n', 'k'])] : [];
      const built = attempt('radical-div-mono', () => {
        const radNum = rng.bool(0.5);
        const N = { c: radNum ? rng.pick([1, 2, 3, 5, 6, 7, 10, 12, 15, 18, 20]) : 1, e: {} as Exps };
        const D = { c: n === 2 ? rng.pick([2, 3, 5, 6, 7, 8, 10, 12, 18, 20]) : rng.int(2, 9), e: {} as Exps };
        if (n === 2 && N.c * D.c > 150) return null;
        for (const v of vars) {
          N.e[v] = radNum ? rng.int(0, 5) : 0;
          D.e[v] = rng.int(1, 3);
        }
        const k = radNum ? rng.pick([1, 1, 2, 3]) : rng.int(1, 12);
        const c = rng.pick([1, 1, 2, 3]);
        const dr = simplifyRootMono(D.c, D.e, n);
        if (dr.inC === 1 && !varsTex(dr.inV)) return null; // denominator already rational
        if (radNum && N.c === D.c && vars.length === 0) return null;
        const res = rationalizeMono(k, N, c, D, n, vars);
        if (res.coef.d > 60 || Math.abs(res.coef.n) > 200) return null;
        return { radNum, N, D, k, c, res };
      });
      const { radNum, N, D, k, c, res } = built;
      const numTex = radNum ? `${k === 1 ? '' : k}${radTex(n, radicandTex(N.c, N.e))}` : String(k);
      const denTex = `${c === 1 ? '' : c}${radTex(n, radicandTex(D.c, D.e))}`;
      question = `\\frac{${numTex}}{${denTex}}`;
      answerTex = monoFracTex(res.coef, res.exps, n, res.inC, res.inV);
      const mulBy = radTex(n, radicandTex(D.c ** (n - 1), Object.fromEntries(vars.map((v) => [v, (n - 1) * D.e[v]!]))));
      steps.push(m(`= \\frac{${numTex}}{${denTex}} \\cdot \\frac{${mulBy}}{${mulBy}}`));
      steps.push(m(`= \\frac{${k === 1 ? '' : k}${radTex(n, res.radicand)}}{${c === 1 ? '' : c}${radicandTex(D.c, D.e)}}`));
      steps.push(m(`= ${answerTex}`));
      // forgot to multiply the denominator; used √D instead of ∛D² for cube roots; flipped
      const prodOnce = rationalizeMono(k, N, c, D, n, vars, n === 3 ? 1 : 2);
      const forgotTex = monoFracTex(res.coef.mul(D.c), Object.fromEntries(vars.map((v) => [v, res.exps[v]! + D.e[v]!])), n, res.inC, res.inV);
      wrongs = [
        forgotTex,
        monoFracTex(prodOnce.coef, prodOnce.exps, n, prodOnce.inC, prodOnce.inV),
        monoFracTex(new Frac(res.coef.d, res.coef.n), res.exps, n, res.inC, res.inV),
        monoFracTex(res.coef.neg(), res.exps, n, res.inC, res.inV),
      ];
      fallback = (j) => {
        const cf = res.coef.add(new Frac(offset(j), res.coef.d));
        return cf.isZero() ? null : monoFracTex(cf, res.exps, n, res.inC, res.inV);
      };
    } else {
      const built = attempt('radical-div-conj', () => {
        let den: Array<[number, number]>;
        if (kind === 'conj2') {
          const [p, q] = rng.sample(SMALL_FREE, 2) as [number, number];
          den = [[1, p], [rng.pick([1, -1]), q]];
        } else {
          const r = rng.pick(SMALL_FREE);
          den = [[rng.int(1, 6), 1], [rng.signedInt(1, difficulty === 'hard' ? 3 : 1, true), r]];
          if (den[1]![0] > 0 && rng.bool(0.35)) den.reverse();
        }
        const D = rs(den);
        const conjTerms: Array<[number, number]> = [den[0]!, [-den[1]![0], den[1]![1]]];
        const conj = rs(conjTerms);
        const Q = D.mul(conj);
        if (Q.size !== 1 || Q.constant === 0) return null;
        let num: Array<[number, number]>;
        const nk = difficulty === 'hard' ? rng.int(0, 2) : 0;
        if (nk === 0) num = [[rng.int(1, 12), 1]];
        else if (nk === 1) num = [[rng.int(1, 4), rng.pick(SMALL_FREE)]];
        else num = [[rng.int(1, 5), 1], [rng.signedInt(1, 3, true), den.find(([, x]) => x !== 1)![1]]];
        const N = rs(num);
        const red = reduceRadFrac(N.mul(conj), Q.constant);
        if (red.M.isZero()) return null;
        if (Math.abs(red.d) > 60) return null;
        return { den, conjTerms, num, N, conj, Q: Q.constant, red };
      });
      const { den, conjTerms, num, N, conj, Q, red } = built;
      const numTex = termsTex(num);
      question = `\\frac{${numTex}}{${termsTex(den)}}`;
      answerTex = radFracTex(red.M, red.d);
      const numWrap = num.length > 1 ? `(${numTex})` : numTex;
      steps.push(m(`= \\frac{${numTex}}{${termsTex(den)}} \\cdot \\frac{${termsTex(conjTerms)}}{${termsTex(conjTerms)}}`));
      steps.push(m(`= \\frac{${numWrap}(${termsTex(conjTerms)})}{${Q}}`));
      const unreduced = N.mul(conj);
      if (red.d !== Q) steps.push(m(`= \\frac{${unreduced.tex()}}{${Q}}`));
      steps.push(m(`= ${answerTex}`));
      const frac = (M: RadSum, d: number) => {
        if (d === 0 || M.isZero()) return null;
        const r = reduceRadFrac(M, d);
        return radFracTex(r.M, r.d);
      };
      const D = rs(den);
      const rad = den.find(([, x]) => x !== 1) ?? den[1]!;
      const a = den.find(([, x]) => x === 1);
      const plusDen = a ? a[0] ** 2 + rad[0] ** 2 * rad[1] : den[0]![1] + den[1]![1];
      const noSquare = a ? a[0] ** 2 - Math.abs(rad[0]) * rad[1] : den[0]![1] * den[1]![1];
      wrongs = [
        frac(unreduced, plusDen),
        frac(N.mul(D), Q),
        frac(unreduced, noSquare),
        frac(red.M.scale(-1), red.d),
      ];
      fallback = (j) => frac(red.M.add(RadSum.of([1, offset(j)])), red.d);
    }
    const answer = m(answerTex);
    const distractors = distinctDistractors(
      answer,
      wrongs.map((w) => (w ? m(w) : null)),
      (k) => {
        const f = fallback(k);
        return f ? m(f) : null;
      },
    );
    return {
      question: m(question),
      answer,
      steps,
      distractors,
      check: { kind: 'alg2-radicals-rational.radical', vars, positive: true, rationalized: true },
    };
  },
});
