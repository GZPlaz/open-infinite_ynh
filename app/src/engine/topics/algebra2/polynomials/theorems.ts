/** Descartes' Rule of Signs, the Rational Zero Theorem and the Fundamental Theorem of Algebra. */
import { Frac } from '../../../fraction';
import { attempt, defineTopic, distinctDistractors, offset, strOpt } from '../../../generator';
import { Poly } from '../../../polynomial';
import type { Rng } from '../../../rng';
import { m, num } from '../../../tex';
import type { Difficulty, ProblemContent } from '../../../types';
import { CATEGORY, type Cx, makePair, orList, randPoly, rootFactor } from './common';

const bounded = (p: Poly, max: number) => p.c.every((c) => Math.abs(c.value) <= max);

export function signChanges(coeffs: readonly number[]): number {
  const s = coeffs.filter((c) => c !== 0).map(Math.sign);
  let n = 0;
  for (let i = 1; i < s.length; i++) if (s[i] !== s[i - 1]) n++;
  return n;
}

const stepDown = (k: number) => Array.from({ length: Math.floor(k / 2) + 1 }, (_, i) => k - 2 * i);

/** Coefficients in descending order. */
const desc = (p: Poly) => Array.from({ length: p.degree + 1 }, (_, i) => p.coef(p.degree - i).value);
const negX = (p: Poly) => new Poly(p.c.map((c, i) => (i % 2 ? c.neg() : c)));

function descartesText(pos: number[], neg: number[], imag: number[]): string {
  return `Positive: ${orList(pos)}; negative: ${orList(neg)}; imaginary: ${orList(imag)}`;
}

function imagSet(n: number, pos: number[], neg: number[]): number[] {
  const s = new Set<number>();
  for (const p of pos) for (const q of neg) s.add(n - p - q);
  return [...s].sort((a, b) => a - b);
}

export const descartesRule = defineTopic({
  id: 'alg2.poly.descartes',
  subject: 'algebra2',
  category: CATEGORY,
  title: "Descartes' Rule of Signs",
  description: 'Count sign changes of f(x) and f(−x) to list the possible numbers of positive, negative and imaginary zeros.',
  instruction: 'State the possible number of positive real zeros, negative real zeros, and imaginary zeros of each function.',
  multipleChoice: true,
  defaultCount: 10,
  options: [],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const p = attempt('descartes', () => {
      const deg = difficulty === 'easy' ? rng.int(3, 4) : difficulty === 'medium' ? rng.int(4, 5) : rng.int(5, 7);
      const q = randPoly(rng, deg, 9, rng.int(Math.min(3, deg), deg + 1), { constant: true });
      return q.coef(0).isZero() ? null : q;
    });
    const n = p.degree;
    const P = signChanges(desc(p));
    const fneg = negX(p);
    const N = signChanges(desc(fneg));
    const pos = stepDown(P);
    const neg = stepDown(N);
    const answer = descartesText(pos, neg, imagSet(n, pos, neg));
    const steps = [
      `$f(x) = ${p.toTex('x')}$ has $${P}$ sign change${P === 1 ? '' : 's'}.`,
      `$f(-x) = ${fneg.toTex('x')}$ has $${N}$ sign change${N === 1 ? '' : 's'}.`,
      `Each count may drop by an even number; the degree is $${n}$, so the rest of the zeros are imaginary.`,
    ];
    const all = (k: number) => Array.from({ length: k + 1 }, (_, i) => k - i);
    const cands = [
      descartesText(neg, pos, imagSet(n, neg, pos)),
      descartesText([P], [N], [n - P - N]),
      descartesText(all(P), all(N), imagSet(n, all(P), all(N)).filter((x) => x >= 0)),
      descartesText(pos, stepDown(N + 1), imagSet(n, pos, stepDown(N + 1)).filter((x) => x >= 0)),
      descartesText(stepDown(P + 1), neg, imagSet(n, stepDown(P + 1), neg).filter((x) => x >= 0)),
    ];
    return {
      question: m(`f(x) = ${p.toTex('x')}`),
      answer,
      steps,
      distractors: distinctDistractors(answer, cands, (k) => {
        const a = Math.max(0, P + offset(k));
        const b = Math.max(0, N - offset(k));
        return descartesText(stepDown(a), stepDown(b), imagSet(n, stepDown(a), stepDown(b)).filter((x) => x >= 0));
      }),
      check: { kind: 'alg2-polynomials.descartes' },
    };
  },
});

