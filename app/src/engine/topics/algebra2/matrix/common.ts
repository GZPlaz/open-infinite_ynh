/** Shared exact matrix helpers for the Matrices unit (builds on ../matrices). */
import { Frac, type FracLike } from '../../../fraction';
import type { Rng } from '../../../rng';
import { num, paren } from '../../../tex';
import { addM, det, mat, matTex, mulM, randMatrix, scaleM, type Matrix } from '../matrices';

export { addM, det, mat, matTex, mulM, randMatrix, scaleM, type Matrix };

/** Matrix in any bracket environment: `bmatrix` (default) or `vmatrix` (determinant bars). */
export function envTex(a: Matrix, env: 'bmatrix' | 'vmatrix'): string {
  return `\\begin{${env}} ${a.map((r) => r.map((x) => num(x)).join(' & ')).join(' \\\\ ')} \\end{${env}}`;
}

export const detTex = (a: Matrix): string => envTex(a, 'vmatrix');

export const identity = (n: number): Matrix => mat(Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))));

export const transpose = (a: Matrix): Matrix => a[0]!.map((_, j) => a.map((r) => r[j]!));

export const eqM = (a: Matrix, b: Matrix): boolean =>
  a.length === b.length && a.every((r, i) => r.length === b[i]!.length && r.every((x, j) => x.eq(b[i]![j]!)));

export const mapM = (a: Matrix, f: (x: Frac, i: number, j: number) => FracLike): Matrix => a.map((r, i) => r.map((x, j) => Frac.of(f(x, i, j))));

/** Minor of a square matrix with row i and column j removed. */
export function minor(a: Matrix, i: number, j: number): Matrix {
  return a.filter((_, r) => r !== i).map((row) => row.filter((_, c) => c !== j));
}

/** Determinant of any square matrix (cofactor expansion; sizes ≤ 3 here). */
export function detN(a: Matrix): Frac {
  if (a.length === 1) return a[0]![0]!;
  if (a.length <= 3) return det(a);
  let s = Frac.ZERO;
  for (let j = 0; j < a.length; j++) s = s.add(a[0]![j]!.mul(detN(minor(a, 0, j))).mul(j % 2 ? -1 : 1));
  return s;
}

/** Matrix of cofactors. */
export function cofactors(a: Matrix): Matrix {
  return a.map((r, i) => r.map((_, j) => detN(minor(a, i, j)).mul((i + j) % 2 ? -1 : 1)));
}

export const adjugate = (a: Matrix): Matrix => transpose(cofactors(a));

/** Exact inverse, or null when singular. */
export function inverse(a: Matrix): Matrix | null {
  const d = detN(a);
  if (d.isZero()) return null;
  return adjugate(a).map((r) => r.map((x) => x.div(d)));
}

/** Largest denominator among the entries. */
export const maxDen = (a: Matrix): number => Math.max(...a.flat().map((x) => x.d));
export const maxAbs = (a: Matrix): number => Math.max(...a.flat().map((x) => Math.abs(x.value)));

/** Change one entry by a small amount (MC fallback distractors). */
export function perturbM(r: Matrix, k: number): Matrix {
  const cells = r.length * r[0]!.length;
  const idx = (k - 1) % cells;
  const by = Math.ceil(k / cells) * (k % 2 ? 1 : -1);
  return r.map((row, i) => row.map((x, j) => (i * row.length + j === idx ? x.add(by) : x)));
}

/** Random matrix with entries in [-max, max] (or [0, max] without negatives). */
export function randomM(rng: Rng, rows: number, cols: number, max: number, negatives = true): Matrix {
  return negatives ? randMatrix(rng, rows, cols, max) : mat(Array.from({ length: rows }, () => Array.from({ length: cols }, () => rng.int(0, max))));
}

/** `(a)(d) - (b)(c)` expansion of a 2×2 determinant. */
export function det2Expansion(a: Matrix): string {
  return `${paren(a[0]![0]!)}${paren(a[1]![1]!)} - ${paren(a[0]![1]!)}${paren(a[1]![0]!)}`;
}

/** First-row cofactor expansion of a 3×3 determinant, as a TeX string `a(…) - b(…) + c(…)`. */
export function det3Expansion(a: Matrix): string {
  return [0, 1, 2]
    .map((j) => `${j === 0 ? '' : j === 1 ? ' - ' : ' + '}${paren(a[0]![j]!)}${paren(det(minor(a, 0, j)))}`)
    .join('');
}

/** Worked steps for a determinant. */
export function detSteps(a: Matrix): string[] {
  const d = detN(a);
  if (a.length === 2) return [`$${det2Expansion(a)} = ${num(d)}$`];
  const steps = ['Expand along the first row: $a_{11}M_{11} - a_{12}M_{12} + a_{13}M_{13}$.'];
  steps.push(
    `Minors: ${[0, 1, 2].map((j) => `$M_{1${j + 1}} = ${det2Expansion(minor(a, 0, j))} = ${num(det(minor(a, 0, j)))}$`).join(', ')}`,
  );
  steps.push(`$${det3Expansion(a)} = ${num(d)}$`);
  return steps;
}
