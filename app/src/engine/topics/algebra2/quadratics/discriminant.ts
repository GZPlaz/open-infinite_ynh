/** The discriminant b² − 4ac and the number and type of solutions. */
import { attempt, boolOpt, defineTopic, distinctDistractors, opt, pickVar, strOpt } from '../../../generator';
import { Poly } from '../../../polynomial';
import { isPerfectSquare } from '../../../radical';
import type { Rng } from '../../../rng';
import { m, paren } from '../../../tex';
import type { Difficulty, ProblemContent } from '../../../types';
import { CATEGORY_QUAD, rearranged } from './common';

type Cat = 'rational2' | 'irrational2' | 'one' | 'imaginary2';

export const CATEGORY_TEXT: Record<Cat, string> = {
  rational2: 'two rational solutions',
  irrational2: 'two irrational solutions',
  one: 'one rational solution',
  imaginary2: 'two imaginary solutions',
};

function category(D: number): Cat {
  if (D < 0) return 'imaginary2';
  if (D === 0) return 'one';
  return isPerfectSquare(D) ? 'rational2' : 'irrational2';
}

function build(rng: Rng, d: Difficulty): [number, number, number] {
  const want = rng.pick<Cat>(['rational2', 'irrational2', 'one', 'imaginary2', 'irrational2', 'imaginary2']);
  const L = d === 'easy' ? { a: 3, b: 8, c: 8 } : d === 'medium' ? { a: 6, b: 12, c: 10 } : { a: 9, b: 16, c: 15 };
  return attempt('discriminant', () => {
    if (want === 'one') {
      const p = rng.int(1, d === 'easy' ? 2 : 3);
      const q = rng.signedInt(1, d === 'easy' ? 4 : 6, true);
      const k = d === 'hard' ? rng.signedInt(1, 2, true) : 1;
      return [k * p * p, 2 * k * p * q, k * q * q];
    }
    const a = rng.signedInt(1, L.a, d !== 'easy');
    const b = rng.int(-L.b, L.b);
    const c = rng.signedInt(1, L.c, true);
    if (category(b * b - 4 * a * c) !== want) return null;
    return [a, b, c];
  });
}

export const discriminant = defineTopic({
  id: 'alg2.quad.discriminant',
  subject: 'algebra2',
  category: CATEGORY_QUAD,
  title: 'The Discriminant',
  description: 'Compute b² − 4ac and use it to describe the number and type of solutions.',
  instruction: (o) =>
    o.task === 'value'
      ? 'Find the value of the discriminant of each quadratic equation.'
      : o.task === 'describe'
        ? 'Use the discriminant to determine the number and type of solutions of each equation.'
        : 'Find the value of the discriminant of each quadratic equation. Then describe the number and type of solutions.',
  multipleChoice: true,
  defaultCount: 12,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Task',
      default: 'both',
      choices: [
        { value: 'both', label: 'Discriminant and type of solutions' },
        { value: 'value', label: 'Discriminant only' },
        { value: 'describe', label: 'Number and type of solutions only' },
      ],
    },
    opt.variedVariables(true),
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const task = strOpt(ctx, 'task');
    const v = pickVar(rng, boolOpt(ctx, 'variedVars'));
    const [a, b, c] = build(rng, difficulty);
    const std = Poly.of(c, b, a);
    const question = difficulty === 'hard' ? rearranged(rng, std, v) : `${std.toTex(v)} = 0`;
    const D = b * b - 4 * a * c;
    const cat = category(D);
    const steps: string[] = [];
    if (difficulty === 'hard') steps.push(`Standard form: $${std.toTex(v)} = 0$`);
    steps.push(`$a = ${a},\\ b = ${b},\\ c = ${c}$`);
    steps.push(`$b^{2} - 4ac = ${paren(b)}^{2} - 4${paren(a)}${paren(c)} = ${D}$`);
    steps.push(
      D < 0
        ? 'The discriminant is negative, so there are two imaginary solutions.'
        : D === 0
          ? 'The discriminant is zero, so there is one (repeated) rational solution.'
          : isPerfectSquare(D)
            ? 'The discriminant is a positive perfect square, so there are two rational solutions.'
            : 'The discriminant is positive but not a perfect square, so there are two irrational solutions.',
    );
    const show = (Dv: number, ct: Cat | null) => (task === 'value' ? m(`D = ${Dv}`) : task === 'describe' ? CATEGORY_TEXT[ct!] : `${m(`D = ${Dv}`)}; ${CATEGORY_TEXT[ct!]}`);
    const answer = show(D, cat);
    const others = (Object.keys(CATEGORY_TEXT) as Cat[]).filter((x) => x !== cat);
    const alt = b * b + 4 * a * c;
    const distractors =
      task === 'describe'
        ? others.map((x) => CATEGORY_TEXT[x])
        : distinctDistractors(
            answer,
            [
              show(D, others[0]!),
              show(alt, category(alt)),
              D !== 0 ? show(-D, category(-D)) : null,
              b !== 0 ? show(b * b, category(b * b)) : null,
              show(b - 4 * a * c, category(b - 4 * a * c)),
            ],
            (k) => show(D + 4 * k, category(D + 4 * k)),
          );
    return {
      question: m(question),
      answer,
      steps,
      distractors,
      check: { kind: 'alg2-quadratics-functions.discriminant', variable: v, task },
    };
  },
});