function divisors(n: number): number[] {
  const out: number[] = [];
  for (let i = 1; i <= Math.abs(n); i++) if (n % i === 0) out.push(i);
  return out;
}

/** Positive values p/q, p | a0, q | an, ascending. */
export function candidates(a0: number, an: number): Frac[] {
  const out: Frac[] = [];
  for (const p of divisors(a0)) for (const q of divisors(an)) {
    const f = new Frac(p, q);
    if (!out.some((x) => x.eq(f))) out.push(f);
  }
  return out.sort((a, b) => a.cmp(b));
}

const pmList = (fs: readonly Frac[]) => fs.map((f) => `\\pm ${num(f)}`).join(', ');

function zerosAnswer(rs: readonly Frac[]): string {
  return m(`x = ${[...rs].sort((a, b) => a.cmp(b)).map((r) => num(r)).join(', ')}`);
}

function buildRationalFind(rng: Rng, d: Difficulty): { f: Poly; roots: Frac[] } {
  return attempt('rational-find', () => {
    const count = d === 'easy' ? rng.int(2, 3) : rng.int(1, 3);
    const roots: Frac[] = [];
    for (let i = 0; i < count; i++) {
      const frac = d !== 'easy' && i === 0 && rng.bool(d === 'hard' ? 0.7 : 0.45);
      const r = frac ? new Frac(rng.signedInt(1, 5, true), rng.int(2, 4)) : new Frac(rng.signedInt(1, 5, true));
      if (roots.some((x) => x.eq(r))) return null;
      roots.push(r);
    }
    let f = roots.reduce((p, r) => p.mul(rootFactor(r)), Poly.of(1));
    if (count < 3 || rng.bool(0.3)) {
      const c = rng.pick([1, 2, 3, 4, 5, -2, -3, -5, -7]);
      f = f.mul(Poly.of(c, 0, 1));
    }
    if (f.degree < 3 || f.degree > 5 || !bounded(f, 150)) return null;
    return { f, roots };
  });
}

