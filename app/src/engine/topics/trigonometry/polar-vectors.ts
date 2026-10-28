/**
 * Polar coordinates, complex numbers in trigonometric form, and vectors: the
 * precalculus generators reused as trigonometry topics, plus vector magnitude
 * and direction angle.
 */
import { attempt, defineTopic, distinctDistractors, offset, strOpt, variant } from '../../generator';
import { isPerfectSquare, sqrtTex } from '../../radical';
import { decimal, m, roundTo } from '../../tex';
import type { ProblemContent } from '../../types';
import { complexTrigForm } from '../precalculus/complex-trig';
import { dotProduct } from '../precalculus/dot-product';
import { polarEquations } from '../precalculus/polar-equations';
import { polarGraphs } from '../precalculus/polar-graphs';
import { polarPoints } from '../precalculus/polar-points';
import { Exact, cosExact, sinExact } from './exact';

const CATEGORY = 'Polar Coordinates, Complex Numbers and Vectors';

export const trigPolarPoints = variant(polarPoints, { id: 'trig.polar.points', title: 'Polar Coordinates', subject: 'trigonometry', category: CATEGORY, fixed: {} });
export const trigPolarEquations = variant(polarEquations, { id: 'trig.polar.equations', title: 'Converting Polar and Rectangular Equations', subject: 'trigonometry', category: CATEGORY, fixed: {} });
export const trigPolarGraphs = variant(polarGraphs, { id: 'trig.polar.graph', title: 'Graphing Polar Equations', subject: 'trigonometry', category: CATEGORY, fixed: {} });
export const trigComplexForm = variant(complexTrigForm, { id: 'trig.complex.trig-form', title: 'Trigonometric Form of Complex Numbers', subject: 'trigonometry', category: CATEGORY, fixed: {} });
export const trigDotProduct = variant(dotProduct, { id: 'trig.vectors.dot-product', title: 'Dot Product and Angle Between Vectors', subject: 'trigonometry', category: CATEGORY, fixed: {} });

const vecTex = (a: string, b: string) => `\\left\\langle ${a}, ${b} \\right\\rangle`;
const NORM = '\\|\\mathbf{v}\\|';

/** Direction angle in [0°, 360°). */
const direction = (x: number, y: number) => {
  const d = (Math.atan2(y, x) * 180) / Math.PI;
  return d < 0 ? d + 360 : d;
};

