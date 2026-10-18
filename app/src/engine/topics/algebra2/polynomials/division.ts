/** Dividing polynomials (long and synthetic division) and the Remainder Theorem. */
import { Frac, gcd } from '../../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, offset, opt, pickVar, strOpt } from '../../../generator';
import { Poly } from '../../../polynomial';
import type { Rng } from '../../../rng';
import { m, num } from '../../../tex';
import type { Difficulty, ProblemContent } from '../../../types';
import { CATEGORY, divMod, mono, randPoly, synthetic, syntheticTex, timesTex } from './common';

/** `q + \frac{r}{d}` with the sign of the remainder pulled out. */
export function quotientTex(q: Poly, r: Poly, d: Poly, v: string): string {
  const qt = q.toTex(v);
  if (r.isZero()) return qt;
  const neg = r.lead().sign < 0;
  const frac = `\\frac{${(neg ? r.scale(-1) : r).toTex(v)}}{${d.toTex(v)}}`;
  if (q.isZero()) return neg ? `-${frac}` : frac;
  return `${qt} ${neg ? '-' : '+'} ${frac}`;
}

const bounded = (p: Poly, max: number) => p.c.every((c) => Math.abs(c.value) <= max);

interface Div {
  n: Poly;
  d: Poly;
  synthetic: boolean;
}

function buildDivision(rng: Rng, diff: Difficulty, method: 'long' | 'synthetic', remainders: boolean): Div {
  return attempt('division', () => {
    const rem = () => (remainders && rng.bool(0.75) ? rng.signedInt(1, 9, true) : 0);
    if (method === 'synthetic' || diff === 'easy') {
      const r = rng.signedInt(1, diff === 'easy' ? 4 : diff === 'medium' ? 5 : 6, true);
      const deg = diff === 'easy' ? rng.int(2, 3) : diff === 'medium' ? 3 : rng.int(3, 4);
      const nTerms = diff === 'easy' ? deg + 1 : rng.int(deg - 1, deg + 1);
      let n = randPoly(rng, deg, diff === 'easy' ? 6 : 9, nTerms, { constant: true });
      if (diff === 'easy') n = new Poly(n.c.map((c, i) => (i === deg ? Frac.of(rng.int(1, 3)) : c)));
      const d = Poly.linear(1, -r);
      const want = rem();
      const actual = n.eval(r);
      n = n.add(Poly.of(actual.neg().add(want)));
      if (!bounded(n, 60) || n.degree !== deg) return null;
      return { n, d, synthetic: method === 'synthetic' };
    }
    // long division with a non-monic or quadratic divisor
    const quadratic = diff === 'hard' && rng.bool(0.5);
    let d: Poly;
    if (quadratic) d = Poly.of(rng.signedInt(1, 5, true), rng.bool(0.4) ? 0 : rng.signedInt(1, 4, true), 1);
    else {
      const a = rng.int(2, 3);
      const b = rng.signedInt(1, 5, true);
      if (gcd(a, b) !== 1) return null;
      d = Poly.linear(a, b);
    }
    const qDeg = diff === 'medium' ? rng.int(1, 2) : rng.int(2, 3);
    const q = randPoly(rng, qDeg, 5, rng.int(qDeg, qDeg + 1), { constant: true });
    if (q.lead().sign < 0 && rng.bool(0.7)) return null;
    const R = remainders && rng.bool(0.75) ? (quadratic ? Poly.of(rng.signedInt(1, 9, true), rng.int(-4, 4)) : Poly.of(rng.signedInt(1, 9, true))) : Poly.of(0);
    const n = d.mul(q).add(R);
    if (!bounded(n, 60)) return null;
    return { n, d, synthetic: false };
  });
}

