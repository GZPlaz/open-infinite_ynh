/** Infinite sequences and series: convergence tests, power series, Taylor polynomials and series, error bounds. */
import { Frac } from '../../fraction';
import { attempt, defineTopic, distinctDistractors, offset, strOpt } from '../../generator';
import { Poly } from '../../polynomial';
import type { Rng } from '../../rng';
import { decimal, m, num, sum } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import { lead } from './common';

const ds = (t: string) => `\\displaystyle ${t}`;
const series = (body: string, from = 1) => `\\sum_{n=${from}}^{\\infty} ${body}`;
const fr = (a: string, b: string) => `\\frac{${a}}{${b}}`;
/** n + k tidily. */
const np = (k: number, v = 'n') => (k === 0 ? v : `${v} ${k > 0 ? '+' : '-'} ${Math.abs(k)}`);
const nPow = (p: Frac) => (p.eq(1) ? 'n' : p.eq(new Frac(1, 2)) ? '\\sqrt{n}' : p.isInt() ? `n^{${p.n}}` : `n^{${p.toTex()}}`);

const CONV = 'Converges';
const DIV = 'Diverges';

// ---------------------------------------------------------------- sequences

export const sequenceConvergence = defineTopic({
  id: 'calc.sequence-convergence',
  subject: 'calculus',
  category: 'Infinite Sequences and Series',
  title: 'Convergence of Sequences',
  description: 'Decide whether a sequence converges and find its limit: rational, exponential, factorial-free, oscillating and (1 + k/n)ⁿ forms.',
  instruction: 'Determine whether each sequence converges or diverges. If it converges, find its limit.',
  multipleChoice: true,
  defaultCount: 10,
  options: [],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const POOL: Record<Difficulty, string[]> = { easy: ['rational', 'rational', 'recip'], medium: ['rational', 'expo', 'alt', 'logn'], hard: ['eLimit', 'alt', 'sinOver', 'expo', 'rootN', 'rational'] };
    const kind = rng.pick(POOL[difficulty]);
    let body: string;
    let limit: Frac | 'div' | { tex: string; v: number };
    let wrongs: string[];
    const steps: string[] = [];
    switch (kind) {
      case 'rational': {
        const dn = rng.int(1, 3);
        const rel = rng.pick(['eq', 'eq', 'lower', 'higher']);
        const dd = rel === 'eq' ? dn : rel === 'lower' ? dn + 1 : dn - 1 || 1;
        const P = randPolyN(rng, rel === 'higher' ? dd + 1 : dn);
        const Q = randPolyN(rng, dd, true);
        body = fr(P.toTex('n'), Q.toTex('n'));
        limit = P.degree === Q.degree ? P.lead().div(Q.lead()) : P.degree < Q.degree ? Frac.ZERO : 'div';
        steps.push(P.degree === Q.degree ? 'Equal degrees: the limit is the ratio of leading coefficients.' : P.degree < Q.degree ? 'The denominator has the higher degree, so the terms approach $0$.' : 'The numerator has the higher degree, so the terms grow without bound.');
        wrongs = [num(P.lead().div(Q.lead()).neg()), '0', num(P.coef(0).isZero() || Q.coef(0).isZero() ? new Frac(1) : P.coef(0).div(Q.coef(0)))];
        break;
      }
      case 'recip': {
        const c = rng.signedInt(1, 9, true);
        const k = rng.int(1, 9);
        body = `${c} + \\frac{${k}}{n}`;
        limit = new Frac(c);
        steps.push('$\\frac{k}{n} \\to 0$');
        wrongs = [String(c + k), String(k), '0'];
        break;
      }
      case 'expo': {
        const a = rng.int(2, 5);
        const b = rng.int(2, 5);
        const grow = rng.bool(0.4);
        body = grow ? fr(`${a}^{n}`, `${a * b}n`) : fr(`${lead(rng.int(1, 5))}n${rng.bool() ? '^{2}' : ''}`, `${a}^{n}`);
        limit = grow ? 'div' : Frac.ZERO;
        steps.push(grow ? 'Exponentials grow faster than polynomials: the terms grow without bound.' : 'Exponentials grow faster than polynomials, so the terms approach $0$.');
        wrongs = ['0', '1', num(new Frac(1, a))];
        break;
      }
      case 'alt': {
        const k = rng.int(1, 9);
        const conv = rng.bool(0.5);
        body = conv ? fr(`(-1)^{n}`, `n + ${k}`) : fr(`(-1)^{n} n`, `n + ${k}`);
        limit = conv ? Frac.ZERO : 'div';
        steps.push(conv ? 'The terms are squeezed between $\\pm\\frac{1}{n}$-type bounds and approach $0$.' : 'The terms alternate near $1$ and $-1$, so the limit does not exist.');
        wrongs = ['1', '-1', conv ? 'div' : '0'];
        break;
      }
      case 'logn': {
        const p = rng.int(1, 2);
        const c = rng.int(1, 5);
        body = fr(`${c === 1 ? '' : c}\\ln n`, p === 1 ? 'n' : `n^{${p}}`);
        limit = Frac.ZERO;
        steps.push("L'Hôpital's rule on $\\frac{\\ln x}{x^{p}}$ gives $0$.");
        wrongs = ['1', String(c), 'div'];
        break;
      }
      case 'eLimit': {
        const k = rng.signedInt(1, 4, true);
        const c = rng.int(1, 2);
        body = `\\left(1 ${k < 0 ? '-' : '+'} \\frac{${Math.abs(k)}}{${c === 1 ? '' : c}n}\\right)^{n}`;
        const e = new Frac(k, c);
        limit = { tex: e.eq(1) ? 'e' : `e^{${num(e)}}`, v: Math.exp(e.value) };
        steps.push(`$\\left(1 + \\frac{a}{n}\\right)^{n} \\to e^{a}$ with $a = ${num(e)}$`);
        wrongs = ['1', e.neg().eq(1) ? 'e' : `e^{${num(e.neg())}}`, e.eq(1) ? 'e^{2}' : 'e'];
        break;
      }
      case 'sinOver': {
        const k = rng.int(1, 5);
        const fn = rng.pick(['sin', 'cos']);
        body = fr(`\\${fn} n`, `${k === 1 ? '' : k}n`);
        limit = Frac.ZERO;
        steps.push(`Squeeze: $-\\frac{1}{${k === 1 ? '' : k}n} \\le a_{n} \\le \\frac{1}{${k === 1 ? '' : k}n}$`);
        wrongs = ['1', num(new Frac(1, k)), 'div'];
        break;
      }
      case 'rootN':
      default: {
        const k = rng.int(2, 9);
        body = `\\sqrt[n]{${k}}`;
        limit = Frac.ONE;
        steps.push(`$${k}^{1/n} \\to ${k}^{0} = 1$`);
        wrongs = ['0', String(k), 'div'];
        break;
      }
    }
    const show = (l: typeof limit | string) => (l === 'div' ? DIV : `${CONV} to $${typeof l === 'string' ? l : l instanceof Frac ? num(l) : l.tex}$`);
    const answer = show(limit);
    return {
      question: m(ds(`a_{n} = ${body}`)),
      answer,
      steps: [...steps, answer],
      distractors: distinctDistractors(answer, [...wrongs.map((w) => show(w)), DIV], (q) => show(String(q + 2))),
      check: { kind: 'calculus.sequence' },
    };
  },
});

