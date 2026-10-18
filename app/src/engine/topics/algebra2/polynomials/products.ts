/** Special products and the Binomial Theorem. */
import { boolOpt, defineTopic, distinctDistractors, opt, pickVar, strOpt } from '../../../generator';
import type { Rng } from '../../../rng';
import { m, pow, sum } from '../../../tex';
import type { Difficulty, ProblemContent } from '../../../types';
import { CATEGORY, ordinal } from './common';

/** c · v^ex · y^ey */
interface Mono {
  c: number;
  ex: number;
  ey: number;
}

const Y = 'y';

function symOf(v: string, t: Mono): string {
  return `${pow(v, t.ex)}${pow(Y, t.ey)}`;
}

function monosTex(ms: readonly Mono[], v: string): string {
  return sum(ms.map((t) => ({ coef: t.c, sym: symOf(v, t) })));
}

function binom(n: number, k: number): number {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
}

function powMono(t: Mono, e: number): Mono {
  return { c: t.c ** e, ex: t.ex * e, ey: t.ey * e };
}

function mulMono(a: Mono, b: Mono, k = 1): Mono {
  return { c: a.c * b.c * k, ex: a.ex + b.ex, ey: a.ey + b.ey };
}

/** Terms of (A + B)^n, descending powers of A. */
function expand(A: Mono, B: Mono, n: number): Mono[] {
  return Array.from({ length: n + 1 }, (_, k) => mulMono(powMono(A, n - k), powMono(B, k), binom(n, k)));
}

/** `(tex)` or `(tex)^{e}` (never ^{1}). */
function powParen(tex: string, e: number): string {
  return e === 1 ? `(${tex})` : `(${tex})^{${e}}`;
}

function pickTerms(rng: Rng, d: Difficulty, kind: 'square' | 'conjugate' | 'cube' | 'binomial', twoVars: boolean): [Mono, Mono] {
  const small = kind === 'cube' || kind === 'binomial';
  const aMax = d === 'easy' ? 1 : d === 'medium' ? (small ? 2 : 4) : small ? 3 : 5;
  const exA = d === 'hard' && rng.bool(kind === 'binomial' ? 0.25 : 0.4) ? 2 : 1;
  const A: Mono = { c: rng.int(1, aMax), ex: exA, ey: 0 };
  const bMax = small ? (d === 'easy' ? 3 : d === 'medium' ? 4 : 5) : 9;
  const B: Mono = { c: rng.signedInt(1, bMax, true), ex: 0, ey: twoVars && rng.bool(0.6) ? 1 : 0 };
  if (A.c === 1 && A.ex === 1 && Math.abs(B.c) === 1 && B.ey === 0 && rng.bool(0.7)) B.c *= 2;
  return [A, B];
}

