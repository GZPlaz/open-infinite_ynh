/** End behavior of polynomial functions and graphing factored polynomials. */
import { graphPlane, plot } from '../../../diagram';
import { Frac } from '../../../fraction';
import { attempt, defineTopic, strOpt } from '../../../generator';
import { Poly } from '../../../polynomial';
import type { Rng } from '../../../rng';
import { m, num, sum } from '../../../tex';
import type { Difficulty, ProblemContent } from '../../../types';
import { CATEGORY, factoredTex, randPoly, rootFactor } from './common';

interface Graphable {
  roots: Array<{ r: number; e: number }>;
  k: Frac;
  poly: Poly;
}

const SCALES = [2, 1, new Frac(1, 2), new Frac(1, 3), new Frac(1, 4), new Frac(1, 5), new Frac(1, 6), new Frac(1, 8), new Frac(1, 10), new Frac(1, 12), new Frac(1, 16), new Frac(1, 20)];

function buildGraphable(rng: Rng, d: Difficulty, opts: { exits: boolean; integerOnly?: boolean }): Graphable {
  return attempt('graphable', () => {
    const count = d === 'easy' ? rng.int(2, 3) : d === 'medium' ? rng.int(2, 4) : rng.int(3, 4);
    const pool = rng.sample([-4, -3, -2, -1, 0, 1, 2, 3, 4], count).sort((a, b) => a - b);
    const roots = pool.map((r) => ({ r, e: 1 }));
    if (d !== 'easy' && rng.bool(0.6)) rng.pick(roots).e = d === 'hard' && rng.bool(0.4) ? 3 : 2;
    const deg = roots.reduce((s, x) => s + x.e, 0);
    if (deg < 2 || deg > 5) return null;
    const base = roots.reduce((p, x) => p.mul(rootFactor(x.r).powInt(x.e)), Poly.of(1));
    let M = 0;
    for (let x = pool[0]! - 0.3; x <= pool[pool.length - 1]! + 0.3; x += 0.05) M = Math.max(M, Math.abs(base.evalNum(x)));
    const sign = rng.sign();
    const options = (opts.integerOnly ? [1] : SCALES).map((s) => Frac.of(s)).filter((s) => {
      const top = M * s.value;
      return opts.integerOnly ? true : top >= 1.5 && top <= 9;
    });
    if (!options.length || (opts.integerOnly && M > 15)) return null;
    const k = rng.pick(options).mul(sign);
    const poly = base.scale(k);
    if (opts.exits && (Math.abs(poly.evalNum(-9.5)) < 11 || Math.abs(poly.evalNum(9.5)) < 11)) return null;
    return { roots, k, poly };
  });
}

function factoredFormTex(g: Graphable): string {
  const body = factoredTex({ k: 1, mono: 0, factors: g.roots.map((x) => ({ p: rootFactor(x.r), e: x.e })) }, 'x');
  const k = g.k;
  const prefix = k.eq(1) ? '' : k.eq(-1) ? '-' : k.toTex();
  return `${prefix}${body}`;
}

function endText(left: number, right: number): string {
  const s = (x: number) => (x > 0 ? '+' : '-');
  return `$f(x) \\to ${s(left)}\\infty$ as $x \\to -\\infty$; $f(x) \\to ${s(right)}\\infty$ as $x \\to +\\infty$`;
}

function shapeText(left: number, right: number): string {
  const even = left === right;
  const pos = right > 0;
  return `${even ? 'Even' : 'Odd'} degree; ${pos ? 'positive' : 'negative'} leading coefficient. ${endText(left, right)}`;
}

const COMBOS: Array<[number, number]> = [
  [1, 1],
  [-1, -1],
  [-1, 1],
  [1, -1],
];