function randPolyN(rng: Rng, deg: number, positive = false): Poly {
  return attempt('npoly', () => {
    const c = Array.from({ length: deg + 1 }, (_, i) => (i === deg ? (positive ? rng.int(1, 7) : rng.signedInt(1, 7, true)) : rng.bool(0.6) ? (positive ? rng.int(1, 9) : rng.int(-9, 9)) : 0));
    const p = new Poly(c);
    return p.degree === deg ? p : null;
  });
}

// ---------------------------------------------------------------- geometric series and the nth-term test

export const geometricSeries = defineTopic({
  id: 'calc.geometric-series',
  subject: 'calculus',
  category: 'Infinite Sequences and Series',
  title: 'Geometric Series and the nth-Term Test',
  description: 'Sums of convergent geometric series (any starting index), divergent geometric series, and divergence by the nth-term test.',
  instruction: 'Determine whether each series converges or diverges. If it converges, find its sum.',
  multipleChoice: true,
  defaultCount: 10,
  options: [{ type: 'boolean', id: 'nth', label: 'Include nth-term test problems', default: true }],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const nth = ctx.options.nth !== false && rng.bool(0.3);
    const steps: string[] = [];
    if (nth) {
      const P = randPolyN(rng, rng.int(1, 2), true);
      const Q = new Poly([...P.c.slice(0, -1).map((c) => c.add(rng.int(0, 3))), P.lead().mul(rng.int(2, 4))]);
      const body = fr(P.toTex('n'), Q.toTex('n'));
      const L = P.lead().div(Q.lead());
      const answer = `${DIV} (nth-term test: the terms approach $${num(L)}$)`;
      steps.push(`$\\displaystyle \\lim_{n \\to \\infty} ${body} = ${num(L)} \\ne 0$`);
      return {
        question: m(ds(series(body))),
        answer,
        steps: [...steps, answer],
        distractors: distinctDistractors(answer, [`${CONV} to $${num(L)}$`, `${CONV} to $${num(L.div(new Frac(1).sub(L)))}$`, `${CONV} (the terms approach $${num(L)}$)`], () => null),
        check: { kind: 'calculus.series' },
      };
    }
    // a·r^n from n = k
    const r = rng.pick(difficulty === 'easy' ? [new Frac(1, 2), new Frac(1, 3), new Frac(2, 3), new Frac(-1, 2), new Frac(3, 2)] : [new Frac(1, 2), new Frac(-1, 3), new Frac(2, 5), new Frac(-3, 4), new Frac(5, 4), new Frac(-4, 3), new Frac(3, 5), new Frac(1, 4)]);
    const a = rng.signedInt(1, 6, true);
    const k = difficulty === 'easy' ? rng.int(0, 1) : rng.int(0, 2);
    const shift = difficulty === 'hard' && rng.bool(0.5) ? rng.int(1, 2) : 0;
    // body a·r^{n − shift}
    const rTex = r.isInt() ? String(r.n) : `\\left(${num(r)}\\right)`;
    const body = `${a === 1 ? '' : a === -1 ? '-' : a}${rTex}^{${np(-shift)}}`;
    const conv = r.abs().cmp(1) < 0;
    const first = r.pow(k - shift).mul(a);
    let answer: string;
    if (conv) {
      const S = first.div(new Frac(1).sub(r));
      answer = `${CONV} to $${num(S)}$`;
      steps.push(`Geometric with $r = ${num(r)}$, $|r| < 1$, first term $${num(first)}$`, `$S = \\frac{${num(first)}}{1 - ${r.sign < 0 ? `\\left(${num(r)}\\right)` : num(r)}} = ${num(S)}$`);
      const wrongS = [new Frac(a).div(new Frac(1).sub(r)), first.div(new Frac(1).add(r)), S.neg(), first.mul(r).div(new Frac(1).sub(r))];
      return {
        question: m(ds(series(body, k))),
        answer,
        steps: [...steps, answer],
        distractors: distinctDistractors(answer, [...wrongS.map((w) => `${CONV} to $${num(w)}$`), DIV], (q) => `${CONV} to $${num(S.add(offset(q)))}$`),
        check: { kind: 'calculus.series' },
      };
    }
    answer = `${DIV} ($|r| = ${num(r.abs())} \\ge 1$)`;
    steps.push(`Geometric with $r = ${num(r)}$`);
    const fake = first.div(new Frac(1).sub(r));
    return {
      question: m(ds(series(body, k))),
      answer,
      steps: [...steps, answer],
      distractors: distinctDistractors(answer, [`${CONV} to $${num(fake)}$`, `${CONV} to $${num(fake.neg())}$`, `${CONV} to $${num(new Frac(a))}$`], (q) => `${CONV} to $${num(fake.add(offset(q)))}$`),
      check: { kind: 'calculus.series' },
    };
  },
});

// ---------------------------------------------------------------- integral test and p-series

const verdicts = (conv: boolean, reason: string, wrongReason: string) => ({
  answer: `${conv ? CONV : DIV} (${reason})`,
  wrongs: [`${conv ? DIV : CONV} (${reason})`, `${conv ? DIV : CONV} (${wrongReason})`, `${CONV} by the nth-term test`, 'The test is inconclusive'],
});