export const specialProducts = defineTopic({
  id: 'alg2.poly.special-products',
  subject: 'algebra2',
  category: CATEGORY,
  title: 'Multiplying Special Cases',
  description: 'Square and cube binomials and multiply conjugates: (a ± b)², (a + b)(a − b), (a ± b)³.',
  instruction: 'Find each product.',
  multipleChoice: true,
  defaultCount: 12,
  options: [
    {
      type: 'select',
      id: 'type',
      label: 'Product',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'Mixed' },
        { value: 'square', label: 'Square of a binomial (a ± b)²' },
        { value: 'conjugate', label: 'Sum and difference (a + b)(a − b)' },
        { value: 'cube', label: 'Cube of a binomial (a ± b)³' },
      ],
    },
    { type: 'boolean', id: 'twoVars', label: 'Two variables', default: false },
    opt.variedVariables(true),
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const type = strOpt(ctx, 'type');
    const v = pickVar(rng, boolOpt(ctx, 'variedVars'));
    const kind =
      type === 'mixed'
        ? rng.weighted<'square' | 'conjugate' | 'cube'>([
            ['square', 0.4],
            ['conjugate', 0.3],
            ['cube', 0.3],
          ])
        : (type as 'square' | 'conjugate' | 'cube');
    const [A, B] = pickTerms(rng, difficulty, kind, boolOpt(ctx, 'twoVars'));
    const aTex = monosTex([A], v);
    const bAbs: Mono = { ...B, c: Math.abs(B.c) };
    const bAbsTex = monosTex([bAbs], v);
    const plus = B.c > 0;
    const sg = plus ? '+' : '-';
    const negB: Mono = { ...B, c: -B.c };
    let question: string;
    let result: Mono[];
    const wrongs: Mono[][] = [];
    const steps: string[] = [];
    if (kind === 'square') {
      question = `(${monosTex([A, B], v)})^{2}`;
      result = expand(A, B, 2);
      steps.push(`Use $(a ${sg} b)^{2} = a^{2} ${sg} 2ab + b^{2}$ with $a = ${aTex}$ and $b = ${bAbsTex}$.`);
      steps.push(`$(${aTex})^{2} ${sg} 2(${aTex})(${bAbsTex}) + (${bAbsTex})^{2}$`);
      wrongs.push([powMono(A, 2), powMono(B, 2)], [powMono(A, 2), mulMono(A, B), powMono(B, 2)], expand(A, negB, 2), [powMono(A, 2), mulMono(A, B, 2), powMono(negB, 2)]);
    } else if (kind === 'conjugate') {
      const f1 = monosTex([A, bAbs], v);
      const f2 = monosTex([A, { ...bAbs, c: -bAbs.c }], v);
      question = rng.bool() ? `(${f1})(${f2})` : `(${f2})(${f1})`;
      result = [powMono(A, 2), { ...powMono(bAbs, 2), c: -(bAbs.c ** 2) }];
      steps.push(`Use $(a + b)(a - b) = a^{2} - b^{2}$ with $a = ${aTex}$ and $b = ${bAbsTex}$.`);
      steps.push(`$(${aTex})^{2} - (${bAbsTex})^{2}$`);
      wrongs.push(
        [powMono(A, 2), powMono(bAbs, 2)],
        [powMono(A, 2), mulMono(A, bAbs, -2), { ...powMono(bAbs, 2), c: -(bAbs.c ** 2) }],
        [powMono(A, 2), { c: -bAbs.c, ex: 2 * bAbs.ex, ey: 2 * bAbs.ey }],
        expand(A, { ...bAbs, c: -bAbs.c }, 2),
      );
    } else {
      question = `(${monosTex([A, B], v)})^{3}`;
      result = expand(A, B, 3);
      steps.push(`Use $(a ${sg} b)^{3} = a^{3} ${sg} 3a^{2}b + 3ab^{2} ${sg} b^{3}$ with $a = ${aTex}$ and $b = ${bAbsTex}$.`);
      steps.push(`$(${aTex})^{3} ${sg} 3(${aTex})^{2}(${bAbsTex}) + 3(${aTex})(${bAbsTex})^{2} ${sg} (${bAbsTex})^{3}$`);
      wrongs.push(
        [powMono(A, 3), powMono(B, 3)],
        [powMono(A, 3), mulMono(powMono(A, 2), B), mulMono(A, powMono(B, 2)), powMono(B, 3)],
        expand(A, negB, 3),
        [powMono(A, 3), mulMono(powMono(A, 2), B, 3), mulMono(A, powMono(B, 2), -3), powMono(B, 3)],
      );
    }
    const answerTex = monosTex(result, v);
    steps.push(`$= ${answerTex}$`);
    const answer = m(answerTex);
    const distractors = distinctDistractors(
      answer,
      wrongs.map((w) => m(monosTex(w, v))),
      (k) => m(monosTex(result.map((t, i) => (i === result.length - 1 ? { ...t, c: t.c + (k % 2 ? k : -k) } : t)), v)),
    );
    const twoVars = [A, B].some((t) => t.ey > 0);
    return {
      question: m(question),
      answer,
      steps,
      distractors,
      check: { kind: 'equivalent', vars: twoVars ? [v, Y] : [v] },
    };
  },
});

