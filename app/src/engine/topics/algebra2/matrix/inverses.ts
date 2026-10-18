/** Inverses of 2×2 and 3×3 matrices (including singular ones). */
import { attempt, boolOpt, defineTopic, distinctDistractors, strOpt } from '../../../generator';
import type { Rng } from '../../../rng';
import { m, num } from '../../../tex';
import type { Difficulty, ProblemContent } from '../../../types';
import { KIND } from '../smc-common';
import { adjugate, cofactors, det2Expansion, detN, inverse, mat, matTex, maxAbs, perturbM, randomM, transpose, type Matrix } from './common';

export const NO_INVERSE = 'No inverse';

function singularMatrix(rng: Rng, n: number, max: number): Matrix {
  return attempt('singular', () => {
    const r1 = Array.from({ length: n }, () => rng.int(-max, max));
    const r2 = Array.from({ length: n }, () => rng.int(-max, max));
    const rows =
      n === 2
        ? [r1, r1.map((x) => x * rng.pick([-2, -1, 2, 3]))]
        : [r1, r2, r1.map((x, j) => x * rng.pick([1, -1, 2]) + r2[j]! * rng.pick([1, -1]))];
    const a = mat(rng.shuffle(rows));
    if (a.flat().some((x) => Math.abs(x.value) > max * 3) || a.some((r) => r.every((x) => x.isZero()))) return null;
    if (!detN(a).isZero()) return null;
    return a;
  });
}

function invertible(rng: Rng, n: number, d: Difficulty): Matrix {
  return attempt('invertible', () => {
    const max = n === 2 ? { easy: 6, medium: 7, hard: 9 }[d] : { easy: 2, medium: 3, hard: 3 }[d];
    const a = randomM(rng, n, n, max);
    const det = Math.abs(detN(a).value);
    if (det === 0) return null;
    if (d === 'easy' && det !== 1) return null;
    if (n === 2 && d !== 'easy' && (det === 1 || det > 24)) return null;
    if (n === 3 && det > (d === 'easy' ? 1 : d === 'medium' ? 2 : 4)) return null;
    if (a.flat().filter((x) => x.isZero()).length > n) return null;
    return a;
  });
}

export const inverseMatrices = defineTopic({
  id: 'alg2.matrix.inverses',
  subject: 'algebra2',
  title: 'Inverse Matrices',
  description: 'Find the inverse of a 2×2 or 3×3 matrix, or show that none exists.',
  category: 'Matrices',
  instruction: (o) => (o.singular ? 'Find the inverse of each matrix, if it exists.' : 'Find the inverse of each matrix.'),
  multipleChoice: true,
  defaultCount: 8,
  options: [
    {
      type: 'select',
      id: 'size',
      label: 'Matrix size',
      default: 'any',
      choices: [
        { value: 'any', label: 'By difficulty (3×3 at hard)' },
        { value: '2', label: '2×2 only' },
        { value: '3', label: '3×3 only' },
      ],
    },
    { type: 'boolean', id: 'singular', label: 'Include matrices with no inverse', default: true },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const size = strOpt(ctx, 'size');
    const n = size === '2' ? 2 : size === '3' ? 3 : difficulty === 'hard' ? 3 : 2;
    const singular = boolOpt(ctx, 'singular') && rng.bool(0.2);
    const a = singular ? singularMatrix(rng, n, n === 2 ? 6 : 3) : invertible(rng, n, difficulty);
    const d = detN(a);
    const adj = adjugate(a);
    const steps: string[] = [];
    if (n === 2) steps.push(`$\\det = ${det2Expansion(a)} = ${num(d)}$`);
    else steps.push(`Expand along the first row: $\\det = ${num(d)}$`);
    const question = m(`${matTex(a)}^{-1}`);
    let answer: string;
    let candidates: Array<string | null>;
    let fallback: (k: number) => string;
    if (singular) {
      steps.push('The determinant is $0$, so the matrix has no inverse.');
      answer = NO_INVERSE;
      candidates = [m(matTex(adj)), m(matTex(adj.map((r) => r.map((x) => x.neg())))), m(matTex(transpose(a)))];
      fallback = (k) => m(matTex(perturbM(adj, k)));
    } else {
      const inv = inverse(a)!;
      if (n === 2) {
        steps.push(`Swap the diagonal entries and negate the others: $${matTex(adj)}$`);
      } else {
        steps.push(`Matrix of cofactors: $${matTex(cofactors(a))}$`);
        steps.push(`Adjugate (transpose of the cofactors): $${matTex(adj)}$`);
      }
      steps.push(`Multiply by $\\frac{1}{\\det}$: $${d.eq(1) ? '' : d.eq(-1) ? '-' : `\\frac{1}{${num(d)}}`}${matTex(adj)} = ${matTex(inv)}$`);
      answer = m(matTex(inv));
      const viaA = a.map((r) => r.map((x) => x.div(d)));
      candidates = [
        m(matTex(inv.map((r) => r.map((x) => x.neg())))),
        maxAbs(adj) > 0 && !d.abs().eq(1) ? m(matTex(adj)) : null,
        n === 2 ? m(matTex(viaA)) : m(matTex(cofactors(a).map((r) => r.map((x) => x.div(d))))),
        m(matTex(transpose(inv))),
        NO_INVERSE,
      ];
      fallback = (k) => m(matTex(perturbM(inv, k)));
    }
    return {
      question,
      answer,
      steps,
      distractors: distinctDistractors(answer, candidates, fallback),
      check: { kind: `${KIND}.inverse` },
    };
  },
});
