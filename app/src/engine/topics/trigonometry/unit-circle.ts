/** The unit circle: coordinates for an angle, angles for coordinates, and reading sin / cos / tan. */
import { DiagramBuilder, dirDeg, mul, type Diagram } from '../../diagram';
import { attempt, boolOpt, defineTopic, distinctDistractors, strOpt } from '../../generator';
import type { Rng } from '../../rng';
import { m } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import { pickUnit, unitsOpt } from './angles';
import { angleTex, cosExact, Exact, mod360, sinExact, type AngleUnit } from './exact';

const SPECIAL = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330];

/** Plain-text friendly label for a special coordinate: `-\sqrt{3}/2`, `1/2`, `0`. */
function plainCoord(e: Exact): string {
  return e.toTex().replace(/\\frac\{([^{}]*(?:\{\d+\}[^{}]*)?)\}\{(\d+)\}/, '$1/$2');
}

const tupleTex = (x: Exact, y: Exact) => `\\left(${x.toTex()}, ${y.toTex()}\\right)`;

function circleFigure(o: { deg?: number; point?: boolean; pointLabel?: string; vline?: number; hline?: number }, alt: string): Diagram {
  const b = new DiagramBuilder(70);
  const R = 1.35;
  b.arrow([-R, 0], [R, 0], { both: true, ink: 'axis', weight: 1 });
  b.arrow([0, -R], [0, R], { both: true, ink: 'axis', weight: 1 });
  b.label([R, 0], 'x', 'e', { ink: 'axis' });
  b.label([0, R], 'y', 'n', { ink: 'axis' });
  b.circle([0, 0], 1, { weight: 1.2 });
  b.label([1, 0], '1', 'se', { ink: 'muted', small: true });
  b.label([0, 1], '1', 'nw', { ink: 'muted', small: true });
  b.label([-1, 0], '-1', 'sw', { ink: 'muted', small: true });
  b.label([0, -1], '-1', 'sw', { ink: 'muted', small: true });
  if (o.vline !== undefined) b.segment([o.vline, -1.2], [o.vline, 1.2], { dash: true, ink: 'accent', weight: 1 });
  if (o.hline !== undefined) b.segment([-1.2, o.hline], [1.2, o.hline], { dash: true, ink: 'accent', weight: 1 });
  if (o.deg !== undefined) {
    const P = dirDeg(o.deg);
    b.segment([0, 0], P, { ink: 'accent', weight: 1.4 });
    if (o.deg % 360 !== 0) {
      b.arc([0, 0], 0.22, 0, mod360(o.deg), 'ink', 1);
      b.label(mul(dirDeg(mod360(o.deg) / 2), 0.36), '\\theta', 'c', { small: true });
    }
    if (o.point) {
      b.dot(P, false, 'accent');
      if (o.pointLabel) b.label(mul(P, 1.08), o.pointLabel, P[0] >= 0 ? (P[1] >= 0 ? 'ne' : 'se') : P[1] >= 0 ? 'nw' : 'sw', { small: true });
    }
  }
  return b.build(alt);
}

function pickSpecial(rng: Rng, d: Difficulty, allowAxes: boolean): number {
  return attempt('unit circle angle', () => {
    const a = rng.pick(SPECIAL);
    if (!allowAxes && a % 90 === 0) return null;
    if (a % 90 === 0 && rng.bool(0.6)) return null;
    const turns = d === 'hard' ? rng.pick([-2, -1, 0, 1]) : d === 'medium' ? rng.pick([-1, 0, 0, 1]) : rng.pick([0, 0, 1, -1]);
    const deg = a + 360 * turns;
    return deg;
  });
}

