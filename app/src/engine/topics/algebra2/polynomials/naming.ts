/** Naming polynomials by degree and number of terms; degree and leading coefficient. */
import { Frac } from '../../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, opt, pickVar, strOpt } from '../../../generator';
import { m, pow, sum, type Term } from '../../../tex';
import type { ProblemContent } from '../../../types';
import { CATEGORY, randPoly } from './common';

const DEGREE_NAMES = ['Constant', 'Linear', 'Quadratic', 'Cubic', 'Quartic', 'Quintic', 'Sixth-degree', 'Seventh-degree'];
const COUNT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];

export function termName(n: number): string {
  if (n === 1) return 'monomial';
  if (n === 2) return 'binomial';
  if (n === 3) return 'trinomial';
  return `polynomial with ${COUNT_WORDS[n]} terms`;
}

export function polyName(degree: number, terms: number): string {
  return `${DEGREE_NAMES[degree]} ${termName(terms)}`;
}

export const namingPolynomials = defineTopic({
  id: 'alg2.poly.naming',
  subject: 'algebra2',
  category: CATEGORY,
  title: 'Naming Polynomials',
  description: 'Classify polynomials by degree and number of terms, and find the degree and leading coefficient.',
  instruction: (o) =>
    o.task === 'degree'
      ? 'State the degree and leading coefficient of each polynomial.'
      : o.task === 'both'
        ? 'Name each polynomial by degree and number of terms, and state its leading coefficient.'
        : 'Name each polynomial by degree and number of terms.',
  multipleChoice: true,
  defaultCount: 12,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Task',
      default: 'name',
      choices: [
        { value: 'name', label: 'Name by degree and number of terms' },
        { value: 'degree', label: 'Degree and leading coefficient' },
        { value: 'both', label: 'Name and leading coefficient' },
      ],
    },
    { type: 'boolean', id: 'order', label: 'Terms out of standard order', default: false, help: 'Always on for hard problems.' },
    opt.variedVariables(true),
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const task = strOpt(ctx, 'task');
    const v = pickVar(rng, boolOpt(ctx, 'variedVars'));
    const shuffled = difficulty === 'hard' || boolOpt(ctx, 'order');
    const built = attempt('naming', () => {
      const degree = difficulty === 'easy' ? rng.int(0, 4) : difficulty === 'medium' ? rng.int(1, 5) : rng.int(2, 6);
      const maxTerms = Math.min(degree + 1, difficulty === 'easy' ? 3 : 4);
      const nTerms = rng.int(1, maxTerms);
      const p = randPoly(rng, degree, difficulty === 'easy' ? 9 : 12, nTerms);
      const terms: Term[] = p.terms(v).filter((t) => !Frac.of(t.coef).isZero());
      let order = terms;
      if (shuffled && terms.length > 1) {
        order = rng.shuffle(terms);
        if (order[0] === terms[0]) order = [...order.slice(1), order[0]!];
      }
      return { p, terms, order };
    });
    const { p, terms, order } = built;
    const degree = p.degree;
    const n = terms.length;
    const lead = p.lead();
    const question = sum(order);
    const leadTex = lead.toTex();
    const firstDeg = (() => {
      const sym = order[0]!.sym ?? '';
      for (let k = 0; k <= 7; k++) if (pow(v, k) === sym) return k;
      return degree;
    })();
    const firstCoef = order[0]!.coef;

    const say = (deg: number, cnt: number, lc: string) => {
      if (task === 'degree') return `Degree $${deg}$; leading coefficient $${lc}$`;
      if (task === 'both') return `${polyName(deg, cnt)}; leading coefficient $${lc}$`;
      return polyName(deg, cnt);
    };
    const answer = say(degree, n, leadTex);
    const steps = [
      `The term with the greatest exponent is $${sum([{ coef: lead, sym: pow(v, degree) }])}$, so the degree is $${degree}$ (${DEGREE_NAMES[degree]!.toLowerCase()}).`,
      `There ${n === 1 ? 'is' : 'are'} ${COUNT_WORDS[n]} term${n === 1 ? '' : 's'} (${termName(n)}); the leading coefficient is $${leadTex}$.`,
    ];
    const ok = (deg: number, cnt: number) => deg >= 0 && deg <= 7 && cnt >= 1 && cnt <= 8;
    const cands: Array<[number, number, string]> = [
      [firstDeg, n, Frac.of(firstCoef).toTex()],
      [degree, n + 1, leadTex],
      [degree + 1, n, leadTex],
      [degree, n, lead.neg().toTex()],
      [n, degree, leadTex],
      [degree - 1, n, leadTex],
      [degree, n - 1, leadTex],
    ];
    const distractors = distinctDistractors(
      answer,
      cands.filter(([d, c]) => ok(d, c)).map(([d, c, l]) => say(d, c, l)),
      (k) => {
        const d = degree + (k % 3) - 1 + (k > 6 ? 2 : 0);
        const c = n + ((k >> 1) % 3) - 1;
        return ok(d, c) ? say(d, c, k % 2 ? lead.neg().toTex() : leadTex) : null;
      },
    );
    return {
      question: m(question),
      answer,
      steps,
      distractors,
      check: { kind: 'alg2-polynomials.naming', variable: v, task },
    };
  },
});
