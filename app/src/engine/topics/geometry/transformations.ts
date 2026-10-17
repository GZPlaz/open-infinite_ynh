/** Transformations on the coordinate plane: translations, reflections, rotations, dilations. */
import { coordinatePlane, type Pt } from '../../diagram';
import { attempt, boolOpt, defineTopic, distinctDistractors } from '../../generator';
import type { Rng } from '../../rng';
import { m, sum } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';

export type Transform =
  | { k: 'translate'; h: number; v: number }
  | { k: 'reflect'; axis: 'x' | 'y' | 'y=x' | 'y=-x' }
  | { k: 'rotate'; deg: 90 | 180 | 270 }
  | { k: 'dilate'; s: number };

export function applyTransform(t: Transform, [x, y]: Pt): Pt {
  switch (t.k) {
    case 'translate':
      return [x + t.h, y + t.v];
    case 'reflect':
      return t.axis === 'x' ? [x, -y] : t.axis === 'y' ? [-x, y] : t.axis === 'y=x' ? [y, x] : [-y, -x];
    case 'rotate':
      return t.deg === 90 ? [-y, x] : t.deg === 180 ? [-x, -y] : [y, -x];
    case 'dilate':
      return [x * t.s, y * t.s];
  }
}

function describe(t: Transform): string {
  switch (t.k) {
    case 'translate': {
      const parts = [];
      if (t.h) parts.push(`${Math.abs(t.h)} unit${Math.abs(t.h) === 1 ? '' : 's'} ${t.h > 0 ? 'right' : 'left'}`);
      if (t.v) parts.push(`${Math.abs(t.v)} unit${Math.abs(t.v) === 1 ? '' : 's'} ${t.v > 0 ? 'up' : 'down'}`);
      return `translation: ${parts.join(' and ')}`;
    }
    case 'reflect':
      return t.axis === 'x' ? 'reflection across the x-axis' : t.axis === 'y' ? 'reflection across the y-axis' : `reflection across the line $${t.axis === 'y=x' ? 'y = x' : 'y = -x'}$`;
    case 'rotate':
      return t.deg === 180 ? 'rotation 180° about the origin' : `rotation 90° ${t.deg === 90 ? 'counterclockwise' : 'clockwise'} about the origin`;
    case 'dilate':
      return `dilation by a scale factor of ${t.s} centered at the origin`;
  }
}

function rule(t: Transform): string {
  const [x, y] = ['x', 'y'];
  switch (t.k) {
    case 'translate':
      return `(x, y) \\to (${sum([{ coef: 1, sym: x }, { coef: t.h }])}, ${sum([{ coef: 1, sym: y }, { coef: t.v }])})`;
    case 'reflect':
      return t.axis === 'x' ? '(x, y) \\to (x, -y)' : t.axis === 'y' ? '(x, y) \\to (-x, y)' : t.axis === 'y=x' ? '(x, y) \\to (y, x)' : '(x, y) \\to (-y, -x)';
    case 'rotate':
      return t.deg === 90 ? '(x, y) \\to (-y, x)' : t.deg === 180 ? '(x, y) \\to (-x, -y)' : '(x, y) \\to (y, -x)';
    case 'dilate':
      return `(x, y) \\to (${t.s}x, ${t.s}y)`;
  }
}

function randomTransform(rng: Rng, d: Difficulty): Transform {
  const pool: Transform['k'][] = d === 'easy' ? ['translate', 'reflect'] : ['rotate', 'reflect', 'dilate', 'translate'];
  const k = rng.pick(pool);
  switch (k) {
    case 'translate': {
      const h = rng.int(-6, 6);
      const v = rng.int(-6, 6);
      return h === 0 && v === 0 ? { k, h: 3, v: -2 } : { k, h, v };
    }
    case 'reflect':
      return { k, axis: rng.pick(d === 'easy' ? (['x', 'y'] as const) : (['x', 'y', 'y=x', 'y=-x'] as const)) };
    case 'rotate':
      return { k, deg: rng.pick([90, 180, 270] as const) };
    case 'dilate':
    default:
      return { k: 'dilate', s: rng.pick([2, 2, 3]) };
  }
}

const NAMES = [['A', 'B', 'C'], ['J', 'K', 'L'], ['P', 'Q', 'R'], ['X', 'Y', 'Z'], ['D', 'E', 'F']];