export const unitCircle = defineTopic({
  id: 'trig.functions.unit-circle',
  subject: 'trigonometry',
  title: 'The Unit Circle',
  description: 'Coordinates of unit-circle points, the angles that give a coordinate, and reading sine, cosine and tangent off the unit circle.',
  category: 'Trigonometric Functions',
  instruction: (o) =>
    o.task === 'coords'
      ? 'Find the coordinates of the point on the unit circle for each angle.'
      : o.task === 'angles'
        ? o.units === 'deg'
          ? 'Find every angle θ with 0° ≤ θ < 360° that matches the given point or coordinate on the unit circle.'
          : o.units === 'rad'
            ? 'Find every angle θ with 0 ≤ θ < 2π that matches the given point or coordinate on the unit circle.'
            : 'Find every angle θ in one revolution (0° ≤ θ < 360°, or 0 ≤ θ < 2π) that matches the given point or coordinate.'
        : o.task === 'read'
          ? 'Use the unit circle to find sin θ, cos θ and tan θ.'
          : 'Use the unit circle to answer each question.',
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Task',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'coords', label: 'Coordinates for an angle' },
        { value: 'angles', label: 'Angles for coordinates' },
        { value: 'read', label: 'Read sin, cos and tan' },
      ],
    },
    unitsOpt('rad'),
    { type: 'boolean', id: 'figure', label: 'Show a unit-circle figure', default: true },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const t = strOpt(ctx, 'task');
    const task = t === 'coords' || t === 'angles' || t === 'read' ? t : rng.pick(['coords', 'angles', 'read'] as const);
    const unit: AngleUnit = pickUnit(ctx);
    const fig = boolOpt(ctx, 'figure');
    const A = (d: number) => angleTex(d, unit);

    if (task === 'coords') {
      const deg = pickSpecial(rng, difficulty, true);
      const x = cosExact(deg);
      const y = sinExact(deg);
      const answer = m(tupleTex(x, y));
      const a = mod360(deg);
      return {
        question: `${m(`\\theta = ${A(deg)}`)}`,
        answer,
        steps: [
          ...(a !== deg ? [`Coterminal angle: ${m(A(a))}.`] : []),
          m(`(\\cos \\theta, \\sin \\theta) = ${tupleTex(x, y)}`),
        ],
        distractors: distinctDistractors(answer, [m(tupleTex(y, x)), m(tupleTex(x.neg(), y)), m(tupleTex(x, y.neg())), m(tupleTex(x.neg(), y.neg()))], (k) => m(tupleTex(cosExact(deg + 30 * k), sinExact(deg + 30 * k)))),
        diagram: fig ? circleFigure({ deg, point: true, pointLabel: 'P' }, `Unit circle with the terminal side of theta = ${deg} degrees`) : undefined,
        check: { kind: 'trigonometry.unitcircle', task },
      };
    }

    const fmtAngles = (list: number[]) => m(`\\theta = ${[...new Set(list.map(mod360))].sort((p, q) => p - q).map(A).join(', ')}`);

    if (task === 'angles') {
      const usePoint = rng.bool(difficulty === 'easy' ? 0.5 : 0.4);
      const a = attempt('angles', () => {
        const x = rng.pick(SPECIAL);
        return x % 90 === 0 && rng.bool(0.7) ? null : x;
      });
      const x = cosExact(a);
      const y = sinExact(a);
      if (usePoint) {
        const answer = fmtAngles([a]);
        return {
          question: `The point ${m(`P${tupleTex(x, y)}`)} is on the unit circle.`,
          answer,
          steps: [m(`\\cos \\theta = ${x.toTex()}, \\; \\sin \\theta = ${y.toTex()}`), `Both coordinates fix one angle: ${answer}.`],
          distractors: distinctDistractors(answer, [fmtAngles([90 - a]), fmtAngles([180 - a]), fmtAngles([-a]), fmtAngles([a + 180])], (k) => fmtAngles([a + 15 * k])),
          diagram: fig ? circleFigure({ deg: a, point: true, pointLabel: `(${plainCoord(x)}, ${plainCoord(y)})` }, 'Unit circle with a marked point') : undefined,
          check: { kind: 'trigonometry.unitcircle', task },
        };
      }
      const useX = rng.bool();
      const c = useX ? x : y;
      const sols = useX ? [a, -a] : [a, 180 - a];
      const answer = fmtAngles(sols);
      const other = useX ? [90 - a, 90 + a] : [90 - a, 270 + a];
      return {
        question: `The point on the unit circle has ${m(`${useX ? 'x' : 'y'} = ${c.toTex()}`)}.`,
        answer,
        steps: [m(`${useX ? '\\cos' : '\\sin'} \\theta = ${c.toTex()}`), `Solutions in one turn: ${answer}.`],
        distractors: distinctDistractors(answer, [fmtAngles([a]), fmtAngles(other), fmtAngles(sols.map((s) => s + 180)), fmtAngles(useX ? [180 - a, 180 + a] : [-a, 180 + a])], (k) => fmtAngles(sols.map((s) => s + 15 * k))),
        diagram: fig ? circleFigure(useX ? { vline: c.value } : { hline: c.value }, `Unit circle with the line ${useX ? 'x' : 'y'} = ${c.value.toFixed(3)}`) : undefined,
        check: { kind: 'trigonometry.unitcircle', task },
      };
    }

    // read sin, cos, tan off the unit circle
    const deg = pickSpecial(rng, difficulty, false);
    const x = cosExact(deg);
    const y = sinExact(deg);
    const tn = y.div(x);
    const fmt = (s: Exact, c: Exact, t2: Exact) => [m(`\\sin \\theta = ${s.toTex()}`), m(`\\cos \\theta = ${c.toTex()}`), m(`\\tan \\theta = ${t2.toTex()}`)].join(', ');
    const where = `The terminal side of ${m('\\theta')} meets the unit circle at ${m(`P${tupleTex(x, y)}`)}.`;
    const all = rng.bool(0.4);
    if (!all) {
      const VALS: Record<string, [Exact, string]> = {
        sin: [y, 'y'],
        cos: [x, 'x'],
        tan: [tn, '\\frac{y}{x}'],
        csc: [Exact.ONE.div(y), '\\frac{1}{y}'],
        sec: [Exact.ONE.div(x), '\\frac{1}{x}'],
        cot: [x.div(y), '\\frac{x}{y}'],
      };
      const fn = rng.pick(Object.keys(VALS));
      const [v, def] = VALS[fn]!;
      const one = (e: Exact) => m(`\\${fn} \\theta = ${e.toTex()}`);
      const answer = one(v);
      const recip = { sin: 'csc', cos: 'sec', tan: 'cot', csc: 'sin', sec: 'cos', cot: 'tan' }[fn]!;
      const co = { sin: 'cos', cos: 'sin', tan: 'cot', cot: 'tan', sec: 'csc', csc: 'sec' }[fn]!;
      return {
        question: `${where} Find ${m(`\\${fn} \\theta`)}.`,
        answer,
        steps: [m(`\\${fn} \\theta = ${def} = ${v.toTex()}`)],
        distractors: distinctDistractors(answer, [one(VALS[recip]![0]), one(VALS[co]![0]), one(v.neg()), one(VALS[co]![0].neg())], (k) => one(v.add(Exact.of(k)))),
        diagram: fig ? circleFigure({ deg, point: true, pointLabel: `(${plainCoord(x)}, ${plainCoord(y)})` }, 'Unit circle with the point P') : undefined,
        check: { kind: 'trigonometry.unitcircle', task },
      };
    }
    const answer = fmt(y, x, tn);
    return {
      question: `${where} Find ${m('\\sin \\theta')}, ${m('\\cos \\theta')} and ${m('\\tan \\theta')}.`,
      answer,
      steps: [m(`\\sin \\theta = y = ${y.toTex()}`), m(`\\cos \\theta = x = ${x.toTex()}`), m(`\\tan \\theta = \\frac{y}{x} = ${tn.toTex()}`)],
      distractors: distinctDistractors(answer, [fmt(x, y, x.div(y)), fmt(y, x, x.div(y)), fmt(y.neg(), x, tn.neg()), fmt(y, x.neg(), tn.neg())], (k) => fmt(y, x, tn.add(Exact.of(k)))),
      diagram: fig ? circleFigure({ deg, point: true, pointLabel: `(${plainCoord(x)}, ${plainCoord(y)})` }, 'Unit circle with the point P') : undefined,
      check: { kind: 'trigonometry.unitcircle', task },
    };
  },
});