export const rationalZeroTheorem = defineTopic({
  id: 'alg2.poly.rational-zeros',
  subject: 'algebra2',
  category: CATEGORY,
  title: 'The Rational Zero Theorem',
  description: 'List all possible rational zeros ±p/q, or find all rational zeros of a polynomial.',
  instruction: (o) =>
    o.task === 'list' ? 'List all possible rational zeros of each function.' : o.task === 'find' ? 'Find all rational zeros of each function.' : 'Use the Rational Zero Theorem.',
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
        { value: 'list', label: 'List possible rational zeros' },
        { value: 'find', label: 'Find all rational zeros' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const taskOpt = strOpt(ctx, 'task');
    const task = taskOpt === 'mixed' ? rng.pick(['list', 'find']) : taskOpt;
    if (task === 'list') {
      const p = attempt('rational-list', () => {
        const an = difficulty === 'easy' ? 1 : difficulty === 'medium' ? rng.pick([1, 2, 3]) : rng.pick([2, 3, 4, 5, 6]);
        const a0 = rng.signedInt(2, difficulty === 'medium' ? 10 : 12, true);
        const deg = rng.int(3, 4);
        const c = Array.from({ length: deg + 1 }, (_, i) => (i === 0 ? a0 : i === deg ? an * (rng.bool(0.2) ? -1 : 1) : rng.bool(0.75) ? rng.int(-9, 9) : 0));
        const q = new Poly(c);
        if (q.degree !== deg || candidates(a0, an).length > 16) return null;
        return q;
      });
      const a0 = p.coef(0).value;
      const an = p.lead().value;
      const cs = candidates(a0, an);
      const answer = m(pmList(cs));
      const steps = [
        `Factors of the constant term $${a0}$: $p = ${divisors(a0).map((x) => `\\pm ${x}`).join(', ')}$`,
        `Factors of the leading coefficient $${an}$: $q = ${divisors(an).map((x) => `\\pm ${x}`).join(', ')}$`,
        `Possible rational zeros $\\frac{p}{q}$: $${pmList(cs)}$`,
      ];
      const ints = divisors(a0).map((x) => Frac.of(x));
      const recip = candidates(an, a0);
      const wrongs = [m(pmList(ints)), m(pmList(recip)), m(cs.map((f) => num(f)).join(', ')), m(pmList(cs.filter((f) => f.isInt() || f.d === Math.abs(an))))];
      return {
        question: m(`f(x) = ${p.toTex('x')}`),
        answer,
        steps,
        distractors: distinctDistractors(answer, wrongs, (k) => m(pmList([...cs, Frac.of(Math.abs(a0) + k)]))),
        check: { kind: 'alg2-polynomials.rationalZeros', task: 'list' },
      };
    }
    const { f, roots } = buildRationalFind(rng, difficulty);
    const a0 = f.coef(0).value;
    const an = f.lead().value;
    const answer = zerosAnswer(roots);
    const steps = [
      `Possible rational zeros: $${pmList(candidates(a0, an))}$`,
      `Test them (synthetic division): $${[...roots].sort((a, b) => a.cmp(b)).map((r) => `f\\left(${num(r)}\\right) = 0`).join(',\\ ')}$`,
      `Rational zeros: $${[...roots].sort((a, b) => a.cmp(b)).map((r) => num(r)).join(', ')}$`,
    ];
    const notRoot = candidates(a0, an).find((c) => !f.eval(c).isZero() && !roots.some((r) => r.eq(c)));
    const wrongs = [
      zerosAnswer(roots.map((r) => r.neg())),
      zerosAnswer(roots.map((r) => (r.isInt() ? r : r.inv()))),
      notRoot ? zerosAnswer([...roots, notRoot]) : null,
      roots.length > 1 ? zerosAnswer(roots.slice(1)) : zerosAnswer([roots[0]!, roots[0]!.neg()]),
    ];
    return {
      question: m(`f(x) = ${f.toTex('x')}`),
      answer,
      steps,
      distractors: distinctDistractors(answer, wrongs, (k) => zerosAnswer(roots.map((r, i) => (i === 0 ? r.add(offset(k)) : r)))),
      check: { kind: 'alg2-polynomials.rationalZeros', task: 'find' },
    };
  },
});

function ftaText(n: number): string {
  const real = Array.from({ length: Math.floor(n / 2) + 1 }, (_, i) => n - 2 * i);
  const imag = real.map((r) => n - r);
  return `Complex zeros: ${n}; possible real zeros: ${orList(real)}; possible imaginary zeros: ${orList(imag)}`;
}

