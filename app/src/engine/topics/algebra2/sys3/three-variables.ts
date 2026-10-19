/** Systems of three linear equations in three variables, solved by elimination. */
import { gcdAll, lcm } from '../../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, offset, opt } from '../../../generator';
import type { Rng } from '../../../rng';
import { m, sum, tuple } from '../../../tex';
import type { Difficulty, ProblemContent } from '../../../types';
import { KIND } from '../smc-common';
import { detN, mat } from '../matrix/common';

const V = ['x', 'y', 'z'] as const;

/** [a, b, c, d] for a·x + b·y + c·z = d. */
type Row = number[];

export const rowEq = (r: Row): string => `${sum(r.slice(0, 3).map((c, i) => ({ coef: c, sym: V[i]! })))} = ${r[3]}`;

function reduce(r: Row): Row {
  const g = gcdAll(r) || 1;
  const lead = r.slice(0, 3).find((c) => c !== 0) ?? r[3]!;
  const s = lead < 0 ? -1 : 1;
  return r.map((x) => (s * x) / g + 0);
}

/** Combine two rows so that variable j cancels. */
function eliminate(p: Row, q: Row, j: number): Row {
  const l = lcm(p[j]!, q[j]!);
  const mp = l / p[j]!;
  const mq = l / q[j]!;
  return reduce(q.map((x, i) => mq * x - mp * p[i]!));
}

type Outcome = { kind: 'one'; sol: number[] } | { kind: 'none' } | { kind: 'all' };

/** Elimination steps; the outcome is derived independently by the caller. */
function eliminationSteps(rows: Row[], outcome: Outcome): string[] {
  const steps: string[] = [];
  const j0 = [0, 1, 2].find((j) => rows.filter((r) => r[j] !== 0).length >= 2) ?? 0;
  const pivotIdx = rows.reduce((best, r, i) => (r[j0] !== 0 && (rows[best]![j0] === 0 || Math.abs(r[j0]!) < Math.abs(rows[best]![j0]!)) ? i : best), rows.findIndex((r) => r[j0] !== 0));
  const pivot = rows[pivotIdx]!;
  const others = rows.map((r, i) => ({ r, i })).filter((o) => o.i !== pivotIdx);
  const reduced = others.map(({ r, i }) => {
    if (r[j0] === 0) return r;
    const e = eliminate(pivot, r, j0);
    steps.push(`Eliminate $${V[j0]}$ using equations ${pivotIdx + 1} and ${i + 1}: $${rowEq(e)}$`);
    return e;
  });
  const degenerate = reduced.filter((r) => r.slice(0, 3).every((c) => c === 0));
  if (degenerate.length) {
    const bad = degenerate.find((r) => r[3] !== 0);
    steps.push(bad ? `This gives $0 = ${bad[3]}$, which is false.` : 'This gives $0 = 0$: one equation depends on the others.');
  } else {
    const [r1, r2] = reduced as [Row, Row];
    const j1 = [0, 1, 2].find((j) => j !== j0 && r1[j] !== 0 && r2[j] !== 0);
    if (j1 !== undefined) {
      const e = eliminate(r1, r2, j1);
      if (e.slice(0, 3).every((c) => c === 0)) steps.push(`Eliminate $${V[j1]}$ from the new pair: $0 = ${e[3]}$, which is ${e[3] === 0 ? 'always true' : 'false'}.`);
      else steps.push(`Eliminate $${V[j1]}$ from the new pair: $${rowEq(e)}$`);
    }
  }
  if (outcome.kind === 'one') {
    const s = outcome.sol;
    steps.push(`Back-substitute: $${V.map((v, i) => `${v} = ${s[i]}`).join(',\\ ')}$`);
  } else steps.push(outcome.kind === 'none' ? 'The system is inconsistent: no solution.' : 'The planes share a line: infinitely many solutions.');
  return steps;
}

interface Built {
  rows: Row[];
  outcome: Outcome;
}

