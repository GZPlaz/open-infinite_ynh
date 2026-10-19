/** Radical equations (with extraneous solutions) and rational exponent equations. */
import { Frac } from '../../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, opt, pickVar } from '../../../generator';
import { m, num, sum } from '../../../tex';
import type { ProblemContent, RichText } from '../../../types';
import { radTex } from './common';

const CATEGORY = 'Radical Functions and Rational Exponents';

/** `x = 2, 5` / "No solution". */
export function solutionText(v: string, sols: readonly Frac[]): RichText {
  if (sols.length === 0) return 'No solution';
  const sorted = [...sols].sort((a, b) => a.cmp(b));
  return m(`${v} = ${sorted.map((s) => num(s)).join(', ')}`);
}

const lin = (a: number, b: number, v: string) => sum([{ coef: a, sym: v }, { coef: b }]);

type RadForm = 'linear' | 'cube' | 'quadratic' | 'twoSides' | 'twoRadicals';

export const radicalEquations = defineTopic({
  id: 'alg2.radical.equations',
  subject: 'algebra2',
  title: 'Radical Equations',
  description: 'Solve equations containing square and cube roots and reject extraneous solutions.',
  category: CATEGORY,
  instruction: 'Solve each equation. Remember to check for extraneous solutions.',
  multipleChoice: true,
  defaultCount: 10,
  options: [
    { type: 'boolean', id: 'cube', label: 'Include cube roots', default: true },
    { type: 'boolean', id: 'noSolution', label: 'Allow "No solution"', default: true },
    opt.variedVariables(false),
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const v = pickVar(rng, boolOpt(ctx, 'variedVars'));
    const allowNone = boolOpt(ctx, 'noSolution');
    const forms: RadForm[] =
      difficulty === 'easy' ? ['linear', 'linear'] : difficulty === 'medium' ? ['linear', 'quadratic', 'twoSides', 'quadratic'] : ['quadratic', 'quadratic', 'twoRadicals', 'linear'];
    if (boolOpt(ctx, 'cube') && difficulty !== 'easy') forms.push('cube');
    const form = rng.pick(forms);
    const steps: string[] = [];
    let question: string;
    let sols: Frac[];
    let extraneous: Frac[] = [];
    let wrongSets: Frac[][] = [];

    switch (form) {
      case 'linear':
      case 'cube': {
        const n = form === 'cube' ? 3 : 2;
        const built = attempt('radical-linear', () => {
          const a = difficulty === 'easy' ? rng.pick([1, 1, 2, 3]) : rng.int(1, 4);
          const p = rng.signedInt(1, difficulty === 'easy' ? 3 : 6, difficulty !== 'easy');
          const none = n === 2 && allowNone && rng.bool(0.15);
          const s = none ? -rng.int(1, 6) : n === 3 ? rng.signedInt(1, 4, true) : rng.int(1, difficulty === 'easy' ? 6 : 8);
          const x = rng.int(-10, 15);
          const q = s ** n - p * x;
          if (Math.abs(q) > 60 || q === 0) return null;
          const d = difficulty === 'easy' && rng.bool(0.5) ? 0 : rng.signedInt(1, 9, true);
          const c = a * s + d;
          return { a, p, q, s, x, d, c, none };
        });
        const { a, p, q, s, x, d, c, none } = built;
        const lhs = `${a === 1 ? '' : a}${radTex(n, lin(p, q, v))}`;
        question = `${sum([{ coef: 1, sym: lhs }, { coef: d }])} = ${c}`;
        if (d !== 0) steps.push(m(`${lhs} = ${c - d}`));
        if (a !== 1) steps.push(m(`${radTex(n, lin(p, q, v))} = ${s}`));
        if (none) {
          steps.push(`A principal square root is never negative, so there is no solution.`);
          sols = [];
          extraneous = [new Frac(s * s - q, p)];
          wrongSets = [[new Frac(s * s - q, p)], [new Frac(-(s * s) - q, p)], [new Frac(x)]];
        } else {
          steps.push(m(`${lin(p, q, v)} = ${s ** n}`));
          steps.push(m(`${v} = ${x}`));
          if (n === 2) steps.push(`Check: ${m(`${sum([{ coef: 1, sym: `${a === 1 ? '' : a}\\sqrt{${s * s}}` }, { coef: d }])} = ${c}`)} ✓`);
          sols = [new Frac(x)];
          wrongSets = [[new Frac(s - q, p)], [new Frac(s ** n + q, p)], [new Frac(-(s ** n) - q, p)], [new Frac(c ** n - q, p)]];
        }
        break;
      }
      case 'quadratic': {
        // √(px + q) = x + r  ⇒  x² + (2r − p)x + (r² − q) = 0
        const built = attempt('radical-quadratic', () => {
          const r = rng.int(-6, 6);
          const [x1, x2] = [rng.int(-8, 10), rng.int(-8, 10)];
          if (x1 === x2) return null;
          const p = x1 + x2 + 2 * r;
          const q = r * r - x1 * x2;
          if (p === 0 || Math.abs(q) > 60) return null;
          const valid = [x1, x2].filter((x) => x + r >= 0);
          if (valid.length === 0 && (!allowNone || rng.bool(0.6))) return null;
          if (valid.length === 2 && difficulty === 'hard' && rng.bool(0.5)) return null;
          return { r, x1, x2, p, q, valid };
        });
        const { r, x1, x2, p, q, valid } = built;
        // optionally write as √(px + q) − r = x when r ≠ 0
        const moved = r !== 0 && rng.bool(0.5);
        question = moved ? `${sum([{ coef: 1, sym: `\\sqrt{${lin(p, q, v)}}` }, { coef: -r }])} = ${v}` : `\\sqrt{${lin(p, q, v)}} = ${lin(1, r, v)}`;
        if (moved) steps.push(m(`\\sqrt{${lin(p, q, v)}} = ${lin(1, r, v)}`));
        steps.push(m(`${lin(p, q, v)} = ${r === 0 ? `${v}^{2}` : `(${lin(1, r, v)})^{2}`}`));
        steps.push(m(`${sum([{ coef: 1, sym: `${v}^{2}` }, { coef: 2 * r - p, sym: v }, { coef: r * r - q }])} = 0`));
        steps.push(m(`(${lin(1, -x1, v)})(${lin(1, -x2, v)}) = 0`) + ', so ' + m(`${v} = ${Math.min(x1, x2)}, ${Math.max(x1, x2)}`));
        for (const x of [x1, x2]) {
          if (x + r < 0) steps.push(`${m(`${v} = ${x}`)} is extraneous: the right side is ${m(String(x + r))}, which is negative.`);
        }
        sols = valid.map((x) => new Frac(x));
        extraneous = [x1, x2].filter((x) => x + r < 0).map((x) => new Frac(x));
        wrongSets = [[new Frac(x1), new Frac(x2)], extraneous.length ? extraneous : [new Frac(-x1)], [new Frac(-x1), new Frac(-x2)]];
        if (sols.length === 2) wrongSets.push([new Frac(x1)], [new Frac(x2)]);
        else if (sols.length === 1) wrongSets.push([]);
        break;
      }
      case 'twoSides': {
        // √(px + q) = √(sx + t)
        const built = attempt('radical-two-sides', () => {
          const p = rng.int(1, 6);
          const s = rng.int(1, 6);
          if (p === s) return null;
          const x = rng.int(-6, 12);
          const q = rng.int(-15, 15);
          const val = p * x + q;
          const t = val - s * x;
          if (Math.abs(t) > 30 || q === 0 || t === 0) return null;
          const ok = val >= 0;
          if (!ok && (!allowNone || rng.bool(0.6))) return null;
          return { p, q, s, t, x, ok };
        });
        const { p, q, s, t, x, ok } = built;
        question = `\\sqrt{${lin(p, q, v)}} = \\sqrt{${lin(s, t, v)}}`;
        steps.push(m(`${lin(p, q, v)} = ${lin(s, t, v)}`));
        steps.push(m(`${v} = ${x}`));
        if (!ok) steps.push(`Check: both radicands equal ${m(String(p * x + q))} at ${m(`${v} = ${x}`)}, which is negative, so ${m(`${v} = ${x}`)} is extraneous.`);
        else steps.push(`Check: both sides equal ${m(`\\sqrt{${p * x + q}}`)} ✓`);
        sols = ok ? [new Frac(x)] : [];
        extraneous = ok ? [] : [new Frac(x)];
        wrongSets = [[new Frac(-x)], [new Frac(t + q, p - s)], [new Frac(x + 1)], ok ? [] : [new Frac(x)]];
        break;
      }
      case 'twoRadicals':
      default: {
        // √(x + a) = √(x + c) + b with √(x + c) = k ≥ 0
        const built = attempt('radical-two-radicals', () => {
          const k = rng.int(0, 5);
          const b = rng.int(1, 4);
          const c = rng.int(-8, 8);
          const x = k * k - c;
          const a = (k + b) ** 2 - x;
          if (a === c || Math.abs(a) > 60) return null;
          return { k, b, c, x, a };
        });
        const { k, b, c, x, a } = built;
        const r1 = `\\sqrt{${lin(1, a, v)}}`;
        const r2 = `\\sqrt{${lin(1, c, v)}}`;
        question = rng.bool(0.5) ? `${r1} = ${r2} + ${b}` : `${r1} - ${r2} = ${b}`;
        steps.push(m(`${r1} = ${r2} + ${b}`));
        steps.push(m(`${lin(1, a, v)} = ${lin(1, c + b * b, v)} + ${2 * b}${r2}`));
        steps.push(m(`${a - c - b * b} = ${2 * b}${r2}`));
        steps.push(m(`${r2} = ${k}`) + ', so ' + m(`${lin(1, c, v)} = ${k * k}`));
        steps.push(m(`${v} = ${x}`));
        sols = [new Frac(x)];
        wrongSets = [[new Frac(k - c)], [new Frac(a - c - b * b)], [new Frac(-x)], [new Frac(x + b * b)], []];
        break;
      }
    }
    const answer = solutionText(v, sols);
    const distractors = distinctDistractors(
      answer,
      wrongSets.map((ws) => solutionText(v, ws)),
      (k) => solutionText(v, [new Frac((sols[0]?.n ?? 0) + k)]),
    );
    return {
      question: m(question),
      answer,
      steps,
      distractors,
      check: { kind: 'alg2-radicals-rational.roots', variable: v, solutions: sols.map((s) => s.value), extraneous: extraneous.map((s) => s.value) },
    };
  },
});

