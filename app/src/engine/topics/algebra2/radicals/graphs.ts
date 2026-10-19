/** Graphing radical functions and finding their domain and range. */
import { graphPlane, plotParam } from '../../../diagram';
import { Frac } from '../../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, strOpt } from '../../../generator';
import { m, num, sum, tuple } from '../../../tex';
import type { ProblemContent } from '../../../types';
import { coefPrefix, radTex } from './common';

const CATEGORY = 'Radical Functions and Rational Exponents';

/** y = a·ⁿ√(s(x − h)) + k with s = ±1. */
interface RadFn {
  n: 2 | 3;
  a: Frac;
  s: 1 | -1;
  h: number;
  k: number;
}

function innerTex(s: 1 | -1, h: number): string {
  return s === 1 ? sum([{ coef: 1, sym: 'x' }, { coef: -h }]) : sum([{ coef: h }, { coef: -1, sym: 'x' }]);
}

function fnTex(f: RadFn): string {
  return sum([{ coef: 1, sym: `${coefPrefix(f.a)}${radTex(f.n, innerTex(f.s, f.h))}` }, { coef: f.k }]);
}

function evalFn(f: RadFn, x: number): number {
  const u = f.s * (x - f.h);
  return f.a.value * (f.n === 2 ? Math.sqrt(u) : Math.cbrt(u)) + f.k;
}

export const graphRadicals = defineTopic({
  id: 'alg2.radical.graph',
  subject: 'algebra2',
  title: 'Graphing Radical Functions',
  description: 'Graph square-root and cube-root functions y = a√(x − h) + k from their key points.',
  category: CATEGORY,
  instruction: 'Graph each function.',
  multipleChoice: false,
  defaultCount: 6,
  options: [
    {
      type: 'select',
      id: 'type',
      label: 'Functions',
      default: 'any',
      choices: [
        { value: 'any', label: 'Square and cube roots' },
        { value: 'square', label: 'Square roots only' },
        { value: 'cube', label: 'Cube roots only' },
      ],
    },
    { type: 'boolean', id: 'reflect', label: 'Reflections in the y-axis (hard)', default: true },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const type = strOpt(ctx, 'type');
    const n: 2 | 3 = type === 'square' ? 2 : type === 'cube' ? 3 : rng.bool(0.6) ? 2 : 3;
    const aChoices =
      difficulty === 'easy' ? [new Frac(1), new Frac(-1), new Frac(2)] : difficulty === 'medium' ? [1, -1, 2, -2, new Frac(1, 2), new Frac(-1, 2)].map((x) => Frac.of(x)) : [2, -2, 3, -3, new Frac(1, 2), new Frac(-1, 2), new Frac(3, 2)].map((x) => Frac.of(x));
    const f: RadFn = {
      n,
      a: rng.pick(aChoices),
      s: difficulty === 'hard' && boolOpt(ctx, 'reflect') && rng.bool(0.35) ? -1 : 1,
      h: rng.int(difficulty === 'easy' ? -4 : -5, difficulty === 'easy' ? 4 : 5),
      k: rng.int(difficulty === 'easy' ? -4 : -5, difficulty === 'easy' ? 4 : 5),
    };
    const eq = `y = ${fnTex(f)}`;
    // key points: t with integer x and y
    const ts = f.a.d === 2 ? [2] : [1];
    const keys: Array<[number, number]> = [[f.h, f.k]];
    for (const t of ts) {
      const tt = n === 2 ? [t] : [t, -t];
      for (const u of tt) keys.push([f.h + f.s * (n === 2 ? u * u : u ** 3), f.a.mul(u).add(f.k).value]);
    }
    if (n === 2) keys.push([f.h + f.s * 4 * ts[0]! * ts[0]!, f.a.mul(2 * ts[0]!).add(f.k).value]);
    const inside = keys.filter(([x, y]) => Math.abs(x) <= 10 && Math.abs(y) <= 10);

    const blank = graphPlane(10, 2);
    const solved = graphPlane(10, 2);
    const T = n === 2 ? Math.sqrt(21) : Math.cbrt(21);
    plotParam(
      solved.b,
      (t) => f.h + f.s * (n === 2 ? t * t : t ** 3),
      (t) => f.a.value * t + f.k,
      n === 2 ? 0 : -T,
      T,
      solved.w,
      {},
      300,
    );
    for (const p of inside) solved.b.dot(p, false, 'accent');
    const named = inside.slice(0, 3);
    const label = n === 2 ? 'Endpoint' : 'Center';
    const answer = `${label} ${m(tuple([num(f.h), num(f.k)]))}; also through ${named
      .slice(1)
      .map(([x, y]) => m(tuple([x, y])))
      .join(' and ')}`;
    const steps = [
      `Parent function ${m(n === 2 ? 'y = \\sqrt{x}' : 'y = \\sqrt[3]{x}')}${f.s === -1 ? ', reflected across the y-axis' : ''}.`,
      `Vertical stretch/reflection ${m(`a = ${f.a.toTex()}`)}; shift ${f.h === 0 ? 'none' : `${Math.abs(f.h)} ${f.h > 0 ? 'right' : 'left'}`} horizontally and ${f.k === 0 ? 'none' : `${Math.abs(f.k)} ${f.k > 0 ? 'up' : 'down'}`} vertically.`,
      `Plot ${named.map(([x, y]) => m(tuple([x, y]))).join(', ')} and draw the curve${n === 2 ? ' from the endpoint' : ''}.`,
    ];
    return {
      question: m(eq),
      answer,
      steps,
      diagram: blank.b.build('Blank coordinate plane'),
      answerDiagram: solved.b.build(`Graph of ${eq}`),
      check: { kind: 'alg2-radicals-rational.radgraph', n: inside.length, valid: named.length >= 2 },
    };
  },
});

