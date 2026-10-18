/** Systems of two linear equations, solved by elimination or substitution. */
import { Frac, lcm } from '../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, offset, opt, strOpt } from '../../generator';
import type { Rng } from '../../rng';
import { m, num, paren, sum, tuple } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';

/** a·x + b·y = c */
interface Eq {
  a: number;
  b: number;
  c: number;
}

type Solution = { kind: 'one'; x: Frac; y: Frac } | { kind: 'none' } | { kind: 'all' };

const lhs = (e: Eq | { a: Frac; b: Frac }) => sum([
  { coef: e.a, sym: 'x' },
  { coef: e.b, sym: 'y' },
]);
const eqTex = (e: Eq) => `${lhs(e)} = ${e.c}`;
const system = (rows: string[]) => `\\begin{aligned} ${rows.map((r) => r.replace(' = ', ' &= ')).join(' \\\\ ')} \\end{aligned}`;

function solve(e1: Eq, e2: Eq): Solution {
  const det = e1.a * e2.b - e2.a * e1.b;
  if (det === 0) {
    // parallel or identical lines
    const consistent = e1.a * e2.c === e2.a * e1.c && e1.b * e2.c === e2.b * e1.c;
    return consistent ? { kind: 'all' } : { kind: 'none' };
  }
  return {
    kind: 'one',
    x: new Frac(e1.c * e2.b - e2.c * e1.b, det),
    y: new Frac(e1.a * e2.c - e2.a * e1.c, det),
  };
}

interface Built {
  e1: Eq;
  e2: Eq;
  substitution: boolean;
}

function build(rng: Rng, d: Difficulty, method: string, negatives: boolean, fractions: boolean, special: boolean): Built {
  const substitution = method === 'substitution' || (method === 'any' && rng.bool(0.35));
  const wantSpecial = special && rng.bool(0.25);
  const C = d === 'easy' ? 6 : d === 'medium' ? 8 : 10;
  const R = d === 'easy' ? 6 : 8;
  return attempt('systems', () => {
    const coef = () => rng.signedInt(1, C, negatives);
    let e1: Eq;
    let e2: Eq;
    const x0 = new Frac(rng.signedInt(0, R, negatives));
    const y0 = new Frac(rng.signedInt(0, R, negatives));
    const make = (a: number, b: number): Eq => ({ a, b, c: x0.mul(a).add(y0.mul(b)).value });
    if (substitution) {
      // y = mx + k  →  -mx + y = k
      const mm = rng.signedInt(1, d === 'easy' ? 4 : 6, true);
      e1 = make(-mm, 1);
      e2 = make(coef(), coef());
    } else if (d === 'easy') {
      const a1 = coef();
      const b1 = coef();
      const elimY = rng.bool();
      e1 = make(a1, b1);
      e2 = elimY ? make(coef(), -b1) : make(-a1, coef());
    } else if (d === 'medium') {
      const a1 = coef();
      const b1 = coef();
      const k = rng.pick([2, 3, -2, -3]);
      e1 = make(a1, b1);
      e2 = rng.bool() ? make(coef(), b1 * k) : make(a1 * k, coef());
      if (rng.bool()) [e1, e2] = [e2, e1];
    } else {
      e1 = make(coef(), coef());
      e2 = make(coef(), coef());
      if (Math.abs(e1.a) === 1 || Math.abs(e1.b) === 1 || Math.abs(e2.a) === 1 || Math.abs(e2.b) === 1) {
        if (rng.bool(0.7)) return null;
      }
    }
    if (fractions && !substitution) {
      // replace the constants: the solution becomes the (fractional) Cramer solution
      e1 = { ...e1, c: rng.signedInt(1, 20, negatives) };
      e2 = { ...e2, c: rng.signedInt(1, 20, negatives) };
    }
    if (wantSpecial) {
      const k = rng.pick([2, 3, -2, -1]);
      const shift = rng.bool() ? 0 : rng.signedInt(1, 6, true);
      e2 = { a: e1.a * k, b: e1.b * k, c: e1.c * k + shift };
    }
    const sol = solve(e1, e2);
    if (sol.kind === 'one') {
      if (wantSpecial) return null;
      if (fractions && !substitution && sol.x.isInt() && sol.y.isInt()) return null;
      if (Math.max(sol.x.d, sol.y.d) > 12) return null;
    } else if (!wantSpecial) return null;
    if ([e1, e2].some((e) => Math.abs(e.c) > 99 || e.a === 0 || e.b === 0)) return null;
    if (!negatives && [e1, e2].some((e) => e.c < 0)) return null;
    return { e1, e2, substitution };
  });
}

