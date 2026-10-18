/** Matrix arithmetic: sums, scalar multiples, products, determinants, inverses. */
import { Frac } from '../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, offset, strOpt } from '../../generator';
import type { Rng } from '../../rng';
import { m, num, paren } from '../../tex';
import type { ProblemContent } from '../../types';

export type Matrix = Frac[][];

export const mat = (rows: number[][]): Matrix => rows.map((r) => r.map((x) => new Frac(x)));

export function matTex(a: Matrix): string {
  return `\\begin{bmatrix} ${a.map((r) => r.map((x) => num(x)).join(' & ')).join(' \\\\ ')} \\end{bmatrix}`;
}

export function randMatrix(rng: Rng, rows: number, cols: number, max: number): Matrix {
  return mat(Array.from({ length: rows }, () => Array.from({ length: cols }, () => rng.int(-max, max))));
}

export const addM = (a: Matrix, b: Matrix, s = 1): Matrix => a.map((r, i) => r.map((x, j) => x.add(b[i]![j]!.mul(s))));
export const scaleM = (a: Matrix, k: number): Matrix => a.map((r) => r.map((x) => x.mul(k)));
export function mulM(a: Matrix, b: Matrix): Matrix {
  return a.map((r) => b[0]!.map((_, j) => r.reduce((s, x, k) => s.add(x.mul(b[k]![j]!)), Frac.ZERO)));
}
export function det(a: Matrix): Frac {
  if (a.length === 2) return a[0]![0]!.mul(a[1]![1]!).sub(a[0]![1]!.mul(a[1]![0]!));
  let s = Frac.ZERO;
  for (let j = 0; j < 3; j++) {
    const minor = [1, 2].map((i) => [0, 1, 2].filter((c) => c !== j).map((c) => a[i]![c]!));
    s = s.add(a[0]![j]!.mul(det(minor)).mul(j % 2 ? -1 : 1));
  }
  return s;
}

type Op = 'add' | 'sub' | 'scalar' | 'multiply' | 'determinant' | 'inverse';

const OPS: Record<string, Op[]> = {
  easy: ['add', 'sub', 'scalar'],
  medium: ['multiply', 'determinant', 'sub', 'scalar'],
  hard: ['multiply', 'determinant', 'inverse'],
};

