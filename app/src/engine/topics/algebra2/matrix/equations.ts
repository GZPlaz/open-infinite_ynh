/** Matrix equations: X + A = B, kX = B, kX + A = B, AX = B, XA = B. */
import { Frac } from '../../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, strOpt } from '../../../generator';
import type { Rng } from '../../../rng';
import { m, num } from '../../../tex';
import type { Difficulty, ProblemContent } from '../../../types';
import { KIND } from '../smc-common';
import { addM, detN, eqM, inverse, mapM, matTex, maxAbs, mulM, perturbM, randomM, scaleM, type Matrix } from './common';

type Form = 'add' | 'subtract' | 'scalar' | 'scalarAdd' | 'left' | 'right';

const FORMS: Record<Difficulty, Form[]> = {
  easy: ['add', 'subtract', 'scalar'],
  medium: ['scalar', 'scalarAdd', 'left'],
  hard: ['scalarAdd', 'left', 'right'],
};

const divM = (a: Matrix, k: number): Matrix => a.map((r) => r.map((x) => x.div(k)));
const negM = (a: Matrix): Matrix => scaleM(a, -1);

/** Coefficient in front of X: `3X`, `-X`, `\frac{1}{2}X`. */
const kX = (k: Frac) => (k.eq(1) ? 'X' : k.eq(-1) ? '-X' : `${num(k)}X`);

function shape(rng: Rng, d: Difficulty): [number, number] {
  return d === 'easy' ? rng.pick<[number, number]>([[2, 2], [2, 2], [2, 3], [3, 2]]) : rng.pick<[number, number]>([[2, 2], [2, 2], [2, 3], [3, 3]]);
}

function invertible2(rng: Rng, d: Difficulty): Matrix {
  return attempt('matrix-eq A', () => {
    const a = randomM(rng, 2, 2, d === 'hard' ? 6 : 5);
    const det = Math.abs(detN(a).value);
    if (det === 0 || (d === 'medium' && det !== 1) || det > 12) return null;
    return a;
  });
}