function eliminationSteps(e1: Eq, e2: Eq, sol: Solution): string[] {
  const steps: string[] = [];
  // eliminate the variable that needs the smaller multipliers
  const cost = (p: number, q: number) => lcm(p, q) / Math.abs(p) + lcm(p, q) / Math.abs(q);
  const elimY = cost(e1.b, e2.b) <= cost(e1.a, e2.a);
  const p = elimY ? e1.b : e1.a;
  const q = elimY ? e2.b : e2.a;
  const l = lcm(p, q);
  let k1 = l / p;
  let k2 = -l / q;
  if (k1 < 0) {
    k1 = -k1;
    k2 = -k2;
  }
  const s1: Eq = { a: e1.a * k1, b: e1.b * k1, c: e1.c * k1 };
  const s2: Eq = { a: e2.a * k2, b: e2.b * k2, c: e2.c * k2 };
  if (k1 !== 1) steps.push(`Multiply the first equation by $${k1}$: $${eqTex(s1)}$`);
  if (k2 !== 1) steps.push(`Multiply the second equation by $${k2}$: $${eqTex(s2)}$`);
  const sumEq: Eq = { a: s1.a + s2.a, b: s1.b + s2.b, c: s1.c + s2.c };
  const v = elimY ? 'x' : 'y';
  const coef = elimY ? sumEq.a : sumEq.b;
  if (coef === 0) {
    steps.push(`Add the equations: $0 = ${sumEq.c}$`);
    steps.push(sumEq.c === 0 ? 'The equations describe the same line.' : 'This is false, so the lines are parallel.');
    return steps;
  }
  steps.push(`Add the equations: $${sum([{ coef, sym: v }])} = ${sumEq.c}$`);
  if (sol.kind !== 'one') return steps;
  const first = elimY ? sol.x : sol.y;
  const other = elimY ? sol.y : sol.x;
  if (coef !== 1) steps.push(`$${v} = ${num(first)}$`);
  const times = (k: number, v: Frac) => (k === 1 ? paren(v) : k === -1 ? `-${paren(v)}` : `${k}${paren(v)}`);
  const sub = elimY
    ? `${times(e1.a, first)} ${e1.b < 0 ? '-' : '+'} ${Math.abs(e1.b) === 1 ? '' : Math.abs(e1.b)}y`
    : `${sum([{ coef: e1.a, sym: 'x' }])} ${e1.b < 0 ? '-' : '+'} ${times(Math.abs(e1.b), first)}`;
  steps.push(`Substitute into the first equation: $${sub} = ${e1.c}$`);
  steps.push(`$${elimY ? 'y' : 'x'} = ${num(other)}$`);
  return steps;
}

function substitutionSteps(e1: Eq, e2: Eq, sol: Solution): string[] {
  // e1 is -m·x + y = k, i.e. y = m·x + k
  const mm = -e1.a;
  const k = e1.c;
  const yExpr = sum([{ coef: mm, sym: 'x' }, { coef: k }]);
  const steps = [
    `Substitute $y = ${yExpr}$ into the second equation: $${sum([{ coef: e2.a, sym: 'x' }])} ${e2.b < 0 ? '-' : '+'} ${Math.abs(e2.b) === 1 ? '' : Math.abs(e2.b)}(${yExpr}) = ${e2.c}$`,
  ];
  const A = e2.a + e2.b * mm;
  const B = e2.b * k;
  steps.push(`Simplify: $${sum([{ coef: A, sym: 'x' }, { coef: B }])} = ${e2.c}$`);
  if (A === 0) {
    steps.push(B === e2.c ? 'This is always true.' : 'This is never true.');
    return steps;
  }
  if (sol.kind !== 'one') return steps;
  steps.push(`$x = ${num(sol.x)}$`);
  const mx = mm === 1 ? paren(sol.x) : mm === -1 ? `-${paren(sol.x)}` : `${mm}${paren(sol.x)}`;
  steps.push(`Back-substitute: $y = ${mx}${k === 0 ? '' : ` ${k < 0 ? '-' : '+'} ${Math.abs(k)}`} = ${num(sol.y)}$`);
  return steps;
}

export const systemsOfEquations = defineTopic({
  id: 'alg1.systems',
  subject: 'algebra1',
  category: 'Systems of Equations and Inequalities',
  title: 'Systems of Linear Equations',
  description: 'Two equations in x and y, by elimination or substitution.',
  instruction: (o) =>
    o.method === 'elimination'
      ? 'Solve each system by elimination.'
      : o.method === 'substitution'
        ? 'Solve each system by substitution.'
        : 'Solve each system of equations.',
  multipleChoice: true,
  defaultCount: 8,
  options: [
    {
      type: 'select',
      id: 'method',
      label: 'Method',
      default: 'any',
      choices: [
        { value: 'any', label: 'Any' },
        { value: 'elimination', label: 'Elimination' },
        { value: 'substitution', label: 'Substitution' },
      ],
    },
    opt.negatives(true),
    opt.fractionAnswers(false),
    { type: 'boolean', id: 'special', label: 'Include “no solution” / “infinitely many”', default: false },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const { e1, e2, substitution } = build(
      rng,
      difficulty,
      strOpt(ctx, 'method'),
      boolOpt(ctx, 'negatives'),
      boolOpt(ctx, 'fractions'),
      boolOpt(ctx, 'special'),
    );
    const sol = solve(e1, e2);
    const row1 = substitution ? `y = ${sum([{ coef: -e1.a, sym: 'x' }, { coef: e1.c }])}` : eqTex(e1);
    const question = system([row1, eqTex(e2)]);
    const steps = substitution ? substitutionSteps(e1, e2, sol) : eliminationSteps(e1, e2, sol);
    const pair = (x: Frac, y: Frac) => m(tuple([x, y]));
    const NONE = 'No solution';
    const ALL = 'Infinitely many solutions';
    let answer: string;
    let distractors: string[];
    if (sol.kind === 'one') {
      answer = pair(sol.x, sol.y);
      distractors = distinctDistractors(
        answer,
        [pair(sol.y, sol.x), pair(sol.x.neg(), sol.y), pair(sol.x, sol.y.neg())],
        (k) => pair(sol.x.add(offset(k)), sol.y),
      );
    } else {
      answer = sol.kind === 'none' ? NONE : ALL;
      distractors = distinctDistractors(answer, [sol.kind === 'none' ? ALL : NONE, m(tuple([0, 0])), m(tuple([1, -1]))], (k) => m(tuple([k, k])));
    }
    return {
      question: m(question),
      answer,
      steps,
      distractors,
      check: { kind: 'system', solution: sol.kind === 'one' ? [sol.x.value, sol.y.value] : sol.kind },
    };
  },
});
