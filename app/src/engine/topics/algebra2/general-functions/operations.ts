/** Function operations: f + g, f − g, f·g, f/g and f∘g, as expressions or evaluated at a number. */
import { attempt, boolOpt, defineTopic, distinctDistractors, opt, pickVar, strOpt } from '../../../generator';
import type { Rng } from '../../../rng';
import { m, num, paren, parenNeg } from '../../../tex';
import type { Difficulty, ProblemContent } from '../../../types';
import { CATEGORY_FUNC, compose, Frac, Poly, polySub, randomPoly } from './common';

type Op = '+' | '-' | '*' | '/' | 'o';

const OPS: Record<string, Op[]> = {
  mixed: ['+', '-', '*', '/', 'o'],
  addsub: ['+', '-'],
  muldiv: ['*', '/'],
  compose: ['o'],
};

const PAIRS: Array<[string, string]> = [
  ['f', 'g'],
  ['g', 'f'],
  ['g', 'h'],
  ['f', 'h'],
  ['h', 'g'],
];

function degrees(rng: Rng, d: Difficulty): [number, number] {
  if (d === 'easy') return [1, 1];
  if (d === 'medium') return rng.bool() ? [1, 2] : [2, 1];
  return rng.pick<[number, number]>([
    [2, 2],
    [2, 1],
    [1, 2],
    [3, 1],
    [2, 3],
  ]);
}

/** Result of an operation as an expression (tex) and as a function of a number. */
interface Result {
  tex: string;
  at: (x: Frac) => Frac | null;
}

function apply(op: Op, f: Poly, g: Poly, v: string): Result {
  const fromPoly = (p: Poly): Result => ({ tex: p.toTex(v), at: (x) => p.eval(x) });
  switch (op) {
    case '+':
      return fromPoly(f.add(g));
    case '-':
      return fromPoly(f.sub(g));
    case '*':
      return fromPoly(f.mul(g));
    case 'o':
      return fromPoly(compose(f, g));
    case '/':
      return {
        tex: `\\frac{${f.toTex(v)}}{${g.toTex(v)}}`,
        at: (x) => (g.eval(x).isZero() ? null : f.eval(x).div(g.eval(x))),
      };
  }
}

function opTex(op: Op, a: string, b: string): string {
  switch (op) {
    case '+':
      return `(${a} + ${b})`;
    case '-':
      return `(${a} - ${b})`;
    case '*':
      return `(${a} \\cdot ${b})`;
    case 'o':
      return `(${a} \\circ ${b})`;
    case '/':
      return `\\left(\\frac{${a}}{${b}}\\right)`;
  }
}