function longSteps(n: Poly, d: Poly, v: string): string[] {
  const out: string[] = [];
  let r = n;
  while (!r.isZero() && r.degree >= d.degree) {
    const k = r.degree - d.degree;
    const c = r.lead().div(d.lead());
    const qt = mono(c, k);
    const sub = d.mul(qt);
    const next = r.sub(sub);
    const qTex = qt.toTex(v);
    const mulTex = k === 0 ? timesTex(c, '', d.toTex(v), true) : `${qTex}(${d.toTex(v)})`;
    out.push(`$${qTex}$: subtract $${mulTex} = ${sub.toTex(v)}$, leaving $${next.toTex(v)}$`);
    r = next;
    if (out.length > 6) break;
  }
  return out;
}

export const dividingPolynomials = defineTopic({
  id: 'alg2.poly.divide',
  subject: 'algebra2',
  category: CATEGORY,
  title: 'Dividing Polynomials',
  description: 'Long division and synthetic division of polynomials, with remainders written as fractions.',
  instruction: (o) => (o.method === 'synthetic' ? 'Divide using synthetic division.' : o.method === 'long' ? 'Divide using long division.' : 'Divide.'),
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'method',
      label: 'Method',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'Mixed' },
        { value: 'long', label: 'Long division' },
        { value: 'synthetic', label: 'Synthetic division' },
      ],
    },
    { type: 'boolean', id: 'remainders', label: 'Allow remainders', default: true },
    opt.variedVariables(false),
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const methodOpt = strOpt(ctx, 'method');
    const method = methodOpt === 'mixed' ? (rng.bool() ? 'long' : 'synthetic') : (methodOpt as 'long' | 'synthetic');
    const v = pickVar(rng, boolOpt(ctx, 'variedVars'));
    const { n, d, synthetic: useSynth } = buildDivision(rng, difficulty, method, boolOpt(ctx, 'remainders'));
    const { q, r } = divMod(n, d);
    const answerTex = quotientTex(q, r, d, v);
    const steps: string[] = [];
    if (useSynth) {
      const root = d.coef(0).neg();
      steps.push(`Divide by $${d.toTex(v)}$: use $${num(root)}$ and the coefficients of the dividend (zeros for missing terms).`);
      steps.push(`$${syntheticTex(n, root)}$`);
      steps.push(`Quotient $${q.toTex(v)}$, remainder $${r.toTex(v)}$`);
    } else steps.push(...longSteps(n, d, v));
    steps.push(`$${answerTex}$`);
    const answer = m(answerTex);

    const flippedD = new Poly(d.c.map((c, i) => (i === 0 ? c.neg() : c)));
    const fl = divMod(n, flippedD);
    const shifted = q.mul(Poly.of(0, 1));
    const wrongs = [
      quotientTex(fl.q, fl.r, d, v),
      r.isZero() ? quotientTex(q, Poly.of(rng.signedInt(1, 5, true)), d, v) : q.toTex(v),
      r.isZero() ? quotientTex(shifted, r, d, v) : quotientTex(q, r.scale(-1), d, v),
      quotientTex(shifted, r, d, v),
    ];
    const distractors = distinctDistractors(answer, wrongs.map(m), (k) => m(quotientTex(q.add(Poly.of(offset(k))), r, d, v)));
    return {
      question: m(`(${n.toTex(v)}) \\div (${d.toTex(v)})`),
      answer,
      steps,
      distractors,
      check: { kind: 'equivalent', vars: [v] },
    };
  },
});

type RTask = 'evaluate' | 'remainder' | 'factor';

