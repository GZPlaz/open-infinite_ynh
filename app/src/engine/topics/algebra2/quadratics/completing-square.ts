/** Completing the square: finding c, and solving equations by completing the square. */
import { Frac } from '../../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, opt, pickVar } from '../../../generator';
import { Poly } from '../../../polynomial';
import { isPerfectSquare } from '../../../radical';
import type { Rng } from '../../../rng';
import { m, num, paren, setTex, sum } from '../../../tex';
import type { Difficulty, ProblemContent } from '../../../types';
import { formatRoots } from '../quadratic-formula';
import { CATEGORY_QUAD, rearranged, rootValues, shiftTex } from './common';

function pickB(rng: Rng, d: Difficulty): Frac {
  if (d === 'easy') return new Frac(rng.signedInt(1, 15, true) * 2);
  if (d === 'medium') return new Frac(rng.signedInt(0, 15, true) * 2 + 1);
  return attempt('complete-square-b', () => {
    const q = rng.pick([2, 3, 4, 5]);
    const b = new Frac(rng.signedInt(1, 3 * q, true), q);
    return b.isInt() ? null : b;
  });
}

export const completingTheSquare = defineTopic({
  id: 'alg2.quad.complete-square',
  subject: 'algebra2',
  category: CATEGORY_QUAD,
  title: 'Completing the Square',
  description: 'Find c so that x² + bx + c is a perfect square trinomial, then write it as a square.',
  instruction: 'Find the value of $c$ that completes the square. Then write the trinomial as a perfect square.',
  multipleChoice: true,
  defaultCount: 12,
  options: [opt.variedVariables(true)],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const v = pickVar(rng, boolOpt(ctx, 'variedVars'));
    const b = pickB(rng, difficulty);
    const half = b.div(2);
    const c = half.mul(half);
    const bx = sum([
      { coef: 1, sym: `${v}^{2}` },
      { coef: b, sym: v },
    ]);
    const steps = [
      `Take half of the coefficient of $${v}$: $\\frac{1}{2}${paren(b)} = ${num(half)}$`,
      `Square it: $c = ${paren(half)}^{2} = ${num(c)}$`,
      `$${bx} + ${num(c)} = ${shiftTex(v, half.neg())}^{2}$`,
    ];
    const show = (cc: Frac, shift: Frac) => m(`c = ${num(cc)}`) + '; ' + m(`${bx} + ${num(cc)} = ${shiftTex(v, shift.neg())}^{2}`);
    const answer = show(c, half);
    const distractors = distinctDistractors(
      answer,
      [show(half.abs(), half), show(c, half.neg()), show(b.mul(b), b), show(c.mul(2), half)],
      (k) => show(c.add(k), half),
    );
    return {
      question: m(`${bx} + c`),
      answer,
      steps,
      distractors,
      check: { kind: 'alg2-quadratics-functions.completeSquare', variable: v },
    };
  },
});

interface Built {
  A: number;
  B: number;
  C: number;
}

function buildSolve(rng: Rng, d: Difficulty, complex: boolean): Built {
  const wantComplex = complex && rng.bool(0.3);
  return attempt('solve-complete-square', () => {
    if (d === 'easy' && !wantComplex) {
      // integer roots with an even middle coefficient
      const r1 = rng.signedInt(0, 10, true);
      const r2 = rng.signedInt(1, 10, true);
      if ((r1 + r2) % 2 !== 0 || r1 + r2 === 0) return null;
      return { A: 1, B: -(r1 + r2), C: r1 * r2 };
    }
    const A = d === 'hard' ? rng.int(2, 5) : 1;
    const half = d === 'hard' ? rng.signedInt(1, 6, true) : rng.signedInt(1, 9, true);
    // hard: B divisible by A keeps x² + (B/A)x tidy about half the time
    const B = d === 'hard' ? (rng.bool(0.5) ? 2 * A * half : rng.signedInt(1, 12, true)) : d === 'medium' && rng.bool(0.3) ? 2 * half + 1 : 2 * half;
    const C = rng.signedInt(1, d === 'hard' ? 20 : 30, true);
    const D = B * B - 4 * A * C;
    if (wantComplex ? D >= 0 : D <= 0) return null;
    if (!wantComplex && d !== 'easy' && isPerfectSquare(D) && rng.bool(0.8)) return null;
    if (Math.abs(D) > 600) return null;
    return { A, B, C };
  });
}