export const functionOperations = defineTopic({
  id: 'alg2.func.operations',
  subject: 'algebra2',
  category: CATEGORY_FUNC,
  title: 'Function Operations',
  description: 'Add, subtract, multiply, divide and compose functions, as expressions or at a value.',
  instruction: 'Perform the indicated operation.',
  multipleChoice: true,
  defaultCount: 12,
  options: [
    {
      type: 'select',
      id: 'op',
      label: 'Operations',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'Mixed' },
        { value: 'addsub', label: 'Sums and differences' },
        { value: 'muldiv', label: 'Products and quotients' },
        { value: 'compose', label: 'Compositions' },
      ],
    },
    {
      type: 'select',
      id: 'form',
      label: 'Result',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'Mixed' },
        { value: 'expression', label: 'Expression in x' },
        { value: 'value', label: 'Value at a number' },
      ],
    },
    opt.variedVariables(false),
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const varied = boolOpt(ctx, 'variedVars');
    const v = pickVar(rng, varied);
    const [F, G] = varied ? rng.pick(PAIRS) : ['f', 'g'];
    const op = rng.pick(OPS[strOpt(ctx, 'op')] ?? OPS.mixed!);
    const formOpt = strOpt(ctx, 'form');
    const value = formOpt === 'value' || (formOpt === 'mixed' && rng.bool(0.4));
    return attempt('function-operations', () => {
      const [df, dg] = degrees(rng, difficulty);
      const f = randomPoly(rng, df, difficulty === 'easy' ? 6 : 7);
      const g = randomPoly(rng, dg, difficulty === 'easy' ? 6 : 7);
      if (f.eq(g) || f.degree < 1 || g.degree < 1) return null;
      if (op === 'o' && f.degree * g.degree > 4) return null;
      if (op === '*' && f.degree + g.degree > 4) return null;
      const res = apply(op, f, g, v);
      const a = new Frac(rng.int(-5, 5));
      const at = (r: Result) => r.at(a);
      if (value) {
        const val = at(res);
        if (!val || Math.abs(val.value) > 999) return null;
      }
      const arg = value ? num(a) : v;
      const req = `${opTex(op, F, G)}(${arg})`;
      const show = (r: Result) => {
        if (!value) return m(`${req} = ${r.tex}`);
        const x = at(r);
        return x ? m(`${req} = ${num(x)}`) : null;
      };
      // common mistakes
      const lead = (p: Poly) => new Poly(p.c.map((c, i) => (i === p.degree ? c : Frac.ZERO)));
      const fromPoly = (p: Poly): Result => ({ tex: p.toTex(v), at: (x) => p.eval(x) });
      const wrong: Result[] = [];
      if (op === '+') wrong.push(apply('-', f, g, v), fromPoly(f.add(g.sub(Poly.of(g.coef(0).mul(2))))), apply('*', f, g, v));
      if (op === '-') wrong.push(apply('+', f, g, v), fromPoly(f.sub(lead(g)).add(g.sub(lead(g)))), apply('-', g, f, v));
      if (op === '*') wrong.push(apply('+', f, g, v), fromPoly(lead(f).mul(lead(g)).add(f.sub(lead(f)).mul(g.sub(lead(g))))), apply('o', f, g, v));
      if (op === '/') wrong.push(apply('/', g, f, v), apply('-', f, g, v), apply('*', f, g, v));
      if (op === 'o') wrong.push(apply('o', g, f, v), apply('*', f, g, v), apply('+', f, g, v));
      const answer = show(res);
      if (!answer) return null;
      const distractors = distinctDistractors(answer, wrong.map(show), (k) => {
        if (value) {
          const x = at(res)!;
          return m(`${req} = ${num(x.add(k))}`);
        }
        if (op === '/') return m(`${req} = \\frac{${f.add(Poly.of(k)).toTex(v)}}{${g.toTex(v)}}`);
        return m(`${req} = ${fromPolyAnswer(op, f, g).add(Poly.of(k)).toTex(v)}`);
      });
      const steps = stepsFor(op, F, G, f, g, v, value ? a : null, res);
      return {
        question: `${m(`${F}(${v}) = ${f.toTex(v)}`)} and ${m(`${G}(${v}) = ${g.toTex(v)}`)}. Find ${m(req)}.`,
        answer,
        steps,
        distractors,
        check: { kind: 'alg2-quadratics-functions.funcEval' },
      };
    });
  },
});

function fromPolyAnswer(op: Op, f: Poly, g: Poly): Poly {
  return op === '+' ? f.add(g) : op === '-' ? f.sub(g) : op === '*' ? f.mul(g) : compose(f, g);
}

function stepsFor(op: Op, F: string, G: string, f: Poly, g: Poly, v: string, a: Frac | null, res: Result): string[] {
  const fx = f.toTex(v);
  const gx = g.toTex(v);
  const steps: string[] = [];
  if (a !== null && op !== 'o') {
    const fa = f.eval(a);
    const ga = g.eval(a);
    steps.push(`$${F}(${num(a)}) = ${num(fa)}$ and $${G}(${num(a)}) = ${num(ga)}$`);
    const sym = op === '+' ? '+' : op === '-' ? '-' : op === '*' ? '\\cdot' : '\\div';
    steps.push(`$${num(fa)} ${sym} ${parenNeg(ga)} = ${num(res.at(a)!)}$`);
    return steps;
  }
  if (a !== null) {
    const ga = g.eval(a);
    steps.push(`$${G}(${num(a)}) = ${num(ga)}$`);
    steps.push(`$${F}(${num(ga)}) = ${polySub(f, paren(ga))} = ${num(res.at(a)!)}$`);
    return steps;
  }
  if (op === '+') steps.push(`$${F}(${v}) + ${G}(${v}) = (${fx}) + (${gx})$`, `Combine like terms: $${res.tex}$`);
  if (op === '-') steps.push(`$${F}(${v}) - ${G}(${v}) = (${fx}) - (${gx})$`, `Distribute the negative and combine like terms: $${res.tex}$`);
  if (op === '*') steps.push(`$${F}(${v}) \\cdot ${G}(${v}) = (${fx})(${gx})$`, `Multiply and combine like terms: $${res.tex}$`);
  if (op === '/') steps.push(`$\\frac{${F}(${v})}{${G}(${v})} = ${res.tex}$`);
  if (op === 'o') steps.push(`$${F}(${G}(${v})) = ${polySub(f, `(${gx})`)}$`, `Simplify: $${res.tex}$`);
  return steps;
}
