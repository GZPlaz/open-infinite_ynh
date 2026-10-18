/** Points in three dimensions: octants, plotting, distance and midpoint in space. */
import { DiagramBuilder, type Pt } from '../../../diagram';
import { Frac } from '../../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, offset, opt, strOpt } from '../../../generator';
import { isPerfectSquare, sqrtTex } from '../../../radical';
import type { Rng } from '../../../rng';
import { decimal, m, paren, parenNeg, tuple } from '../../../tex';
import type { ProblemContent } from '../../../types';
import { KIND } from '../smc-common';

export type P3 = readonly [number, number, number];

/** Oblique projection: y to the right, z up, x toward the viewer (down-left at 45°, half length). */
export function proj([x, y, z]: P3): Pt {
  const k = 0.5 * Math.SQRT1_2;
  return [y - k * x, z - k * x];
}

/** Three labelled axes from -R to R (negative halves dashed), with unit ticks. */
export function axes3d(R: number, scale = 14): DiagramBuilder {
  const b = new DiagramBuilder(scale);
  const axes: Array<[P3, string]> = [
    [[1, 0, 0], 'x'],
    [[0, 1, 0], 'y'],
    [[0, 0, 1], 'z'],
  ];
  for (const [u, name] of axes) {
    const at = (t: number): P3 => [u[0] * t, u[1] * t, u[2] * t];
    b.segment(proj(at(-R)), proj(at(0)), { dash: true, ink: 'axis', weight: 0.8 });
    b.arrow(proj(at(0)), proj(at(R + 0.8)), { ink: 'axis', weight: 1 });
    b.label(proj(at(R + 0.8)), name, name === 'x' ? 'sw' : name === 'y' ? 'e' : 'n', { ink: 'axis' });
    for (let t = 1; t <= R; t++) {
      const p = proj(at(t));
      const tick = b.px(3);
      if (name === 'z') b.segment([p[0] - tick, p[1]], [p[0] + tick, p[1]], { ink: 'axis', weight: 0.8 });
      else b.segment([p[0], p[1] - tick], [p[0], p[1] + tick], { ink: 'axis', weight: 0.8 });
      if (t % 2 === 0 || R <= 4) b.label(p, String(t), name === 'z' ? 'w' : 's', { ink: 'muted', small: true });
    }
  }
  return b;
}

