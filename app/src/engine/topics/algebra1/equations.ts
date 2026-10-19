/** One-step equations and absolute value equations. */
import { Frac } from '../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, offset, opt, pickVar, strOpt } from '../../generator';
import { decimal, linear, m, num, sum } from '../../tex';
import type { ProblemContent } from '../../types';

// ================================================================ one-step equations

type OneStep = 'add' | 'sub' | 'mul' | 'div';

export const oneStepEquations = defineTopic({
  id: 'alg1.one-step-equations',
  subject: 'algebra1',
  category: 'Equations and Inequalities',
  title: 'One-Step Equations',
  description: 'Solve equations that need a single inverse operation: add, subtract, multiply or divide.',
  instruction: 'Solve each equation.',
  multipleChoice: true,
  defaultCount: 16,
  options: [
    {
      type: 'select',
      id: 'type',
      label: 'Operations',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'Mixed' },
        { value: 'addsub', label: 'Addition and subtraction' },
        { value: 'muldiv', label: 'Multiplication and division' },
      ],
    },
    opt.negatives(true),
    opt.fractionAnswers(false),
    opt.variedVariables(true),
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const negatives = boolOpt(ctx, 'negatives');
    const fractions = boolOpt(ctx, 'fractions');
    const v = pickVar(rng, boolOpt(ctx, 'variedVars'));
    const type = strOpt(ctx, 'type');
    const kinds: OneStep[] = type === 'addsub' ? ['add', 'sub'] : type === 'muldiv' ? ['mul', 'div'] : ['add', 'sub', 'mul', 'div'];
    const kind = rng.pick(kinds);
    const R = difficulty === 'easy' ? 10 : difficulty === 'medium' ? 20 : 30;
    const swap = difficulty !== 'easy' && rng.bool(0.3);
    const eq = (lhs: string, rhs: string) => (swap ? `${rhs} = ${lhs}` : `${lhs} = ${rhs}`);
    const ans = (x: string) => m(`${v} = ${x}`);
    let question: string;
    let sol: Frac;
    let step: string;
    let wrong: Array<string | null>;

    if (kind === 'add' || kind === 'sub') {
      // hard: one decimal problem in two
      const dec = difficulty === 'hard' && rng.bool(0.5);
      const scale = dec ? 10 : 1;
      const { a, x } = attempt('one-step add', () => {
        const a = rng.signedInt(1, R * scale, negatives);
        const x = rng.signedInt(0, R * scale, negatives);
        if (dec && (a % 10 === 0 || x % 10 === 0)) return null;
        if (x === 0 && rng.bool(0.8)) return null;
        const b = kind === 'add' ? x + a : x - a;
        if (!negatives && b <= 0) return null;
        return { a, x };
      });
      const show = (t: number) => (dec ? decimal(t / 10, 1) : String(t));
      const b = kind === 'add' ? x + a : x - a;
      const c = kind === 'add' ? a : -a;
      const lhs = kind === 'add' && rng.bool(0.3) ? `${show(a)} + ${v}` : `${v} ${c < 0 ? '-' : '+'} ${show(Math.abs(c))}`;
      question = m(eq(lhs, show(b)));
      sol = new Frac(x, scale);
      const shift = kind === 'add' ? a : -a;
      step = `${shift > 0 ? 'Subtract' : 'Add'} $${show(Math.abs(shift))}$ ${shift > 0 ? 'from' : 'to'} both sides: $${v} = ${show(x)}$`;
      wrong = [ans(show(b + shift)), ans(show(-x)), ans(show(b))];
      const answer = ans(show(x));
      return finish(question, answer, [step], wrong, v, sol.value, (k) => ans(show(x + offset(k))));
    }

    if (kind === 'mul') {
      const fracCoef = difficulty === 'hard' && rng.bool(0.5);
      const built = attempt('one-step mul', () => {
        if (fracCoef) {
          const q = rng.int(2, 6);
          const p = rng.signedInt(1, 7, negatives);
          const c = new Frac(p, q);
          if (c.isInt()) return null;
          const x = new Frac(rng.signedInt(1, 12, negatives) * (fractions ? 1 : q));
          return { c, x, b: c.mul(x) };
        }
        const c = new Frac(rng.signedInt(2, difficulty === 'easy' ? 9 : 15, negatives));
        let x: Frac;
        if (fractions && rng.bool(0.6)) {
          x = new Frac(rng.signedInt(1, R, negatives), Math.abs(c.n));
          if (x.isInt()) return null;
        } else x = new Frac(rng.signedInt(1, R, negatives));
        const b = c.mul(x);
        if (!negatives && b.sign < 0) return null;
        return { c, x, b };
      });
      const { c, x, b } = built;
      const lhs = `${c.toTex()}${v}`;
      question = m(eq(lhs, num(b)));
      sol = x;
      step = c.isInt()
        ? `Divide both sides by $${num(c)}$: $${v} = ${num(x)}$`
        : `Multiply both sides by $${c.inv().toTex()}$: $${v} = ${num(x)}$`;
      wrong = [ans(num(b.mul(c))), ans(num(x.neg())), ans(num(b.sub(c)))];
      return finish(question, ans(num(x)), [step], wrong, v, sol.value, (k) => ans(num(x.add(offset(k)))));
    }

    // division: x / a = b
    const a = rng.signedInt(2, difficulty === 'easy' ? 9 : 12, negatives && difficulty !== 'easy');
    let b = new Frac(rng.signedInt(1, difficulty === 'easy' ? 10 : 15, negatives));
    if (fractions && rng.bool(0.4)) b = new Frac(rng.signedInt(1, 9, negatives), rng.pick([2, 3, 4, 5]));
    const x = b.mul(a);
    const lhs = a < 0 ? `-\\frac{${v}}{${-a}}` : `\\frac{${v}}{${a}}`;
    question = m(eq(lhs, num(b)));
    sol = x;
    step = `Multiply both sides by $${num(a)}$: $${v} = ${num(x)}$`;
    wrong = [ans(num(b.div(a))), ans(num(x.neg())), ans(num(b.add(a)))];
    return finish(question, ans(num(x)), [step], wrong, v, sol.value, (k) => ans(num(x.add(offset(k)))));
  },
});