export const pSeries = defineTopic({
  id: 'calc.p-series',
  subject: 'calculus',
  category: 'Infinite Sequences and Series',
  title: 'The Integral Test and p-Series',
  description: 'Convergence of p-series and of series decided by the integral test.',
  instruction: 'Determine whether each series converges or diverges.',
  multipleChoice: true,
  defaultCount: 10,
  options: [],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const kind = rng.pick(difficulty === 'easy' ? ['p', 'p'] : difficulty === 'medium' ? ['p', 'pShift', 'integral'] : ['integral', 'pShift', 'integral']);
    let body: string;
    let conv: boolean;
    let reason: string;
    let steps: string[];
    if (kind === 'p' || kind === 'pShift') {
      const p = rng.pick([new Frac(1, 2), new Frac(1), new Frac(3, 2), new Frac(2), new Frac(3), new Frac(5, 2), new Frac(1, 3), new Frac(4)]);
      const c = rng.int(1, 9);
      conv = p.cmp(1) > 0;
      if (kind === 'p') {
        body = fr(String(c), nPow(p));
      } else {
        const k = rng.int(1, 5);
        body = p.eq(new Frac(1, 2)) ? fr(String(c), `\\sqrt{n + ${k}}`) : p.isInt() ? fr(String(c), p.eq(1) ? `n + ${k}` : `(n + ${k})^{${p.n}}`) : fr(String(c), `(n + ${k})^{${p.toTex()}}`);
      }
      reason = `$p$-series with $p = ${num(p)}$`;
      steps = [`Compare with $\\sum \\frac{1}{n^{p}}$, $p = ${num(p)}$ ${conv ? '> 1' : '\\le 1'}.`];
    } else {
      const f = rng.pick(['nexp', 'lnSq', 'ln', 'recipQuad', 'nOverQuad']);
      const a = rng.int(1, 4);
      switch (f) {
        case 'nexp':
          body = `n e^{-${a === 1 ? '' : a}n^{2}}`;
          conv = true;
          break;
        case 'lnSq':
          body = fr('\\ln n', `n^{${rng.int(2, 3)}}`);
          conv = true;
          break;
        case 'ln':
          body = fr(`${a === 1 ? '' : a}\\ln n`, 'n');
          conv = false;
          break;
        case 'recipQuad':
          body = fr(String(a), `n^{2} + ${rng.int(1, 9)}`);
          conv = true;
          break;
        default:
          body = fr(`${a === 1 ? '' : a}n`, `n^{2} + ${rng.int(1, 9)}`);
          conv = false;
          break;
      }
      reason = 'integral test';
      steps = [`The function is positive, continuous and decreasing; $\\int_{1}^{\\infty} f(x)\\,dx$ ${conv ? 'converges' : 'diverges'}.`];
    }
    const v = verdicts(conv, reason, conv ? 'integral test' : 'harmonic comparison');
    return {
      question: m(ds(series(body))),
      answer: v.answer,
      steps: [...steps, v.answer],
      distractors: distinctDistractors(v.answer, v.wrongs, () => null),
      check: { kind: 'calculus.series' },
    };
  },
});

// ---------------------------------------------------------------- comparison tests

export const comparisonTests = defineTopic({
  id: 'calc.comparison-tests',
  subject: 'calculus',
  category: 'Infinite Sequences and Series',
  title: 'Comparison and Limit Comparison Tests',
  description: 'Decide convergence by direct comparison or limit comparison with p-series and geometric series.',
  instruction: 'Determine whether each series converges or diverges. Name the series you compare with.',
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'test',
      label: 'Test',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'direct', label: 'Direct comparison' },
        { value: 'limit', label: 'Limit comparison' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng } = ctx;
    const tOpt = strOpt(ctx, 'test');
    const test = tOpt === 'any' ? rng.pick(['direct', 'limit']) : tOpt;
    let body: string;
    let conv: boolean;
    let cmp: string;
    let wrongCmp: string;
    const k = rng.int(1, 9);
    const c = rng.int(1, 5);
    if (test === 'direct') {
      const f = rng.pick(['sq', 'geo', 'trig', 'root', 'harm']);
      switch (f) {
        case 'sq':
          body = fr(String(c), `n^{2} + ${k}`);
          conv = true;
          cmp = `\\frac{${c}}{n^{2}}`;
          wrongCmp = '\\frac{1}{n}';
          break;
        case 'geo': {
          const b = rng.int(2, 5);
          body = fr(String(c), `${b}^{n} + ${k}`);
          conv = true;
          cmp = `\\frac{${c}}{${b}^{n}}`;
          wrongCmp = '\\frac{1}{n}';
          break;
        }
        case 'trig': {
          const fn = rng.pick(['sin', 'cos']);
          body = fr(`\\${fn}^{2} n`, `n^{${rng.int(2, 3)}}`);
          conv = true;
          cmp = '\\frac{1}{n^{2}}';
          wrongCmp = '\\frac{1}{n}';
          break;
        }
        case 'root':
          body = fr(String(c), `\\sqrt{n} - ${rng.pick([new Frac(1, 2), new Frac(1, 3)]).toTex()}`);
          conv = false;
          cmp = `\\frac{${c}}{\\sqrt{n}}`;
          wrongCmp = '\\frac{1}{n^{2}}';
          break;
        case 'harm':
        default:
          body = fr(`${k + 1} + \\cos n`, 'n');
          conv = false;
          cmp = `\\frac{${k}}{n}`;
          wrongCmp = '\\frac{1}{n^{2}}';
          break;
      }
    } else {
      const f = rng.pick(['rat2', 'rat1', 'root', 'sqrtQuad', 'expo']);
      switch (f) {
        case 'rat2':
          body = fr(`${lead(c)}n + ${k}`, `n^{3} + ${rng.int(1, 9)}`);
          conv = true;
          cmp = '\\frac{1}{n^{2}}';
          wrongCmp = '\\frac{1}{n}';
          break;
        case 'rat1': {
          const lc = rng.int(1, 4);
          body = fr(`${lead(c)}n^{2} + ${k}`, `${lc === 1 ? '' : lc}n^{3} + ${rng.int(1, 9)}`);
          conv = false;
          cmp = '\\frac{1}{n}';
          wrongCmp = '\\frac{1}{n^{2}}';
          break;
        }
        case 'root':
          body = fr('\\sqrt{n}', `n^{2} + ${k}`);
          conv = true;
          cmp = '\\frac{1}{n^{\\frac{3}{2}}}';
          wrongCmp = '\\frac{1}{\\sqrt{n}}';
          break;
        case 'sqrtQuad':
          body = fr(String(c), `\\sqrt{n^{2} + ${k}}`);
          conv = false;
          cmp = '\\frac{1}{n}';
          wrongCmp = '\\frac{1}{n^{2}}';
          break;
        case 'expo':
        default: {
          const a = rng.int(2, 4);
          const b = a + rng.int(1, 3);
          body = fr(`${a}^{n} + ${k}`, `${b}^{n}`);
          conv = true;
          cmp = `\\left(\\frac{${a}}{${b}}\\right)^{n}`;
          wrongCmp = '\\frac{1}{n}';
          break;
        }
      }
    }
    const reason = (s: string) => `compare with $\\sum ${s}$`;
    const answer = `${conv ? CONV : DIV}; ${reason(cmp)}`;
    const wrongs = [`${conv ? DIV : CONV}; ${reason(cmp)}`, `${conv ? DIV : CONV}; ${reason(wrongCmp)}`, `${conv ? CONV : DIV}; ${reason(wrongCmp)}`, 'The test is inconclusive'];
    return {
      question: m(ds(series(body))),
      answer,
      steps: [test === 'direct' ? `Compare term by term with $${cmp}$.` : `$\\displaystyle \\lim_{n \\to \\infty} \\frac{a_{n}}{b_{n}}$ is finite and positive with $b_{n} = ${cmp}$.`, answer],
      distractors: distinctDistractors(answer, wrongs, () => null),
      check: { kind: 'calculus.series' },
    };
  },
});

