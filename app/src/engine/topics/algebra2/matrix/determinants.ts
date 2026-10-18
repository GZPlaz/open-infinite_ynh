/** Evaluating 2×2 and 3×3 determinants. */
import { Frac } from '../../../fraction';
import { boolOpt, defineTopic, distinctDistractors, offset, opt, strOpt } from '../../../generator';
import { m, num } from '../../../tex';
import type { ProblemContent } from '../../../types';
import { KIND } from '../smc-common';
import { detN, detSteps, detTex, randomM, type Matrix } from './common';

/** Sum of the three "downward" diagonal products only (a classic 3×3 slip). */
function forwardDiagonals(a: Matrix): Frac {
  let s = Frac.ZERO;
  for (let k = 0; k < 3; k++) s = s.add(a[0]![k]!.mul(a[1]![(k + 1) % 3]!).mul(a[2]![(k + 2) % 3]!));
  return s;
}

export const determinants = defineTopic({
  id: 'alg2.matrix.determinants',
  subject: 'algebra2',
  title: 'Determinants',
  description: 'Evaluate determinants of 2×2 and 3×3 matrices.',
  category: 'Matrices',
  instruction: 'Evaluate each determinant.',
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'size',
      label: 'Matrix size',
      default: 'any',
      choices: [
        { value: 'any', label: 'By difficulty' },
        { value: '2', label: '2×2 only' },
        { value: '3', label: '3×3 only' },
      ],
    },
    opt.negatives(true),
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const neg = boolOpt(ctx, 'negatives');
    const size = strOpt(ctx, 'size');
    const n = size === '2' ? 2 : size === '3' ? 3 : difficulty === 'easy' ? 2 : difficulty === 'medium' ? rng.pick([2, 2, 3]) : 3;
    const max = n === 2 ? { easy: 6, medium: 10, hard: 15 }[difficulty] : { easy: 3, medium: 4, hard: 6 }[difficulty];
    const a = randomM(rng, n, n, max, neg);
    const d = detN(a);
    const wrongs =
      n === 2
        ? [a[0]![0]!.mul(a[1]![1]!).add(a[0]![1]!.mul(a[1]![0]!)), d.neg(), a[0]![0]!.mul(a[1]![0]!).sub(a[0]![1]!.mul(a[1]![1]!))]
        : [forwardDiagonals(a), d.neg(), d.add(a[0]![1]!.mul(detN([[a[1]![0]!, a[1]![2]!], [a[2]![0]!, a[2]![2]!]])).mul(2))];
    return {
      question: m(detTex(a)),
      answer: m(num(d)),
      steps: detSteps(a),
      distractors: distinctDistractors(
        m(num(d)),
        wrongs.map((w) => m(num(w))),
        (k) => m(num(d.add(offset(k)))),
      ),
      check: { kind: `${KIND}.det` },
    };
  },
});