/** Plot a point with the dashed "box" path that locates it. */
export function plotPoint3(b: DiagramBuilder, p: P3, label: string): void {
  const [x, y, z] = p;
  b.path([proj([x, 0, 0]), proj([x, y, 0]), proj([0, y, 0])], { dash: true, ink: 'muted', weight: 0.8 });
  b.segment(proj([x, y, 0]), proj([x, y, z]), { dash: true, ink: 'muted', weight: 0.8 });
  b.dot(proj(p), false, 'accent');
  b.label(proj(p), label, 'ne', { ink: 'accent', small: true });
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
/** Sign patterns of octants I–VIII. */
const SIGNS: P3[] = [
  [1, 1, 1],
  [-1, 1, 1],
  [-1, -1, 1],
  [1, -1, 1],
  [1, 1, -1],
  [-1, 1, -1],
  [-1, -1, -1],
  [1, -1, -1],
];

/** "Octant IV", "On the $xz$-plane", "On the $y$-axis". */
export function locate(p: P3): string {
  const [x, y, z] = p;
  const zeros = p.filter((v) => v === 0).length;
  if (zeros === 2) return `On the $${x !== 0 ? 'x' : y !== 0 ? 'y' : 'z'}$-axis`;
  if (zeros === 1) return `On the $${x === 0 ? 'yz' : y === 0 ? 'xz' : 'xy'}$-plane`;
  const i = SIGNS.findIndex((s) => s[0] === Math.sign(x) && s[1] === Math.sign(y) && s[2] === Math.sign(z));
  return `Octant ${ROMAN[i]}`;
}

const pt3 = (p: ReadonlyArray<number | Frac>) => tuple(p.map((x) => Frac.of(x)));

type Task = 'octant' | 'distance' | 'midpoint';

function randPoint(rng: Rng, R: number, zeros = 0): P3 {
  const p = [rng.signedInt(1, R, true), rng.signedInt(1, R, true), rng.signedInt(1, R, true)];
  rng.sample([0, 1, 2], zeros).forEach((i) => (p[i] = 0));
  return p as unknown as P3;
}

export const pointsInSpace = defineTopic({
  id: 'alg2.sys3.points-3d',
  subject: 'algebra2',
  title: 'Points in Three Dimensions',
  description: 'Locate points by octant, plot them on 3D axes, and find distance and midpoint in space.',
  category: 'Systems of Equations and Inequalities',
  instruction: (o) =>
    o.task === 'octant'
      ? o.graph
        ? 'Plot each point and name the octant or the axis/plane it lies on.'
        : 'Name the octant, axis or coordinate plane in which each point lies.'
      : o.task === 'midpoint'
        ? 'Find the midpoint or the missing endpoint.'
        : o.answerForm === 'round'
          ? 'Answer each question. Round distances to the nearest tenth.'
          : 'Answer each question. Leave distances in simplest radical form.',
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Problem type',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'octant', label: 'Octants (locate / plot)' },
        { value: 'distance', label: 'Distance' },
        { value: 'midpoint', label: 'Midpoint / endpoint' },
      ],
    },
    opt.rounding('exact'),
    { type: 'boolean', id: 'graph', label: 'Plot octant points on 3D axes', default: false },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const chosen = strOpt(ctx, 'task');
    const task: Task = chosen === 'any' ? rng.pick<Task>(['octant', 'distance', 'midpoint']) : (chosen as Task);
    const round = strOpt(ctx, 'answerForm') === 'round';
    const graph = boolOpt(ctx, 'graph');
    const R = { easy: 6, medium: 9, hard: 12 }[difficulty];

    if (task === 'octant') {
      const zeros = difficulty === 'hard' ? rng.pick([0, 1, 1, 2]) : difficulty === 'medium' ? rng.pick([0, 0, 1]) : 0;
      const p = randPoint(rng, graph ? 5 : R, zeros);
      const answer = locate(p);
      const flips = [0, 1, 2].map((i) => locate(p.map((v, j) => (j === i ? (v === 0 ? 1 : -v) : v)) as unknown as P3));
      const cands = [...flips, locate(p.map((v) => (v === 0 ? 1 : -v)) as unknown as P3)];
      const all = [...ROMAN.map((r) => `Octant ${r}`), 'On the $xy$-plane', 'On the $xz$-plane', 'On the $yz$-plane', 'On the $z$-axis'];
      const distractors = distinctDistractors(answer, cands, (k) => all[(k * 3) % all.length]!);
      const steps = [`Signs of the coordinates: $x ${p[0] > 0 ? '> 0' : p[0] < 0 ? '< 0' : '= 0'}$, $y ${p[1] > 0 ? '> 0' : p[1] < 0 ? '< 0' : '= 0'}$, $z ${p[2] > 0 ? '> 0' : p[2] < 0 ? '< 0' : '= 0'}$.`];
      steps.push(zeros === 0 ? `The sign pattern $(${p.map((v) => (v > 0 ? '+' : '-')).join(', ')})$ places it in ${answer}.` : `${zeros === 1 ? 'One coordinate is zero, so the point lies on a coordinate plane' : 'Two coordinates are zero, so the point lies on an axis'}: ${answer.replace('On', 'on')}.`);
      let diagram;
      let answerDiagram;
      if (graph) {
        diagram = axes3d(5).build('Blank three-dimensional axes');
        const a = axes3d(5);
        plotPoint3(a, p, tuple([...p]));
        answerDiagram = a.build(`The point ${tuple([...p])} plotted on three-dimensional axes`);
      }
      return {
        question: graph ? `Plot $${pt3([...p])}$. Where does it lie?` : `$${pt3([...p])}$`,
        answer,
        steps,
        distractors,
        diagram,
        answerDiagram,
        check: { kind: `${KIND}.space`, task: 'octant' },
      };
    }

    if (task === 'distance') {
      const { A, B } = attempt('distance 3d', () => {
        const A = randPoint(rng, R, rng.pick([0, 0, 1]));
        const B = randPoint(rng, R, rng.pick([0, 0, 1]));
        const d2 = A.reduce((s, a, i) => s + (B[i]! - a) ** 2, 0);
        if (d2 === 0 || A.some((a, i) => a === B[i])) return null;
        if (difficulty === 'easy' && !isPerfectSquare(d2)) return null;
        if (difficulty !== 'easy' && isPerfectSquare(d2) && rng.bool(0.7)) return null;
        if (difficulty === 'hard' && sqrtTex(d2).indexOf('\\sqrt') <= 0 && !isPerfectSquare(d2) && rng.bool(0.6)) return null;
        return { A, B };
      });
      const diffs = A.map((a, i) => B[i]! - a);
      const d2 = diffs.reduce((s, v) => s + v * v, 0);
      const show = (n: number) => (round && !isPerfectSquare(n) ? `d \\approx ${decimal(Math.sqrt(n))}` : `d = ${sqrtTex(n)}`);
      const answer = m(show(d2));
      const sums = A.reduce((s, a, i) => s + (B[i]! + a) ** 2, 0);
      const noZ = diffs[0]! ** 2 + diffs[1]! ** 2;
      const lin = diffs.reduce((s, v) => s + Math.abs(v), 0);
      const distractors = distinctDistractors(
        answer,
        [m(show(noZ)), m(show(sums)), m(`d = ${d2}`), m(`d = ${lin}`)],
        (k) => m(show(d2 + offset(k) * 3)),
      );
      const subst = diffs.map((v, i) => `${paren(B[i]!)} - ${paren(A[i]!)}`).map((s) => `(${s})^{2}`).join(' + ');
      const steps = [
        '$d = \\sqrt{(x_2 - x_1)^{2} + (y_2 - y_1)^{2} + (z_2 - z_1)^{2}}$',
        `$d = \\sqrt{${subst}}$`,
        `$d = \\sqrt{${diffs.map((v) => `${v * v}`).join(' + ')}} = \\sqrt{${d2}}$`,
        answer,
      ];
      return {
        question: `Find the distance between $${pt3([...A])}$ and $${pt3([...B])}$.`,
        answer,
        steps,
        distractors,
        check: { kind: `${KIND}.space`, task: 'distance' },
      };
    }

    // midpoint / endpoint
    const endpoint = difficulty === 'hard' && rng.bool(0.5);
    const { A, B } = attempt('midpoint 3d', () => {
      const A = randPoint(rng, R, rng.pick([0, 0, 1]));
      const B = randPoint(rng, R, rng.pick([0, 0, 1]));
      if (A.every((a, i) => a === B[i])) return null;
      const odd = A.filter((a, i) => (a + B[i]!) % 2 !== 0).length;
      if (difficulty === 'easy' && odd > 0) return null;
      if (difficulty !== 'easy' && !endpoint && odd === 0 && rng.bool(0.7)) return null;
      if (endpoint && odd > 0) return null;
      return { A, B };
    });
    const M = A.map((a, i) => new Frac(a + B[i]!, 2));
    if (endpoint) {
      const answer = m(`B${pt3([...B])}`);
      const wrongMid = A.map((a, i) => new Frac(a + M[i]!.value * 1, 1).div(2));
      const distractors = distinctDistractors(
        answer,
        [m(`B${pt3(wrongMid)}`), m(`B${pt3(A.map((a, i) => M[i]!.value * 2 + a))}`), m(`B${pt3(A.map((a, i) => a - M[i]!.value))}`)],
        (k) => m(`B${pt3(B.map((b, i) => (i === (k - 1) % 3 ? b + offset(Math.ceil(k / 3)) : b)))}`),
      );
      return {
        question: `One endpoint of $\\overline{AB}$ is $A${pt3([...A])}$ and its midpoint is $M${pt3(M)}$. Find the other endpoint $B$.`,
        answer,
        steps: ['Each coordinate of $B$ is $2 \\cdot (\\text{midpoint}) - (\\text{endpoint})$.', ...['x', 'y', 'z'].map((v, i) => `$${v}_B = 2${paren(M[i]!)} - ${paren(A[i]!)} = ${B[i]}$`)],
        distractors,
        check: { kind: `${KIND}.space`, task: 'endpoint' },
      };
    }
    const answer = m(`M = ${pt3(M)}`);
    const halfDiff = A.map((a, i) => new Frac(B[i]! - a, 2));
    const distractors = distinctDistractors(
      answer,
      [m(`M = ${pt3(halfDiff)}`), m(`M = ${pt3(A.map((a, i) => a + B[i]!))}`), m(`M = ${pt3(halfDiff.map((h) => h.neg()))}`)],
      (k) => m(`M = ${pt3(M.map((c, i) => (i === (k - 1) % 3 ? c.add(offset(Math.ceil(k / 3))) : c)))}`),
    );
    return {
      question: `Find the midpoint of the segment joining $${pt3([...A])}$ and $${pt3([...B])}$.`,
      answer,
      steps: [
        '$M = \\left(\\frac{x_1 + x_2}{2}, \\frac{y_1 + y_2}{2}, \\frac{z_1 + z_2}{2}\\right)$',
        `$M = \\left(${A.map((a, i) => `\\frac{${a} + ${parenNeg(B[i]!)}}{2}`).join(', ')}\\right) = ${pt3(M)}$`,
      ],
      distractors,
      check: { kind: `${KIND}.space`, task: 'midpoint' },
    };
  },
});