function build(rng: Rng, d: Difficulty, neg: boolean, special: boolean): Built {
  const wantSpecial = special && d === 'hard' && rng.bool(0.25) ? rng.pick<'none' | 'all'>(['none', 'all']) : null;
  const C = { easy: 3, medium: 5, hard: 7 }[d];
  const R = { easy: 5, medium: 7, hard: 9 }[d];
  const zeroP = { easy: 0.3, medium: 0.15, hard: 0.05 }[d];
  return attempt('three-variable system', () => {
    const sol = V.map(() => (neg ? rng.int(-R, R) : rng.int(0, R)));
    const coef = () => (rng.bool(zeroP) ? 0 : rng.signedInt(1, C, neg));
    const A = [0, 1, 2].map(() => [coef(), coef(), coef()]);
    if (wantSpecial) {
      const p = rng.pick([1, -1, 2]);
      const q = rng.pick([1, -1, 2, -2]);
      A[2] = A[0]!.map((x, j) => p * x + q * A[1]![j]!);
    }
    if (A.some((r) => r.filter((c) => c === 0).length > 1)) return null;
    if ([0, 1, 2].some((j) => A.every((r) => r[j] === 0))) return null;
    if (A.flat().some((c) => Math.abs(c) > C + 4)) return null;
    const rows: Row[] = A.map((r) => [...r, r.reduce((s, c, j) => s + c * sol[j]!, 0)]);
    const det = detN(mat(A)).value;
    let outcome: Outcome;
    if (wantSpecial) {
      if (det !== 0) return null;
      // rows 1, 2 must be independent
      const cross = [A[0]![1]! * A[1]![2]! - A[0]![2]! * A[1]![1]!, A[0]![2]! * A[1]![0]! - A[0]![0]! * A[1]![2]!, A[0]![0]! * A[1]![1]! - A[0]![1]! * A[1]![0]!];
      if (cross.every((c) => c === 0)) return null;
      if (wantSpecial === 'none') rows[2]![3]! += rng.signedInt(1, 6, true);
      outcome = { kind: wantSpecial };
    } else {
      if (det === 0) return null;
      outcome = { kind: 'one', sol };
    }
    if (rows.some((r) => Math.abs(r[3]!) > 60)) return null;
    if (!neg && rows.some((r) => r[3]! < 0)) return null;
    return { rows: rng.shuffle(rows), outcome };
  });
}

export const threeVariableSystems = defineTopic({
  id: 'alg2.sys3.three-variables',
  subject: 'algebra2',
  title: 'Systems of Three Variables',
  description: 'Solve systems of three linear equations in x, y and z by elimination.',
  category: 'Systems of Equations and Inequalities',
  instruction: 'Solve each system of equations.',
  multipleChoice: true,
  defaultCount: 6,
  options: [opt.negatives(true), { type: 'boolean', id: 'special', label: 'Include “no solution” / “infinitely many” (hard)', default: true }],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const { rows, outcome } = build(rng, difficulty, boolOpt(ctx, 'negatives'), boolOpt(ctx, 'special'));
    const question = m(`\\begin{aligned} ${rows.map((r) => rowEq(r).replace(' = ', ' &= ')).join(' \\\\ ')} \\end{aligned}`);
    const steps = eliminationSteps(rows, outcome);
    const NONE = 'No solution';
    const ALL = 'Infinitely many solutions';
    let answer: string;
    let distractors: string[];
    const satisfiesAll = (t: number[]) => rows.every((r) => r[0]! * t[0]! + r[1]! * t[1]! + r[2]! * t[2]! === r[3]);
    if (outcome.kind === 'one') {
      const s = outcome.sol;
      answer = m(tuple(s));
      distractors = distinctDistractors(
        answer,
        [m(tuple([s[1]!, s[0]!, s[2]!])), m(tuple([s[0]!, s[2]!, s[1]!])), m(tuple([-s[0]!, s[1]!, s[2]!])), m(tuple([s[0]!, s[1]!, -s[2]!]))],
        (k) => m(tuple(s.map((v, i) => (i === (k - 1) % 3 ? v + offset(Math.ceil(k / 3)) : v)))),
      );
    } else {
      answer = outcome.kind === 'none' ? NONE : ALL;
      const tuples = [[0, 0, 0], [1, -1, 2], [2, 1, -1], [-1, 3, 1], [3, 0, -2]].filter((t) => !satisfiesAll(t));
      distractors = distinctDistractors(answer, [outcome.kind === 'none' ? ALL : NONE, ...tuples.map((t) => m(tuple(t)))], (k) => m(tuple([k + 3, -k, 2 * k + 1])));
    }
    return { question, answer, steps, distractors, check: { kind: `${KIND}.system3` } };
  },
});