export const matrixEquations = defineTopic({
  id: 'alg2.matrix.equations',
  subject: 'algebra2',
  title: 'Matrix Equations',
  description: 'Solve matrix equations such as X + A = B, kX = B and AX = B for the matrix X.',
  category: 'Matrices',
  instruction: 'Solve each equation for the matrix $X$.',
  multipleChoice: true,
  defaultCount: 8,
  options: [
    {
      type: 'select',
      id: 'form',
      label: 'Equation type',
      default: 'any',
      choices: [
        { value: 'any', label: 'By difficulty' },
        { value: 'add', label: 'X + A = B, X − A = B' },
        { value: 'scalar', label: 'kX = B, kX + A = B' },
        { value: 'multiply', label: 'AX = B, XA = B' },
      ],
    },
    opt_fractions(),
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const fractions = boolOpt(ctx, 'fractions');
    const chosen = strOpt(ctx, 'form');
    const form: Form =
      chosen === 'add'
        ? rng.pick<Form>(['add', 'subtract'])
        : chosen === 'scalar'
          ? rng.pick<Form>(difficulty === 'easy' ? ['scalar', 'scalar', 'scalarAdd'] : ['scalar', 'scalarAdd', 'scalarAdd'])
          : chosen === 'multiply'
            ? rng.pick<Form>(difficulty === 'hard' ? ['left', 'right'] : ['left', 'left', 'right'])
            : rng.pick(FORMS[difficulty]);
    const E = difficulty === 'easy' ? 9 : difficulty === 'medium' ? 10 : 12;
    const steps: string[] = [];
    let question: string;
    let X: Matrix;
    let wrongs: Matrix[];

    switch (form) {
      case 'add':
      case 'subtract': {
        const [r, c] = shape(rng, difficulty);
        const A = randomM(rng, r, c, E);
        X = randomM(rng, r, c, E);
        const B = form === 'add' ? addM(X, A) : addM(X, A, -1);
        const aFirst = form === 'add' && rng.bool(0.4);
        question = form === 'add' ? (aFirst ? `${matTex(A)} + X = ${matTex(B)}` : `X + ${matTex(A)} = ${matTex(B)}`) : `X - ${matTex(A)} = ${matTex(B)}`;
        steps.push(form === 'add' ? `Subtract $${matTex(A)}$ from both sides.` : `Add $${matTex(A)}$ to both sides.`);
        steps.push(`$X = ${matTex(B)} ${form === 'add' ? '-' : '+'} ${matTex(A)} = ${matTex(X)}$`);
        wrongs = [form === 'add' ? addM(B, A) : addM(B, A, -1), form === 'add' ? addM(A, B, -1) : negM(X)];
        break;
      }
      case 'scalar':
      case 'scalarAdd': {
        const [r, c] = shape(rng, difficulty);
        const k = new Frac(rng.signedInt(2, difficulty === 'easy' ? 4 : 6, true));
        const A = form === 'scalarAdd' ? randomM(rng, r, c, E) : null;
        if (fractions) {
          const rhs = attempt('kX', () => {
            const R = randomM(rng, r, c, E);
            return divM(R, k.value).some((row) => row.some((x) => !x.isInt())) ? R : null;
          });
          X = divM(rhs, k.value);
        } else X = randomM(rng, r, c, form === 'scalar' ? 8 : 6);
        const kx = scaleM(X, k.value);
        const B = A ? addM(kx, A) : kx;
        question = A ? (rng.bool(0.3) ? `${matTex(A)} ${k.sign < 0 ? '-' : '+'} ${kX(k.abs())} = ${matTex(B)}` : `${kX(k)} + ${matTex(A)} = ${matTex(B)}`) : `${kX(k)} = ${matTex(B)}`;
        if (A) steps.push(`Subtract: $${kX(k)} = ${matTex(B)} - ${matTex(A)} = ${matTex(kx)}$`);
        steps.push(`Divide every entry by $${num(k)}$: $X = ${matTex(X)}$`);
        wrongs = A ? [divM(addM(B, A), k.value), addM(divM(B, k.value), A, -1), divM(addM(B, A, -1), -k.value)] : [scaleM(B, k.value), divM(B, -k.value), mapM(B, (x) => x.sub(k))];
        break;
      }
      case 'left':
      case 'right':
      default: {
        const A = invertible2(rng, difficulty);
        const Ainv = inverse(A)!;
        const cols = rng.bool(form === 'left' ? 0.4 : 0) ? 1 : 2;
        const shapeX: [number, number] = form === 'left' ? [2, cols] : [cols === 1 ? 1 : 2, 2];
        if (fractions && !detN(A).abs().eq(1)) {
          X = attempt('AX=B', () => {
            const B = randomM(rng, shapeX[0], shapeX[1], E);
            const x = form === 'left' ? mulM(Ainv, B) : mulM(B, Ainv);
            return x.some((row) => row.some((v) => !v.isInt())) && Math.max(...x.flat().map((v) => v.d)) <= 12 ? x : null;
          });
        } else X = randomM(rng, shapeX[0], shapeX[1], 5);
        const B = form === 'left' ? mulM(A, X) : mulM(X, A);
        question = form === 'left' ? `${matTex(A)}X = ${matTex(B)}` : `X${matTex(A)} = ${matTex(B)}`;
        steps.push(`$${matTex(A)}^{-1} = ${matTex(Ainv)}$`);
        steps.push(
          form === 'left'
            ? `Multiply both sides on the left by the inverse: $X = ${matTex(Ainv)}${matTex(B)} = ${matTex(X)}$`
            : `Multiply both sides on the right by the inverse: $X = ${matTex(B)}${matTex(Ainv)} = ${matTex(X)}$`,
        );
        const wrongOrder = B[0]!.length === Ainv.length && Ainv[0]!.length === B.length ? (form === 'left' ? mulM(B, Ainv) : mulM(Ainv, B)) : null;
        wrongs = [wrongOrder, form === 'left' ? mulM(A, B) : B[0]!.length === 2 ? mulM(B, A) : null, negM(X)].filter((w): w is Matrix => w !== null && w.length === X.length && w[0]!.length === X[0]!.length);
        break;
      }
    }
    const answer = m(`X = ${matTex(X)}`);
    const distractors = distinctDistractors(
      answer,
      wrongs.filter((w) => !eqM(w, X) && maxAbs(w) < 1000).map((w) => m(`X = ${matTex(w)}`)),
      (k) => m(`X = ${matTex(perturbM(X, k))}`),
    );
    return { question: m(question), answer, steps, distractors, check: { kind: `${KIND}.matrixEq` } };
  },
});

function opt_fractions() {
  return { type: 'boolean' as const, id: 'fractions', label: 'Allow fractional entries in X', default: false };
}