export const fundamentalTheorem = defineTopic({
  id: 'alg2.poly.fundamental-theorem',
  subject: 'algebra2',
  category: CATEGORY,
  title: 'The Fundamental Theorem of Algebra',
  description: 'State how many complex zeros a polynomial has, or find all of its zeros, including imaginary ones.',
  instruction: (o) =>
    o.task === 'count'
      ? 'State the number of complex zeros and the possible numbers of real and imaginary zeros of each function.'
      : o.task === 'find'
        ? 'Find all zeros of each function.'
        : 'Use the Fundamental Theorem of Algebra.',
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
        { value: 'count', label: 'Count the zeros' },
        { value: 'find', label: 'Find all zeros' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const taskOpt = strOpt(ctx, 'task');
    const task = taskOpt === 'mixed' ? rng.pick(['count', 'find']) : taskOpt;
    if (task === 'count') {
      const deg = difficulty === 'easy' ? rng.int(2, 4) : difficulty === 'medium' ? rng.int(3, 6) : rng.int(5, 8);
      const p = randPoly(rng, deg, 9, rng.int(2, Math.min(5, deg + 1)), { constant: true });
      const n = p.degree;
      const answer = ftaText(n);
      const odd = (k: number) => `Complex zeros: ${k}; possible real zeros: ${orList(Array.from({ length: k + 1 }, (_, i) => k - i))}; possible imaginary zeros: ${orList(Array.from({ length: k + 1 }, (_, i) => i))}`;
      return {
        question: m(`f(x) = ${p.toTex('x')}`),
        answer,
        steps: [
          `The degree is $${n}$, so there are $${n}$ complex zeros (counting multiplicity).`,
          'Imaginary zeros come in conjugate pairs, so the number of real zeros drops by $2$ at a time.',
        ],
        distractors: distinctDistractors(answer, [ftaText(n - 1), ftaText(n + 1), odd(n), ftaText(n + 2)], (k) => ftaText(n + 2 + k)),
        check: { kind: 'alg2-polynomials.fta' },
      };
    }
    const built = attempt('fta-find', () => {
      const pair = makePair(rng, rng.bool() ? 'complex' : 'irrational', difficulty);
      const nLin = difficulty === 'easy' ? 1 : rng.int(1, 2);
      const lin: Frac[] = [];
      for (let i = 0; i < nLin; i++) {
        const r = difficulty === 'hard' && i === 0 && rng.bool(0.5) ? new Frac(rng.signedInt(1, 5, true), rng.int(2, 3)) : new Frac(rng.signedInt(1, 5, true));
        if (lin.some((x) => x.eq(r))) return null;
        lin.push(r);
      }
      const f = lin.reduce((p, r) => p.mul(rootFactor(r)), pair.quad);
      return bounded(f, 200) ? { pair, lin: lin.sort((a, b) => a.cmp(b)), f } : null;
    });
    const { pair, lin, f } = built;
    const fTex = f.toTex('x');
    const zeroTex = [...lin.map((r) => num(r)), ...pair.tex];
    const values: Cx[] = [...lin.map((r) => ({ re: r.value, im: 0 })), ...pair.values];
    const answer = m(`x = ${zeroTex.join(', ')}`);
    const steps = [
      `Degree $${f.degree}$: there are $${f.degree}$ zeros.`,
      `Rational zeros (Rational Zero Theorem and synthetic division): $${lin.map((r) => num(r)).join(', ')}$`,
      `Remaining factor $${pair.quad.toTex('x')} = 0$: $x = ${pair.tex.join(', ')}$`,
    ];
    const mid = pair.quad.coef(1).value;
    const wrongPair = Poly.of(pair.quad.coef(0), -mid, 1);
    const wp = wrongPair.coef(1).isZero() ? null : [...lin.map((r) => num(r)), ...['', ''].map((_, i) => pair.tex[i]!.startsWith('-') ? pair.tex[i]!.slice(1) : `-${pair.tex[i]}`).map((t) => t.replace(/ \+ /, ' @ ').replace(/ - /, ' + ').replace(/ @ /, ' - '))];
    const wrongs = [
      m(`x = ${[...lin.map((r) => r.neg()).sort((a, b) => a.cmp(b)).map((r) => num(r)), ...pair.tex].join(', ')}`),
      wp ? m(`x = ${wp.join(', ')}`) : null,
      m(`x = ${lin.map((r) => num(r)).join(', ')}`),
      m(`x = ${[...lin.map((r) => num(r)), pair.tex[0]].join(', ')}`),
    ];
    return {
      question: `Find all zeros of $f(x) = ${fTex}$.`,
      answer,
      steps,
      distractors: distinctDistractors(answer, wrongs, (k) => m(`x = ${[...lin.map((r, i) => num(i === 0 ? r.add(offset(k)) : r)), ...pair.tex].join(', ')}`)),
      check: { kind: 'roots', variable: 'x', equation: `${fTex} = 0`, solutions: values },
    };
  },
});
