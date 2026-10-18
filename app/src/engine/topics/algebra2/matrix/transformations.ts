/** Geometric transformations with matrices: translate, reflect, rotate and dilate a vertex matrix. */
import { graphPlane, type DiagramBuilder, type Pt } from '../../../diagram';
import { Frac } from '../../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, strOpt } from '../../../generator';
import type { Rng } from '../../../rng';
import { m, num } from '../../../tex';
import type { Difficulty, ProblemContent } from '../../../types';
import { KIND } from '../smc-common';
import { addM, eqM, mat, matTex, mulM, scaleM, type Matrix } from './common';

export type MTransform =
  | { k: 'translate'; h: number; v: number }
  | { k: 'reflect'; axis: 'x' | 'y' | 'y=x' | 'y=-x' }
  | { k: 'rotate'; deg: 90 | 180 | 270 }
  | { k: 'dilate'; s: number; den: number };

const REFLECT: Record<string, number[][]> = {
  x: [[1, 0], [0, -1]],
  y: [[-1, 0], [0, 1]],
  'y=x': [[0, 1], [1, 0]],
  'y=-x': [[0, -1], [-1, 0]],
};
const ROTATE: Record<number, number[][]> = {
  90: [[0, -1], [1, 0]],
  180: [[-1, 0], [0, -1]],
  270: [[0, 1], [-1, 0]],
};

/** The matrix operation, as a TeX expression in the vertex matrix `V` (already typeset). */
function apply(t: MTransform, V: Matrix): { result: Matrix; tex: string } {
  const n = V[0]!.length;
  switch (t.k) {
    case 'translate': {
      const T = mat([Array(n).fill(t.h), Array(n).fill(t.v)]);
      return { result: addM(V, T), tex: `${matTex(T)} + ${matTex(V)}` };
    }
    case 'reflect':
    case 'rotate': {
      const M = mat(t.k === 'reflect' ? REFLECT[t.axis]! : ROTATE[t.deg]!);
      return { result: mulM(M, V), tex: `${matTex(M)}${matTex(V)}` };
    }
    case 'dilate':
    default: {
      const s = new Frac(t.s, t.den);
      return { result: V.map((r) => r.map((x) => x.mul(s))), tex: `${num(s)}${matTex(V)}` };
    }
  }
}

const units = (n: number) => `${Math.abs(n)} unit${Math.abs(n) === 1 ? '' : 's'}`;

export function describeT(t: MTransform): string {
  switch (t.k) {
    case 'translate': {
      const parts: string[] = [];
      if (t.h) parts.push(`${units(t.h)} ${t.h > 0 ? 'right' : 'left'}`);
      if (t.v) parts.push(`${units(t.v)} ${t.v > 0 ? 'up' : 'down'}`);
      return `a translation ${parts.join(' and ')}`;
    }
    case 'reflect':
      return t.axis === 'x' ? 'a reflection across the $x$-axis' : t.axis === 'y' ? 'a reflection across the $y$-axis' : `a reflection across the line $${t.axis === 'y=x' ? 'y = x' : 'y = -x'}$`;
    case 'rotate':
      return `a rotation of $${t.deg}^\\circ$ counterclockwise about the origin`;
    case 'dilate':
    default:
      return `a dilation by a scale factor of $${num(new Frac(t.s, t.den))}$ centered at the origin`;
  }
}

function randomT(rng: Rng, kind: string): MTransform {
  switch (kind) {
    case 'translate': {
      const h = rng.int(-5, 5);
      const v = rng.int(-5, 5);
      return h === 0 && v === 0 ? { k: 'translate', h: -3, v: 2 } : { k: 'translate', h, v };
    }
    case 'reflect':
      return { k: 'reflect', axis: rng.pick(['x', 'y', 'y=x', 'y=-x'] as const) };
    case 'rotate':
      return { k: 'rotate', deg: rng.pick([90, 180, 270] as const) };
    case 'dilate':
    default:
      return rng.bool(0.3) ? { k: 'dilate', s: 1, den: 2 } : { k: 'dilate', s: rng.pick([2, 3]), den: 1 };
  }
}

