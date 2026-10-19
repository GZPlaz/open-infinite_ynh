/** Coordinate geometry: distance, midpoint, slope, missing endpoint. */
import { coordinatePlane, type Pt } from '../../diagram';
import { Frac } from '../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, opt, strOpt } from '../../generator';
import { isPerfectSquare, sqrtTex } from '../../radical';
import { decimal, m, num, paren, parenNeg, tuple } from '../../tex';
import type { ProblemContent } from '../../types';

type Task = 'distance' | 'midpoint' | 'slope' | 'endpoint';

const pt = (p: Pt) => tuple([p[0], p[1]]);

export const coordinateGeometry = defineTopic({
  id: 'geo.coordinate',
  subject: 'geometry',
  category: 'Basics of Geometry',
  title: 'Distance, Midpoint & Slope',
  description: 'Distance and midpoint formulas, slope between two points, missing endpoints.',
  instruction: (o) =>
    o.task === 'distance' || o.task === 'any'
      ? o.answerForm === 'exact'
        ? 'Find each measure. Leave distances in simplest radical form.'
        : 'Find each measure. Round distances to the nearest tenth.'
      : 'Find each measure.',
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Find',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'distance', label: 'Distance' },
        { value: 'midpoint', label: 'Midpoint' },
        { value: 'slope', label: 'Slope' },
      ],
    },
    opt.rounding('exact'),
    { type: 'boolean', id: 'graph', label: 'Plot the points on a grid', default: false },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const chosen = strOpt(ctx, 'task');
    const form = strOpt(ctx, 'answerForm');
    const graph = boolOpt(ctx, 'graph');
    let task: Task = chosen === 'any' ? rng.pick<Task>(['distance', 'midpoint', 'slope']) : (chosen as Task);
    if (task === 'midpoint' && difficulty === 'hard' && rng.bool(0.5)) task = 'endpoint';
    const R = graph ? 8 : difficulty === 'easy' ? 8 : difficulty === 'medium' ? 10 : 14;

    const { A, B } = attempt('coordinate', () => {
      const A: Pt = [rng.int(-R, R), rng.int(-R, R)];
      const B: Pt = [rng.int(-R, R), rng.int(-R, R)];
      const dx = B[0] - A[0];
      const dy = B[1] - A[1];
      if (dx === 0 && dy === 0) return null;
      if (task === 'distance' && difficulty === 'easy' && !isPerfectSquare(dx * dx + dy * dy)) return null;
      if (task === 'distance' && difficulty !== 'easy' && (dx === 0 || dy === 0)) return null;
      if (task === 'midpoint' && difficulty === 'easy' && ((A[0] + B[0]) % 2 !== 0 || (A[1] + B[1]) % 2 !== 0)) return null;
      if (task === 'slope' && dx === 0 && (difficulty !== 'hard' || rng.bool(0.7))) return null;
      if (task === 'slope' && dy === 0 && rng.bool(0.8)) return null;
      if (task === 'endpoint') {
        const E: Pt = [2 * B[0] - A[0], 2 * B[1] - A[1]];
        if (Math.abs(E[0]) > 20 || Math.abs(E[1]) > 20) return null;
      }
      return { A, B };
    });
    const dx = B[0] - A[0];
    const dy = B[1] - A[1];
    const steps: string[] = [];
    let question: string;
    let answer: string;
    let wrongs: string[];

    switch (task) {
      case 'distance': {
        const d2 = dx * dx + dy * dy;
        const d = Math.sqrt(d2);
        const exact = sqrtTex(d2);
        const shown = (v: number, sq: number) =>
          form === 'exact' || isPerfectSquare(sq) ? sqrtTex(sq) : `\\approx ${decimal(v)}`;
        const fmt = (v: number, sq: number) => m(`d ${shown(v, sq).startsWith('\\approx') ? '' : '= '}${shown(v, sq)}`);
        question = `Find the distance between $${pt(A)}$ and $${pt(B)}$.`;
        steps.push(m(`d = \\sqrt{(${B[0]} - ${parenNeg(A[0])})^{2} + (${B[1]} - ${parenNeg(A[1])})^{2}}`));
        steps.push(m(`d = \\sqrt{${paren(dx)}^{2} + ${paren(dy)}^{2}} = \\sqrt{${d2}}${exact !== `\\sqrt{${d2}}` ? ` = ${exact}` : ''}${!isPerfectSquare(d2) ? ` \\approx ${decimal(d)}` : ''}`));
        answer = fmt(d, d2);
        const s1 = (Math.abs(dx) + Math.abs(dy)) ** 2;
        const s2 = Math.abs(dx * dx - dy * dy) || 2;
        const s3 = (B[0] + A[0]) ** 2 + (B[1] + A[1]) ** 2 || 3;
        wrongs = [fmt(Math.sqrt(s1), s1), fmt(Math.sqrt(s2), s2), fmt(Math.sqrt(s3), s3)];
        break;
      }
      case 'midpoint': {
        const M = [new Frac(A[0] + B[0], 2), new Frac(A[1] + B[1], 2)];
        question = `Find the midpoint of the segment with endpoints $${pt(A)}$ and $${pt(B)}$.`;
        steps.push(m(`M = \\left(\\frac{${A[0]} + ${parenNeg(B[0])}}{2}, \\frac{${A[1]} + ${parenNeg(B[1])}}{2}\\right)`));
        answer = m(tuple(M));
        wrongs = [
          m(tuple([new Frac(B[0] - A[0], 2), new Frac(B[1] - A[1], 2)])),
          m(tuple([A[0] + B[0], A[1] + B[1]])),
          m(tuple([M[1]!, M[0]!])),
        ];
        break;
      }
      case 'endpoint': {
        // A is one endpoint, B the midpoint
        const E: Pt = [2 * B[0] - A[0], 2 * B[1] - A[1]];
        question = `One endpoint of a segment is $${pt(A)}$ and its midpoint is $${pt(B)}$. Find the other endpoint.`;
        steps.push(m(`x = 2${paren(B[0])} - ${parenNeg(A[0])} = ${E[0]},\\ y = 2${paren(B[1])} - ${parenNeg(A[1])} = ${E[1]}`));
        answer = m(pt(E));
        wrongs = [
          m(tuple([new Frac(A[0] + B[0], 2), new Frac(A[1] + B[1], 2)])),
          m(pt([2 * A[0] - B[0], 2 * A[1] - B[1]])),
          m(pt([E[1], E[0]])),
        ];
        break;
      }
      case 'slope':
      default: {
        question = `Find the slope of the line through $${pt(A)}$ and $${pt(B)}$.`;
        if (dx === 0) {
          steps.push(m(`m = \\frac{${dy}}{0}`));
          answer = 'Undefined';
          wrongs = [m('m = 0'), m(`m = ${dy}`), m(`m = ${-dy}`)];
        } else {
          const s = new Frac(dy, dx);
          steps.push(m(`m = \\frac{${B[1]} - ${parenNeg(A[1])}}{${B[0]} - ${parenNeg(A[0])}} = \\frac{${dy}}{${dx}}${s.n !== dy || s.d !== dx ? ` = ${num(s)}` : ''}`));
          answer = m(`m = ${num(s)}`);
          wrongs = [m(`m = ${num(dy === 0 ? new Frac(1) : s.inv())}`), m(`m = ${num(s.neg())}`), dy === 0 ? 'Undefined' : m(`m = ${num(s.inv().neg())}`)];
        }
        break;
      }
    }

    let diagram;
    if (graph && task !== 'endpoint') {
      const plane = coordinatePlane({ range: 9, scale: 9, tickEvery: 0 });
      plane.dot(A, false);
      plane.dot(B, false);
      plane.label(A, pt(A), 'ne', { small: true });
      plane.label(B, pt(B), 'ne', { small: true });
      diagram = plane.build(`Points ${A.join(', ')} and ${B.join(', ')} on a coordinate grid`);
    }
    const fallback = (k: number) => m(task === 'slope' ? `m = ${k + 1}` : pt([A[0] + k, B[1] - k]));
    return {
      question,
      answer,
      steps,
      distractors: distinctDistractors(answer, wrongs, fallback),
      diagram,
      check: { kind: 'coord', task, A, B, form },
    };
  },
});
