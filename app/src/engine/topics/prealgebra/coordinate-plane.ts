/** The coordinate plane: naming coordinates of plotted points, quadrants, plotting points. */
import { coordinatePlane, type Diagram, type Pt } from '../../diagram';
import { attempt, defineTopic, distinctDistractors, strOpt } from '../../generator';
import type { Rng } from '../../rng';
import { m } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import { CAT } from './common';

const LETTER_SETS = ['ABCDE', 'JKLMN', 'PQRST', 'UVWXY', 'FGHJK', 'DEFGH'];

function pickPoints(rng: Rng, d: Difficulty): { pts: Pt[]; names: string[]; R: number } {
  const R = d === 'easy' ? 5 : d === 'medium' ? 6 : 8;
  const count = d === 'easy' ? 3 : d === 'medium' ? 4 : 5;
  const names = [...rng.pick(LETTER_SETS)].slice(0, count);
  const pts = attempt('plane-points', () => {
    const pts: Pt[] = [];
    for (let i = 0; i < count; i++) {
      const onAxis = d !== 'easy' && rng.bool(0.2);
      const x = onAxis && rng.bool() ? 0 : rng.signedInt(1, R, true);
      const y = onAxis && x !== 0 ? 0 : rng.signedInt(1, R, true);
      if (pts.some((p) => p[0] === x && p[1] === y)) return null;
      pts.push([x + 0, y + 0]);
    }
    // the swapped-coordinates distractor must differ
    if (pts.every((p) => p[0] === p[1])) return null;
    return pts;
  });
  return { pts, names, R };
}

function figure(R: number, pts: Pt[], names: string[], withPoints: boolean, alt: string): Diagram {
  const b = coordinatePlane({ range: R, scale: R <= 6 ? 20 : 16, tickEvery: R <= 6 ? 1 : 2 });
  if (withPoints) {
    pts.forEach((p, i) => {
      b.dot(p, false, 'accent');
      b.label(p, names[i]!, 'ne', { ink: 'accent' });
    });
  }
  return b.build(alt);
}

const pair = (p: Pt) => `(${p[0]}, ${p[1]})`;
const listAnswer = (pts: Pt[], names: string[]) => pts.map((p, i) => m(`${names[i]}${pair(p)}`)).join(', ');

function location(p: Pt): string {
  const [x, y] = p;
  if (x === 0 && y === 0) return 'The origin';
  if (x === 0) return 'On the $y$-axis';
  if (y === 0) return 'On the $x$-axis';
  return `Quadrant ${x > 0 ? (y > 0 ? 'I' : 'IV') : y > 0 ? 'II' : 'III'}`;
}

export const coordinatePlanePoints = defineTopic({
  id: 'prealg.coordinate-plane',
  subject: 'prealgebra',
  category: CAT.graphing,
  title: 'Points in the Coordinate Plane',
  description: 'State the coordinates of plotted points and name the quadrant (or axis) where a point lies.',
  instruction: (o) =>
    o.task === 'name' ? 'State the coordinates of each point.' : o.task === 'quadrant' ? 'Name the quadrant or axis on which each point lies.' : 'Answer each question about the coordinate plane.',
  multipleChoice: true,
  defaultCount: 6,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Problems',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'Mixed' },
        { value: 'name', label: 'Coordinates of plotted points' },
        { value: 'quadrant', label: 'Quadrant of a point' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const t = strOpt(ctx, 'task');
    const task = t === 'mixed' ? rng.pick(['name', 'quadrant'] as const) : (t as 'name' | 'quadrant');
    if (task === 'quadrant') {
      const R = difficulty === 'easy' ? 9 : 20;
      const p = attempt('quadrant', () => {
        const axis = difficulty !== 'easy' && rng.bool(0.25);
        const x = axis && rng.bool() ? 0 : rng.signedInt(1, R, true);
        const y = axis && x !== 0 ? 0 : rng.signedInt(1, R, true);
        return [x + 0, y + 0] as Pt;
      });
      const answer = location(p);
      const options = ['Quadrant I', 'Quadrant II', 'Quadrant III', 'Quadrant IV', 'On the $x$-axis', 'On the $y$-axis'];
      const swapped = location([p[1], p[0]]);
      const negX = location([-p[0], p[1]]);
      const distractors = distinctDistractors(answer, [swapped, negX, location([-p[0], -p[1]]), ...options], () => null);
      return {
        question: t === 'mixed' ? `Where does the point $${pair(p)}$ lie?` : m(pair(p)),
        answer,
        steps: [p[0] === 0 || p[1] === 0 ? 'A coordinate of $0$ puts the point on an axis.' : `$x$ is ${p[0] > 0 ? 'positive' : 'negative'} and $y$ is ${p[1] > 0 ? 'positive' : 'negative'}.`],
        distractors,
        check: { kind: 'prealgebra.plane', task: 'quadrant' },
      };
    }
    const { pts, names, R } = pickPoints(rng, difficulty);
    const answer = listAnswer(pts, names);
    const flipOne = pts.map((p, i) => (i === 0 ? ([p[0], -p[1]] as Pt) : p));
    const swapOne = pts.map((p, i) => (i === pts.length - 1 ? ([p[1], p[0]] as Pt) : p));
    const distractors = distinctDistractors(
      answer,
      [listAnswer(pts.map((p) => [p[1], p[0]] as Pt), names), listAnswer(flipOne, names), listAnswer(swapOne, names), listAnswer(pts.map((p) => [-p[0], p[1]] as Pt), names)],
      (k) => listAnswer(pts.map((p, i) => (i === k % pts.length ? ([p[0] + 1, p[1]] as Pt) : p)), names),
    );
    return {
      question: `State the coordinates of ${names.slice(0, -1).map((n) => `$${n}$`).join(', ')} and $${names.at(-1)}$.`,
      answer,
      steps: ['Read across the $x$-axis first, then up or down the $y$-axis.'],
      distractors,
      diagram: figure(R, pts, names, true, `Coordinate plane with points ${names.join(', ')}`),
      check: { kind: 'prealgebra.plane', task: 'name' },
    };
  },
});

export const plottingPoints = defineTopic({
  id: 'prealg.plotting-points',
  subject: 'prealgebra',
  category: CAT.graphing,
  title: 'Plotting Points',
  description: 'Plot and label ordered pairs in the coordinate plane.',
  instruction: 'Plot and label each point.',
  multipleChoice: false,
  defaultCount: 4,
  options: [],
  generate(ctx): ProblemContent {
    const { pts, names, R } = pickPoints(ctx.rng, ctx.difficulty);
    return {
      question: listAnswer(pts, names),
      answer: listAnswer(pts, names),
      steps: pts.map((p, i) => `$${names[i]}$: move ${Math.abs(p[0])} ${p[0] < 0 ? 'left' : 'right'}, then ${Math.abs(p[1])} ${p[1] < 0 ? 'down' : 'up'}.`),
      diagram: figure(R, pts, names, false, 'Blank coordinate plane'),
      answerDiagram: figure(R, pts, names, true, `Coordinate plane with points ${names.join(', ')} plotted`),
      check: { kind: 'prealgebra.plot' },
    };
  },
});