// ---------------------------------------------------------------- domain and range

export const radicalDomainRange = defineTopic({
  id: 'alg2.radical.domain-range',
  subject: 'algebra2',
  title: 'Domain and Range of Radical Functions',
  description: 'State the domain and range of square-root, fourth-root and cube-root functions.',
  category: CATEGORY,
  instruction: (o) => (o.notation === 'interval' ? 'Find the domain and range of each function. Use interval notation.' : 'Find the domain and range of each function.'),
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'notation',
      label: 'Notation',
      default: 'inequality',
      choices: [
        { value: 'inequality', label: 'Inequalities' },
        { value: 'interval', label: 'Interval notation' },
      ],
    },
    { type: 'boolean', id: 'cube', label: 'Include cube roots', default: true },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const interval = strOpt(ctx, 'notation') === 'interval';
    const built = attempt('domain-range', () => {
      const n = boolOpt(ctx, 'cube') && rng.bool(0.2) ? 3 : difficulty === 'hard' && rng.bool(0.25) ? 4 : 2;
      const b = difficulty === 'easy' ? 1 : difficulty === 'medium' ? rng.pick([1, 1, -1, 2, 3]) : rng.pick([-1, 2, -2, 3, -3, 4, -4]);
      const c = rng.int(-9, 9);
      const a = difficulty === 'easy' ? rng.pick([1, 2, 3, -1]) : rng.pick([1, -1, 2, -2, 3, -3, 4, -5]);
      const k = rng.int(-8, 8);
      const x0 = new Frac(-c, b);
      if (!x0.isInt() && difficulty !== 'hard') return null;
      return { n, a, b, c, k, x0 };
    });
    const { n, a, b, c, k, x0 } = built;
    const inner = sum([{ coef: b, sym: 'x' }, { coef: c }]);
    const fTex = sum([{ coef: 1, sym: `${coefPrefix(a)}${radTex(n, inner)}` }, { coef: k }]);
    const question = `y = ${fTex}`;
    const ineq = (v: string, ge: boolean, e: Frac) => (interval ? (ge ? `\\left[${num(e)}, \\infty\\right)` : `\\left(-\\infty, ${num(e)}\\right]`) : `${v} ${ge ? '\\ge' : '\\le'} ${num(e)}`);
    const all = interval ? m('\\left(-\\infty, \\infty\\right)') : 'all real numbers';
    const render = (d: string, r: string) => `Domain: ${d}; Range: ${r}`;
    const dom = (ge: boolean, e: Frac) => m(ineq('x', ge, e));
    const ran = (ge: boolean, e: Frac) => m(ineq('y', ge, e));
    const K = new Frac(k);
    let answer: string;
    let wrongs: string[];
    const steps: string[] = [];
    if (n === 3) {
      answer = render(all, all);
      wrongs = [render(dom(true, x0), all), render(all, ran(true, K)), render(dom(true, x0), ran(true, K)), render(dom(true, x0.neg()), ran(a > 0, K))];
      steps.push('A cube root is defined for every real number and takes every real value.');
    } else {
      const ge = b > 0;
      answer = render(dom(ge, x0), ran(a > 0, K));
      wrongs = [render(dom(!ge, x0), ran(a > 0, K)), render(dom(ge, x0), ran(a < 0, K)), render(dom(ge, x0.neg()), ran(a > 0, K)), render(dom(ge, x0), ran(a > 0, x0)), render(dom(!ge, x0.neg()), ran(a < 0, K))];
      steps.push(`The radicand must be nonnegative: ${m(`${inner} \\ge 0`)}, so ${m(`x ${ge ? '\\ge' : '\\le'} ${num(x0)}`)}.`);
      steps.push(`The root is at least ${m('0')}; multiplying by ${m(String(a))} and adding ${m(String(k))} gives ${m(`y ${a > 0 ? '\\ge' : '\\le'} ${k}`)}.`);
    }
    const distractors = distinctDistractors(answer, wrongs, () => null);
    return {
      question: m(question),
      answer,
      steps,
      distractors,
      check: { kind: 'alg2-radicals-rational.domrange' },
    };
  },
});
