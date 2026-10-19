/** Absolute value (modulus) of complex numbers. */
import { Frac } from '../../../fraction';
import { attempt, defineTopic, distinctDistractors, offset, opt, strOpt } from '../../../generator';
import { isPerfectSquare, rootTex, simplifySqrt } from '../../../radical';
import { decimal, m, num, parenNeg } from '../../../tex';
import type { ProblemContent } from '../../../types';
import { KIND } from '../smc-common';
import { cmul, cParen, cTex, cx, norm2, randCx, type Cx } from './common';

const TRIPLES: Array<[number, number]> = [
  [3, 4],
  [6, 8],
  [5, 12],
  [8, 6],
  [9, 12],
  [8, 15],
  [12, 16],
  [7, 24],
  [15, 20],
  [12, 5],
];

/** √n for a non-negative rational n, in simplest radical form or rounded. */
function rootOf(n: Frac, round: boolean): string {
  if (round && !(isPerfectSquare(n.n) && isPerfectSquare(n.d))) return `\\approx ${decimal(Math.sqrt(n.value))}`;
  // √(P/Q) = √(PQ)/Q
  const { out, inside } = simplifySqrt(n.n * n.d);
  const coef = new Frac(out, n.d);
  const top = rootTex(coef.n, inside);
  return coef.d === 1 ? top : `\\frac{${top}}{${coef.d}}`;
}

export const complexAbsoluteValue = defineTopic({
  id: 'alg2.complex.absolute-value',
  subject: 'algebra2',
  title: 'Absolute Value of Complex Numbers',
  description: 'Find |a + bi| = √(a² + b²), exactly or rounded.',
  category: 'Complex Numbers',
  instruction: (o) => (o.answerForm === 'round' ? 'Find each absolute value. Round to the nearest tenth when necessary.' : 'Find each absolute value. Leave answers in simplest radical form.'),
  multipleChoice: true,
  defaultCount: 10,
  options: [opt.rounding('exact')],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const round = strOpt(ctx, 'answerForm') === 'round';
    let z: Cx;
    let inner: string;
    const steps: string[] = [];
    if (difficulty === 'easy') {
      const [a, b] = rng.pick(TRIPLES);
      z = rng.bool(0.15) ? cx(0, rng.signedInt(2, 12, true)) : cx(a * rng.sign(), b * rng.sign());
      inner = cTex(z);
    } else if (difficulty === 'medium') {
      z = attempt('modulus', () => {
        const w = randCx(rng, 10);
        const n = norm2(w).value;
        return isPerfectSquare(n) && rng.bool(0.7) ? null : w;
      });
      inner = cTex(z);
    } else {
      const kind = rng.pick(['product', 'fraction', 'big']);
      if (kind === 'product') {
        const u = randCx(rng, 5);
        const v = randCx(rng, 4);
        z = cmul(u, v);
        inner = `${cParen(u)}${cParen(v)}`;
        steps.push(`Multiply first: $${inner} = ${cTex(z)}$`);
      } else if (kind === 'fraction') {
        const den = rng.pick([2, 3, 4, 5, 6]);
        z = cx(new Frac(rng.signedInt(1, 9, true), den), new Frac(rng.signedInt(1, 9, true), den));
        inner = cTex(z);
      } else {
        z = randCx(rng, 20);
        inner = cTex(z);
      }
    }
    const n2 = norm2(z);
    const value = rootOf(n2, round);
    const answer = m(value);
    steps.unshift(`$\\left|a + bi\\right| = \\sqrt{a^{2} + b^{2}}$`);
    steps.push(`$\\sqrt{${parenNeg(z.re)}^{2} + ${parenNeg(z.im)}^{2}} = \\sqrt{${num(n2)}}${value.startsWith('\\approx') ? ` ${value}` : value === `\\sqrt{${num(n2)}}` ? '' : ` = ${value}`}$`);
    const a = z.re.abs();
    const b = z.im.abs();
    const diff = a.mul(a).sub(b.mul(b)).abs();
    const asRoot = (f: Frac) => rootOf(f, round);
    const cands = [
      m(num(a.add(b))),
      diff.isZero() ? null : asRoot(diff) && m(asRoot(diff)!),
      m(num(n2)),
      asRoot(n2.mul(2)) && m(asRoot(n2.mul(2))!),
    ];
    const distractors = distinctDistractors(answer, cands, (k) => m(num(a.add(b).add(offset(k)))));
    return {
      question: m(`\\left|${inner}\\right|`),
      answer,
      steps,
      distractors,
      check: { kind: `${KIND}.cabs` },
    };
  },
});