export const solveByCompletingSquare = defineTopic({
  id: 'alg2.quad.solve-complete-square',
  subject: 'algebra2',
  category: CATEGORY_QUAD,
  title: 'Solving Equations by Completing the Square',
  description: 'Solve quadratic equations by completing the square: rational, irrational or complex roots.',
  instruction: (o) =>
    o.complex ? 'Solve each equation by completing the square. Include non-real solutions.' : 'Solve each equation by completing the square.',
  multipleChoice: true,
  defaultCount: 10,
  options: [{ type: 'boolean', id: 'complex', label: 'Include complex (non-real) solutions', default: false }, opt.variedVariables(true)],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const complex = boolOpt(ctx, 'complex');
    const v = pickVar(rng, boolOpt(ctx, 'variedVars'));
    const { A, B, C } = buildSolve(rng, difficulty, complex);
    const std = Poly.of(C, B, A);
    const form = difficulty === 'hard' ? 'rearranged' : rng.pick(['zero', 'moved']);
    const question =
      form === 'rearranged' ? rearranged(rng, std, v) : form === 'moved' ? `${sum([{ coef: A, sym: `${v}^{2}` }, { coef: B, sym: v }])} = ${-C}` : `${std.toTex(v)} = 0`;

    const p = new Frac(B, A);
    const q = new Frac(-C, A);
    const half = p.div(2);
    const K = q.add(half.mul(half));
    const left = sum([
      { coef: 1, sym: `${v}^{2}` },
      { coef: p, sym: v },
    ]);
    const steps: string[] = [];
    if (form === 'rearranged') steps.push(`Standard form: $${std.toTex(v)} = 0$`);
    if (A !== 1) steps.push(`Divide every term by $${A}$: $${left} ${q.sign > 0 ? '-' : '+'} ${num(q.abs())} = 0$`);
    steps.push(`Move the constant: $${left} = ${num(q)}$`);
    steps.push(`Add $${paren(half)}^{2} = ${num(half.mul(half))}$ to both sides: $${left} + ${num(half.mul(half))} = ${num(K)}$`);
    const sq = `${shiftTex(v, half.neg())}^{2}`;
    steps.push(`Factor: $${sq} = ${num(K)}$`);
    const inner = sum([
      { coef: 1, sym: v },
      { coef: half },
    ]);
    steps.push(`Take square roots: $${inner} = \\pm\\sqrt{${num(K)}}$`);
    const D = B * B - 4 * A * C;
    const roots = formatRoots(-B, D, 2 * A);
    const answer = m(setTex(roots));
    steps.push(`$${v} = ${roots.join(',\\ ')}$`);

    const wrong = (negB: number, Dw: number, den: number) => (Dw === 0 || (Dw < 0 && D > 0 && !complex) ? null : m(setTex(formatRoots(negB, Dw, den))));
    const distractors = distinctDistractors(
      answer,
      [wrong(B, D, 2 * A), wrong(-B, -4 * A * C, 2 * A), A !== 1 ? wrong(-B, B * B - 4 * C, 2) : null, wrong(-B, B * B + 4 * A * C, 2 * A)],
      (k) => wrong(-B + 2 * k, D, 2 * A),
    );
    return {
      question: m(question),
      answer,
      steps,
      distractors,
      check: { kind: 'roots', variable: v, solutions: rootValues(A, B, C) },
    };
  },
});