function finish(question: string, answer: string, steps: string[], wrong: Array<string | null>, v: string, solution: number, fallback: (k: number) => string): ProblemContent {
  return {
    question,
    answer,
    steps,
    distractors: distinctDistractors(answer, wrong, fallback),
    check: { kind: 'linear', variable: v, solution },
  };
}

// ================================================================ absolute value equations

/** `x = 3, -5` with the values in decreasing order (so equal sets render identically). */
function solutionsTex(v: string, xs: Frac[]): string {
  const uniq: Frac[] = [];
  for (const x of xs) if (!uniq.some((u) => u.eq(x))) uniq.push(x);
  uniq.sort((p, q) => q.cmp(p));
  return m(`${v} = ${uniq.map(num).join(', ')}`);
}

export const absoluteValueEquations = defineTopic({
  id: 'alg1.abs-equations',
  subject: 'algebra1',
  category: 'Equations and Inequalities',
  title: 'Absolute Value Equations',
  description: 'Isolate the absolute value, then solve both cases; some equations have no solution.',
  instruction: 'Solve each equation.',
  multipleChoice: true,
  defaultCount: 10,
  options: [
    opt.fractionAnswers(false),
    opt.variedVariables(true),
    { type: 'boolean', id: 'special', label: 'Include “No solution” (medium and hard)', default: true },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const fractions = boolOpt(ctx, 'fractions');
    const v = pickVar(rng, boolOpt(ctx, 'variedVars'));
    const none = boolOpt(ctx, 'special') && difficulty !== 'easy' && rng.bool(difficulty === 'hard' ? 0.25 : 0.15);
    const single = !none && difficulty !== 'easy' && rng.bool(0.06);
    const p = attempt('abs-equation', () => {
      const a = difficulty === 'easy' ? (rng.bool(0.5) ? 1 : rng.signedInt(2, 6, true)) : rng.signedInt(1, difficulty === 'medium' ? 6 : 9, true);
      const outer = difficulty === 'easy' ? 1 : difficulty === 'medium' ? (rng.bool(0.5) ? 1 : rng.signedInt(2, 6, true)) : rng.signedInt(2, 8, true);
      const k = difficulty === 'easy' ? 0 : difficulty === 'medium' ? (outer === 1 ? rng.signedInt(1, 12, true) : 0) : rng.signedInt(1, 15, true);
      // isolated value C: |a x + b| = C
      const C = none ? -rng.int(1, 9) : single ? 0 : rng.int(1, difficulty === 'easy' ? 12 : 15);
      let b: number;
      let roots: Frac[] = [];
      if (C > 0 || single) {
        const x1 = rng.signedInt(0, 10, true);
        b = C - a * x1;
        const x2 = new Frac(-C - b, a);
        if (!fractions && !x2.isInt()) return null;
        if (fractions && x2.isInt() && rng.bool(0.6)) return null;
        roots = single ? [new Frac(x1)] : [new Frac(x1), x2];
      } else b = rng.signedInt(1, 12, true);
      if (Math.abs(b) > 20 || (a === 1 && b === 0) || (difficulty !== 'easy' && b === 0)) return null;
      if (difficulty === 'easy' && a !== 1 && b !== 0 && rng.bool(0.5)) return null;
      const c = outer * C + k;
      if (Math.abs(c) > 99) return null;
      // keep "no solution" honest: only after isolating can the sign be seen
      if (none && difficulty === 'hard' && c < 0 && outer > 0 && k === 0) return null;
      return { a, b, outer, k, C, c, roots };
    });
    const { a, b, outer, k, C, c, roots } = p;
    const inner = linear(a, b, v);
    const absTex = `\\left|${inner}\\right|`;
    const lhsTex = sum([{ coef: outer, sym: absTex }, { coef: k }]);
    const question = m(`${lhsTex} = ${c}`);
    const steps: string[] = [];
    if (k !== 0) steps.push(`${k > 0 ? 'Subtract' : 'Add'} $${Math.abs(k)}$ ${k > 0 ? 'from' : 'to'} both sides: $${sum([{ coef: outer, sym: absTex }])} = ${c - k}$`);
    if (outer !== 1) steps.push(`Divide both sides by $${outer}$: $${absTex} = ${C}$`);
    let answer: string;
    if (C < 0) {
      steps.push('An absolute value is never negative, so there is no solution.');
      answer = 'No solution';
    } else if (C === 0) {
      steps.push(`Solve $${inner} = 0$: $${v} = ${num(roots[0]!)}$`);
      answer = solutionsTex(v, roots);
    } else {
      steps.push(`Split into two equations: $${inner} = ${C}$ or $${inner} = ${-C}$`);
      steps.push(`Solve each: $${v} = ${num(roots[0]!)}$ or $${v} = ${num(roots[1]!)}$`);
      answer = solutionsTex(v, roots);
    }
    // common mistakes
    const solveFor = (target: number): Frac[] => [new Frac(target - b, a), new Frac(-target - b, a)];
    const notIsolated = c > 0 && (outer !== 1 || k !== 0) ? solutionsTex(v, solveFor(c)) : null;
    const noDivide = outer !== 1 && c - k > 0 ? solutionsTex(v, solveFor(c - k)) : null;
    const absC = Math.abs(C) || 1;
    const onlyPositive = solutionsTex(v, [new Frac(absC - b, a)]);
    const signSlip = solutionsTex(v, [new Frac(absC - b, a), new Frac(-absC + b, a)]);
    const candidates = C < 0 ? [solutionsTex(v, solveFor(absC)), notIsolated, onlyPositive, signSlip] : ['No solution', notIsolated, noDivide, onlyPositive, signSlip];
    const base = roots[0] ?? new Frac(1);
    const distractors = distinctDistractors(answer, candidates, (j) => solutionsTex(v, [base.add(offset(j)), base.sub(offset(j) * 2)]));
    return {
      question,
      answer,
      steps,
      distractors,
      check: { kind: 'roots', variable: v, solutions: roots.map((r) => r.value) },
    };
  },
});
