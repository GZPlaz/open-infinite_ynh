/** Evaluating variable expressions by substitution. */
import { attempt, boolOpt, defineTopic, distinctDistractors, offset } from '../../generator';
import type { Rng } from '../../rng';
import { m, num, paren, parenNeg } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import { CAT } from './common';

interface Template {
  /** LaTeX with placeholders @1, @2, @3 for the variables. */
  tex: string;
  vars: number;
  f: (v: number[]) => number | null;
}

const int = (x: number) => (Number.isInteger(x) ? x : null);

function templates(rng: Rng, d: Difficulty): Template {
  const k = rng.int(2, 9);
  const c = rng.int(1, 12);
  const pool: Record<Difficulty, Template[]> = {
    easy: [
      { tex: `@1 + ${c}`, vars: 1, f: ([a]) => a! + c },
      { tex: `${k}@1`, vars: 1, f: ([a]) => k * a! },
      { tex: `@1 - ${c}`, vars: 1, f: ([a]) => a! - c },
      { tex: `${k}@1 + ${c}`, vars: 1, f: ([a]) => k * a! + c },
      { tex: `\\frac{@1}{${k}}`, vars: 1, f: ([a]) => int(a! / k) },
      { tex: `${c + 10} - @1`, vars: 1, f: ([a]) => c + 10 - a! },
    ],
    medium: [
      { tex: `@1 + @2`, vars: 2, f: ([a, b]) => a! + b! },
      { tex: `${k}@1 - @2`, vars: 2, f: ([a, b]) => k * a! - b! },
      { tex: `@1@2 + ${c}`, vars: 2, f: ([a, b]) => a! * b! + c },
      { tex: `\\frac{@1 + @2}{${k}}`, vars: 2, f: ([a, b]) => int((a! + b!) / k) },
      { tex: `${k}(@1 - @2)`, vars: 2, f: ([a, b]) => k * (a! - b!) },
      { tex: `@1 - ${k}@2`, vars: 2, f: ([a, b]) => a! - k * b! },
    ],
    hard: [
      { tex: `@1^{2} + ${k}@2`, vars: 2, f: ([a, b]) => a! ** 2 + k * b! },
      { tex: `${k}@1^{2} - @2`, vars: 2, f: ([a, b]) => k * a! ** 2 - b! },
      { tex: `\\frac{@1@2}{${k}} - @3`, vars: 3, f: ([a, b, z]) => (int((a! * b!) / k) === null ? null : (a! * b!) / k - z!) },
      { tex: `@1^{2} - @2^{2}`, vars: 2, f: ([a, b]) => a! ** 2 - b! ** 2 },
      { tex: `${k}(@1 + @2) - @3^{2}`, vars: 3, f: ([a, b, z]) => k * (a! + b!) - z! ** 2 },
      { tex: `@3 - @1(@2 + ${c})`, vars: 3, f: ([a, b, z]) => z! - a! * (b! + c) },
      { tex: `\\frac{@1 + @2}{@3}`, vars: 3, f: ([a, b, z]) => (z === 0 ? null : int((a! + b!) / z!)) },
    ],
  };
  return rng.pick(pool[d]);
}

const LETTERS = [
  ['x', 'y', 'z'],
  ['a', 'b', 'c'],
  ['m', 'n', 'p'],
  ['p', 'q', 'r'],
  ['h', 'j', 'k'],
  ['r', 's', 't'],
  ['u', 'v', 'w'],
  ['x', 'y', 'w'],
];

/** Fill placeholders with letters, or with values (parenthesised where needed). */
function fill(tex: string, sub: (i: number, needParen: boolean) => string): string {
  return tex.replace(/@(\d)/g, (_, d: string, at: number) => {
    const before = tex[at - 1] ?? ' ';
    const after = tex[at + 2] ?? ' ';
    const needParen = after === '^' || after === '@' || after === '(' || /[\d)]/.test(before);
    return sub(Number(d) - 1, needParen);
  });
}

export const evaluatingExpressions = defineTopic({
  id: 'prealg.evaluating-expressions',
  subject: 'prealgebra',
  category: CAT.integers,
  title: 'Evaluating Expressions',
  description: 'Substitute the given values into variable expressions and simplify.',
  instruction: 'Evaluate each using the values given.',
  multipleChoice: true,
  defaultCount: 12,
  options: [{ type: 'boolean', id: 'negatives', label: 'Allow negative values', default: true }],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const negatives = boolOpt(ctx, 'negatives');
    const p = attempt('evaluating', () => {
      const t = templates(rng, difficulty);
      const max = difficulty === 'hard' ? 9 : 10;
      const vals = Array.from({ length: t.vars }, () => {
        const v = rng.int(1, max);
        return negatives && rng.bool(difficulty === 'easy' ? 0.25 : 0.45) ? -v : v;
      });
      const value = t.f(vals);
      if (value === null || Math.abs(value) > 200) return null;
      return { t, vals, value };
    });
    const { t, vals, value } = p;
    const letters = rng.pick(LETTERS);
    const expr = fill(t.tex, (i) => letters[i]!);
    const substituted = fill(t.tex, (i, np) => (np ? paren(vals[i]!) : parenNeg(vals[i]!)));
    const given = vals.map((v, i) => `$${letters[i]} = ${num(v)}$`);
    const givenText = given.length === 1 ? given[0] : given.length === 2 ? `${given[0]} and ${given[1]}` : `${given.slice(0, -1).join(', ')}, and ${given.at(-1)}`;
    const answer = m(String(value));
    const absVals = t.f(vals.map(Math.abs));
    const swapped = t.vars > 1 ? t.f([vals[1]!, vals[0]!, ...vals.slice(2)]) : null;
    const distractors = distinctDistractors(
      answer,
      [absVals === null ? null : m(String(absVals)), m(String(-value)), swapped === null ? null : m(String(swapped))],
      (k) => m(String(value + offset(k) * 2)),
    );
    return {
      question: `$${expr}$; use ${givenText}`,
      answer,
      steps: [`Substitute: $${substituted}$`, m(`= ${value}`)],
      distractors,
      check: { kind: 'prealgebra.evaluate', value },
    };
  },
});
