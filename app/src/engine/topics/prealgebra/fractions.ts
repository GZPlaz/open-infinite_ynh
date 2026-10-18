/** Adding, subtracting, multiplying and dividing fractions and mixed numbers. */
import { Frac, lcm } from '../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, offset, strOpt } from '../../generator';
import type { Rng } from '../../rng';
import { m } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import { CAT } from './common';

type Op = '+' | '-' | '*' | '/';
const SYMBOL: Record<Op, string> = { '+': '+', '-': '-', '*': '\\times', '/': '\\div' };

function apply(a: Frac, op: Op, b: Frac): Frac {
  switch (op) {
    case '+':
      return a.add(b);
    case '-':
      return a.sub(b);
    case '*':
      return a.mul(b);
    case '/':
      return a.div(b);
  }
}

/** Operand display: mixed numbers when allowed, negatives in parentheses after an operator. */
function operandTex(x: Frac, mixed: boolean, first: boolean): string {
  const t = mixed ? x.toMixedTex() : x.toTex();
  return x.sign < 0 && !first ? `\\left(${t}\\right)` : t;
}

function resultTex(x: Frac, mixed: boolean): string {
  return mixed ? x.toMixedTex() : x.toTex();
}

/** The same value with denominator `d`, unreduced: `\frac{8}{12}`. */
function scaledTex(x: Frac, d: number, first: boolean): string {
  const n = x.n * (d / x.d);
  const t = `${n < 0 ? '-' : ''}\\frac{${Math.abs(n)}}{${d}}`;
  return n < 0 && !first ? `\\left(${t}\\right)` : t;
}

function improperTex(x: Frac, first: boolean): string {
  const t = x.toTex();
  return x.sign < 0 && !first ? `\\left(${t}\\right)` : t;
}

function pickOperand(rng: Rng, d: Difficulty, mixed: boolean, negatives: boolean, den?: number): Frac {
  const maxDen = d === 'easy' ? 9 : d === 'medium' ? 12 : 12;
  const q = den ?? rng.int(2, maxDen);
  const whole = mixed && d !== 'easy' && rng.bool(0.6) ? rng.int(1, d === 'hard' ? 5 : 3) : 0;
  const p = rng.int(1, q - 1);
  let x = new Frac(whole * q + p, q);
  if (negatives && rng.bool(0.4)) x = x.neg();
  return x;
}

