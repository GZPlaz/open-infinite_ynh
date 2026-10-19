/** Right triangle trigonometry: variants of the geometry generator plus solving whole right triangles. */
import { attempt, defineTopic, distinctDistractors, strOpt, variant } from '../../generator';
import { decimal, m } from '../../tex';
import type { ProblemContent } from '../../types';
import { trigRatios } from '../geometry/trig-ratios';
import { triangleFigure, type Tri } from './figures';
import { givenTex, listTex, type Part } from './triangle';

const CATEGORY = 'Right Triangle Trigonometry';

export const rightTrigRatios = variant(trigRatios, {
  id: 'trig.right.ratios',
  title: 'Right Triangle Trig: Finding Ratios',
  subject: 'trigonometry',
  category: CATEGORY,
  description: 'Write sine, cosine and tangent ratios from the sides of a right triangle.',
  fixed: { task: 'ratio' },
});

export const rightTrigAngles = variant(trigRatios, {
  id: 'trig.right.angles',
  title: 'Right Triangle Trig: Finding Angle Measures',
  subject: 'trigonometry',
  category: CATEGORY,
  description: 'Use inverse sine, cosine and tangent to find acute angles of right triangles.',
  fixed: { task: 'angle' },
});

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

function fromAngleSide(A: number, role: 'a' | 'b' | 'c', len: number): Tri {
  const c = role === 'c' ? len : role === 'a' ? len / Math.sin(rad(A)) : len / Math.cos(rad(A));
  return { A, B: 90 - A, C: 90, a: c * Math.sin(rad(A)), b: c * Math.cos(rad(A)), c };
}

function fromLegs(a: number, b: number): Tri {
  const A = deg(Math.atan2(a, b));
  return { A, B: 90 - A, C: 90, a, b, c: Math.hypot(a, b) };
}

const swapLegs = (t: Tri): Tri => ({ A: t.B, B: t.A, C: 90, a: t.b, b: t.a, c: t.c });