export const remainderTheorem = defineTopic({
  id: 'alg2.poly.remainder-theorem',
  subject: 'algebra2',
  category: CATEGORY,
  title: 'The Remainder Theorem',
  description: 'Evaluate polynomials by synthetic substitution, find remainders, and test whether x − a is a factor.',
  instruction: (o) =>
    o.task === 'evaluate'
      ? 'Evaluate each function at the given value using synthetic substitution.'
      : o.task === 'remainder'
        ? 'Find the remainder using the Remainder Theorem.'
        : o.task === 'factor'
          ? 'Use the Factor Theorem to decide whether the binomial is a factor.'
          : 'Use the Remainder Theorem.',
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Task',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'Mixed' },
        { value: 'evaluate', label: 'Evaluate by synthetic substitution' },
        { value: 'remainder', label: 'Find the remainder' },
        { value: 'factor', label: 'Is (x − a) a factor?' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const taskOpt = strOpt(ctx, 'task');
    const task: RTask = taskOpt === 'mixed' ? rng.pick<RTask>(['evaluate', 'remainder', 'factor']) : (taskOpt as RTask);
    const v = 'x';
    const built = attempt('remainder', () => {
      const deg = difficulty === 'easy' ? 3 : difficulty === 'medium' ? rng.int(3, 4) : rng.int(4, 5);
      const a = rng.signedInt(1, difficulty === 'easy' ? 3 : 4, true);
      let p = randPoly(rng, deg, difficulty === 'easy' ? 5 : 8, difficulty === 'easy' ? rng.int(3, 4) : rng.int(3, deg + 1), { constant: true });
      if (task === 'factor' && rng.bool(0.5)) p = p.sub(Poly.of(p.eval(a)));
      if (p.coef(0).isZero() || !bounded(p, 80) || p.degree !== deg) return null;
      const val = p.eval(a).value;
      if (Math.abs(val) > 2000 || p.eval(-a).isZero()) return null;
      return { p, a, val };
    });
    const { p, a, val } = built;
    const pTex = p.toTex(v);
    const d = Poly.linear(1, -a);
    const dTex = d.toTex(v);
    const { out } = synthetic(p, a);
    const other = p.eval(-a).value;
    const steps = [`$${syntheticTex(p, a)}$`, `The last entry is the remainder: $f(${a}) = ${val}$`];
    if (task === 'evaluate') {
      const answer = m(`f(${a}) = ${val}`);
      const wrong = [other, out[out.length - 2]!.value, -val, p.coef(0).value + val];
      return {
        question: `Use synthetic substitution to find $f(${a})$ for $f(x) = ${pTex}$.`,
        answer,
        steps,
        distractors: distinctDistractors(
          answer,
          wrong.map((w) => m(`f(${a}) = ${w}`)),
          (k) => m(`f(${a}) = ${val + offset(k)}`),
        ),
        check: { kind: 'alg2-polynomials.remainder', task },
      };
    }
    if (task === 'remainder') {
      steps.unshift(`By the Remainder Theorem the remainder is $f(${a})$, where $f(x) = ${pTex}$.`);
      const answer = m(String(val));
      const wrong = [other, out[out.length - 2]!.value, -val, p.coef(0).value];
      return {
        question: `Find the remainder when $${pTex}$ is divided by $${dTex}$.`,
        answer,
        steps,
        distractors: distinctDistractors(
          answer,
          wrong.map((w) => m(String(w))),
          (k) => m(String(val + offset(k))),
        ),
        check: { kind: 'alg2-polynomials.remainder', task },
      };
    }
    const yes = val === 0;
    steps.push(yes ? `The remainder is $0$, so $${dTex}$ is a factor.` : `The remainder is not $0$, so $${dTex}$ is not a factor.`);
    const answer = yes ? `Yes; $f(${a}) = 0$` : `No; $f(${a}) = ${val}$`;
    const wrong = yes
      ? [`No; $f(${a}) = ${other}$`, `No; $f(${-a}) = ${other}$`, `No; $f(${a}) = ${p.coef(0).value}$`]
      : [`Yes; $f(${a}) = 0$`, `Yes; $f(${-a}) = 0$`, `No; $f(${-a}) = ${other}$`];
    return {
      question: `Determine whether $${dTex}$ is a factor of $f(x) = ${pTex}$.`,
      answer,
      steps,
      distractors: distinctDistractors(answer, wrong, (k) => (yes ? `No; $f(${a}) = ${offset(k) * 2}$` : `No; $f(${a}) = ${val + offset(k)}$`)),
      check: { kind: 'alg2-polynomials.remainder', task },
    };
  },
});