/** A plausible slip for each transformation. */
function confuse(t: MTransform): MTransform {
  switch (t.k) {
    case 'translate':
      return t.h === t.v ? { k: 'translate', h: -t.h, v: t.v } : { k: 'translate', h: t.v, v: t.h };
    case 'reflect':
      return { k: 'reflect', axis: t.axis === 'x' ? 'y' : t.axis === 'y' ? 'x' : t.axis === 'y=x' ? 'y=-x' : 'y=x' };
    case 'rotate':
      return { k: 'rotate', deg: t.deg === 90 ? 270 : t.deg === 270 ? 90 : 90 };
    case 'dilate':
    default:
      return t.den === 2 ? { k: 'dilate', s: 2, den: 1 } : { k: 'dilate', s: 1, den: t.s };
  }
}

const POOLS: Record<Difficulty, string[]> = {
  easy: ['translate', 'dilate', 'reflect'],
  medium: ['reflect', 'rotate', 'translate', 'dilate'],
  hard: ['reflect', 'rotate', 'translate', 'dilate'],
};

const NAMES3 = ['ABC', 'PQR', 'JKL', 'XYZ', 'DEF'];
const NAMES4 = ['ABCD', 'PQRS', 'JKLM', 'WXYZ', 'EFGH'];

export const matrixTransformations = defineTopic({
  id: 'alg2.matrix.transformations',
  subject: 'algebra2',
  title: 'Geometric Transformations with Matrices',
  description: 'Use matrix addition and multiplication to translate, reflect, rotate and dilate polygons.',
  category: 'Matrices',
  instruction: 'Use matrices to find the vertex matrix of each image.',
  multipleChoice: true,
  defaultCount: 6,
  options: [
    {
      type: 'select',
      id: 'transform',
      label: 'Transformation',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed (compositions at hard)' },
        { value: 'translate', label: 'Translations' },
        { value: 'reflect', label: 'Reflections' },
        { value: 'rotate', label: 'Rotations' },
        { value: 'dilate', label: 'Dilations' },
      ],
    },
    { type: 'boolean', id: 'graph', label: 'Show the figure on a grid', default: false },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const chosen = strOpt(ctx, 'transform');
    const graph = boolOpt(ctx, 'graph');
    const sides = difficulty === 'easy' ? 3 : rng.pick([3, 4]);
    const names = rng.pick(sides === 3 ? NAMES3 : NAMES4).split('');
    const built = attempt('matrix transformations', () => {
      const kinds = chosen === 'any' ? (difficulty === 'hard' ? rng.sample(POOLS.hard, 2) : [rng.pick(POOLS[difficulty])]) : difficulty === 'hard' && rng.bool(0.4) ? [chosen, rng.pick(['translate', 'reflect', 'rotate'].filter((k) => k !== chosen))] : [chosen];
      const ts = kinds.map((k) => randomT(rng, k));
      if (difficulty === 'easy' && ts[0]!.k === 'reflect' && !['x', 'y'].includes(ts[0]!.axis)) return null;
      const lim = ts.some((t) => t.k === 'dilate' && t.s > 1) ? 3 : 6;
      const half = ts.some((t) => t.k === 'dilate' && t.den === 2);
      const pts: Pt[] = Array.from({ length: sides }, () => (half ? [2 * rng.int(-4, 4), 2 * rng.int(-4, 4)] : [rng.int(-lim, lim), rng.int(-lim, lim)]) as Pt);
      if (!convexPolygon(pts)) return null;
      const V = mat([pts.map((p) => p[0]), pts.map((p) => p[1])]);
      let cur = V;
      const stepsT: string[] = [];
      for (const t of ts) {
        const r = apply(t, cur);
        stepsT.push(`$${r.tex} = ${matTex(r.result)}$`);
        cur = r.result;
      }
      if (cur.flat().some((x) => Math.abs(x.value) > 10)) return null;
      if (eqM(cur, V)) return null;
      return { ts, V, image: cur, stepsT, pts };
    });
    const { ts, V, image, stepsT, pts } = built;
    const shape = sides === 3 ? '\\triangle ' : '\\text{quadrilateral }';
    const name = names.join('');
    const desc = ts.map(describeT).join(', followed by ');
    const question = `$${shape}${name}$ has vertex matrix $${matTex(V)}$ (columns $${names.join(', ')}$). Find the vertex matrix of its image after ${desc}.`;
    const answer = m(matTex(image));
    const kindNote = (t: MTransform) =>
      t.k === 'translate' ? 'Add the translation matrix.' : t.k === 'dilate' ? 'Multiply every entry by the scale factor.' : `Multiply on the left by the ${t.k === 'reflect' ? 'reflection' : 'rotation'} matrix.`;
    const steps: string[] = [];
    ts.forEach((t, i) => {
      steps.push(kindNote(t));
      steps.push(stepsT[i]!);
    });
    const coords = image[0]!.map((x, j) => `${names[j]}${"'".repeat(ts.length)}(${num(x)}, ${num(image[1]![j]!)})`).join(',\\ ');
    steps.push(`Image vertices: $${coords}$`);

    const via = (alt: MTransform[]) => alt.reduce((cur, t) => apply(t, cur).result, V);
    const candidates = [
      via(ts.map((t, i) => (i === 0 ? confuse(t) : t))),
      via([...ts].reverse()),
      [image[1]!, image[0]!],
      ts.length > 1 ? via(ts.map((t, i) => (i === 1 ? confuse(t) : t))) : scaleM(image, -1),
    ];
    const distractors = distinctDistractors(
      answer,
      candidates.filter((c) => !eqM(c, image)).map((c) => m(matTex(c))),
      (k) => m(matTex(image.map((r, i) => r.map((x, j) => (j === (k - 1) % r.length && i === (k % 2) ? x.add(Math.ceil(k / r.length)) : x))))),
    );

    let diagram;
    let answerDiagram;
    if (graph) {
      const draw = (b: DiagramBuilder, P: Pt[], primes: number, accent: boolean) => {
        b.polygon(P, { ink: accent ? 'accent' : 'ink', weight: 1.4 });
        const cx = P.reduce((s, p) => s + p[0], 0) / P.length;
        const cy = P.reduce((s, p) => s + p[1], 0) / P.length;
        P.forEach((p, i) => b.label(p, `${names[i]}${"'".repeat(primes)}`, `${p[1] >= cy ? 'n' : 's'}${p[0] >= cx ? 'e' : 'w'}` as 'ne', { ink: accent ? 'accent' : 'ink', small: true }));
      };
      const q = graphPlane(10, 2, 9).b;
      draw(q, pts, 0, false);
      diagram = q.build(`Polygon ${name} on a coordinate grid`);
      const a = graphPlane(10, 2, 9).b;
      draw(a, pts, 0, false);
      draw(a, image[0]!.map((x, j) => [x.value, image[1]![j]!.value] as Pt), ts.length, true);
      answerDiagram = a.build(`Polygon ${name} and its image on a coordinate grid`);
    }
    return { question, answer, steps, distractors, diagram, answerDiagram, check: { kind: `${KIND}.transform`, transforms: ts } };
  },
});

/** Vertices in order form a convex polygon with a reasonable area (no repeated or collinear points). */
function convexPolygon(P: Pt[]): boolean {
  const n = P.length;
  let sign = 0;
  for (let i = 0; i < n; i++) {
    const a = P[i]!;
    const b = P[(i + 1) % n]!;
    const c = P[(i + 2) % n]!;
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (cross === 0) return false;
    if (sign === 0) sign = Math.sign(cross);
    else if (Math.sign(cross) !== sign) return false;
  }
  let area2 = 0;
  for (let i = 0; i < n; i++) area2 += P[i]![0] * P[(i + 1) % n]![1] - P[(i + 1) % n]![0] * P[i]![1];
  return Math.abs(area2) >= 8;
}