// ---------------------------------------------------------------- ratio and root tests

export const ratioRootTests = defineTopic({
  id: 'calc.ratio-root-tests',
  subject: 'calculus',
  category: 'Infinite Sequences and Series',
  title: 'The Ratio and Root Tests',
  description: 'Use the ratio or root test: find the limit L and decide convergence.',
  instruction: 'Use the ratio test or the root test to determine whether each series converges or diverges.',
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'test',
      label: 'Test',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'ratio', label: 'Ratio test' },
        { value: 'root', label: 'Root test' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const tOpt = strOpt(ctx, 'test');
    const test = tOpt === 'any' ? rng.pick(['ratio', 'ratio', 'root']) : tOpt;
    let body: string;
    let L: Frac | 'inf';
    const a = rng.int(2, 6);
    const p = rng.int(1, 3);
    if (test === 'ratio') {
      const f = rng.pick(difficulty === 'easy' ? ['polyExp', 'expFact', 'expPoly'] : ['polyExp', 'expFact', 'factExp', 'factSq', 'expPoly']);
      switch (f) {
        case 'polyExp':
          body = fr(p === 1 ? 'n' : `n^{${p}}`, `${a}^{n}`);
          L = new Frac(1, a);
          break;
        case 'expFact':
          body = fr(`${a}^{n}`, 'n!');
          L = Frac.ZERO;
          break;
        case 'factExp':
          body = fr('n!', `${a}^{n}`);
          L = 'inf';
          break;
        case 'factSq':
          body = fr('(n!)^{2}', '(2n)!');
          L = new Frac(1, 4);
          break;
        case 'expPoly':
        default: {
          const b = rng.int(2, 5);
          const c = b + rng.int(1, 3);
          const up = rng.bool();
          body = up ? fr(`${c}^{n}`, `${p === 1 ? 'n' : `n^{${p}}`}${b}^{n}`) : fr(`${b}^{n}`, `${p === 1 ? 'n' : `n^{${p}}`}${c}^{n}`);
          L = up ? new Frac(c, b) : new Frac(b, c);
          break;
        }
      }
    } else {
      const f = rng.pick(['ratioPow', 'ratioPowUp', 'powN']);
      const b = rng.int(1, 4);
      const c = rng.int(1, 5);
      if (f === 'ratioPow') {
        const den = b + rng.int(1, 3);
        body = `\\left(${fr(`${b === 1 ? '' : b}n + ${c}`, `${den}n + 1`)}\\right)^{n}`;
        L = new Frac(b, den);
      } else if (f === 'ratioPowUp') {
        const d = b + rng.int(1, 3);
        body = `\\left(${fr(`${d}n + ${c}`, `${b === 1 ? '' : b}n + 1`)}\\right)^{n}`;
        L = new Frac(d, b);
      } else {
        body = `\\frac{${c + 1}^{n}}{n^{n}}`;
        L = Frac.ZERO;
      }
    }
    const conv = L !== 'inf' && L.cmp(1) < 0;
    const lTex = (l: Frac | 'inf') => (l === 'inf' ? '\\infty' : num(l));
    const answer = `${conv ? CONV : DIV} ($L = ${lTex(L)}$)`;
    const wrongL = L === 'inf' ? Frac.ZERO : L.isZero() ? new Frac(1) : L.inv();
    return {
      question: m(ds(series(body))),
      answer,
      steps: [test === 'ratio' ? '$L = \\lim_{n \\to \\infty} \\left|\\frac{a_{n+1}}{a_{n}}\\right|$' : '$L = \\lim_{n \\to \\infty} \\sqrt[n]{|a_{n}|}$', answer],
      distractors: distinctDistractors(answer, [`${conv ? DIV : CONV} ($L = ${lTex(L)}$)`, `${conv ? DIV : CONV} ($L = ${lTex(wrongL)}$)`, `${CONV} ($L = ${lTex(wrongL)}$)`, `The test is inconclusive ($L = 1$)`], () => null),
      check: { kind: 'calculus.series', L: L === 'inf' ? 'inf' : L.value, test },
    };
  },
});

// ---------------------------------------------------------------- alternating series