export const fractionOperations = defineTopic({
  id: 'prealg.fractions',
  subject: 'prealgebra',
  category: CAT.fractions,
  title: 'Operations with Fractions',
  description: 'Add, subtract, multiply and divide fractions and mixed numbers; answers in lowest terms.',
  instruction: (o) => (o.mixed ? 'Evaluate each expression. Write answers as mixed numbers in lowest terms.' : 'Evaluate each expression. Write answers in lowest terms.'),
  multipleChoice: true,
  defaultCount: 16,
  options: [
    {
      type: 'select',
      id: 'operation',
      label: 'Operations',
      default: 'any',
      choices: [
        { value: 'any', label: 'All four' },
        { value: 'addsub', label: 'Add and subtract' },
        { value: 'muldiv', label: 'Multiply and divide' },
      ],
    },
    { type: 'boolean', id: 'mixed', label: 'Mixed numbers', default: false },
    { type: 'boolean', id: 'negatives', label: 'Allow negative numbers', default: false },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const mixed = boolOpt(ctx, 'mixed');
    const negatives = boolOpt(ctx, 'negatives');
    const opSet = strOpt(ctx, 'operation');
    const addsub: Op[] = ['+', '-'];
    const muldiv: Op[] = ['*', '/'];
    const family = opSet === 'addsub' ? addsub : opSet === 'muldiv' ? muldiv : rng.pick([addsub, muldiv]);

    const built = attempt('fractions', () => {
      const count = difficulty === 'hard' && rng.bool(0.5) ? 3 : 2;
      const sameDen = difficulty === 'easy' && family === addsub;
      const den = sameDen ? rng.int(3, 12) : undefined;
      const xs = Array.from({ length: count }, () => pickOperand(rng, difficulty, mixed, negatives, den));
      const ops = Array.from({ length: count - 1 }, () => rng.pick(family));
      let v = xs[0]!;
      for (let i = 0; i < ops.length; i++) v = apply(v, ops[i]!, xs[i + 1]!);
      if (!negatives && v.sign < 0) return null;
      if (v.isZero() || v.d > 60 || Math.abs(v.n) > 400) return null;
      if (difficulty !== 'easy' && family === addsub && xs.every((x) => x.d === xs[0]!.d)) return null;
      return { xs, ops, v };
    });
    const { xs, ops, v } = built;

    const question = xs.reduce((acc, x, i) => (i === 0 ? operandTex(x, mixed, true) : `${acc} ${SYMBOL[ops[i - 1]!]} ${operandTex(x, mixed, false)}`), '');

    const steps: string[] = [];
    const anyMixed = mixed && xs.some((x) => Math.abs(x.n) > x.d);
    if (anyMixed) {
      steps.push(m(`= ${xs.map((x, i) => (i === 0 ? improperTex(x, true) : `${SYMBOL[ops[i - 1]!]} ${improperTex(x, false)}`)).join(' ')}`));
    }
    if (family === addsub) {
      const D = xs.reduce((acc, x) => lcm(acc, x.d), 1);
      if (xs.some((x) => x.d !== D)) {
        steps.push(m(`= ${xs.map((x, i) => (i === 0 ? scaledTex(x, D, true) : `${SYMBOL[ops[i - 1]!]} ${scaledTex(x, D, false)}`)).join(' ')}`));
      }
      const numer = xs.reduce((acc, x, i) => (i === 0 ? x.n * (D / x.d) : ops[i - 1] === '+' ? acc + x.n * (D / x.d) : acc - x.n * (D / x.d)), 0);
      steps.push(m(`= ${numer < 0 ? '-' : ''}\\frac{${Math.abs(numer)}}{${D}}`));
    } else {
      let acc = xs[0]!;
      for (let i = 0; i < ops.length; i++) {
        const b = xs[i + 1]!;
        const rest = xs
          .slice(i + 2)
          .map((x, j) => ` ${SYMBOL[ops[i + 1 + j]!]} ${improperTex(x, false)}`)
          .join('');
        if (ops[i] === '/') steps.push(m(`= ${improperTex(acc, true)} \\times ${improperTex(b.inv(), false)}${rest}`));
        const f = ops[i] === '/' ? b.inv() : b;
        const rawN = acc.n * f.n;
        const rawD = acc.d * f.d;
        acc = acc.mul(f);
        steps.push(m(`= ${rawN < 0 ? '-' : ''}\\frac{${Math.abs(rawN)}}{${rawD}}${rest}`));
      }
    }
    steps.push(m(`= ${resultTex(v, mixed)}`));

    const answer = m(resultTex(v, mixed));
    const a = xs[0]!;
    const b = xs[1]!;
    const candidates: Array<Frac | null> = [
      family === addsub && ops.length === 1 ? new Frac(a.n + (ops[0] === '+' ? b.n : -b.n), a.d + b.d) : null,
      ops[0] === '/' ? a.mul(b) : ops[0] === '*' ? a.div(b) : null,
      v.neg(),
      v.inv(),
    ];
    const distractors = distinctDistractors(
      answer,
      candidates.map((c) => (c && !c.isZero() && (negatives || c.sign > 0) ? m(resultTex(c, mixed)) : null)),
      (k) => m(resultTex(v.add(new Frac(Math.abs(offset(k)), v.d === 1 ? 2 : v.d)), mixed)),
    );
    return {
      question: m(question),
      answer,
      steps,
      distractors,
      check: { kind: 'value', value: v.value, mixed },
    };
  },
});