export const binomialTheorem = defineTopic({
  id: 'alg2.poly.binomial-theorem',
  subject: 'algebra2',
  category: CATEGORY,
  title: 'The Binomial Theorem',
  description: 'Expand (ax + b)ⁿ with binomial coefficients, or find a specific term or coefficient.',
  instruction: (o) =>
    o.task === 'expand' ? 'Expand completely.' : o.task === 'term' ? 'Find each term described.' : o.task === 'coefficient' ? 'Find each coefficient described.' : 'Use the Binomial Theorem.',
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
        { value: 'expand', label: 'Expand' },
        { value: 'term', label: 'Find a specific term' },
        { value: 'coefficient', label: 'Find a coefficient' },
      ],
    },
    { type: 'boolean', id: 'twoVars', label: 'Two variables', default: false },
    opt.variedVariables(false),
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const taskOpt = strOpt(ctx, 'task');
    const task = taskOpt === 'mixed' ? rng.weighted<'expand' | 'term' | 'coefficient'>([['expand', 0.4], ['term', 0.35], ['coefficient', 0.25]]) : (taskOpt as 'expand' | 'term' | 'coefficient');
    const v = pickVar(rng, boolOpt(ctx, 'variedVars'));
    const [A, B] = pickTerms(rng, difficulty, 'binomial', boolOpt(ctx, 'twoVars'));
    const n =
      task === 'expand'
        ? difficulty === 'easy'
          ? rng.int(3, 4)
          : difficulty === 'medium'
            ? rng.int(4, 5)
            : rng.int(5, 6)
        : difficulty === 'easy'
          ? rng.int(4, 6)
          : difficulty === 'medium'
            ? rng.int(5, 8)
            : rng.int(6, 10);
    const base = `(${monosTex([A, B], v)})^{${n}}`;
    const twoVars = A.ey + B.ey > 0;
    const vars = twoVars ? [v, Y] : [v];
    const aTex = monosTex([A], v);
    const bTex = monosTex([B], v);
    const steps: string[] = [];

    if (task === 'expand') {
      const result = expand(A, B, n);
      const row = Array.from({ length: n + 1 }, (_, k) => binom(n, k));
      steps.push(`Row $${n}$ of Pascal's triangle: $${row.join(', ')}$`);
      steps.push(`$${Array.from({ length: n + 1 }, (_, k) => `${row[k] === 1 ? '' : row[k]}${n - k ? powParen(aTex, n - k) : ''}${k ? powParen(bTex, k) : ''}`).join(' + ')}$`);
      const answerTex = monosTex(result, v);
      steps.push(`$= ${answerTex}$`);
      const answer = m(answerTex);
      const noBinom = Array.from({ length: n + 1 }, (_, k) => mulMono(powMono(A, n - k), powMono(B, k)));
      const unpowered = Array.from({ length: n + 1 }, (_, k) => ({ ...result[k]!, c: binom(n, k) * (n - k ? A.c : 1) * (k ? B.c : 1) }));
      const flipped = expand(A, { ...B, c: -B.c }, n);
      return {
        question: taskOpt === 'mixed' ? `Expand $${base}$.` : m(base),
        answer,
        steps,
        distractors: distinctDistractors(
          answer,
          [m(monosTex(noBinom, v)), m(monosTex(unpowered, v)), m(monosTex(flipped, v))],
          (k) => m(monosTex(result.map((t, i) => (i === 1 ? { ...t, c: t.c + (k % 2 ? k : -k) } : t)), v)),
        ),
        check: { kind: 'equivalent', vars },
      };
    }

    // a specific term: k = power of B, the (k + 1)th term
    const k = rng.int(1, n - 1);
    const termOf = (kk: number) => mulMono(powMono(A, n - kk), powMono(B, kk), binom(n, kk));
    const t = termOf(k);
    const aPow = monosTex([powMono(A, n - k)], v);
    const bPow = monosTex([powMono(B, k)], v);
    steps.push(`The term containing $b^{${k}}$ is the ${ordinal(k + 1)} term: $\\binom{${n}}{${k}}a^{${n - k}}b^{${k}}$`);
    steps.push(`$\\binom{${n}}{${k}}${powParen(aTex, n - k)}${powParen(bTex, k)} = ${binom(n, k)}(${aPow})(${bPow})$`);
    if (task === 'term') {
      const answerTex = monosTex([t], v);
      steps.push(`$= ${answerTex}$`);
      const answer = m(answerTex);
      const wrong = [termOf(k + 1), termOf(k - 1), { ...t, c: -t.c }, mulMono(powMono(A, n - k), powMono(B, k))];
      return {
        question: `Find the ${ordinal(k + 1)} term in the expansion of $${base}$.`,
        answer,
        steps,
        distractors: distinctDistractors(
          answer,
          wrong.map((w) => m(monosTex([w], v))),
          (j) => m(monosTex([{ ...t, c: t.c + (j % 2 ? j : -j) }], v)),
        ),
        check: { kind: 'alg2-polynomials.binomial', task: 'term', vars },
      };
    }
    const sym = symOf(v, t);
    steps.push(`The coefficient is $${t.c}$.`);
    const answer = m(String(t.c));
    const wrong = [binom(n, k), termOf(k + 1).c, -t.c, binom(n, k) * A.c * B.c, A.c ** (n - k) * B.c ** k];
    return {
      question: `Find the coefficient of $${sym}$ in the expansion of $${base}$.`,
      answer,
      steps,
      distractors: distinctDistractors(
        answer,
        wrong.map((w) => m(String(w))),
        (j) => m(String(t.c + (j % 2 ? j : -j))),
      ),
      check: { kind: 'alg2-polynomials.binomial', task: 'coefficient', vars },
    };
  },
});
