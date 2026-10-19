/** Matrix arithmetic by difficulty: sums, differences, scalar multiples, linear combinations and products. */
import { Frac } from '../../../fraction';
import { boolOpt, defineTopic, distinctDistractors, opt, strOpt } from '../../../generator';
import type { Rng } from '../../../rng';
import { m, num, paren } from '../../../tex';
import type { Difficulty, ProblemContent } from '../../../types';
import { KIND } from '../smc-common';
import { addM, eqM, matTex, mulM, perturbM, randomM, scaleM, transpose, type Matrix } from './common';

type Op = 'add' | 'scalar' | 'multiply';

/** `3`, `-2`, `` (for 1), `-` (for -1) in front of a matrix. */
const coefTex = (k: number) => (k === 1 ? '' : k === -1 ? '-' : String(k));

function dims(rng: Rng, d: Difficulty): [number, number] {
  return d === 'easy' ? rng.pick<[number, number]>([[2, 2], [2, 2], [1, 3], [2, 1]]) : rng.pick<[number, number]>([[2, 2], [2, 3], [3, 2], [3, 3]]);
}

export const matrixArithmetic = defineTopic({
  id: 'alg2.matrix.operations',
  subject: 'algebra2',
  title: 'Adding, Subtracting and Multiplying Matrices',
  description: 'Matrix sums and differences, scalar multiples, linear combinations and matrix products.',
  category: 'Matrices',
  instruction: (o) => (o.undefinedProducts ? 'Simplify. Write “Undefined” if the expression is undefined.' : 'Simplify.'),
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'operation',
      label: 'Operation',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'add', label: 'Addition / subtraction' },
        { value: 'scalar', label: 'Scalar multiplication' },
        { value: 'multiply', label: 'Matrix multiplication' },
      ],
    },
    opt.negatives(true),
    { type: 'boolean', id: 'undefinedProducts', label: 'Include undefined expressions', default: false },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const neg = boolOpt(ctx, 'negatives');
    const chosen = strOpt(ctx, 'operation');
    const op: Op = chosen === 'any' ? rng.pick<Op>(['add', 'scalar', 'multiply']) : (chosen as Op);
    const undef = boolOpt(ctx, 'undefinedProducts') && rng.bool(0.2);
    const E = { easy: 9, medium: 12, hard: 15 }[difficulty];
    const R = (r: number, c: number, max = E) => randomM(rng, r, c, max, neg);
    const steps: string[] = [];
    let question: string;
    let result: Matrix | null = null;
    let wrongs: Matrix[] = [];
    let undefNote = '';

    if (op === 'add') {
      const [r, c] = dims(rng, difficulty);
      const A = R(r, c);
      const B = undef ? R(c === r ? r + 1 : c, r) : R(r, c);
      if (difficulty === 'hard' && !undef) {
        const C = R(r, c);
        const s1 = rng.sign();
        const s2 = rng.sign();
        question = `${matTex(A)} ${s1 > 0 ? '+' : '-'} ${matTex(B)} ${s2 > 0 ? '+' : '-'} ${matTex(C)}`;
        result = addM(addM(A, B, s1), C, s2);
        steps.push('Combine corresponding entries, left to right.');
        wrongs = [addM(addM(A, B, -s1), C, s2), addM(addM(A, B, s1), C, -s2), addM(addM(A, B, -s1), C, -s2)];
      } else {
        const s = rng.sign();
        question = `${matTex(A)} ${s > 0 ? '+' : '-'} ${matTex(B)}`;
        if (undef) undefNote = 'The matrices have different dimensions, so they cannot be combined.';
        else {
          result = addM(A, B, s);
          steps.push(`${s > 0 ? 'Add' : 'Subtract'} corresponding entries.`);
          wrongs = [addM(A, B, -s), addM(B, A, -s)];
        }
      }
    } else if (op === 'scalar') {
      const [r, c] = dims(rng, difficulty);
      const k = rng.signedInt(2, difficulty === 'easy' ? 5 : 6, neg);
      const A = R(r, c, difficulty === 'easy' ? 9 : 8);
      if (difficulty === 'easy' || undef) {
        question = `${k}${matTex(A)}`;
        result = scaleM(A, k);
        steps.push(`Multiply every entry by $${k}$.`);
        wrongs = [scaleM(A, -k), A.map((row) => row.map((x) => x.add(k))), A.map((row, i) => row.map((x) => (i === 0 ? x.mul(k) : x)))];
        if (undef) {
          const B = R(c, r === c ? r + 1 : r, 6);
          question = `${k}${matTex(A)} + ${matTex(B)}`;
          result = null;
          undefNote = 'The matrices have different dimensions, so they cannot be added.';
        }
      } else {
        const B = R(r, c, 8);
        const j = difficulty === 'medium' ? rng.pick([1, -1]) : rng.signedInt(2, 4, true);
        question = `${coefTex(k)}${matTex(A)} ${j > 0 ? '+' : '-'} ${coefTex(Math.abs(j))}${matTex(B)}`;
        result = addM(scaleM(A, k), scaleM(B, j));
        steps.push(`Scale first: $${matTex(scaleM(A, k))} ${j > 0 ? '+' : '-'} ${matTex(scaleM(B, Math.abs(j)))}$`);
        steps.push('Then combine corresponding entries.');
        wrongs = [addM(scaleM(A, k), scaleM(B, -j)), addM(A, B, j).map((row) => row.map((x) => x.mul(k))), addM(scaleM(A, k), B, j > 0 ? 1 : -1)];
      }
    } else {
      const shapes: Array<[number, number, number]> =
        difficulty === 'easy' ? [[1, 2, 1], [2, 2, 1], [1, 2, 2]] : difficulty === 'medium' ? [[2, 2, 2], [2, 2, 1], [1, 3, 1], [2, 3, 1]] : [[2, 3, 2], [3, 2, 2], [2, 2, 3], [3, 3, 1], [3, 2, 3]];
      const [p, q, s] = rng.pick(shapes);
      const lim = difficulty === 'hard' ? 6 : 5;
      const A = R(p, q, lim);
      const B = R(undef ? q + 1 : q, s, lim);
      question = `${matTex(A)}${matTex(B)}`;
      if (undef) undefNote = `A $${p} \\times ${q}$ matrix cannot multiply a $${q + 1} \\times ${s}$ matrix: the inner dimensions differ.`;
      else {
        result = mulM(A, B);
        const first = A[0]!.map((x, k) => `${paren(x)}${paren(B[k]![0]!)}`).join(' + ');
        steps.push(`The product is $${p} \\times ${s}$. Multiply each row by each column.`);
        steps.push(`Entry $(1, 1)$: $${first} = ${num(result[0]![0]!)}$`);
        wrongs = [];
        if (p === q && q === s) wrongs.push(A.map((row, i) => row.map((x, j) => x.mul(B[i]![j]!))));
        if (s === p) {
          const ba = mulM(B, A);
          if (ba.length === result.length && ba[0]!.length === result[0]!.length) wrongs.push(ba);
        }
        if (result.length === result[0]!.length) wrongs.push(transpose(result));
        wrongs.push(scaleM(result, -1));
      }
    }

    let answer: string;
    let distractors: string[];
    if (result) {
      const res = result;
      answer = m(matTex(res));
      distractors = distinctDistractors(
        answer,
        wrongs.filter((w) => !eqM(w, res)).map((w) => m(matTex(w))),
        (k) => m(matTex(perturbM(res, k))),
      );
    } else {
      steps.push(undefNote);
      answer = 'Undefined';
      const filler = (k: number) => m(matTex([[new Frac(k), new Frac(-k + 3)], [new Frac(2 * k), new Frac(1 - k)]]));
      distractors = distinctDistractors(answer, [m(matTex(R(2, 2, 6))), m(matTex(R(2, 1, 6)))], filler);
    }
    return { question: m(question), answer, steps, distractors, check: { kind: `${KIND}.matrixExpr` } };
  },
});