export const endBehavior = defineTopic({
  id: 'alg2.poly.end-behavior',
  subject: 'algebra2',
  category: CATEGORY,
  title: 'End Behavior of Polynomials',
  description: 'Describe end behavior from the degree and leading coefficient, or read the degree parity and leading-coefficient sign from a graph.',
  instruction: (o) =>
    o.task === 'graph'
      ? 'State whether each graph has even or odd degree and the sign of its leading coefficient, and describe its end behavior.'
      : 'Describe the end behavior of each function.',
  multipleChoice: true,
  defaultCount: 8,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Given',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'Mixed' },
        { value: 'equation', label: 'Equation' },
        { value: 'graph', label: 'Graph' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const taskOpt = strOpt(ctx, 'task');
    const task = taskOpt === 'mixed' ? rng.pick(['equation', 'graph']) : taskOpt;
    if (task === 'graph') {
      const g = buildGraphable(rng, difficulty, { exits: true });
      const n = g.poly.degree;
      const right = g.k.sign;
      const left = n % 2 === 0 ? right : -right;
      const { b, w } = graphPlane(10, 2);
      plot(b, (x) => g.poly.evalNum(x), w);
      const answer = shapeText(left, right);
      return {
        question: `Describe the graphed polynomial, whose $x$-intercepts are $${g.roots.map((x) => x.r).join(', ')}$.`,
        diagram: b.build('Graph of a polynomial function'),
        answer,
        steps: [
          `The left end goes ${left > 0 ? 'up' : 'down'} and the right end goes ${right > 0 ? 'up' : 'down'}.`,
          left === right ? 'Both ends point the same way, so the degree is even.' : 'The ends point in opposite directions, so the degree is odd.',
          `The right end goes ${right > 0 ? 'up' : 'down'}, so the leading coefficient is ${right > 0 ? 'positive' : 'negative'}.`,
        ],
        distractors: COMBOS.filter(([l, r]) => l !== left || r !== right).map(([l, r]) => shapeText(l, r)),
        check: { kind: 'alg2-polynomials.endBehavior', source: 'graph' },
      };
    }
    const built = attempt('end-behavior', () => {
      const deg = difficulty === 'easy' ? rng.int(2, 4) : difficulty === 'medium' ? rng.int(2, 6) : rng.int(3, 7);
      const p = randPoly(rng, deg, 9, rng.int(2, Math.min(4, deg + 1)), { constant: rng.bool(0.7) });
      return p;
    });
    let fTex: string;
    let poly: Poly;
    const form = difficulty === 'hard' ? rng.pick(['factored', 'shuffled']) : difficulty === 'medium' ? rng.pick(['standard', 'shuffled']) : 'standard';
    if (form === 'factored') {
      const g = buildGraphable(rng, difficulty, { exits: false, integerOnly: true });
      const k = rng.signedInt(1, 4, true);
      poly = g.poly.scale(k);
      fTex = factoredFormTex({ ...g, k: g.k.mul(k) });
    } else {
      poly = built;
      const terms = poly.terms('x').filter((t) => !Frac.of(t.coef).isZero());
      let order = terms;
      if (form === 'shuffled' && terms.length > 1) {
        order = rng.shuffle(terms);
        if (order[0] === terms[0]) order = [...order.slice(1), order[0]!];
      }
      fTex = sum(order);
    }
    const n = poly.degree;
    const lead = poly.lead();
    const right = lead.sign;
    const left = n % 2 === 0 ? right : -right;
    const answer = endText(left, right);
    return {
      question: m(`f(x) = ${fTex}`),
      answer,
      steps: [
        `Degree $${n}$ (${n % 2 === 0 ? 'even' : 'odd'}); leading coefficient $${lead.toTex()}$ (${right > 0 ? 'positive' : 'negative'}).`,
        n % 2 === 0 ? 'Even degree: both ends point the same way as the leading coefficient.' : 'Odd degree: the ends point in opposite directions; the right end follows the leading coefficient.',
      ],
      distractors: COMBOS.filter(([l, r]) => l !== left || r !== right).map(([l, r]) => endText(l, r)),
      check: { kind: 'alg2-polynomials.endBehavior', source: 'equation' },
    };
  },
});

export const graphingPolynomials = defineTopic({
  id: 'alg2.poly.graph',
  subject: 'algebra2',
  category: CATEGORY,
  title: 'Graphing Polynomial Functions',
  description: 'Graph polynomials from their zeros and multiplicities (crossing or touching the x-axis) and end behavior.',
  instruction: 'Sketch the graph of each function.',
  multipleChoice: false,
  defaultCount: 6,
  options: [
    {
      type: 'select',
      id: 'form',
      label: 'Form of the function',
      default: 'factored',
      choices: [
        { value: 'factored', label: 'Factored' },
        { value: 'standard', label: 'Standard form' },
        { value: 'mixed', label: 'Mixed' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const formOpt = strOpt(ctx, 'form');
    const form = formOpt === 'mixed' ? rng.pick(['factored', 'standard']) : formOpt;
    const g = buildGraphable(rng, difficulty, { exits: false, integerOnly: form === 'standard' });
    const fTex = form === 'standard' ? g.poly.toTex('x') : factoredFormTex(g);
    const blank = graphPlane(10, 2).b.build('Blank coordinate plane');
    const { b, w } = graphPlane(10, 2);
    const f = (x: number) => g.poly.evalNum(x);
    plot(b, f, w);
    g.roots.forEach((x) => b.dot([x.r, 0], false, 'accent'));
    const y0 = g.poly.eval(0);
    if (Math.abs(y0.value) <= 10) b.dot([0, y0.value], false, 'accent');
    const zeros = g.roots.map((x) => `$${x.r}$${x.e > 1 ? ` (multiplicity ${x.e})` : ''}`).join(', ');
    const answer = `Zeros: ${zeros}; y-intercept: $${num(y0)}$`;
    const steps = [
      ...(form === 'standard' ? [`Factor: $f(x) = ${factoredFormTex(g)}$`] : []),
      `Zeros: ${g.roots.map((x) => `$${x.r}$ (${x.e % 2 ? 'crosses' : 'touches'})`).join(', ')}`,
      `Degree $${g.poly.degree}$ with leading coefficient $${g.poly.lead().toTex()}$: ${endText(g.poly.degree % 2 === 0 ? g.k.sign : -g.k.sign, g.k.sign)}`,
      `$y$-intercept: $f(0) = ${num(y0)}$`,
    ];
    return {
      question: m(`f(x) = ${fTex}`),
      answer,
      steps,
      diagram: blank,
      answerDiagram: b.build(`Graph of f(x) = ${fTex}`),
      check: { kind: 'alg2-polynomials.graph' },
    };
  },
});
