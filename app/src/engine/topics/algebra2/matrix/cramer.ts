/** Cramer's Rule for systems in two and three variables. */
import { Frac } from '../../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, offset, opt, strOpt } from '../../../generator';
import { m, num, sum, tuple } from '../../../tex';
import type { ProblemContent } from '../../../types';
import { KIND } from '../smc-common';
import { detN, detTex, mat, type Matrix } from './common';

export const VARS3 = ['x', 'y', 'z'] as const;

/** `2x - y + 3z = 7` */
export function rowTex(coefs: readonly number[], rhs: number, vars: readonly string[] = VARS3): string {
  return `${sum(coefs.map((c, i) => ({ coef: c, sym: vars[i]! })))} = ${rhs}`;
}

/** Aligned system of equations. */
export function systemTex(rows: string[]): string {
  return `\\begin{aligned} ${rows.map((r) => r.replace(' = ', ' &= ')).join(' \\\\ ')} \\end{aligned}`;
}

/** Replace column j of a by the column b. */
const withColumn = (a: Matrix, j: number, b: Frac[]): Matrix => a.map((r, i) => r.map((x, c) => (c === j ? b[i]! : x)));

export const cramersRule = defineTopic({
  id: 'alg2.matrix.cramer',
  subject: 'algebra2',
  title: "Cramer's Rule",
  description: "Solve systems of two or three linear equations using Cramer's Rule.",
  category: 'Matrices',
  instruction: "Solve each system using Cramer's Rule.",
  multipleChoice: true,
  defaultCount: 6,
  options: [
    {
      type: 'select',
      id: 'vars',
      label: 'Variables',
      default: 'any',
      choices: [
        { value: 'any', label: 'By difficulty' },
        { value: '2', label: 'Two variables' },
        { value: '3', label: 'Three variables' },
      ],
    },
    opt.negatives(true),
    opt.fractionAnswers(false),
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const neg = boolOpt(ctx, 'negatives');
    const fractions = boolOpt(ctx, 'fractions');
    const choice = strOpt(ctx, 'vars');
    const n = choice === '2' ? 2 : choice === '3' ? 3 : difficulty === 'easy' ? 2 : difficulty === 'medium' ? rng.pick([2, 2, 3]) : 3;
    const vars = VARS3.slice(0, n);
    const C = n === 2 ? { easy: 5, medium: 8, hard: 10 }[difficulty] : { easy: 3, medium: 4, hard: 6 }[difficulty];
    const R = { easy: 5, medium: 7, hard: 9 }[difficulty];
    const built = attempt('cramer', () => {
      const a = Array.from({ length: n }, () => Array.from({ length: n }, () => (n === 3 && rng.bool(0.12) ? 0 : rng.signedInt(1, C, neg))));
      let rhs: number[];
      let sol: Frac[];
      const A = mat(a);
      const D = detN(A);
      if (D.isZero()) return null;
      if (fractions) {
        rhs = Array.from({ length: n }, () => rng.signedInt(1, 20, neg));
        sol = vars.map((_, j) => detN(withColumn(A, j, rhs.map((v) => new Frac(v)))).div(D));
        if (sol.every((s) => s.isInt()) || sol.some((s) => s.d > 12)) return null;
      } else {
        sol = vars.map(() => new Frac(neg ? rng.int(-R, R) : rng.int(0, R)));
        rhs = a.map((r) => r.reduce((s, c, j) => s + c * sol[j]!.value, 0));
      }
      if (rhs.some((v) => Math.abs(v) > 99)) return null;
      if (!neg && rhs.some((v) => v < 0)) return null;
      if (!neg && sol.some((s) => s.sign < 0)) return null;
      return { a, rhs, sol, D };
    });
    const { a, rhs, sol, D } = built;
    const A = mat(a);
    const b = rhs.map((v) => new Frac(v));
    const question = m(systemTex(a.map((r, i) => rowTex(r, rhs[i]!, vars))));
    const steps = [`$D = ${detTex(A)} = ${num(D)}$`];
    vars.forEach((v, j) => {
      const Dj = detN(withColumn(A, j, b));
      steps.push(`$D_{${v}} = ${detTex(withColumn(A, j, b))} = ${num(Dj)}$, so $${v} = \\frac{D_{${v}}}{D} = ${num(sol[j]!)}$`);
    });
    const answer = m(tuple(sol));
    const swapped = n === 2 ? [sol[1]!, sol[0]!] : [sol[1]!, sol[0]!, sol[2]!];
    const flipped = sol.map((s, j) => (j === 0 ? s.neg() : s));
    const flippedLast = sol.map((s, j) => (j === n - 1 ? s.neg() : s));
    const inverted = sol.map((s) => (s.isZero() ? s : s.inv()));
    const distractors = distinctDistractors(
      answer,
      [m(tuple(swapped)), m(tuple(flipped)), m(tuple(flippedLast)), m(tuple(inverted))],
      (k) => m(tuple(sol.map((s, j) => (j === (k - 1) % n ? s.add(offset(Math.ceil(k / n))) : s)))),
    );
    return {
      question,
      answer,
      steps,
      distractors,
      check: { kind: 'systemN', vars, solution: sol.map((s) => s.value) },
    };
  },
});