export const vectorMagnitudeDirection = defineTopic({
  id: 'trig.vectors.magnitude-direction',
  subject: 'trigonometry',
  title: 'Vectors: Magnitude and Direction Angle',
  description: 'Find the magnitude and direction angle of a vector, or its components from magnitude and direction.',
  category: CATEGORY,
  instruction: (o) =>
    o.task === 'components'
      ? 'Find the component form of each vector. Round to the nearest tenth when needed.'
      : o.task === 'magdir'
        ? 'Find the magnitude and direction angle of each vector. Round angles to the nearest tenth of a degree.'
        : 'Answer as indicated. Round to the nearest tenth when needed.',
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
        { value: 'magdir', label: 'Magnitude and direction angle' },
        { value: 'components', label: 'Component form from magnitude and direction' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const t = strOpt(ctx, 'task');
    const task = t === 'magdir' || t === 'components' ? t : rng.pick(['magdir', 'components'] as const);

    if (task === 'magdir') {
      const [x, y] = attempt('vector', () => {
        const R = difficulty === 'easy' ? 9 : difficulty === 'medium' ? 12 : 20;
        const v = [rng.signedInt(1, R, difficulty !== 'easy'), rng.signedInt(1, R, true)];
        if (difficulty === 'easy' && v[0]! < 0 && v[1]! < 0) return null;
        return v as [number, number];
      });
      const n2 = x * x + y * y;
      const mag = isPerfectSquare(n2) ? `= ${Math.round(Math.sqrt(n2))}` : `= ${sqrtTex(n2)}`;
      const dir = direction(x, y);
      const ref = (Math.atan(Math.abs(y / x)) * 180) / Math.PI;
      const angTex = (d: number) => `\\theta ${Math.abs(roundTo(d, 1) - d) > 1e-9 ? '\\approx' : '='} ${decimal(d)}^\\circ`;
      const fmt = (magTex: string, d: number) => `${m(`${NORM} ${magTex}`)}, ${m(angTex(d))}`;
      const answer = fmt(mag, dir);
      const wrongMag = `= ${sqrtTex(Math.abs(x * x - y * y) || 2)}`;
      return {
        question: `${m(`\\mathbf{v} = ${vecTex(String(x), String(y))}`)}`,
        answer,
        steps: [
          m(`${NORM} = \\sqrt{(${x})^{2} + (${y})^{2}} = \\sqrt{${n2}}${isPerfectSquare(n2) ? ` = ${Math.round(Math.sqrt(n2))}` : sqrtTex(n2) === `\\sqrt{${n2}}` ? '' : ` = ${sqrtTex(n2)}`}`),
          m(`\\tan \\theta' = \\left|\\frac{${y}}{${x}}\\right| \\Rightarrow \\theta' ${Math.abs(roundTo(ref, 1) - ref) > 1e-9 ? '\\approx' : '='} ${decimal(ref)}^\\circ`),
          `The vector points into Quadrant ${x > 0 ? (y > 0 ? 'I' : 'IV') : y > 0 ? 'II' : 'III'}, so ${m(angTex(dir))}.`,
        ],
        distractors: distinctDistractors(answer, [fmt(mag, ref), fmt(mag, direction(y, x)), fmt(wrongMag, dir), fmt(mag, (dir + 180) % 360)], (k) => fmt(mag, (dir + 10 * k) % 360)),
        check: { kind: 'trigonometry.vecMagDir', task },
      };
    }

    // components from magnitude and direction
    const special = difficulty !== 'hard' && (difficulty === 'easy' || rng.bool());
    const mag = rng.int(2, difficulty === 'easy' ? 12 : 30);
    const deg = special ? rng.pick([30, 45, 60, 120, 135, 150, 210, 225, 240, 300, 315, 330]) : attempt('angle', () => {
      const d = rng.int(5, 355);
      return d % 15 === 0 ? null : d;
    });
    let answer: string;
    let alt: (dx: number, dy: number) => string;
    let comps: [string, string];
    if (special) {
      const cx = cosExact(deg).scale(mag);
      const cy = sinExact(deg).scale(mag);
      comps = [cx.toTex(), cy.toTex()];
      answer = m(`\\mathbf{v} = ${vecTex(comps[0], comps[1])}`);
      // swapped / sign errors, built exactly
      const ex = (a: Exact, b: Exact) => m(`\\mathbf{v} = ${vecTex(a.toTex(), b.toTex())}`);
      alt = (dx, dy) => ex(cx.add(Exact.of(dx)), cy.add(Exact.of(dy)));
      const cands = [ex(cy, cx), ex(cx.neg(), cy), ex(cx, cy.neg()), ex(cx.neg(), cy.neg())];
      return {
        question: `${m(`${NORM} = ${mag}`)}, direction angle ${m(`\\theta = ${deg}^\\circ`)}`,
        answer,
        steps: [m(`\\mathbf{v} = \\left\\langle ${mag}\\cos ${deg}^\\circ, ${mag}\\sin ${deg}^\\circ \\right\\rangle = ${vecTex(comps[0], comps[1])}`)],
        distractors: distinctDistractors(answer, cands, (k) => alt(offset(k), 0)),
        check: { kind: 'trigonometry.vecMagDir', task },
      };
    }
    const r = (Math.PI * deg) / 180;
    const vx = mag * Math.cos(r);
    const vy = mag * Math.sin(r);
    const fmtA = (a: number, b: number) => m(`\\mathbf{v} \\approx ${vecTex(decimal(a), decimal(b))}`);
    answer = fmtA(vx, vy);
    return {
      question: `${m(`${NORM} = ${mag}`)}, direction angle ${m(`\\theta = ${deg}^\\circ`)}`,
      answer,
      steps: [m(`\\mathbf{v} = \\left\\langle ${mag}\\cos ${deg}^\\circ, ${mag}\\sin ${deg}^\\circ \\right\\rangle \\approx ${vecTex(decimal(vx), decimal(vy))}`)],
      distractors: distinctDistractors(answer, [fmtA(vy, vx), fmtA(-vx, vy), fmtA(vx, -vy), fmtA(mag * Math.cos(deg), mag * Math.sin(deg))], (k) => fmtA(vx + offset(k), vy)),
      check: { kind: 'trigonometry.vecMagDir', task },
    };
  },
});