// ---------------------------------------------------------------- rational exponent equations

export const rationalExponentEquations = defineTopic({
  id: 'alg2.radical.rational-exponent-equations',
  subject: 'algebra2',
  title: 'Rational Exponent Equations',
  description: 'Solve equations such as (x + 3)^(3/2) = 8 by raising both sides to the reciprocal power.',
  category: CATEGORY,
  instruction: 'Solve each equation. Give all real solutions.',
  multipleChoice: true,
  defaultCount: 10,
  options: [{ type: 'boolean', id: 'noSolution', label: 'Allow "No solution"', default: true }, opt.variedVariables(false)],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const v = pickVar(rng, boolOpt(ctx, 'variedVars'));
    const allowNone = boolOpt(ctx, 'noSolution') && difficulty !== 'easy';
    const built = attempt('rational-exponent-eq', () => {
      const q = rng.int(2, difficulty === 'easy' ? 3 : 5);
      const p = rng.int(1, difficulty === 'easy' ? 3 : 4);
      if (new Frac(p, q).isInt() || new Frac(p, q).d !== q) return null;
      const neg = difficulty === 'hard' && rng.bool(0.3);
      const r = rng.int(1, q >= 4 ? 2 : q === 3 ? 4 : 5) * (q % 2 === 1 && p % 2 === 1 && rng.bool(0.3) ? -1 : 1);
      const none = allowNone && rng.bool(0.15) && (q % 2 === 0 || p % 2 === 0);
      // u^{p/q} = K with K = r^p (or −|r|^p for "no solution")
      const K = none ? -(Math.abs(r) ** p) : r ** p;
      if (Math.abs(K) > 300 || (Math.abs(K) === 1 && p > 1)) return null;
      // inner values u: u = r^q, plus −r^q when p even, q odd
      const us = none ? [] : p % 2 === 0 && q % 2 === 1 ? [r ** q, -(r ** q)] : [r ** q];
      if (q % 2 === 0 && us.some((u) => u < 0)) return null;
      const a = difficulty === 'easy' ? 1 : rng.pick([1, 1, 2, 3]);
      const b = difficulty === 'easy' && rng.bool(0.5) ? 0 : rng.signedInt(1, 9, true);
      const sols = us.map((u) => new Frac(u - b, a));
      if (sols.some((s) => !s.isInt() && difficulty !== 'hard')) return null;
      if (sols.some((s) => Math.abs(s.value) > 300)) return null;
      const coef = difficulty === 'hard' && !neg && rng.bool(0.4) ? rng.int(2, 4) : 1;
      const shift = difficulty === 'hard' && rng.bool(0.5) ? rng.signedInt(1, 9, true) : 0;
      return { p, q, r, K, us, a, b, sols, neg, none, coef, shift };
    });
    const { p, q, K, us, a, b, sols, neg, none, coef, shift } = built;
    const base = a === 1 && b === 0 ? v : `(${lin(a, b, v)})`;
    const e = new Frac(neg ? -p : p, q);
    const lhsPow = `${base}^{${e.toTex()}}`;
    const lhs = sum([{ coef, sym: lhsPow }, { coef: shift }]);
    const rhsVal = neg ? new Frac(1, K) : new Frac(coef * K + shift);
    const question = `${lhs} = ${num(rhsVal)}`;
    const steps: string[] = [];
    if (shift !== 0 || coef !== 1) steps.push(m(`${lhsPow} = ${num(K)}`));
    if (neg) steps.push(m(`${base}^{${new Frac(p, q).toTex()}} = ${num(K)}`));
    const recip = new Frac(q, p);
    if (none) {
      steps.push(
        q % 2 === 0
          ? `An even root is never negative, so ${m(`${base}^{${new Frac(p, q).toTex()}}`)} cannot equal ${m(num(K))}: no solution.`
          : `The numerator ${m(String(p))} of the exponent is even, so ${m(`${base}^{${new Frac(p, q).toTex()}}`)} is never negative and cannot equal ${m(num(K))}: no solution.`,
      );
    } else {
      steps.push(`Raise both sides to the ${m(recip.toTex())} power${p % 2 === 0 ? ` (an even power, so take ${m('\\pm')})` : ''}:`);
      steps.push(m(`${base === v ? v : lin(a, b, v)} = ${us.length === 2 ? `\\pm ${us[0]}` : us[0]}`));
      if (base !== v) steps.push(m(`${v} = ${sols.map((s) => num(s)).join(', ')}`));
    }
    const answer = solutionText(v, sols);
    const u0 = us[0] ?? Math.abs(K) ** (q / p);
    const wr = (vals: number[]) => (vals.every((u) => Number.isSafeInteger(u)) ? solutionText(v, vals.map((u) => new Frac(u - b, a))) : null);
    const absK = Math.abs(K);
    const flipped = Math.round(absK ** (p / q));
    const wrongs = [
      wr([(absK * q) / p]),
      Math.abs(flipped - absK ** (p / q)) < 1e-9 ? wr([flipped]) : null,
      us.length === 2 ? wr([us[0]!]) : wr([u0, -u0]),
      none ? wr([Math.round(absK ** (q / p))]) : 'No solution',
      wr([absK * q]),
    ];
    const distractors = distinctDistractors(answer, wrongs, (k) => wr([u0 + k]));
    return {
      question: m(question),
      answer,
      steps,
      distractors,
      check: { kind: 'alg2-radicals-rational.roots', variable: v, solutions: sols.map((s) => s.value), realPow: true },
    };
  },
});