export const transformations = defineTopic({
  id: 'geo.transformations',
  subject: 'geometry',
  title: 'Transformations',
  description: 'Images of figures under translations, reflections, rotations and dilations.',
  instruction: (o) => (o.graph ? 'Find the coordinates of the image and graph it.' : 'Find the coordinates of the vertices of each image.'),
  multipleChoice: true,
  defaultCount: 6,
  options: [{ type: 'boolean', id: 'graph', label: 'Show the figure on a grid', default: true }],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const graph = boolOpt(ctx, 'graph');
    const names = rng.pick(NAMES);
    const built = attempt('transformations', () => {
      const ts = difficulty === 'hard' ? [randomTransform(rng, 'medium'), randomTransform(rng, 'medium')] : [randomTransform(rng, difficulty)];
      if (ts.length === 2 && ts[0]!.k === ts[1]!.k) return null;
      if (ts.some((t) => t.k === 'dilate') && ts.length > 1) return null;
      const lim = ts.some((t) => t.k === 'dilate') ? 3 : 7;
      const pre: Pt[] = Array.from({ length: 3 }, () => [rng.int(-lim, lim), rng.int(-lim, lim)] as Pt);
      // non-degenerate triangle
      const area2 = (pre[1]![0] - pre[0]![0]) * (pre[2]![1] - pre[0]![1]) - (pre[2]![0] - pre[0]![0]) * (pre[1]![1] - pre[0]![1]);
      if (Math.abs(area2) < 6) return null;
      const image = pre.map((p) => ts.reduce((q, t) => applyTransform(t, q), p));
      if (image.some(([x, y]) => Math.abs(x) > 9 || Math.abs(y) > 9)) return null;
      // the image should actually move
      if (image.every((p, i) => p[0] === pre[i]![0] && p[1] === pre[i]![1])) return null;
      return { ts, pre, image };
    });
    const { ts, pre, image } = built;
    const primes = (k: number) => "'".repeat(k);
    const coords = (pts: Pt[], k: number) => pts.map((p, i) => `${names[i]}${primes(k)}(${p[0]}, ${p[1]})`).join(',\\ ');
    const final = ts.length;
    const desc = ts.length === 1 ? describe(ts[0]!) : `${describe(ts[0]!)}, followed by a ${describe(ts[1]!)}`;
    const question = `${desc[0]!.toUpperCase()}${desc.slice(1)} of $${coords(pre, 0)}$.`;
    const answer = m(coords(image, final));
    const steps = [m(rule(ts[0]!))];
    if (ts.length === 2) {
      steps.push(m(coords(pre.map((p) => applyTransform(ts[0]!, p)), 1)));
      steps.push(m(rule(ts[1]!)));
    }
    steps.push(answer);

    const wrongTransform = (t: Transform): Transform =>
      t.k === 'rotate'
        ? { k: 'rotate', deg: t.deg === 90 ? 270 : t.deg === 270 ? 90 : 90 }
        : t.k === 'reflect'
          ? { k: 'reflect', axis: t.axis === 'x' ? 'y' : t.axis === 'y' ? 'x' : t.axis === 'y=x' ? 'y=-x' : 'y=x' }
          : t.k === 'translate'
            ? { k: 'translate', h: t.v, v: t.h }
            : { k: 'dilate', s: t.s + 1 };
    const via = (alt: Transform[]) => m(coords(pre.map((p) => alt.reduce((q, t) => applyTransform(t, q), p)), final));
    const distractors = distinctDistractors(
      answer,
      [via(ts.map(wrongTransform)), via([...ts].reverse().map((t) => (t.k === 'translate' ? { ...t, h: -t.h, v: -t.v } : t))), m(coords(image.map(([x, y]) => [y, x] as Pt), final))],
      (k) => m(coords(image.map(([x, y]) => [x + k, y] as Pt), final)),
    );

    let diagram;
    let answerDiagram;
    if (graph) {
      const plane = () => coordinatePlane({ range: 9, scale: 9, tickEvery: 0 });
      const drawFig = (b: ReturnType<typeof plane>, pts: Pt[], k: number, accent: boolean) => {
        b.polygon(pts, { ink: accent ? 'accent' : 'ink', weight: 1.4 });
        pts.forEach((p, i) => b.label(p, `${names[i]}${primes(k)}`, outward(pts, i), { ink: accent ? 'accent' : 'ink', small: true }));
      };
      const q = plane();
      drawFig(q, pre, 0, false);
      diagram = q.build('Pre-image triangle on a coordinate grid');
      const a = plane();
      drawFig(a, pre, 0, false);
      drawFig(a, image, final, true);
      answerDiagram = a.build('Pre-image and image triangles on a coordinate grid');
    }
    return {
      question,
      answer,
      steps,
      distractors,
      diagram,
      answerDiagram,
      check: { kind: 'transform', transforms: ts, pre, names },
    };
  },
});

/** Label position pointing away from the triangle's centroid. */
function outward(pts: Pt[], i: number): 'ne' | 'nw' | 'se' | 'sw' {
  const cx = (pts[0]![0] + pts[1]![0] + pts[2]![0]) / 3;
  const cy = (pts[0]![1] + pts[1]![1] + pts[2]![1]) / 3;
  const [x, y] = pts[i]!;
  return `${y >= cy ? 'n' : 's'}${x >= cx ? 'e' : 'w'}` as 'ne' | 'nw' | 'se' | 'sw';
}