export const matrixOperations = defineTopic({
  id: 'alg2.matrices',
  subject: 'algebra2',
  title: 'Matrix Operations',
  category: 'Matrices',
  description: 'Add, subtract, scale and multiply matrices; determinants and 2×2 inverses.',
  instruction: (o) =>
    o.operation === 'determinant'
      ? 'Evaluate each determinant.'
      : o.operation === 'inverse'
        ? 'Find the inverse of each matrix.'
        : o.undefinedProducts
          ? 'Simplify. Write “undefined” for products that are undefined.'
          : 'Simplify.',
  multipleChoice: true,
  defaultCount: 8,
  options: [
    {
      type: 'select',
      id: 'operation',
      label: 'Operation',
      default: 'any',
      choices: [
        { value: 'any', label: 'Any (by difficulty)' },
        { value: 'add', label: 'Add / subtract' },
        { value: 'scalar', label: 'Scalar multiplication' },
        { value: 'multiply', label: 'Multiplication' },
        { value: 'determinant', label: 'Determinants' },
        { value: 'inverse', label: 'Inverses (2×2)' },
      ],
    },
    { type: 'boolean', id: 'undefinedProducts', label: 'Include undefined products', default: false },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const chosen = strOpt(ctx, 'operation');
    const op: Op = chosen === 'any' ? rng.pick(OPS[difficulty]!) : chosen === 'add' ? rng.pick<Op>(['add', 'sub']) : (chosen as Op);
    const max = difficulty === 'easy' ? 6 : difficulty === 'medium' ? 6 : 5;
    const steps: string[] = [];
    let question: string;
    let answer: string;
    let wrongs: string[];
    let check: Record<string, unknown>;
    let perturb: (k: number) => string;
    const perturbMatrix = (r: Matrix) => (k: number) => {
      const cells = r.length * r[0]!.length;
      const idx = (k - 1) % cells;
      return matTex(r.map((row, i) => row.map((x, j) => (i * row.length + j === idx ? x.add(offset(Math.ceil(k / cells) * 2 - 1)) : x))));
    };

    switch (op) {
      case 'add':
      case 'sub': {
        const rows = rng.int(2, 3);
        const cols = rng.int(2, 3);
        const a = randMatrix(rng, rows, cols, max * 2);
        const b = randMatrix(rng, rows, cols, max * 2);
        const s = op === 'add' ? 1 : -1;
        const r = addM(a, b, s);
        question = `${matTex(a)} ${op === 'add' ? '+' : '-'} ${matTex(b)}`;
        answer = m(matTex(r));
        steps.push(`${op === 'add' ? 'Add' : 'Subtract'} corresponding entries.`);
        wrongs = [matTex(addM(a, b, -s)), matTex(addM(b, a, -1))];
        perturb = perturbMatrix(r);
        check = { kind: 'matrix', op, a, b, result: r };
        break;
      }
      case 'scalar': {
        const k = rng.signedInt(2, 6, true);
        const a = randMatrix(rng, rng.int(2, 3), rng.int(2, 3), max);
        const r = scaleM(a, k);
        question = `${k}${matTex(a)}`;
        answer = m(matTex(r));
        steps.push(`Multiply every entry by $${k}$.`);
        wrongs = [matTex(scaleM(a, -k)), matTex(a.map((row, i) => row.map((x) => (i === 0 ? x.mul(k) : x)))), matTex(a.map((row) => row.map((x) => x.add(k))))];
        perturb = perturbMatrix(r);
        check = { kind: 'matrix', op, k, a, result: r };
        break;
      }
      case 'multiply': {
        const shapes: Array<[number, number, number]> = difficulty === 'hard' ? [[2, 3, 2], [3, 2, 2], [2, 2, 2], [2, 3, 1]] : [[2, 2, 2], [2, 2, 1], [1, 2, 2]];
        const [p, q, r2] = rng.pick(shapes);
        const lim = difficulty === 'hard' ? 5 : 4;
        if (boolOpt(ctx, 'undefinedProducts') && rng.bool(0.2)) {
          // inner dimensions disagree
          const a = randMatrix(rng, p, q, lim);
          const b = randMatrix(rng, q + 1, r2, lim);
          question = `${matTex(a)}${matTex(b)}`;
          answer = 'Undefined';
          steps.push(`A $${p} \\times ${q}$ matrix cannot multiply a $${q + 1} \\times ${r2}$ matrix: the inner dimensions differ.`);
          wrongs = [matTex(randMatrix(rng, p, r2, lim)), matTex(randMatrix(rng, p, r2, lim))];
          perturb = (k) => num(k * 3);
          check = { kind: 'matrix', op: 'undefined' };
          break;
        }
        const a = randMatrix(rng, p, q, lim);
        const b = randMatrix(rng, q, r2, lim);
        const r = mulM(a, b);
        question = `${matTex(a)}${matTex(b)}`;
        answer = m(matTex(r));
        const first = a[0]!.map((x, k) => `${paren(x)}${paren(b[k]![0]!)}`).join(' + ');
        steps.push(`Row $\\times$ column: e.g. entry $(1,1)$ is $${first} = ${num(r[0]![0]!)}$`);
        const elementwise = a.length === b.length && a[0]!.length === b[0]!.length ? matTex(a.map((row, i) => row.map((x, j) => x.mul(b[i]![j]!)))) : null;
        const swapped = b[0]!.length === a.length ? matTex(mulM(b, a)) : null;
        wrongs = [elementwise, swapped].filter((w): w is string => w !== null);
        perturb = perturbMatrix(r);
        check = { kind: 'matrix', op, a, b, result: r };
        break;
      }
      case 'determinant': {
        const n = difficulty === 'hard' ? 3 : 2;
        const a = randMatrix(rng, n, n, n === 3 ? 4 : 9);
        const d = det(a);
        question = `\\det ${matTex(a)}`;
        answer = m(num(d));
        if (n === 2) {
          steps.push(m(`${paren(a[0]![0]!)}${paren(a[1]![1]!)} - ${paren(a[0]![1]!)}${paren(a[1]![0]!)} = ${num(d)}`));
        } else {
          const minors = [0, 1, 2].map((j) => {
            const minor = [1, 2].map((i) => [0, 1, 2].filter((c) => c !== j).map((c) => a[i]![c]!));
            return { j, minor, d: det(minor) };
          });
          steps.push(
            m(
              minors
                .map(({ j, d: md }) => `${j === 0 ? '' : j === 1 ? ' - ' : ' + '}${paren(a[0]![j]!)}${paren(md)}`)
                .join('') + ` = ${num(d)}`,
            ),
          );
        }
        const plus = n === 2 ? a[0]![0]!.mul(a[1]![1]!).add(a[0]![1]!.mul(a[1]![0]!)) : d.neg();
        wrongs = [num(plus), num(d.neg())];
        perturb = (k) => num(d.add(offset(k)));
        check = { kind: 'matrix', op, a, result: d };
        break;
      }
      case 'inverse':
      default: {
        const a = attempt('inverse', () => {
          const x = randMatrix(rng, 2, 2, 6);
          const d = det(x);
          if (d.isZero() || Math.abs(d.value) > 30) return null;
          return x;
        });
        const d = det(a);
        const adj = mat([
          [a[1]![1]!.value, -a[0]![1]!.value],
          [-a[1]![0]!.value, a[0]![0]!.value],
        ]);
        const inv = adj.map((r) => r.map((x) => x.div(d)));
        question = `${matTex(a)}^{-1}`;
        answer = m(matTex(inv));
        steps.push(m(`\\det = ${num(d)}`));
        steps.push(m(`\\frac{1}{${num(d)}}${matTex(adj)} = ${matTex(inv)}`));
        wrongs = [
          matTex(adj.map((r) => r.map((x) => x.div(d.neg())))),
          matTex(a.map((r) => r.map((x) => x.div(d)))),
          matTex(adj),
        ];
        perturb = perturbMatrix(inv);
        check = { kind: 'matrix', op, a, result: inv };
        break;
      }
    }
    const distractors = distinctDistractors(
      answer,
      wrongs.map((w) => m(w)),
      (k) => m(perturb(k)),
    );
    return {
      question: m(question),
      answer,
      steps,
      distractors,
      check,
    };
  },
});