export const alternatingSeries = defineTopic({
  id: 'calc.alternating-series',
  subject: 'calculus',
  category: 'Infinite Sequences and Series',
  title: 'Alternating Series',
  description: 'Absolute versus conditional convergence, the alternating series test, and the alternating series error bound.',
  instruction: (o) => (o.task === 'error' ? 'Use the alternating series error bound to answer each question.' : 'Determine whether each series converges absolutely, converges conditionally, or diverges.'),
  multipleChoice: true,
  defaultCount: 8,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Task',
      default: 'classify',
      choices: [
        { value: 'classify', label: 'Absolute / conditional / divergent' },
        { value: 'error', label: 'Error bound' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const error = strOpt(ctx, 'task') === 'error';
    const sgn = rng.pick(['(-1)^{n}', '(-1)^{n+1}']);
    if (!error) {
      const f = rng.pick(difficulty === 'easy' ? ['p', 'p', 'div'] : ['p', 'rat', 'div', 'expFact', 'p']);
      let body: string;
      let kind: 'abs' | 'cond' | 'div';
      switch (f) {
        case 'p': {
          const p = rng.pick([new Frac(1, 2), new Frac(1), new Frac(2), new Frac(3, 2), new Frac(3), new Frac(1, 3)]);
          const c = rng.int(1, 5);
          body = fr(`${sgn}${c === 1 ? '' : ` \\cdot ${c}`}`, nPow(p));
          kind = p.cmp(1) > 0 ? 'abs' : 'cond';
          break;
        }
        case 'rat': {
          const k = rng.int(1, 9);
          const conv2 = rng.bool();
          body = conv2 ? fr(sgn, `n^{2} + ${k}`) : fr(`${sgn}n`, `n^{2} + ${k}`);
          kind = conv2 ? 'abs' : 'cond';
          break;
        }
        case 'div': {
          const k = rng.int(1, 9);
          const c = rng.int(1, 5);
          body = fr(`${sgn}${c === 1 ? '' : c}n`, `n + ${k}`);
          kind = 'div';
          break;
        }
        case 'expFact':
        default: {
          const a = rng.int(2, 5);
          body = fr(`${sgn}${a}^{n}`, 'n!');
          kind = 'abs';
          break;
        }
      }
      const labels = { abs: `${CONV} absolutely`, cond: `${CONV} conditionally`, div: DIV };
      const answer = labels[kind];
      const steps = kind === 'div' ? ['The terms do not approach $0$ (nth-term test).'] : kind === 'cond' ? ['The terms decrease to $0$ (alternating series test), but $\\sum |a_{n}|$ diverges.'] : ['$\\sum |a_{n}|$ converges.'];
      return {
        question: m(ds(series(body))),
        answer,
        steps: [...steps, answer],
        distractors: distinctDistractors(answer, [...Object.values(labels), 'Converges to $0$'], () => null),
        check: { kind: 'calculus.series', absolute: true },
      };
    }
    // error bound: |S − S_N| ≤ a_{N+1}
    const p = rng.int(1, 3);
    const c = rng.int(1, 3);
    const N = rng.int(3, difficulty === 'hard' ? 9 : 6);
    const fact = difficulty === 'hard' && rng.bool(0.5);
    const body = fact ? fr(`(-1)^{n+1}`, 'n!') : fr(`(-1)^{n+1}${c === 1 ? '' : ` \\cdot ${c}`}`, p === 1 ? 'n' : `n^{${p}}`);
    const next = fact ? new Frac(1, factorialN(N + 1)) : new Frac(c, (N + 1) ** p);
    const answer = `$|S - S_{${N}}| \\le ${num(next)}$`;
    const wrongs = [fact ? new Frac(1, factorialN(N)) : new Frac(c, N ** p), fact ? new Frac(1, factorialN(N + 2)) : new Frac(c, (N + 2) ** p), next.mul(2)].map((w) => `$|S - S_{${N}}| \\le ${num(w)}$`);
    return {
      question: `$${ds(series(body))}$; bound the error in using $S_{${N}}$ (the sum of the first $${N}$ terms)`,
      answer,
      steps: [`The error is at most the first omitted term: $|a_{${N + 1}}|$.`, answer],
      distractors: distinctDistractors(answer, wrongs, (k) => `$|S - S_{${N}}| \\le ${num(next.add(new Frac(offset(k), 100)).abs())}$`),
      check: { kind: 'calculus.alterror', N },
    };
  },
});

function factorialN(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

// ---------------------------------------------------------------- power series: radius and interval

export const powerSeriesInterval = defineTopic({
  id: 'calc.power-series-interval',
  subject: 'calculus',
  category: 'Infinite Sequences and Series',
  title: 'Radius and Interval of Convergence',
  description: 'Radius and interval of convergence of power series, with endpoint checks.',
  instruction: 'Find the radius and interval of convergence of each power series.',
  multipleChoice: true,
  defaultCount: 8,
  options: [],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const kind = rng.pick(difficulty === 'easy' ? ['basic', 'basic', 'infinite'] : difficulty === 'medium' ? ['basic', 'scaled', 'infinite', 'zero'] : ['basic', 'scaled', 'alt', 'infinite', 'zero']);
    const a = difficulty === 'easy' ? rng.int(-2, 2) : rng.int(-4, 4);
    const xa = a === 0 ? 'x' : `(${np(-a, 'x')})`;
    const xn = `${xa}^{n}`;
    const steps: string[] = [];
    let body: string;
    let answer: string;
    let wrongs: string[];
    const iv = (lo: number, hi: number, l: boolean, r: boolean) => `${l ? '[' : '('}${lo}, ${hi}${r ? ']' : ')'}`;
    const show = (R: string, interval: string) => `$R = ${R}$; interval $${interval}$`;
    if (kind === 'infinite') {
      const b = rng.int(1, 4);
      body = b === 1 ? fr(xn, 'n!') : fr(xn, `${b}^{n} n!`);
      answer = show('\\infty', '(-\\infty, \\infty)');
      steps.push('Ratio test: $L = 0 < 1$ for every $x$.');
      wrongs = [show('0', `[${a}, ${a}]`), show(String(b), iv(a - b, a + b, false, false)), show('1', iv(a - 1, a + 1, true, false))];
    } else if (kind === 'zero') {
      body = `n! ${xn}`;
      answer = `$R = 0$; converges only at $x = ${a}$`;
      steps.push('Ratio test: $L = \\infty$ unless $x = ' + a + '$.');
      wrongs = [show('\\infty', '(-\\infty, \\infty)'), show('1', iv(a - 1, a + 1, false, false)), show('1', iv(a - 1, a + 1, true, true))];
    } else {
      // (x − a)^n / (b^n n^p): R = b; right endpoint Σ1/n^p, left Σ(−1)^n/n^p
      const b = kind === 'basic' ? 1 : rng.int(2, 5);
      const p = rng.pick([0, 1, 2, 1]);
      const alt = kind === 'alt';
      const den = [b === 1 ? '' : `${b}^{n}`, p === 0 ? '' : p === 1 ? 'n' : `n^{${p}}`].filter(Boolean).join(' ');
      body = den ? fr(`${alt ? '(-1)^{n}' : ''}${xn}`, den) : `${alt ? '(-1)^{n}' : ''}${xn}`;
      const lo = a - b;
      const hi = a + b;
      // at x = a + b the series is Σ(±1)^n/n^p; at a − b the signs flip
      const convRight = alt ? p >= 1 : p >= 2;
      const convLeft = alt ? p >= 2 : p >= 1;
      answer = show(String(b), iv(lo, hi, convLeft, convRight));
      steps.push(`Ratio test: $\\frac{|${np(-a, 'x')}|}{${b}} < 1$, so $R = ${b}$.`, `Check $x = ${lo}$ and $x = ${hi}$ separately.`);
      wrongs = [show(String(b), iv(lo, hi, !convLeft, convRight)), show(String(b), iv(lo, hi, convLeft, !convRight)), show(String(b), iv(lo, hi, !convLeft, !convRight)), show(String(b + 1), iv(a - b - 1, a + b + 1, convLeft, convRight))];
    }
    return {
      question: m(ds(series(body))),
      answer,
      steps: [...steps, answer],
      distractors: distinctDistractors(answer, wrongs, () => null),
      check: { kind: 'calculus.powerseries' },
    };
  },
});

// ---------------------------------------------------------------- Taylor polynomials

interface TaylorF {
  tex: string;
  a: number;
  /** coefficient of (x − a)^k */
  coef: (k: number) => Frac;
}

function taylorFamily(rng: Rng, d: Difficulty): TaylorF {
  const kinds = d === 'easy' ? ['exp', 'sin', 'cos', 'geo'] : d === 'medium' ? ['exp', 'sin', 'cos', 'ln1', 'geo', 'recip'] : ['lnx', 'sqrt', 'recip', 'exp', 'ln1', 'poly'];
  const kind = rng.pick(kinds);
  const fact = (k: number) => factorialN(k);
  switch (kind) {
    case 'exp': {
      const k = rng.signedInt(1, 3, true);
      return { tex: `e^{${k === 1 ? '' : k === -1 ? '-' : k}x}`, a: 0, coef: (j) => new Frac(k ** j, fact(j)) };
    }
    case 'sin':
    case 'cos': {
      const k = rng.int(1, 3);
      const sin = kind === 'sin';
      return { tex: `\\${kind}${k === 1 ? ' x' : ` ${k}x`}`, a: 0, coef: (j) => ((sin ? j % 2 === 1 : j % 2 === 0) ? new Frac((sin ? (j % 4 === 1 ? 1 : -1) : j % 4 === 0 ? 1 : -1) * k ** j, fact(j)) : Frac.ZERO) };
    }
    case 'geo': {
      const k = rng.signedInt(1, 3, true);
      return { tex: `\\frac{1}{1 ${k > 0 ? '-' : '+'} ${Math.abs(k) === 1 ? '' : Math.abs(k)}x}`, a: 0, coef: (j) => new Frac(k ** j) };
    }
    case 'ln1':
      return { tex: '\\ln(1 + x)', a: 0, coef: (j) => (j === 0 ? Frac.ZERO : new Frac(j % 2 === 1 ? 1 : -1, j)) };
    case 'lnx':
      return { tex: '\\ln x', a: 1, coef: (j) => (j === 0 ? Frac.ZERO : new Frac(j % 2 === 1 ? 1 : -1, j)) };
    case 'recip': {
      const a = rng.int(1, 3);
      // 1/x = Σ (−1)^j (x − a)^j / a^{j+1}
      return { tex: '\\frac{1}{x}', a, coef: (j) => new Frac(j % 2 === 0 ? 1 : -1, a ** (j + 1)) };
    }
    case 'sqrt': {
      const r = rng.pick([1, 2]);
      const a = r * r;
      // √x about a = r²: binomial coefficients C(1/2, j) r^{1 − 2j}
      return {
        tex: '\\sqrt{x}',
        a,
        coef: (j) => {
          let c = new Frac(1);
          for (let i = 0; i < j; i++) c = c.mul(new Frac(1, 2).sub(i)).div(i + 1);
          return c.mul(new Frac(r).pow(1 - 2 * j));
        },
      };
    }
    case 'poly':
    default: {
      const p = new Poly([rng.int(-5, 5), rng.int(-4, 4), rng.int(-3, 3), rng.signedInt(1, 2, true)]);
      const a = rng.signedInt(1, 2, true);
      // coefficients p^{(j)}(a)/j!
      return {
        tex: p.toTex(),
        a,
        coef: (j) => {
          let q = p;
          for (let i = 0; i < j; i++) q = q.derivative();
          return q.eval(a).div(fact(j));
        },
      };
    }
  }
}

function taylorTex(F: TaylorF, n: number, scale: (j: number) => Frac = () => Frac.ONE): string {
  const xa = F.a === 0 ? 'x' : `(${np(-F.a, 'x')})`;
  return sum(Array.from({ length: n + 1 }, (_, j) => ({ coef: F.coef(j).mul(scale(j)), sym: j === 0 ? '' : j === 1 ? xa : `${xa}^{${j}}` })));
}

export const taylorPolynomials = defineTopic({
  id: 'calc.taylor-polynomials',
  subject: 'calculus',
  category: 'Infinite Sequences and Series',
  title: 'Taylor and Maclaurin Polynomials',
  description: 'nth-degree Taylor polynomials about x = a, and approximating function values with them.',
  instruction: (o) => (o.task === 'approx' ? 'Use the Taylor polynomial to approximate the value. Round to four decimal places.' : 'Find the Taylor polynomial of the given degree about the given center.'),
  multipleChoice: true,
  defaultCount: 8,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Task',
      default: 'poly',
      choices: [
        { value: 'poly', label: 'Find the polynomial' },
        { value: 'approx', label: 'Approximate a value' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const approx = strOpt(ctx, 'task') === 'approx';
    const F = taylorFamily(rng, difficulty);
    const n = approx ? rng.int(2, 3) : rng.int(2, difficulty === 'easy' ? 3 : 4);
    const P = taylorTex(F, n);
    if (P === '0' || /^-?\d+$/.test(P)) return taylorPolynomials.generate({ ...ctx, rng: rng.fork('zero') });
    const where = F.a === 0 ? 'Maclaurin polynomial' : `Taylor polynomial about $x = ${F.a}$`;
    if (!approx) {
      const answer = m(`P_{${n}}(x) = ${P}`);
      const wrongs = [taylorTex(F, n, (j) => new Frac(factorialN(j))), taylorTex(F, n, (j) => new Frac(j % 2 === 1 ? -1 : 1)), taylorTex(F, n + 1), taylorTex(F, n - 1)].map((w) => m(`P_{${n}}(x) = ${w}`));
      return {
        question: `$f(x) = ${F.tex}$; degree-$${n}$ ${where}${F.a === 0 ? ' (about $x = 0$)' : ''}`,
        answer,
        steps: [`$P_{${n}}(x) = \\sum_{k=0}^{${n}} \\frac{f^{(k)}(${F.a})}{k!}${F.a === 0 ? 'x' : `(${np(-F.a, 'x')})`}^{k}$`, answer],
        distractors: distinctDistractors(answer, wrongs, (k) => m(`P_{${n}}(x) = ${P} + ${Math.abs(offset(k)) === 1 ? '' : Math.abs(offset(k))}x^{${n + 1}}`)),
        check: { kind: 'calculus.taylor', n, a: F.a },
      };
    }
    const h = rng.pick([new Frac(1, 10), new Frac(-1, 10), new Frac(1, 5), new Frac(3, 10)]);
    const b = h.add(F.a);
    const val = Array.from({ length: n + 1 }, (_, j) => F.coef(j).mul(h.pow(j))).reduce((s, c) => s.add(c), Frac.ZERO);
    const show = (v: number) => m(`f(${decimal(b.value, 2)}) \\approx ${decimal(v, 4)}`);
    const answer = show(val.value);
    const lower = Array.from({ length: n }, (_, j) => F.coef(j).mul(h.pow(j))).reduce((s, c) => s.add(c), Frac.ZERO);
    return {
      question: `$f(x) = ${F.tex}$; use the degree-$${n}$ ${where}${F.a === 0 ? ' (about $x = 0$)' : ''} to approximate $f(${decimal(b.value, 2)})$`,
      answer,
      steps: [m(`P_{${n}}(x) = ${P}`), answer],
      distractors: distinctDistractors(answer, [show(lower.value), show(val.value + F.coef(n).mul(h.pow(n)).value), show(val.value - 2 * F.coef(1).mul(h).value)], (k) => show(val.value + offset(k) * 0.01)),
      check: { kind: 'calculus.taylor', n, a: F.a, approx: true },
    };
  },
});

// ---------------------------------------------------------------- known Maclaurin series

interface Mac {
  f: string;
  /** general term in n */
  term: string;
  from: number;
  how: string;
  wrongs: string[];
}

const kPow = (k: number, e = 'n') => (k === 1 ? '' : k === -1 ? `(-1)^{${e}}` : k < 0 ? `(${k})^{${e}}` : `${k}^{${e}}`);
const xp = (e: string) => (e === '1' ? 'x' : `x^{${e}}`);

function maclaurin(rng: Rng, d: Difficulty): Mac {
  const kinds = d === 'easy' ? ['expK', 'geoK', 'sinK', 'cosK', 'sinSub'] : d === 'medium' ? ['expSq', 'sinSub', 'xCos', 'geoSq', 'lnK', 'xExp'] : ['atan', 'geoDeriv', 'lnK', 'xExp', 'expSq', 'geoSq'];
  const kind = rng.pick(kinds);
  const k = rng.int(2, 5);
  const s = rng.pick([1, -1]);
  const sk = s * k;
  const mm = rng.int(1, 3);
  switch (kind) {
    case 'expK':
      return { f: `e^{${sk}x}`, term: fr(`${kPow(sk)} x^{n}`, 'n!'), from: 0, how: `Substitute $${sk}x$ into $e^{u} = \\sum \\frac{u^{n}}{n!}$.`, wrongs: [fr(`${sk}x^{n}`, 'n!'), fr(`x^{${k}n}`, 'n!'), fr(`${kPow(sk)} x^{n}`, 'n')] };
    case 'expSq':
      return { f: `e^{-${k}x^{2}}`, term: fr(`(-${k})^{n} x^{2n}`, 'n!'), from: 0, how: `Substitute $u = -${k}x^{2}$ into $e^{u}$.`, wrongs: [fr(`(-${k})^{n} x^{n}`, 'n!'), fr(`${k}^{n} x^{2n}`, 'n!'), fr(`(-1)^{n} x^{2n}`, `${k}^{n} n!`)] };
    case 'geoK':
      return { f: `\\frac{1}{1 ${s > 0 ? '-' : '+'} ${k}x}`, term: `${kPow(sk)} x^{n}`, from: 0, how: `Substitute $u = ${sk}x$ into $\\frac{1}{1 - u} = \\sum u^{n}$.`, wrongs: [`${sk}x^{n}`, `${kPow(-sk)} x^{n}`, fr('x^{n}', `${k}^{n}`)] };
    case 'geoSq':
      return { f: `\\frac{1}{1 + ${k}x^{2}}`, term: `(-${k})^{n} x^{2n}`, from: 0, how: `Substitute $u = -${k}x^{2}$ into $\\frac{1}{1 - u}$.`, wrongs: [`${k}^{n} x^{2n}`, `(-${k})^{n} x^{n}`, `(-1)^{n} ${k}x^{2n}`] };
    case 'sinSub': {
      const p = d === 'easy' ? 2 : rng.int(2, 3);
      return { f: `\\sin(x^{${p}})`, term: fr(`(-1)^{n} x^{${2 * p}n+${p}}`, '(2n+1)!'), from: 0, how: `Substitute $x^{${p}}$ into $\\sin u = \\sum \\frac{(-1)^{n}u^{2n+1}}{(2n+1)!}$.`, wrongs: [fr('(-1)^{n} x^{2n+1}', '(2n+1)!'), fr(`(-1)^{n} x^{${2 * p}n+${p}}`, '(2n)!'), fr(`x^{${2 * p}n+${p}}`, '(2n+1)!')] };
    }
    case 'sinK':
      return { f: `\\sin ${k}x`, term: fr(`(-1)^{n} ${k}^{2n+1} x^{2n+1}`, '(2n+1)!'), from: 0, how: `Substitute $${k}x$ into $\\sin u$.`, wrongs: [fr(`(-1)^{n} ${k}x^{2n+1}`, '(2n+1)!'), fr(`(-1)^{n} ${k}^{2n+1} x^{2n+1}`, '(2n)!'), fr(`${k}^{2n+1} x^{2n+1}`, '(2n+1)!')] };
    case 'cosK':
      return { f: `\\cos ${k}x`, term: fr(`(-1)^{n} ${k}^{2n} x^{2n}`, '(2n)!'), from: 0, how: `Substitute $${k}x$ into $\\cos u = \\sum \\frac{(-1)^{n}u^{2n}}{(2n)!}$.`, wrongs: [fr(`(-1)^{n} ${k}x^{2n}`, '(2n)!'), fr(`(-1)^{n} ${k}^{2n} x^{2n}`, '(2n+1)!'), fr(`${k}^{2n} x^{2n}`, '(2n)!')] };
    case 'xCos':
      return { f: `${xp(String(mm))}\\cos x`, term: fr(`(-1)^{n} x^{2n+${mm}}`, '(2n)!'), from: 0, how: `Multiply the series for $\\cos x$ by $${xp(String(mm))}$.`, wrongs: [fr('(-1)^{n} x^{2n}', '(2n)!'), fr(`(-1)^{n} x^{2n+${mm}}`, '(2n+1)!'), fr(`x^{2n+${mm}}`, '(2n)!')] };
    case 'xExp':
      return { f: `${xp(String(mm))}e^{${s < 0 ? '-' : ''}x}`, term: fr(`${s < 0 ? '(-1)^{n} ' : ''}x^{n+${mm}}`, 'n!'), from: 0, how: `Multiply the series for $e^{${s < 0 ? '-' : ''}x}$ by $${xp(String(mm))}$.`, wrongs: [fr(`${s < 0 ? '' : '(-1)^{n} '}x^{n+${mm}}`, 'n!'), fr(`${s < 0 ? '(-1)^{n} ' : ''}x^{n}`, 'n!'), fr(`${s < 0 ? '(-1)^{n} ' : ''}x^{n+${mm}}`, `(n+${mm})!`)] };
    case 'lnK':
      return { f: `\\ln(1 + ${k}x)`, term: fr(`(-1)^{n+1} ${k}^{n} x^{n}`, 'n'), from: 1, how: `Substitute $${k}x$ into $\\ln(1 + u) = \\sum_{n \\ge 1} \\frac{(-1)^{n+1}u^{n}}{n}$.`, wrongs: [fr(`(-1)^{n+1} ${k}x^{n}`, 'n'), fr(`(-1)^{n+1} ${k}^{n} x^{n}`, 'n!'), fr(`${k}^{n} x^{n}`, 'n')] };
    case 'atan': {
      const a = rng.int(1, 4);
      return a === 1
        ? { f: '\\tan^{-1} x', term: fr('(-1)^{n} x^{2n+1}', '2n+1'), from: 0, how: 'Integrate $\\frac{1}{1 + x^{2}} = \\sum (-1)^{n}x^{2n}$ term by term.', wrongs: [fr('(-1)^{n} x^{2n+1}', '(2n+1)!'), fr('(-1)^{n} x^{2n}', '2n'), fr('x^{2n+1}', '2n+1')] }
        : { f: `\\tan^{-1}(${a}x)`, term: fr(`(-1)^{n} ${a}^{2n+1} x^{2n+1}`, '2n+1'), from: 0, how: `Substitute $${a}x$ into $\\tan^{-1} u = \\sum \\frac{(-1)^{n}u^{2n+1}}{2n+1}$.`, wrongs: [fr(`(-1)^{n} ${a}x^{2n+1}`, '2n+1'), fr(`(-1)^{n} ${a}^{2n+1} x^{2n+1}`, '(2n+1)!'), fr(`${a}^{2n+1} x^{2n+1}`, '2n+1')] };
    }
    case 'geoDeriv':
    default: {
      const a = rng.int(1, 4);
      return a === 1
        ? { f: '\\frac{1}{(1 - x)^{2}}', term: 'n x^{n-1}', from: 1, how: 'Differentiate $\\frac{1}{1 - x} = \\sum x^{n}$ term by term.', wrongs: ['x^{n-1}', 'n x^{n}', '(n+1) x^{n+1}'] }
        : { f: `\\frac{${a}}{(1 - ${a}x)^{2}}`, term: `n ${a}^{n} x^{n-1}`, from: 1, how: `Differentiate $\\frac{1}{1 - ${a}x} = \\sum ${a}^{n}x^{n}$ term by term.`, wrongs: [`${a}^{n} x^{n-1}`, `n ${a}^{n} x^{n}`, `n ${a}x^{n-1}`] };
    }
  }
}

export const maclaurinSeries = defineTopic({
  id: 'calc.maclaurin-series',
  subject: 'calculus',
  category: 'Infinite Sequences and Series',
  title: 'Taylor Series from Known Maclaurin Series',
  description: 'Build Maclaurin series from those of eˣ, sin x, cos x, 1/(1 − x) and ln(1 + x) by substitution, multiplication, differentiation and integration.',
  instruction: 'Find the Maclaurin series for each function, in sigma notation.',
  multipleChoice: true,
  defaultCount: 8,
  options: [],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const M = maclaurin(rng, difficulty);
    const show = (t: string) => m(ds(`${series(t, M.from)}`));
    const answer = show(M.term);
    return {
      question: m(`f(x) = ${M.f}`),
      answer,
      steps: [M.how, answer],
      distractors: distinctDistractors(answer, M.wrongs.map(show), () => null),
      check: { kind: 'calculus.maclaurin' },
    };
  },
});

// ---------------------------------------------------------------- Lagrange error bound

export const lagrangeError = defineTopic({
  id: 'calc.lagrange-error',
  subject: 'calculus',
  category: 'Infinite Sequences and Series',
  title: 'Lagrange Error Bound',
  description: 'Bound the error of a Taylor polynomial approximation with the Lagrange form of the remainder.',
  instruction: 'Use the Lagrange error bound to bound the error of each approximation.',
  multipleChoice: true,
  defaultCount: 6,
  options: [],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const kind = rng.pick(difficulty === 'easy' ? ['sin', 'cos'] : ['sin', 'cos', 'exp', 'ln1']);
    const n = rng.int(2, difficulty === 'hard' ? 5 : 4);
    const b = rng.pick([new Frac(1, 2), new Frac(1, 5), new Frac(1, 10), new Frac(3, 10), new Frac(2, 5)]);
    const F: TaylorF =
      kind === 'sin'
        ? { tex: '\\sin x', a: 0, coef: (j) => (j % 2 === 1 ? new Frac(j % 4 === 1 ? 1 : -1, factorialN(j)) : Frac.ZERO) }
        : kind === 'cos'
          ? { tex: '\\cos x', a: 0, coef: (j) => (j % 2 === 0 ? new Frac(j % 4 === 0 ? 1 : -1, factorialN(j)) : Frac.ZERO) }
          : kind === 'exp'
            ? { tex: 'e^{x}', a: 0, coef: (j) => new Frac(1, factorialN(j)) }
            : { tex: '\\ln(1 + x)', a: 0, coef: (j) => (j === 0 ? Frac.ZERO : new Frac(j % 2 === 1 ? 1 : -1, j)) };
    const P = taylorTex(F, n);
    if (/^-?\d+$/.test(P)) return lagrangeError.generate({ ...ctx, rng: rng.fork('const') });
    // M bounds |f^{(n+1)}| on [0, b]
    const M = kind === 'exp' ? new Frac(2) : kind === 'ln1' ? new Frac(factorialN(n)) : new Frac(1);
    const Mtext = kind === 'exp' ? '$M = 2$ (since $e^{x} < 2$ there)' : kind === 'ln1' ? `$M = ${factorialN(n)}$` : '$M = 1$';
    const bound = M.mul(b.pow(n + 1)).div(factorialN(n + 1));
    const bt = decimal(b.value, 2);
    const answer = `$|R_{${n}}(${bt})| \\le ${num(bound)}$`;
    const wrongs = [M.mul(b.pow(n)).div(factorialN(n)), M.mul(b.pow(n + 1)).div(factorialN(n)), bound.mul(n + 2)].map((w) => `$|R_{${n}}(${bt})| \\le ${num(w)}$`);
    return {
      question: `$P_{${n}}(x) = ${P}$ approximates $f(x) = ${F.tex}$ near $x = 0$. Bound $|f(${bt}) - P_{${n}}(${bt})|$ on $[0, ${bt}]$ using ${Mtext} for $|f^{(${n + 1})}|$.`,
      answer,
      steps: [`$|R_{n}(x)| \\le \\frac{M|x|^{n+1}}{(n+1)!}$`, answer],
      distractors: distinctDistractors(answer, wrongs, (k) => `$|R_{${n}}(${bt})| \\le ${num(bound.mul(k + 2))}$`),
      check: { kind: 'calculus.lagrange', n, value: bound.value },
    };
  },
});