export const solveRightTriangles = defineTopic({
  id: 'trig.right.solve',
  subject: 'trigonometry',
  title: 'Right Triangle Trig: Finding Angles and Sides',
  description: 'Find missing sides and angles of right triangles, or solve the whole triangle.',
  category: CATEGORY,
  instruction: (o) =>
    o.task === 'side'
      ? 'Find the missing side. Round to the nearest tenth.'
      : o.task === 'angle'
        ? 'Find the measure of each indicated angle. Round to the nearest tenth of a degree.'
        : o.task === 'solve'
          ? 'Solve each triangle. Round answers to the nearest tenth.'
          : 'Find the missing sides and angles as indicated. Round answers to the nearest tenth.',
  multipleChoice: true,
  defaultCount: 8,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Find',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'side', label: 'One missing side' },
        { value: 'angle', label: 'One missing angle' },
        { value: 'solve', label: 'Solve the whole triangle' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const t = strOpt(ctx, 'task');
    const task = t === 'side' || t === 'angle' || t === 'solve' ? t : rng.pick(['side', 'angle', 'solve', 'solve'] as const);
    if (task !== 'solve') return trigRatios.generate({ ...ctx, options: { task } });

    const mode = difficulty === 'easy' ? 'AS' : rng.pick(['AS', 'SS'] as const);
    const maxLen = { easy: 20, medium: 30, hard: 60 }[difficulty];
    const dec = difficulty === 'hard';
    const len = () => (dec && rng.bool() ? rng.int(40, maxLen * 10) / 10 : rng.int(4, maxLen));

    let tri: Tri;
    let given: Part[];
    let wrong: Tri[];
    if (mode === 'AS') {
      const atA = rng.bool();
      const angle = dec && rng.bool() ? rng.int(150, 750) / 10 : rng.int(15, 75);
      const role = rng.pick(['a', 'b', 'c'] as const);
      const L = len();
      // build from the angle at A; if the angle is given at B, mirror
      const base = fromAngleSide(atA ? angle : 90 - angle, role, L);
      tri = { ...base, [role]: L, ...(atA ? { A: angle } : { B: angle, A: 90 - angle }) };
      given = [atA ? 'A' : 'B', role];
      const otherRole = role === 'c' ? 'a' : 'c';
      wrong = [
        fromAngleSide(atA ? 90 - angle : angle, role, L), // angle placed at the wrong vertex
        fromAngleSide(atA ? angle : 90 - angle, otherRole, L), // side given the wrong role
        swapLegs(base),
      ];
    } else {
      const pair = rng.pick([['a', 'b'], ['a', 'c'], ['b', 'c']] as const);
      tri = attempt('right-ss', () => {
        const u = len();
        const v = len();
        if (pair[1] === 'c') {
          if (v <= u * 1.15) return null;
          const leg = Math.sqrt(v * v - u * u);
          return { ...(pair[0] === 'a' ? fromLegs(u, leg) : fromLegs(leg, u)), [pair[0]]: u, c: v };
        }
        if (u === v) return null;
        return fromLegs(u, v);
      });
      given = [...pair];
      const g0 = tri[pair[0]];
      const g1 = tri[pair[1]];
      wrong = [
        swapLegs(tri),
        pair[1] === 'c' ? (pair[0] === 'a' ? fromLegs(g0, g1) : fromLegs(g1, g0)) : g0 > g1 ? fromLegs(Math.sqrt(g0 * g0 - g1 * g1), g1) : fromLegs(g0, Math.sqrt(g1 * g1 - g0 * g0)),
        { ...tri, c: tri.a + tri.b, A: tri.B, B: tri.A },
      ];
    }
    const unknown = (['A', 'B', 'a', 'b', 'c'] as Part[]).filter((p) => !given.includes(p));
    const fmt = (x: Tri) => listTex(x, unknown).map(m).join(', ');
    const answer = fmt(tri);
    const qGiven = [givenTex('C', 90), ...given.map((p) => givenTex(p, tri[p]))];
    const steps: string[] = [];
    if (mode === 'AS') {
      const ang = given[0] as 'A' | 'B';
      const other = ang === 'A' ? 'B' : 'A';
      steps.push(m(`m\\angle ${other} = 90^\\circ - ${tri[ang]}^\\circ = ${decimal(tri[other])}^\\circ`));
      const L = tri[given[1]!];
      const opp = ang === 'A' ? 'a' : 'b';
      const adj = ang === 'A' ? 'b' : 'a';
      const T = `${tri[ang]}^\\circ`;
      if (given[1] === 'c') {
        steps.push(m(`${opp} = ${L}\\sin ${T} \\approx ${decimal(tri[opp])}`), m(`${adj} = ${L}\\cos ${T} \\approx ${decimal(tri[adj])}`));
      } else if (given[1] === opp) {
        steps.push(m(`${adj} = \\frac{${L}}{\\tan ${T}} \\approx ${decimal(tri[adj])}`), m(`c = \\frac{${L}}{\\sin ${T}} \\approx ${decimal(tri.c)}`));
      } else {
        steps.push(m(`${opp} = ${L}\\tan ${T} \\approx ${decimal(tri[opp])}`), m(`c = \\frac{${L}}{\\cos ${T}} \\approx ${decimal(tri.c)}`));
      }
    } else {
      const third = unknown.find((p) => p === 'a' || p === 'b' || p === 'c')!;
      const [p0, p1] = given as [Part, Part];
      steps.push(
        third === 'c'
          ? m(`c = \\sqrt{${tri.a}^{2} + ${tri.b}^{2}} \\approx ${decimal(tri.c)}`)
          : m(`${third} = \\sqrt{${tri.c}^{2} - ${tri[p0 === 'c' ? p1 : p0]}^{2}} \\approx ${decimal(tri[third])}`),
      );
      const fn = third === 'c' ? 'tan' : third === 'b' ? 'sin' : 'cos';
      const ratio = fn === 'tan' ? `\\frac{${tri.a}}{${tri.b}}` : fn === 'sin' ? `\\frac{${tri.a}}{${tri.c}}` : `\\frac{${tri.b}}{${tri.c}}`;
      steps.push(m(`m\\angle A = \\${fn}^{-1}\\left(${ratio}\\right) \\approx ${decimal(tri.A)}^\\circ`), m(`m\\angle B = 90^\\circ - m\\angle A \\approx ${decimal(tri.B)}^\\circ`));
    }
    const scaled = (k: number): Tri => ({ ...tri, a: tri.a * (1 + 0.08 * k), b: tri.b * (1 + 0.08 * k), c: tri.c * (1 + 0.08 * k), A: tri.A + k, B: tri.B - k });
    const labels: [string, string, string] = [
      given.includes('a') ? String(tri.a) : 'a',
      given.includes('b') ? String(tri.b) : 'b',
      given.includes('c') ? String(tri.c) : 'c',
    ];
    return {
      question: qGiven.map(m).join(', '),
      answer,
      steps,
      distractors: distinctDistractors(answer, wrong.map(fmt), (k) => fmt(scaled(k))),
      diagram: triangleFigure(
        rng,
        tri,
        { names: ['A', 'B', 'C'], sides: labels, angles: [given.includes('A') ? `${tri.A}^\\circ` : '', given.includes('B') ? `${tri.B}^\\circ` : '', ''] },
        'Right triangle ABC with the right angle at C',
      ),
      check: { kind: 'trigonometry.triangle' },
    };
  },
});
