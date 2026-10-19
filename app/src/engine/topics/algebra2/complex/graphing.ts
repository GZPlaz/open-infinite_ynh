/** Graphing complex numbers on the complex plane, and naming plotted points. */
import { boolOpt, defineTopic, distinctDistractors, strOpt } from '../../../generator';
import { m, num, tuple } from '../../../tex';
import type { ProblemContent } from '../../../types';
import { KIND } from '../smc-common';
import { cadd, ceq, cmul, complexPlane, cParen, csub, cTex, cx, randCx, type Cx } from './common';

type Task = 'plot' | 'identify';

export const complexGraphing = defineTopic({
  id: 'alg2.complex.graphing',
  subject: 'algebra2',
  title: 'Graphing Complex Numbers',
  description: 'Plot complex numbers on the complex plane and name complex numbers from their graphs.',
  category: 'Complex Numbers',
  instruction: (o) => (o.task === 'identify' ? 'Write the complex number represented by each point.' : o.task === 'plot' ? 'Graph each complex number.' : 'Graph or name each complex number.'),
  multipleChoice: true,
  defaultCount: 6,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Problem type',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'plot', label: 'Graph a number' },
        { value: 'identify', label: 'Name a plotted point' },
      ],
    },
    { type: 'boolean', id: 'operations', label: 'Graph results of operations (hard)', default: true },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const chosen = strOpt(ctx, 'task');
    const task: Task = chosen === 'any' ? rng.pick<Task>(['plot', 'identify']) : (chosen as Task);
    const range = difficulty === 'easy' ? 6 : 8;
    const R = difficulty === 'easy' ? 5 : 7;
    let z: Cx = randCx(rng, R, difficulty !== 'easy');
    let expr = cTex(z);
    const steps: string[] = [];
    if (task === 'plot' && difficulty === 'hard' && boolOpt(ctx, 'operations')) {
      const kind = rng.pick(['add', 'sub', 'times']);
      let a: Cx;
      let b: Cx;
      if (kind === 'times') {
        a = cx(0, rng.pick([1, -1]));
        b = randCx(rng, 6);
        expr = `${cTex(a)}${cParen(b)}`;
        z = cmul(a, b);
      } else {
        a = randCx(rng, 4, true);
        b = csub(z, a);
        if (kind === 'sub') b = cx(b.re.neg(), b.im.neg());
        if (b.re.isZero() && b.im.isZero()) b = cx(1, -1);
        z = kind === 'add' ? cadd(a, b) : csub(a, b);
        expr = `${cParen(a)} ${kind === 'add' ? '+' : '-'} ${cParen(b)}`;
      }
      steps.push(`Simplify first: $${expr} = ${cTex(z)}$`);
    }
    const x = z.re.value;
    const y = z.im.value;
    const at = m(tuple([z.re, z.im]));
    const describe = `Real part $${num(z.re)}$ (horizontal), imaginary part $${num(z.im)}$ (vertical).`;
    steps.push(describe);
    const alts: Cx[] = [cx(z.im, z.re), cx(z.re, z.im.neg()), cx(z.re.neg(), z.im), cx(z.re.neg(), z.im.neg()), cx(z.im.neg(), z.re)];
    if (task === 'plot') {
      const q = complexPlane(range);
      const a = complexPlane(range);
      a.dot([x, y], false, 'accent');
      a.label([x, y], cTex(z), y >= 0 ? 'ne' : 'se', { ink: 'accent', small: true });
      const answer = `The point ${at}`;
      steps.push(`Plot the point ${at}.`);
      return {
        question: m(expr),
        answer,
        steps,
        diagram: q.build('Blank complex plane'),
        answerDiagram: a.build(`The complex number ${cTex(z)} plotted on the complex plane`),
        distractors: distinctDistractors(answer, alts.filter((w) => !ceq(w, z)).map((w) => `The point ${m(tuple([w.re, w.im]))}`), (k) => `The point ${m(tuple([x + k, y]))}`),
        check: { kind: `${KIND}.cplane`, task },
      };
    }
    const q = complexPlane(range);
    q.dot([x, y], false, 'accent');
    const answer = m(cTex(z));
    return {
      question: 'Name the complex number graphed.',
      answer,
      steps,
      diagram: q.build('A point plotted on the complex plane'),
      distractors: distinctDistractors(answer, alts.filter((w) => !ceq(w, z)).map((w) => m(cTex(w))), (k) => m(cTex(cx(x + k, y)))),
      check: { kind: `${KIND}.cplane`, task },
    };
  },
});
