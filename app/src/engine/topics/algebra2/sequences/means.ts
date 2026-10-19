/** Arithmetic and geometric means: insert means between two numbers, or find a single mean. */
import { Frac } from '../../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, offset, strOpt } from '../../../generator';
import { rootTex, simplifySqrt } from '../../../radical';
import { m, num } from '../../../tex';
import type { ProblemContent } from '../../../types';
import { NUMBER_WORDS } from './common';

type Task = 'arithmetic' | 'geometric' | 'single';

const listAns = (xs: readonly Frac[]) => m(xs.map((x) => num(x)).join(', '));
const plural = (k: number, word: string) => `${NUMBER_WORDS[k]} ${word}${k === 1 ? '' : 's'}`;

export const means = defineTopic({
  id: 'alg2.seq.means',
  subject: 'algebra2',
  title: 'Arithmetic and Geometric Mean',
  description: 'Insert arithmetic or geometric means between two numbers, or find a single arithmetic or geometric mean.',
  category: 'Sequences and Series',
  instruction: 'Find the indicated means.',
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Problems',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'arithmetic', label: 'Insert arithmetic means' },
        { value: 'geometric', label: 'Insert geometric means' },
        { value: 'single', label: 'A single arithmetic or geometric mean' },
      ],
    },
    { type: 'boolean', id: 'negatives', label: 'Allow negative numbers', default: true },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty: d } = ctx;
    const negatives = boolOpt(ctx, 'negatives') && d !== 'easy';
    const tOpt = strOpt(ctx, 'task');
    const task: Task = tOpt === 'any' || !tOpt ? rng.pick<Task>(['arithmetic', 'geometric', 'single']) : (tOpt as Task);

    if (task === 'arithmetic') {
      const k = rng.int(d === 'easy' ? 1 : 2, d === 'easy' ? 3 : 5);
      const a = new Frac(negatives ? rng.int(-30, 30) : rng.int(1, 30));
      const diff = d === 'hard' && rng.bool(0.4) ? new Frac(rng.signedInt(1, 7, negatives), 2) : new Frac(rng.signedInt(2, d === 'easy' ? 6 : 12, negatives));
      const b = a.add(diff.mul(k + 1));
      const terms = (dd: Frac, len = k) => Array.from({ length: len }, (_, i) => a.add(dd.mul(i + 1)));
      const answer = listAns(terms(diff));
      const span = b.sub(a);
      const wrongs = [listAns(terms(span.div(k))), k > 1 ? listAns(terms(span.div(k + 2))) : null, listAns(terms(diff.neg()).map((t) => t.add(diff.mul(k + 2))))];
      return {
        question: k === 1 ? `Find the arithmetic mean between ${m(num(a))} and ${m(num(b))}.` : `Insert ${plural(k, 'arithmetic mean')} between ${m(num(a))} and ${m(num(b))}.`,
        answer,
        steps: [m(`${num(b)} = ${num(a)} + ${k + 1}d`), m(`d = ${num(diff)}`), answer],
        distractors: distinctDistractors(answer, wrongs, (j) => listAns([...terms(diff).slice(0, -1), terms(diff)[k - 1]!.add(offset(j))])),
        check: { kind: 'alg2-sequences-probability.means', mean: 'arithmetic', count: k },
      };
    }

    if (task === 'geometric') {
      return attempt('geometric-means', () => {
        const k = d === 'hard' && rng.bool(0.4) ? 4 : 2;
        const rs = k === 4 ? [2, 3, -2] : d === 'easy' ? [2, 3, 4] : [2, 3, 4, 5, -2, -3];
        const fractional = d !== 'easy' && rng.bool(0.25);
        const r = fractional ? new Frac(rng.pick(negatives ? [1, -1] : [1]), rng.pick([2, 3])) : new Frac(rng.pick(rs.filter((x) => negatives || x > 0)));
        const a = new Frac(rng.signedInt(1, k === 4 ? 3 : d === 'easy' ? 10 : 6, negatives) * (fractional ? r.d ** (k + 1) : 1));
        const terms = Array.from({ length: k }, (_, i) => a.mul(r.pow(i + 1)));
        const b = a.mul(r.pow(k + 1));
        if (Math.abs(b.value) > 20000) return null;
        const answer = listAns(terms);
        const ad = b.sub(a).div(k + 1);
        const wrongs = [
          listAns(terms.map((_, i) => a.add(ad.mul(i + 1)))),
          listAns(terms.map((_, i) => a.mul(r.neg().pow(i + 1)))),
          listAns(terms.map((_, i) => a.mul(r.pow(i + 2)))),
        ];
        return {
          question: `Insert ${plural(k, 'geometric mean')} between ${m(num(a))} and ${m(num(b))}.`,
          answer,
          steps: [m(`${num(b)} = ${num(a)} \\cdot r^{${k + 1}}`), m(`r^{${k + 1}} = ${num(b.div(a))} \\Rightarrow r = ${num(r)}`), answer],
          distractors: distinctDistractors(answer, wrongs, (j) => listAns([...terms.slice(0, -1), terms[k - 1]!.add(offset(j))])),
          check: { kind: 'alg2-sequences-probability.means', mean: 'geometric', count: k },
        };
      });
    }

    // single mean
    if (rng.bool(0.4)) {
      const a = rng.signedInt(1, d === 'easy' ? 30 : 60, negatives);
      const b = attempt('am', () => {
        const x = rng.signedInt(1, d === 'easy' ? 30 : 60, negatives);
        return x === a || (d === 'easy' && (a + x) % 2 !== 0) ? null : x;
      });
      const mean = new Frac(a + b, 2);
      const answer = m(num(mean));
      return {
        question: `Find the arithmetic mean of ${m(String(a))} and ${m(String(b))}.`,
        answer,
        steps: [m(`\\frac{${a} ${b < 0 ? '-' : '+'} ${Math.abs(b)}}{2} = ${num(mean)}`)],
        distractors: distinctDistractors(answer, [m(String(a + b)), m(num(new Frac(Math.abs(b - a), 2))), m(num(new Frac(a + b, 3)))], (j) => m(num(mean.add(offset(j))))),
        check: { kind: 'alg2-sequences-probability.means', mean: 'arithmetic', count: 1 },
      };
    }
    return attempt('gm', () => {
      let a: number;
      let b: number;
      if (d === 'easy') {
        const g = rng.int(2, 12);
        a = rng.pick([1, 2, 3, 4].filter((x) => (g * g) % x === 0 && x !== g));
        a = a * rng.pick([1, 1, 2].filter((y) => (g * g) % (a * y) === 0));
        b = (g * g) / a;
      } else {
        a = rng.int(2, d === 'medium' ? 20 : 40);
        b = rng.int(2, d === 'medium' ? 20 : 40);
      }
      if (a === b || !Number.isInteger(b)) return null;
      const { out, inside } = simplifySqrt(a * b);
      if (d === 'easy' && inside !== 1) return null;
      if (d === 'hard' && inside === 1 && rng.bool(0.7)) return null;
      const gm = rootTex(out, inside);
      const answer = m(gm);
      const sumRoot = simplifySqrt(a + b);
      const wrongs = [m(num(new Frac(a + b, 2))), m(num(new Frac(a * b, 2))), m(rootTex(sumRoot.out, sumRoot.inside)), m(`-${gm}`)];
      return {
        question: `Find the geometric mean of ${m(String(a))} and ${m(String(b))}.`,
        answer,
        steps: [m(`\\sqrt{${a} \\cdot ${b}} = \\sqrt{${a * b}} = ${gm}`)],
        distractors: distinctDistractors(answer, wrongs, (j) => m(String(out * inside + j))),
        check: { kind: 'alg2-sequences-probability.means', mean: 'geometric', count: 1 },
      };
    });
  },
});
